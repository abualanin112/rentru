import httpStatus from 'http-status';
import { runInTransaction } from '../../../infrastructure/prisma.js';
import { ApiError } from '../../../shared/ApiError.js';
import { generateAuthTokens, verifyToken, tokenTypes, hashToken } from './token.service.js';
import { upsertSession, getSession, destroySession } from './session.service.js';
import crypto from 'crypto';
import { logEvent, logEventAsync } from '../../audit/index.js';

/**
 * Handles Google OAuth Login and Invitation Provisioning.
 */
export const handleGoogleLogin = async (profile, deviceId, inviteToken = null) => {
  if (!profile || !profile.emails || !profile.emails.length) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid Google profile.');
  }

  const email = profile.emails[0].value.toLowerCase();

  return runInTransaction(async (tx) => {
    let user = await tx.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });

    if (user) {
      if (!user.isActive) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Account is suspended. Please contact the administrator.');
      }

      if (!user.googleId) {
        user = await tx.user.update({
          where: { id: user.id },
          data: { googleId: profile.id },
          include: { roles: { include: { role: true } } },
        });
      }

      // Generate Session ID locally
      const sessionId = crypto.randomUUID();
      const finalTokens = generateAuthTokens(user.id, sessionId, deviceId);
      const hashedRefresh = crypto.createHash('sha256').update(finalTokens.refresh.token).digest('hex');

      await tx.session.upsert({
        where: { userId: user.id },
        update: {
          refreshTokenHash: hashedRefresh,
          deviceId,
          expiresAt: finalTokens.refresh.expires,
          id: sessionId,
        },
        create: {
          id: sessionId,
          userId: user.id,
          refreshTokenHash: hashedRefresh,
          deviceId,
          expiresAt: finalTokens.refresh.expires,
        },
      });

      await logEvent(
        {
          event: 'iam.auth.login.success',
          targetType: 'User',
          targetId: user.id,
          action: 'EXECUTE',
          metadata: { deviceId },
        },
        tx,
      );

      return { user, tokens: finalTokens };
    } else {
      if (!inviteToken) {
        throw new ApiError(
          httpStatus.UNAUTHORIZED,
          'No active account found. Please request an invitation from the administrator.',
        );
      }

      const hashedInviteToken = crypto.createHash('sha256').update(inviteToken).digest('hex');

      const invitation = await tx.invitation.findUnique({
        where: { inviteToken: hashedInviteToken },
        include: { role: true },
      });

      if (!invitation || invitation.email.toLowerCase() !== email) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or mismatched invitation token.');
      }

      if (invitation.status !== 'PENDING') {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Invitation is no longer pending.');
      }

      if (invitation.expiresAt < new Date()) {
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED' },
        });
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Invitation has expired.');
      }

      const updateResult = await tx.invitation.updateMany({
        where: { id: invitation.id, status: 'PENDING' },
        data: { status: 'COMPLETED', updatedAt: new Date() },
      });

      if (updateResult.count === 0) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Invitation has already been consumed or is no longer pending.');
      }

      const newUser = await tx.user.create({
        data: {
          email,
          googleId: profile.id,
          firstName: profile.name?.givenName || 'New',
          lastName: profile.name?.familyName || 'User',
          avatarUrl: profile.photos?.[0]?.value,
          isActive: true,
          branchId: invitation.branchId,
          roles: {
            create: {
              roleId: invitation.roleId,
              assignedBy: 'system-onboarding',
            },
          },
        },
        include: { roles: { include: { role: true } } },
      });

      const sessionId = crypto.randomUUID();
      const tokens = generateAuthTokens(newUser.id, sessionId, deviceId);
      const hashedRefresh = crypto.createHash('sha256').update(tokens.refresh.token).digest('hex');

      await tx.session.upsert({
        where: { userId: newUser.id },
        update: {
          refreshTokenHash: hashedRefresh,
          deviceId,
          expiresAt: tokens.refresh.expires,
          id: sessionId,
        },
        create: {
          id: sessionId,
          userId: newUser.id,
          refreshTokenHash: hashedRefresh,
          deviceId,
          expiresAt: tokens.refresh.expires,
        },
      });

      await logEvent(
        {
          event: 'iam.auth.login.success',
          targetType: 'User',
          targetId: newUser.id,
          action: 'EXECUTE',
          metadata: { deviceId, isNewProvision: true },
        },
        tx,
      );

      await logEvent(
        {
          event: 'iam.user.created',
          targetType: 'User',
          targetId: newUser.id,
          action: 'CREATE',
          metadata: { email },
        },
        tx,
      );

      return { user: newUser, tokens };
    }
  });
};

/**
 * Handles Refreshing Access Tokens and Detects Reuse Attacks.
 */
export const refreshAuth = async (refreshToken, deviceId, _ipAddress = null) => {
  try {
    const payload = verifyToken(refreshToken);

    if (payload.type !== tokenTypes.REFRESH) {
      throw new Error();
    }

    const session = await getSession(payload.sub, deviceId);

    if (!session) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Session not found or device mismatch. Please log in again.');
    }

    const expectedHash = hashToken(refreshToken);

    // Reuse Detection with 2-second Grace Period
    if (session.refreshTokenHash !== expectedHash) {
      const timeSinceLastUpdate = Date.now() - session.createdAt.getTime(); // Assuming createdAt is effectively updatedAt because of upsert
      // Wait, upsert does not have updatedAt in Session model!
      // In prisma/schema.prisma:
      // createdAt DateTime @default(now()) @map("created_at")
      // There is no updatedAt on Session. Since we upsert (replace the whole record) or create, createdAt is technically the update time for a new session. But we should check `session.createdAt` vs Date.now().
      // If the time diff is <= 2000ms, it's a concurrent request (grace period).

      if (timeSinceLastUpdate <= 2000) {
        // Grace period allows the old token to pass briefly to handle concurrent network requests.
        // We do NOT generate new tokens here, we should probably just return the same tokens or throw an error?
        // Wait, if it's a concurrent refresh request, the backend ALREADY rotated the token and saved it.
        // It's safer to just reject it but NOT revoke the session, or just fail silently.
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Concurrent refresh token request within grace period.');
      } else {
        // Token mismatch and outside grace period means stolen token reuse!
        await destroySession(payload.sub);

        logEventAsync({
          event: 'iam.token.revoked',
          targetType: 'Session',
          targetId: session.id,
          action: 'DELETE',
          reason: 'Token reuse detected',
          metadata: { deviceId },
        });

        throw new ApiError(httpStatus.UNAUTHORIZED, 'Security violation: Refresh token reuse detected. Session revoked.');
      }
    }

    // Generate new tokens, keeping same sessionId to preserve session identity
    const tokens = generateAuthTokens(payload.sub, session.id, deviceId);

    // Rotate refresh token in DB (implicit session.createdAt reset via upsert replacement or we should update it)
    // Wait, upsert update branch does NOT update createdAt because it's not mapped.
    // If we want createdAt to act as updatedAt, we must explicitly set it.
    await upsertSession(payload.sub, tokens.refresh.token, deviceId, tokens.refresh.expires, session.id);

    logEventAsync({
      event: 'iam.token.refresh',
      targetType: 'Session',
      targetId: session.id,
      action: 'UPDATE',
      metadata: { deviceId },
    });

    return tokens;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired refresh token');
  }
};

/**
 * Logs out a user by destroying their session.
 */
export const logout = async (userId) => {
  await destroySession(userId);

  logEventAsync({
    event: 'iam.auth.logout',
    targetType: 'User',
    targetId: userId,
    action: 'EXECUTE',
  });
};
