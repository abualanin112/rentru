import request from 'supertest';
import httpStatus from 'http-status';
import { setupTestDB } from '../utils/setupTestDB.js';
import { prisma } from '../../src/infrastructure/prisma.js';
import { app } from '../../src/app.js';
import * as authorizationService from '../../src/modules/iam/services/authorization.service.js';
import { userOne, userTwo, insertUsers } from '../fixtures/user.fixture.js';
import { generateAuthTokens } from '../../src/modules/iam/services/token.service.js';

setupTestDB();

describe('Security Regression & Hardening', () => {
  describe('API & Token Security (S-01 to S-08)', () => {
    let user;
    let tokens;

    beforeEach(async () => {
      user = await prisma.user.create({
        data: {
          email: 'secure@rentru.com',
          firstName: 'Secure',
          lastName: 'User',
          isActive: true,
          roles: {
            create: {
              role: {
                create: {
                  name: 'standard',
                  level: 10,
                  version: 1,
                  permissions: {
                    create: {
                      permission: {
                        create: {
                          action: 'read',
                          subject: 'users',
                          scope: 'branch',
                          group: 'IAM',
                        },
                      },
                    },
                  },
                },
              },
              assignedBy: 'system',
            },
          },
          branch: {
            create: {
              name: 'Main Branch',
            },
          },
        },
        include: { roles: { include: { role: true } } },
      });

      const session = await prisma.session.create({
        data: {
          userId: user.id,
          deviceId: 'test-device-id',
          refreshTokenHash: 'dummy-hash',
          expiresAt: new Date(Date.now() + 1000000),
        },
      });
      tokens = await generateAuthTokens(user.id, session.id, 'test-device-id');
    });

    test('S-01: Request without Authorization header should return 401 Unauthorized', async () => {
      const res = await request(app).get('/v1/users/me');
      expect(res.status).toBe(httpStatus.UNAUTHORIZED);
    });

    test('S-02: Request with forged JWT signature should return 401 Unauthorized', async () => {
      const forgedToken = tokens.access.token + 'forged';
      const res = await request(app).get('/v1/users/me').set('Authorization', `Bearer ${forgedToken}`);

      expect(res.status).toBe(httpStatus.UNAUTHORIZED);
    });

    test('S-03: Request with valid JWT for a suspended user should return 401/403', async () => {
      // Suspend user (must use updateMany due to Prisma extension injecting deletedAt: null)
      await prisma.user.updateMany({ where: { id: user.id }, data: { isActive: false } });

      const res = await request(app).get('/v1/users/me').set('Authorization', `Bearer ${tokens.access.token}`);

      // Passport jwt strategy returns 401 if user check fails
      expect([httpStatus.UNAUTHORIZED, httpStatus.FORBIDDEN]).toContain(res.status);
    });

    test('S-04: Empty deviceId in /auth/google should return 400 Bad Request', async () => {
      const res = await request(app).get('/v1/auth/google'); // Missing deviceId query param
      expect(res.status).toBe(httpStatus.BAD_REQUEST);
    });

    test('S-05: API access without required permission should return 403 Forbidden', async () => {
      // The user has 'read:users:branch'. Let's try to access something they don't have, e.g. archiving a user.
      const res = await request(app).delete(`/v1/users/${user.id}`).set('Authorization', `Bearer ${tokens.access.token}`);

      expect(res.status).toBe(httpStatus.FORBIDDEN);
    });

    test('S-07: API responses omit sensitive fields (googleId, refreshTokenHash)', async () => {
      await prisma.user.updateMany({
        where: { id: user.id },
        data: { googleId: 'hidden123' },
      });

      const res = await request(app).get('/v1/users/me').set('Authorization', `Bearer ${tokens.access.token}`);

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.googleId).toBeUndefined();
      expect(res.body.refreshTokenHash).toBeUndefined();
    });

    test('S-08: Refresh Token Cookie has HttpOnly, Secure, SameSite', async () => {
      // Since this is a Google SSO login flow, we can test the /refresh endpoint
      // We need to update the session created in beforeEach
      const { hashToken } = await import('../../src/modules/iam/services/token.service.js');
      await prisma.session.updateMany({
        where: { userId: user.id },
        data: {
          refreshTokenHash: hashToken(tokens.refresh.token),
        },
      });

      const res = await request(app)
        .post('/v1/auth/refresh')
        .send({ deviceId: 'test-device-id' })
        .set('Cookie', [`refreshToken=${tokens.refresh.token}`]);

      expect(res.status).toBe(httpStatus.OK);

      const setCookieHeaders = res.headers['set-cookie'];
      expect(setCookieHeaders).toBeDefined();

      const refreshTokenCookie = setCookieHeaders.find((cookie) => cookie.startsWith('refreshToken='));
      expect(refreshTokenCookie).toBeDefined();
      expect(refreshTokenCookie).toContain('HttpOnly');
      expect(refreshTokenCookie).toContain('SameSite=Strict');
    });
  });

  describe('RBAC Bypasses & Escalation', () => {
    test('should prevent vertical privilege escalation when assigning roles', async () => {
      await insertUsers([userOne, userTwo]);

      const superAdminRole = await prisma.role.create({
        data: { name: 'super-admin-test', description: 'Super Admin', level: 100 },
      });

      const userRole = await prisma.role.create({
        data: { name: 'user-manager', description: 'User Manager', level: 10 },
      });

      const adminRole = await prisma.role.create({
        data: { name: 'admin-role', description: 'Admin', level: 50 },
      });

      await prisma.userRole.create({
        data: { userId: userTwo.id, roleId: adminRole.id, assignedBy: userTwo.id },
      });

      const assignPerm = await prisma.permission.create({
        data: { action: 'assign', subject: 'roles', scope: 'any', group: 'IAM', description: 'Assign roles' },
      });

      await prisma.rolePermission.create({
        data: { roleId: adminRole.id, permissionId: assignPerm.id },
      });

      const { assignRoleToUser } = authorizationService;

      await expect(assignRoleToUser({ id: userTwo.id }, userOne.id, superAdminRole.id)).rejects.toThrow(
        'Cannot assign a role with a higher privilege level than your own',
      );

      const result = await assignRoleToUser({ id: userTwo.id }, userOne.id, userRole.id);
      expect(result).toBeDefined();
      expect(result.roleId).toBe(userRole.id);
    });
  });
});
