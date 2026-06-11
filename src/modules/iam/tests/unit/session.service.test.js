import { describe, test, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../../../../infrastructure/prisma.js';
import { upsertSession, getSession, destroySession } from '../../services/session.service.js';
import { hashToken } from '../../services/token.service.js';

vi.mock('../../../../infrastructure/prisma.js', () => ({
  prisma: {
    session: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe('Session Service', () => {
  const userId = 'user-1';
  const refreshToken = 'some-token';
  const deviceId = 'device-123';
  const expiresAt = new Date(Date.now() + 10000);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('upsertSession', () => {
    test('U-SS-01: should hash token and upsert session for single device policy', async () => {
      const mockSession = { id: 'session-1', userId, deviceId };
      prisma.session.upsert.mockResolvedValue(mockSession);

      const result = await upsertSession(userId, refreshToken, deviceId, expiresAt);

      expect(prisma.session.upsert).toHaveBeenCalledWith({
        where: { userId },
        update: expect.objectContaining({ deviceId, expiresAt }),
        create: expect.objectContaining({ userId, deviceId, expiresAt }),
      });
      // Verify hash was generated and passed
      const hash = hashToken(refreshToken);
      expect(prisma.session.upsert.mock.calls[0][0].update.refreshTokenHash).toBe(hash);
      expect(result).toEqual(mockSession);
    });
  });

  describe('getSession', () => {
    test('U-SS-02: should return session if valid and device matches', async () => {
      const mockSession = { id: 's1', userId, deviceId, expiresAt: new Date('2030-01-01') };
      prisma.session.findUnique.mockResolvedValue(mockSession);

      const result = await getSession(userId, deviceId);
      expect(result).toEqual(mockSession);
    });

    test('U-SS-03: should return null if device ID mismatch (compromised/superseded session)', async () => {
      const mockSession = { id: 's1', userId, deviceId: 'different-device', expiresAt: new Date('2030-01-01') };
      prisma.session.findUnique.mockResolvedValue(mockSession);

      const result = await getSession(userId, deviceId);
      expect(result).toBeNull();
    });

    test('U-SS-04: should destroy session and return null if expired', async () => {
      const mockSession = { id: 's1', userId, deviceId, expiresAt: new Date('2000-01-01') };
      prisma.session.findUnique.mockResolvedValue(mockSession);
      prisma.session.delete.mockResolvedValue({});

      const result = await getSession(userId, deviceId);
      expect(result).toBeNull();
      expect(prisma.session.delete).toHaveBeenCalledWith({ where: { userId } });
    });
  });

  describe('destroySession', () => {
    test('U-SS-05: should delete session', async () => {
      prisma.session.delete.mockResolvedValue({});
      await destroySession(userId);
      expect(prisma.session.delete).toHaveBeenCalledWith({ where: { userId } });
    });

    test('U-SS-06: should ignore P2025 error (Record not found)', async () => {
      const error = new Error();
      error.code = 'P2025';
      prisma.session.delete.mockRejectedValue(error);

      await expect(destroySession(userId)).resolves.toBeUndefined();
    });

    test('U-SS-07: should throw other errors', async () => {
      const error = new Error('Database down');
      prisma.session.delete.mockRejectedValue(error);

      await expect(destroySession(userId)).rejects.toThrow('Database down');
    });
  });
});
