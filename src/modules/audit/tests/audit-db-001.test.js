import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import { prisma } from '../../../infrastructure/prisma.js';
import { logEvent } from '../audit.service.js';
import { als as asyncLocalStorage } from '../../../infrastructure/als.js';
import { generateAuthTokens } from '../../iam/services/token.service.js';
import { config } from '../../../infrastructure/config.js';

describe('Audit Domain - DB-001: Soft Delete Bypass', () => {
  let superAdminToken;
  let testUser;

  beforeAll(async () => {
    // 1. Ensure Super Admin exists
    let superAdmin = await prisma.user.findFirst({
      where: { email: config.env === 'test' ? 'admin@rentru.com' : process.env.SUPER_ADMIN_EMAIL },
    });

    if (!superAdmin) {
      const role = await prisma.role.upsert({
        where: { name: 'super_admin' },
        update: {},
        create: {
          name: 'super_admin',
          description: 'Super Admin',
          level: 100,
          isSystem: true,
          version: 1,
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

      superAdmin = await prisma.user.create({
        data: {
          email: 'admin@rentru.com',
          firstName: 'System',
          lastName: 'Admin',
          isActive: true,
          roles: {
            create: { roleId: role.id, assignedBy: 'test' },
          },
        },
      });
    }

    const session = await prisma.session.upsert({
      where: { userId: superAdmin.id },
      update: {
        deviceId: 'audit-db-test-device',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        refreshTokenHash: 'dummy-hash',
      },
      create: {
        userId: superAdmin.id,
        deviceId: 'audit-db-test-device',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        refreshTokenHash: 'dummy-hash',
      },
    });

    const tokens = generateAuthTokens(superAdmin.id, session.id, 'dummy-device-id');
    superAdminToken = tokens.access.token;

    // 2. Create a Branch
    const branch = await prisma.branch.create({
      data: {
        name: 'Audit Test Branch ' + Date.now(),
      },
    });

    // 3. Create a Test User
    testUser = await prisma.user.create({
      data: {
        email: `test-audit-${Date.now()}@rentru.com`,
        firstName: 'Audit',
        lastName: 'Tester',
        branchId: branch.id,
        isActive: true,
      },
    });

    // 4. Create an Audit Log with the test user as Actor
    await asyncLocalStorage.run({ userId: testUser.id, branchId: testUser.branchId }, async () => {
      await logEvent({
        event: 'test.audit.event',
        targetType: 'User',
        targetId: testUser.id,
        action: 'UPDATE',
      });
    });

    // 5. Soft Delete the Test User
    await prisma.user.updateMany({
      where: { id: testUser.id },
      data: { deletedAt: new Date() },
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { event: 'test.audit.event' } });

    // We must use deleteMany to hard delete the user so we can delete the branch
    // However, Prisma deleteMany bypasses the extension? No, Silent Guardian intercepts deleteMany!
    // We can just use raw SQL to hard delete the test user.
    await prisma.$executeRaw`DELETE FROM users WHERE email LIKE 'test-audit-%'`;

    await prisma.branch.deleteMany({ where: { name: { contains: 'Audit Test Branch' } } });
  });

  it('should return audit logs and successfully resolve soft-deleted actors', async () => {
    const res = await request(app).get('/v1/audit?event=test.audit.event').set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.length).toBeGreaterThan(0);

    const log = res.body.data.find((l) => l.event === 'test.audit.event' && l.actorId === testUser.id);
    expect(log).toBeDefined();

    // Verify Silent Guardian Bypass: The actor field should be populated despite the user being soft-deleted
    expect(log.actor).toBeDefined();
    expect(log.actor.id).toBe(testUser.id);
    expect(log.actor.email).toBe(testUser.email);
    expect(log.actor.deletedAt).not.toBeNull();
  });
});
