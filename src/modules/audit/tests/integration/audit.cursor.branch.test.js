import request from 'supertest';
import httpStatus from 'http-status';
import { app } from '../../../../app.js';
import crypto from 'node:crypto';
import { setupTestDB } from '../../../../../tests/utils/setupTestDB.js';
import { insertUsers, admin, userOne } from '../../../../../tests/fixtures/user.fixture.js';
import { generateAuthTokens } from '../../../iam/services/token.service.js';
import { upsertSession } from '../../../iam/services/session.service.js';
import { prisma } from '../../../../infrastructure/prisma.js';

setupTestDB();

describe('Audit Cursor Pagination - Branch Isolation (HTTP Integration)', () => {
  let branchA;
  let branchB;
  let adminAccessToken;
  let userOneAccessToken;

  beforeEach(async () => {
    await insertUsers([admin, userOne]);

    const adminSessionId = crypto.randomUUID();
    const adminTokens = generateAuthTokens(admin.id, adminSessionId, 'device-admin');
    await upsertSession(admin.id, adminTokens.refresh.token, 'device-admin', adminTokens.refresh.expires, adminSessionId);
    adminAccessToken = adminTokens.access.token;

    const userSessionId = crypto.randomUUID();
    const userTokens = generateAuthTokens(userOne.id, userSessionId, 'device-user');
    await upsertSession(userOne.id, userTokens.refresh.token, 'device-user', userTokens.refresh.expires, userSessionId);
    userOneAccessToken = userTokens.access.token;

    branchA = await prisma.branch.create({ data: { name: 'Branch A' } });
    branchB = await prisma.branch.create({ data: { name: 'Branch B' } });

    // userOne belongs to Branch A
    await prisma.user.updateMany({
      where: { id: userOne.id },
      data: { branchId: branchA.id },
    });

    // Grant userOne the ability to read audit logs scoped to their branch
    const standardRole = await prisma.role.findUnique({ where: { name: 'standard_user' } });
    const auditPerm = await prisma.permission.upsert({
      where: { action_subject_scope: { action: 'read', subject: 'audit', scope: 'branch' } },
      update: {},
      create: { action: 'read', subject: 'audit', scope: 'branch', group: 'Audit' },
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: standardRole.id, permissionId: auditPerm.id } },
      update: {},
      create: { roleId: standardRole.id, permissionId: auditPerm.id },
    });

    // Create Audit Logs for Branch A
    await prisma.auditLog.createMany({
      data: [
        { branchId: branchA.id, event: 'branch.A.1', action: 'TEST', createdAt: new Date('2026-06-12T10:05:00Z') },
        { branchId: branchA.id, event: 'branch.A.2', action: 'TEST', createdAt: new Date('2026-06-12T10:04:00Z') },
        { branchId: branchA.id, event: 'branch.A.3', action: 'TEST', createdAt: new Date('2026-06-12T10:03:00Z') },
      ],
    });

    // Create Audit Logs for Branch B
    await prisma.auditLog.createMany({
      data: [
        { branchId: branchB.id, event: 'branch.B.1', action: 'TEST', createdAt: new Date('2026-06-12T10:02:00Z') },
        { branchId: branchB.id, event: 'branch.B.2', action: 'TEST', createdAt: new Date('2026-06-12T10:01:00Z') },
      ],
    });
  });

  describe('CURSOR-BRANCH-001 & CURSOR-BRANCH-002: Branch Admin Pagination', () => {
    it('should only paginate records from the users own branch', async () => {
      // Request page 1
      const res1 = await request(app)
        .get('/v1/audit')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .query({ limit: 2 })
        .send();

      expect(res1.status).toBe(httpStatus.OK);
      expect(res1.body.data.length).toBe(2);
      expect(res1.body.data.every((l) => l.branchId === branchA.id)).toBe(true);
      expect(res1.body.pagination.hasMore).toBe(true);

      const nextCursor = res1.body.pagination.nextCursor;

      // Request page 2
      const res2 = await request(app)
        .get('/v1/audit')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .query({ limit: 2, cursor: nextCursor })
        .send();

      expect(res2.status).toBe(httpStatus.OK);
      expect(res2.body.data.length).toBe(1);
      expect(res2.body.data[0].branchId).toBe(branchA.id);
      expect(res2.body.pagination.hasMore).toBe(false);
    });
  });

  describe('CURSOR-BRANCH-003: Branch Replay Attack', () => {
    it('should remain isolated even if user replays a cursor from another branch', async () => {
      // Admin (Global) fetches branch B cursor
      const adminRes = await request(app)
        .get('/v1/audit')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .query({ limit: 1 })
        .send();

      const globalCursor = adminRes.body.pagination.nextCursor;

      // userOne (Branch A) attempts to use global cursor
      const attackRes = await request(app)
        .get('/v1/audit')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .query({ limit: 10, cursor: globalCursor })
        .send();

      expect(attackRes.status).toBe(httpStatus.OK);
      // Because the tuple cursor condition is OR combined with Silent Guardian AND conditions
      // It will safely return Branch A items that match the tuple bounds, but NEVER Branch B items.
      expect(attackRes.body.data.every((l) => l.branchId === branchA.id)).toBe(true);
    });
  });

  describe('CURSOR-BRANCH-004: Global Admin Pagination', () => {
    it('should paginate across all branches correctly for a super admin', async () => {
      const res = await request(app)
        .get('/v1/audit')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .query({ limit: 10 })
        .send();

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.data.length).toBe(5); // 3 from A + 2 from B
      const hasBranchA = res.body.data.some((l) => l.branchId === branchA.id);
      const hasBranchB = res.body.data.some((l) => l.branchId === branchB.id);
      expect(hasBranchA).toBe(true);
      expect(hasBranchB).toBe(true);
    });
  });
});
