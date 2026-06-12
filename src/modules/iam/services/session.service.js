import { prisma } from '../../../infrastructure/prisma.js';
import { hashToken } from './token.service.js';

/**
 * Creates or updates a session. Enforces Strict Single Device Policy
 * by upserting based on userId. The old session is implicitly destroyed.
 */
export const upsertSession = async (userId, refreshToken, deviceId, expiresAt, sessionId = undefined) => {
  const refreshTokenHash = hashToken(refreshToken);

  const session = await prisma.session.upsert({
    where: { userId },
    update: {
      id: sessionId, // In case we want to rotate the sessionId on refresh, though usually it stays the same
      refreshTokenHash,
      deviceId,
      expiresAt,
      createdAt: new Date(),
    },
    create: {
      id: sessionId,
      userId,
      refreshTokenHash,
      deviceId,
      expiresAt,
    },
  });

  return session;
};

/**
 * Retrieves an active session for validation.
 * Must match the user and device ID.
 */
export const getSession = async (userId, deviceId) => {
  const session = await prisma.session.findUnique({
    where: { userId },
  });

  if (!session) {
    return null;
  }

  if (deviceId && session.deviceId !== deviceId) {
    return null;
  }

  if (session.expiresAt < new Date()) {
    await destroySession(userId);
    return null;
  }

  return session;
};

/**
 * Destroys a user's session (Logout or Kill-Switch).
 */
export const destroySession = async (userId) => {
  await prisma.session.deleteMany({
    where: { userId },
  });
};
