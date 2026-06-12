import request from 'supertest';
import httpStatus from 'http-status';
import { app } from '../../../../app.js';
import crypto from 'node:crypto';
import { setupTestDB } from '../../../../../tests/utils/setupTestDB.js';
import { insertUsers, admin } from '../../../../../tests/fixtures/user.fixture.js';
import { generateAuthTokens } from '../../../iam/services/token.service.js';
import { upsertSession } from '../../../iam/services/session.service.js';

setupTestDB();

describe('Audit Cursor Security & Validation (HTTP Integration)', () => {
  let adminAccessToken;

  beforeEach(async () => {
    await insertUsers([admin]);
    const adminSessionId = crypto.randomUUID();
    const adminTokens = generateAuthTokens(admin.id, adminSessionId, 'device-admin');
    await upsertSession(admin.id, adminTokens.refresh.token, 'device-admin', adminTokens.refresh.expires, adminSessionId);
    adminAccessToken = adminTokens.access.token;
  });
  describe('CURSOR-SEC-001: Invalid Base64 Cursor', () => {
    it('should return 400 Bad Request', async () => {
      const res = await request(app)
        .get('/v1/audit')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .query({ cursor: 'not-base-64-!!@@' })
        .send();

      expect(res.status).toBe(httpStatus.BAD_REQUEST);
    });
  });

  describe('CURSOR-SEC-002: Valid Base64 but invalid JSON', () => {
    it('should return 400 Bad Request', async () => {
      const invalidJsonBase64 = Buffer.from('{"id": "uuid-missing-brace').toString('base64');
      const res = await request(app)
        .get('/v1/audit')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .query({ cursor: invalidJsonBase64 })
        .send();

      expect(res.status).toBe(httpStatus.BAD_REQUEST);
    });
  });

  describe('CURSOR-SEC-003: Valid JSON but missing required tuple fields', () => {
    it('should return 400 Bad Request', async () => {
      const missingFieldsBase64 = Buffer.from(JSON.stringify({ id: '550e8400-e29b-41d4-a716-446655440000' })).toString(
        'base64',
      );
      const res = await request(app)
        .get('/v1/audit')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .query({ cursor: missingFieldsBase64 })
        .send();

      expect(res.status).toBe(httpStatus.BAD_REQUEST);
    });
  });

  describe('CURSOR-SEC-004: Valid structure but invalid UUID', () => {
    it('should return 400 Bad Request', async () => {
      const invalidUuidBase64 = Buffer.from(
        JSON.stringify({ id: 'not-a-uuid', createdAt: '2026-06-12T10:00:00Z' }),
      ).toString('base64');
      const res = await request(app)
        .get('/v1/audit')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .query({ cursor: invalidUuidBase64 })
        .send();

      expect(res.status).toBe(httpStatus.BAD_REQUEST);
    });
  });

  describe('CURSOR-SEC-005: Valid structure but empty string', () => {
    it('should return 400 Bad Request or bypass validation cleanly if not required', async () => {
      // Actually Zod might drop it if it's empty, but let's test a cursor that decodes to empty
      const emptyBase64 = Buffer.from('   ').toString('base64');
      const res = await request(app)
        .get('/v1/audit')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .query({ cursor: emptyBase64 })
        .send();

      expect(res.status).toBe(httpStatus.BAD_REQUEST);
    });
  });
});
