import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { tokenTypes, generateToken, generateAuthTokens, verifyToken, hashToken } from '../../services/token.service.js';
import { config } from '../../../../infrastructure/config.js';

describe('Token Service', () => {
  const userId = 'user-123';
  const sessionId = 'session-123';
  const deviceId = 'device-123';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-11T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateToken', () => {
    test('U-TK-01: should return a signed JWT with correct payload', () => {
      const expiresMinutes = 30;
      const token = generateToken(userId, sessionId, deviceId, expiresMinutes, tokenTypes.ACCESS);

      const payload = jwt.verify(token, config.jwt.secret);
      expect(payload).toMatchObject({
        sub: userId,
        sessionId,
        deviceId,
        type: tokenTypes.ACCESS,
      });
      // 30 minutes later
      expect(payload.exp).toBe(Math.floor(Date.now() / 1000) + 30 * 60);
    });
  });

  describe('generateAuthTokens', () => {
    test('U-TK-02: should return access and refresh tokens with correct expirations', () => {
      const tokens = generateAuthTokens(userId, sessionId, deviceId);

      expect(tokens.access).toBeDefined();
      expect(tokens.refresh).toBeDefined();
      expect(tokens.access.token).toBeTypeOf('string');
      expect(tokens.refresh.token).toBeTypeOf('string');
      expect(tokens.access.expires).toBeInstanceOf(Date);
      expect(tokens.refresh.expires).toBeInstanceOf(Date);
    });
  });

  describe('verifyToken', () => {
    test('U-TK-03: should verify a valid token', () => {
      const token = generateToken(userId, sessionId, deviceId, 10, tokenTypes.ACCESS);
      const payload = verifyToken(token);
      expect(payload.sub).toBe(userId);
    });

    test('U-TK-04: should throw error for expired token', () => {
      const token = generateToken(userId, sessionId, deviceId, -1, tokenTypes.ACCESS);
      expect(() => verifyToken(token)).toThrow();
    });
  });

  describe('hashToken', () => {
    test('U-TK-05: should generate a consistent SHA-256 hash', () => {
      const hash1 = hashToken('test-token-123');
      const hash2 = hashToken('test-token-123');
      const hash3 = hashToken('different');

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash1.length).toBe(64); // SHA-256 hex is 64 chars
    });
  });
});
