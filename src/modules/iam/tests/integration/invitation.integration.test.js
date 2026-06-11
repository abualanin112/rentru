import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import httpStatus from 'http-status';
import { app } from '../../../../app.js';
import { prisma } from '../../../../infrastructure/prisma.js';
import { setupTestDB } from '../../../../../tests/utils/setupTestDB.js';
import { insertUsers, admin } from '../../../../../tests/fixtures/user.fixture.js';
import { generateAuthTokens } from '../../services/token.service.js';
import { upsertSession } from '../../services/session.service.js';
import crypto from 'node:crypto';

setupTestDB();

describe('Invitation Routes', () => {
  let superAdminToken;
  let superAdminRole;

  beforeEach(async () => {
    await insertUsers([admin]);
    const sessionId = crypto.randomUUID();
    const deviceId = 'test-device';
    const tokens = generateAuthTokens(admin.id, sessionId, deviceId);
    await upsertSession(admin.id, tokens.refresh.token, deviceId, tokens.refresh.expires, sessionId);
    superAdminToken = tokens.access.token;

    superAdminRole = await prisma.role.findUnique({ where: { name: 'super_admin' } });
  });

  describe('POST /v1/invitations', () => {
    it('should create an invitation and return 201', async () => {
      const res = await request(app)
        .post('/v1/invitations')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          email: 'newuser@test.com',
          roleId: superAdminRole.id,
        })
        .expect(httpStatus.CREATED);

      expect(res.body.email).toBe('newuser@test.com');
      expect(res.body.status).toBe('PENDING');

      const dbInvite = await prisma.invitation.findUnique({ where: { id: res.body.id } });
      expect(dbInvite).toBeDefined();
    });

    it('should return 400 if user already exists', async () => {
      await request(app)
        .post('/v1/invitations')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          email: admin.email,
          roleId: superAdminRole.id,
        })
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('DELETE /v1/invitations/:inviteId', () => {
    it('should revoke a pending invitation', async () => {
      const invite = await request(app).post('/v1/invitations').set('Authorization', `Bearer ${superAdminToken}`).send({
        email: 'revoke@test.com',
        roleId: superAdminRole.id,
      });

      await request(app)
        .delete(`/v1/invitations/${invite.body.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(httpStatus.NO_CONTENT);

      const dbInvite = await prisma.invitation.findUnique({ where: { id: invite.body.id } });
      expect(dbInvite).toBeDefined();
      expect(dbInvite.status).toBe('REVOKED');
    });
  });
});
