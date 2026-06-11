import request from 'supertest';
import httpStatus from 'http-status';
import { app } from '../../../../app.js';
import { prisma } from '../../../../infrastructure/prisma.js';
import { setupTestDB } from '../../../../../tests/utils/setupTestDB.js';
import { generateAuthTokens, hashToken } from '../../services/token.service.js';
import { upsertSession } from '../../services/session.service.js';

setupTestDB();

describe('Auth & Token Integration', () => {
  let user;

  beforeEach(async () => {
    // Because we need a user for refresh and logout tests
    user = await prisma.user.create({
      data: {
        email: 'test@rentru.com',
        googleId: '12345',
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
      },
    });
  });

  describe('I-AU-01: OAuth flow and state passing', () => {
    it('should pack deviceId into state and redirect to Google', async () => {
      const res = await request(app).get('/v1/auth/google?deviceId=my-test-device').expect(httpStatus.FOUND);

      expect(res.header.location).toContain('accounts.google.com');
      // State should be base64
      const url = new URL(res.header.location);
      const state = url.searchParams.get('state');
      expect(state).toBeDefined();
      const decodedStr = Buffer.from(state, 'base64url').toString('utf-8');
      const payload = JSON.parse(decodedStr);
      expect(payload.deviceId).toBe('my-test-device');
    });
  });

  describe('I-AU-02: Logout flow', () => {
    it('should destroy session and clear cookie', async () => {
      const tokens = generateAuthTokens(user.id, '123e4567-e89b-12d3-a456-426614174000', 'device-id');
      await upsertSession(
        user.id,
        tokens.refresh.token,
        'device-id',
        tokens.refresh.expires,
        '123e4567-e89b-12d3-a456-426614174000',
      );

      const res = await request(app)
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${tokens.access.token}`)
        .send({ deviceId: 'device-id' })
        .expect(httpStatus.NO_CONTENT);

      // Verify cookie is cleared
      const setCookie = res.header['set-cookie'][0];
      expect(setCookie).toMatch(/refreshToken=;/);

      // Verify session is destroyed in DB
      const session = await prisma.session.findUnique({ where: { userId: user.id } });
      expect(session).toBeNull();
    });
  });

  describe('I-TR-01: Refresh Token Rotation', () => {
    it('should issue new tokens and rotate session hash', async () => {
      const tokens = generateAuthTokens(user.id, '123e4567-e89b-12d3-a456-426614174000', 'device-id');
      await upsertSession(
        user.id,
        tokens.refresh.token,
        'device-id',
        tokens.refresh.expires,
        '123e4567-e89b-12d3-a456-426614174000',
      );

      const res = await request(app)
        .post('/v1/auth/refresh')
        .set('Cookie', `refreshToken=${tokens.refresh.token}`)
        .send({ deviceId: 'device-id' });

      expect(res.status).toBe(httpStatus.OK);

      expect(res.body.data.access).toBeDefined();

      const setCookie = res.header['set-cookie'][0];
      expect(setCookie).toMatch(/refreshToken=/);

      const newSession = await prisma.session.findUnique({ where: { userId: user.id } });
      expect(newSession.refreshTokenHash).not.toBe(hashToken(tokens.refresh.token));
    });
  });

  describe('I-TR-02: Refresh Token Reuse Detection', () => {
    it('should revoke session when an old stolen token is reused outside grace period', async () => {
      // Create session simulating it was created a while ago
      const oldTokens = generateAuthTokens(user.id, '123e4567-e89b-12d3-a456-426614174000', 'device-id');

      await prisma.session.create({
        data: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          userId: user.id,
          deviceId: 'device-id',
          refreshTokenHash: hashToken('new-active-refresh-token'), // It was already rotated!
          expiresAt: new Date(Date.now() + 100000),
          createdAt: new Date(Date.now() - 5000), // 5 seconds ago (outside 2s grace period)
        },
      });

      // Attacker tries to use oldTokens
      await request(app)
        .post('/v1/auth/refresh')
        .set('Cookie', `refreshToken=${oldTokens.refresh.token}`)
        .send({ deviceId: 'device-id' })
        .expect(httpStatus.UNAUTHORIZED);

      // Session should be destroyed (Kill-Switch)
      const session = await prisma.session.findUnique({ where: { userId: user.id } });
      expect(session).toBeNull();
    });

    it('should block concurrent refresh but NOT revoke session inside grace period', async () => {
      const oldTokens = generateAuthTokens(user.id, '123e4567-e89b-12d3-a456-426614174000', 'device-id');

      await prisma.session.create({
        data: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          userId: user.id,
          deviceId: 'device-id',
          refreshTokenHash: hashToken('new-active-refresh-token'),
          expiresAt: new Date(Date.now() + 100000),
          createdAt: new Date(Date.now() - 500), // 500ms ago (inside grace period)
        },
      });

      // Network latency / duplicate request tries to use oldTokens
      await request(app)
        .post('/v1/auth/refresh')
        .set('Cookie', `refreshToken=${oldTokens.refresh.token}`)
        .send({ deviceId: 'device-id' })
        .expect(httpStatus.UNAUTHORIZED); // The concurrent req gets 401, but the original succeeding req got the new tokens.

      // Session should NOT be destroyed!
      const session = await prisma.session.findUnique({ where: { userId: user.id } });
      expect(session).toBeDefined();
      expect(session).not.toBeNull();
    });
  });
});
