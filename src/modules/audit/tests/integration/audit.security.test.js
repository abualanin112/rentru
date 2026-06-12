import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../../app.js';
import { prisma } from '../../../../infrastructure/prisma.js';
import { logEvent } from '../../audit.service.js';
import { als as asyncLocalStorage } from '../../../../infrastructure/als.js';
import { generateAuthTokens } from '../../../iam/services/token.service.js';

describe('Audit Security - Branch Isolation API', () => {
  let superAdminToken;
  let branchAAdminToken;
  let branchBAdminToken;

  let branchA;
  let branchB;
  let branchAAdmin;
  let branchBAdmin;

  const EVENT_TYPE = 'test.security.event';

  beforeAll(async () => {
    // 1. Create Branches
    branchA = await prisma.branch.create({ data: { name: 'Branch A ' + Date.now() } });
    branchB = await prisma.branch.create({ data: { name: 'Branch B ' + Date.now() } });

    // 2. Setup Super Admin
    const superRole = await prisma.role.upsert({
      where: { name: 'super_admin_sec' },
      update: {},
      create: {
        name: 'super_admin_sec',
        level: 100,
        isSystem: true,
        permissions: {
          create: [
            {
              permission: {
                connectOrCreate: {
                  where: { action_subject_scope: { action: '*', subject: '*', scope: '*' } },
                  create: { action: '*', subject: '*', scope: '*', group: 'System' },
                },
              },
            },
          ],
        },
      },
    });

    const superAdmin = await prisma.user.create({
      data: {
        email: `super-${Date.now()}@test.com`,
        firstName: 'Super',
        lastName: 'Admin',
        isActive: true,
        roles: { create: { roleId: superRole.id } },
      },
    });

    const superSession = await prisma.session.create({
      data: {
        userId: superAdmin.id,
        deviceId: 'dev-1',
        expiresAt: new Date(Date.now() + 3600000),
        refreshTokenHash: 'hash',
      },
    });
    superAdminToken = generateAuthTokens(superAdmin.id, superSession.id, 'dev-1').access.token;

    // 3. Setup Branch Admins (with read:audit:branch)
    const branchAdminRole = await prisma.role.upsert({
      where: { name: 'branch_admin_sec' },
      update: {},
      create: {
        name: 'branch_admin_sec',
        level: 50,
        isSystem: true,
        permissions: {
          create: [
            {
              permission: {
                connectOrCreate: {
                  where: { action_subject_scope: { action: 'read', subject: 'audit', scope: 'branch' } },
                  create: { action: 'read', subject: 'audit', scope: 'branch', group: 'Audit' },
                },
              },
            },
          ],
        },
      },
    });

    branchAAdmin = await prisma.user.create({
      data: {
        email: `admin-a-${Date.now()}@test.com`,
        firstName: 'Admin',
        lastName: 'A',
        isActive: true,
        branchId: branchA.id,
        roles: { create: { roleId: branchAdminRole.id } },
      },
    });

    const sessionA = await prisma.session.create({
      data: {
        userId: branchAAdmin.id,
        deviceId: 'dev-2',
        expiresAt: new Date(Date.now() + 3600000),
        refreshTokenHash: 'hash',
      },
    });
    branchAAdminToken = generateAuthTokens(branchAAdmin.id, sessionA.id, 'dev-2').access.token;

    branchBAdmin = await prisma.user.create({
      data: {
        email: `admin-b-${Date.now()}@test.com`,
        firstName: 'Admin',
        lastName: 'B',
        isActive: true,
        branchId: branchB.id,
        roles: { create: { roleId: branchAdminRole.id } },
      },
    });

    const sessionB = await prisma.session.create({
      data: {
        userId: branchBAdmin.id,
        deviceId: 'dev-3',
        expiresAt: new Date(Date.now() + 3600000),
        refreshTokenHash: 'hash',
      },
    });
    branchBAdminToken = generateAuthTokens(branchBAdmin.id, sessionB.id, 'dev-3').access.token;

    // 4. Create Audit Logs
    // 3 logs for Branch A
    await asyncLocalStorage.run({ userId: branchAAdmin.id, branchId: branchA.id }, async () => {
      await logEvent({ event: EVENT_TYPE, targetType: 'User', action: 'UPDATE' });
      await logEvent({ event: EVENT_TYPE, targetType: 'User', action: 'CREATE' });
      await logEvent({ event: EVENT_TYPE, targetType: 'User', action: 'DELETE' });
    });

    // 2 logs for Branch B
    await asyncLocalStorage.run({ userId: branchBAdmin.id, branchId: branchB.id }, async () => {
      await logEvent({ event: EVENT_TYPE, targetType: 'Note', action: 'UPDATE' });
      await logEvent({ event: EVENT_TYPE, targetType: 'Note', action: 'CREATE' });
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { event: EVENT_TYPE } });
    await prisma.$executeRaw`DELETE FROM users WHERE email LIKE '%@test.com'`;
    await prisma.role.deleteMany({ where: { name: { in: ['super_admin_sec', 'branch_admin_sec'] } } });
    await prisma.branch.deleteMany({ where: { id: { in: [branchA.id, branchB.id] } } });
  });

  it('AUDIT-SEC-002: Branch Admin can access logs of their own branch', async () => {
    const res = await request(app).get(`/v1/audit?event=${EVENT_TYPE}`).set('Authorization', `Bearer ${branchAAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3); // Should only see Branch A's 3 logs
    expect(res.body.data.every((log) => log.branchId === branchA.id)).toBe(true);
  });

  it('AUDIT-SEC-003: Branch Admin attempting cross-branch access is forced to their own branch', async () => {
    // Admin A tries to pass branchB's ID in the query
    const res = await request(app)
      .get(`/v1/audit?event=${EVENT_TYPE}&branchId=${branchB.id}`)
      .set('Authorization', `Bearer ${branchAAdminToken}`);

    expect(res.status).toBe(200);
    // The controller should forcefully override query.branchId with req.user.branchId
    expect(res.body.data.length).toBe(3);
    expect(res.body.data.every((log) => log.branchId === branchA.id)).toBe(true);
  });

  it('AUDIT-SEC-004: Branch Admin omitting branch filters is forced to their own branch', async () => {
    const res = await request(app).get(`/v1/audit?event=${EVENT_TYPE}`).set('Authorization', `Bearer ${branchBAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2); // Should only see Branch B's 2 logs
    expect(res.body.data.every((log) => log.branchId === branchB.id)).toBe(true);
  });

  it('AUDIT-SEC-005: Super Admin retains global visibility across all branches', async () => {
    // Super Admin does not pass a branch filter -> Should see all 5 logs
    const res = await request(app).get(`/v1/audit?event=${EVENT_TYPE}`).set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(5); // Sees Branch A (3) and Branch B (2) logs
  });
});
