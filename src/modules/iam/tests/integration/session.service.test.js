import { describe, test, expect, beforeEach } from 'vitest';
import { prisma } from '../../../../infrastructure/prisma.js';
import { upsertSession, getSession, destroySession } from '../../services/session.service.js';
import { hashToken } from '../../services/token.service.js';
import { setupTestDB } from '../../../../../tests/utils/setupTestDB.js';
import { insertUsers, userOne } from '../../../../../tests/fixtures/user.fixture.js';

setupTestDB();

describe('Session Service (Integration)', () => {
  const deviceId = 'device-123';

  beforeEach(async () => {
    await insertUsers([userOne]);
  });

  describe('upsertSession', () => {
    test('should hash token and upsert session in DB', async () => {
      const refreshToken = 'some-token';
      const expiresAt = new Date(Date.now() + 10000);

      const result = await upsertSession(userOne.id, refreshToken, deviceId, expiresAt);

      expect(result.userId).toBe(userOne.id);
      expect(result.deviceId).toBe(deviceId);

      const dbSession = await prisma.session.findUnique({ where: { userId: userOne.id } });
      expect(dbSession.refreshTokenHash).toBe(hashToken(refreshToken));
    });
  });

  describe('getSession', () => {
    test('should return session if valid and device matches', async () => {
      const expiresAt = new Date(Date.now() + 10000);
      await upsertSession(userOne.id, 'token', deviceId, expiresAt);

      const result = await getSession(userOne.id, deviceId);
      expect(result).not.toBeNull();
      expect(result.deviceId).toBe(deviceId);
    });

    test('should return null if device ID mismatch', async () => {
      const expiresAt = new Date(Date.now() + 10000);
      await upsertSession(userOne.id, 'token', 'different-device', expiresAt);

      const result = await getSession(userOne.id, deviceId);
      expect(result).toBeNull();
    });

    test('should destroy session and return null if expired', async () => {
      const expiredAt = new Date(Date.now() - 10000); // Past
      // Manually insert expired session to bypass Prisma validation if necessary
      await prisma.session.create({
        data: {
          userId: userOne.id,
          deviceId: deviceId,
          refreshTokenHash: hashToken('token'),
          expiresAt: expiredAt,
        },
      });

      const result = await getSession(userOne.id, deviceId);
      expect(result).toBeNull();

      const dbSession = await prisma.session.findUnique({ where: { userId: userOne.id } });
      expect(dbSession).toBeNull();
    });
  });

  describe('destroySession', () => {
    test('should delete session', async () => {
      const expiresAt = new Date(Date.now() + 10000);
      await upsertSession(userOne.id, 'token', deviceId, expiresAt);

      await destroySession(userOne.id);

      const dbSession = await prisma.session.findUnique({ where: { userId: userOne.id } });
      expect(dbSession).toBeNull();
    });
  });
});
