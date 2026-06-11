import request from 'supertest';
import httpStatus from 'http-status';
import crypto from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../../../app.js';
import { prisma } from '../../../../infrastructure/prisma.js';
import { setupTestDB } from '../../../../../tests/utils/setupTestDB.js';
import { insertUsers, admin, userOne } from '../../../../../tests/fixtures/user.fixture.js';
import { generateAuthTokens } from '../../services/token.service.js';
import { upsertSession } from '../../services/session.service.js';

describe('Role Integration Tests', () => {
  setupTestDB();

  let adminAccessToken;
  let userAccessToken;

  beforeEach(async () => {
    await insertUsers([admin, userOne]);

    const adminSessionId = crypto.randomUUID();
    const adminTokens = generateAuthTokens(admin.id, adminSessionId, 'device-admin');
    await upsertSession(admin.id, adminTokens.refresh.token, 'device-admin', adminTokens.refresh.expires, adminSessionId);
    adminAccessToken = adminTokens.access.token;

    const userSessionId = crypto.randomUUID();
    const userTokens = generateAuthTokens(userOne.id, userSessionId, 'device-user');
    await upsertSession(userOne.id, userTokens.refresh.token, 'device-user', userTokens.refresh.expires, userSessionId);
    userAccessToken = userTokens.access.token;
  });

  describe('POST /v1/roles', () => {
    it('should create a role when super admin', async () => {
      const res = await request(app).post('/v1/roles').set('Authorization', `Bearer ${adminAccessToken}`).send({
        name: 'Manager',
        description: 'A manager role',
        level: 50,
      });

      expect(res.status).toBe(httpStatus.CREATED);

      expect(res.body.name).toBe('Manager');
      expect(res.body.level).toBe(50);
      expect(res.body.version).toBe(1);
    });

    it('should reject when user does not have permission', async () => {
      // userOne is a standard_user with level 10, no *:*:* or create:roles:any
      await request(app)
        .post('/v1/roles')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          name: 'HackerRole',
          level: 100,
        })
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('PATCH /v1/roles/:roleId', () => {
    let roleId;

    beforeEach(async () => {
      const role = await prisma.role.create({
        data: { name: 'Editor', level: 20 },
      });
      roleId = role.id;
    });

    it('should update a role', async () => {
      const res = await request(app)
        .patch(`/v1/roles/${roleId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ name: 'Senior Editor' });

      expect(res.status).toBe(httpStatus.OK);

      expect(res.body.name).toBe('Senior Editor');
    });
  });
});
