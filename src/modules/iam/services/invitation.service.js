import crypto from 'crypto';
import httpStatus from 'http-status';
import { prisma, runInTransaction } from '../../../infrastructure/prisma.js';
import { ApiError } from '../../../shared/ApiError.js';
import { paginate } from '../../../shared/Paginate.js';
import { enforcePrivilegeEscalationGuard } from './role.service.js';
import { logEvent } from '../../audit/index.js';
import { sendInviteEmail } from '../../../infrastructure/email/email.service.js';
import { hasPermission } from './permission.service.js';

export const createInvitation = async (actorId, { email, roleId, branchId }) => {
  const normalizedEmail = email.toLowerCase();

  // 1. Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User with this email already exists.');
  }

  // 2. Check if a valid invitation already exists
  const existingInvite = await prisma.invitation.findFirst({
    where: {
      email: normalizedEmail,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
  });

  if (existingInvite) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'A pending invitation already exists for this email.');
  }

  // 3. Verify actor's branch isolation
  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  if (!actor) throw new ApiError(httpStatus.UNAUTHORIZED, 'Actor not found');

  const isSuperAdmin = await hasPermission(actorId, '*:*:*');

  if (!isSuperAdmin) {
    // If not super admin, they must invite into their own branch
    if (actor.branchId !== branchId) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You can only invite users to your own branch.');
    }
  }

  // 4. Verify role exists and Actor has privilege to assign it
  const role = await prisma.role.findUnique({
    where: { id: roleId },
  });

  if (!role) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Target role does not exist.');
  }

  await enforcePrivilegeEscalationGuard(actorId, role.level);

  // 5. Create Invitation with hashed token
  const rawInviteToken = crypto.randomBytes(32).toString('hex');
  const hashedInviteToken = crypto.createHash('sha256').update(rawInviteToken).digest('hex');
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

  const invitation = await runInTransaction(async (tx) => {
    const newInvite = await tx.invitation.create({
      data: {
        email: normalizedEmail,
        inviteToken: hashedInviteToken,
        roleId,
        branchId,
        status: 'PENDING',
        expiresAt,
      },
      include: { role: true },
    });

    await logEvent(
      {
        event: 'invitation.created',
        entityType: 'Invitation',
        entityId: newInvite.id,
        actorId,
        action: 'CREATE',
        metadata: { email: normalizedEmail, roleId, branchId },
      },
      tx,
    );

    return newInvite;
  });

  // 6. Fire and forget email dispatch (sending the RAW token)
  const inviterName = actor ? `${actor.firstName} ${actor.lastName}` : 'An administrator';

  try {
    Promise.resolve()
      .then(() => sendInviteEmail(normalizedEmail, rawInviteToken, inviterName))
      .catch(() => {
        // Safe async catch
      });
  } catch {
    // Safe sync catch
  }

  return invitation;
};

export const getInvitations = async (filter, options) => {
  return paginate('invitation', filter, options);
};

export const revokeInvitation = async (actorId, invitationId) => {
  return runInTransaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({
      where: { id: invitationId },
      include: { role: true },
    });

    if (!invitation) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Invitation not found');
    }

    if (invitation.status !== 'PENDING') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Only pending invitations can be revoked');
    }

    // Check privilege escalation guard against the role associated with the invitation
    await enforcePrivilegeEscalationGuard(actorId, invitation.role.level);

    // Transition the invitation to REVOKED instead of deleting it to preserve audit trails
    const updateResult = await tx.invitation.updateMany({
      where: { id: invitationId, status: 'PENDING' },
      data: { status: 'REVOKED', updatedAt: new Date() },
    });

    if (updateResult.count === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Only pending invitations can be revoked');
    }

    await logEvent(
      {
        event: 'invitation.revoked',
        entityType: 'Invitation',
        entityId: invitationId,
        actorId,
        action: 'DELETE',
        metadata: { email: invitation.email },
      },
      tx,
    );

    invitation.status = 'REVOKED';
    return invitation;
  });
};
