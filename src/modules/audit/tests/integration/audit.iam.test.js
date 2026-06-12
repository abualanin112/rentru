import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../../app.js';
import { prisma } from '../../../../infrastructure/prisma.js';
import { config } from '../../../../infrastructure/config.js';
import { generateAuthTokens } from '../../../iam/services/token.service.js';

describe('Audit Domain - AUDIT-IT-002: IAM Integration and Event Catalog Compliance', () => {
  let superAdminToken;
  let testBranch;
  let superAdmin;

  beforeAll(async () => {
    // 1. Create a Branch for isolated testing
    testBranch = await prisma.branch.create({
      data: { name: 'Audit IAM Test Branch ' + Date.now() },
    });

    // 2. Locate or create Super Admin
    superAdmin = await prisma.user.findFirst({
      where: { email: config.env === 'test' ? 'admin@rentru.com' : process.env.SUPER_ADMIN_EMAIL },
    });

    if (!superAdmin) {
      const superRole = await prisma.role.upsert({
        where: { name: 'super_admin' },
        update: {},
        create: {
          name: 'super_admin',
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

      superAdmin = await prisma.user.create({
        data: {
          email: 'admin@rentru.com',
          firstName: 'System',
          lastName: 'Admin',
          isActive: true,
          roles: {
            create: { roleId: superRole.id, assignedBy: 'system' },
          },
        },
      });
    }

    const session = await prisma.session.upsert({
      where: { userId: superAdmin.id },
      update: {
        deviceId: 'iam-test-device',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        refreshTokenHash: 'dummy-hash',
      },
      create: {
        userId: superAdmin.id,
        deviceId: 'iam-test-device',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        refreshTokenHash: 'dummy-hash',
      },
    });

    superAdminToken = generateAuthTokens(superAdmin.id, session.id, 'iam-test-device').access.token;
  });

  afterAll(async () => {
    // Clean up all events created during testing
    await prisma.auditLog.deleteMany({
      where: { branchId: testBranch.id },
    });

    await prisma.$executeRaw`DELETE FROM users WHERE email LIKE '%@iam-audit.com'`;
    await prisma.role.deleteMany({ where: { name: { startsWith: 'IAM Test Role' } } });
    await prisma.branch.deleteMany({ where: { id: testBranch.id } });
  });

  it('should capture iam.role.created when a role is created', async () => {
    const res = await request(app)
      .post('/v1/roles')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'IAM Test Role ' + Date.now(),
        level: 10,
        description: 'Test role for auditing',
      });

    expect(res.status).toBe(201);
    const newRoleId = res.body.id;

    // Verify Audit Log was created asynchronously
    // Wait briefly for fire-and-forget to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        event: 'iam.role.created',
        targetId: newRoleId,
        targetType: 'Role',
      },
    });

    expect(auditLog).toBeDefined();
    expect(auditLog.action).toBe('CREATE');
    expect(auditLog.actorId).toBe(superAdmin.id);
  });

  it('should capture iam.user.suspended when a user is suspended', async () => {
    // 1. Create a dummy user
    const dummyUser = await prisma.user.create({
      data: {
        email: `dummy-${Date.now()}@iam-audit.com`,
        firstName: 'Dummy',
        lastName: 'User',
        isActive: true,
        branchId: testBranch.id,
      },
    });

    // 2. Suspend the user
    const res = await request(app)
      .patch(`/v1/users/${dummyUser.id}/status`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        event: 'iam.user.suspended',
        targetId: dummyUser.id,
        targetType: 'User',
      },
    });

    expect(auditLog).toBeDefined();
    expect(auditLog.action).toBe('SUSPEND');
    expect(auditLog.actorId).toBe(superAdmin.id);
  });

  it('should not crash the application when logEventAsync fails (Fire-and-Forget safety)', async () => {
    // 1. Mock the Prisma AuditLog create method to simulate a database outage
    const auditService = await import('../../audit.service.js');
    const { logger } = await import('../../../../infrastructure/logger.js');

    const loggerSpy = vi.spyOn(logger, 'warn');
    const originalCreate = prisma.auditLog.create;
    prisma.auditLog.create = vi.fn().mockRejectedValue(new Error('Simulated DB Failure'));

    // 2. Call logEventAsync
    auditService.logEventAsync({
      event: 'iam.role.deleted',
      targetType: 'Role',
      targetId: 'dummy-id',
      action: 'DELETE',
    });

    // 3. Wait for the microtask queue to clear
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 4. Verify that logger.warn was called, proving the catch block handled it
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'iam.role.deleted' }),
      'Fire-and-forget audit log failed silently.',
    );

    // 5. Restore the original behavior
    prisma.auditLog.create = originalCreate;
    loggerSpy.mockRestore();
  });
});
