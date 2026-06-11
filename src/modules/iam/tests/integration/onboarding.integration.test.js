import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { prisma } from '../../../../infrastructure/prisma.js';
import { setupTestDB } from '../../../../../tests/utils/setupTestDB.js';
import { insertUsers, admin, userOne } from '../../../../../tests/fixtures/user.fixture.js';

setupTestDB();

describe('Onboarding (Acceptance) Integration Tests', () => {
  let standardRole;

  beforeEach(async () => {
    await insertUsers([admin, userOne]);
    standardRole = await prisma.role.findUnique({ where: { name: 'standard_user' } });
    await prisma.invitation.deleteMany();
    await prisma.session.deleteMany();
  });

  const createActiveInvitation = async (email, inviteToken) => {
    const hashedToken = crypto.createHash('sha256').update(inviteToken).digest('hex');
    return prisma.invitation.create({
      data: {
        email,
        inviteToken: hashedToken,
        roleId: standardRole.id,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 100000), // Valid
      },
    });
  };

  describe('Fix 2 & 4: Invitation Status Validation & Transactional Provisioning', () => {
    it('should reject an expired invitation', async () => {
      const { handleGoogleLogin } = await import('../../services/auth.service.js');
      const hashedToken = crypto.createHash('sha256').update('raw-token').digest('hex');
      await prisma.invitation.create({
        data: {
          email: 'expired@test.com',
          inviteToken: hashedToken,
          roleId: standardRole.id,
          status: 'PENDING',
          expiresAt: new Date(Date.now() - 100000), // Expired
        },
      });

      await expect(
        handleGoogleLogin({ id: 'g1', emails: [{ value: 'expired@test.com', verified: true }] }, 'device1', 'raw-token'),
      ).rejects.toThrow('Invitation has expired');
    });

    it('should reject a revoked invitation', async () => {
      const { handleGoogleLogin } = await import('../../services/auth.service.js');
      const hashedToken = crypto.createHash('sha256').update('raw-token2').digest('hex');
      await prisma.invitation.create({
        data: {
          email: 'revoked@test.com',
          inviteToken: hashedToken,
          roleId: standardRole.id,
          status: 'REVOKED',
          expiresAt: new Date(Date.now() + 100000),
        },
      });

      await expect(
        handleGoogleLogin({ id: 'g2', emails: [{ value: 'revoked@test.com', verified: true }] }, 'device1', 'raw-token2'),
      ).rejects.toThrow('Invitation is no longer pending');
    });

    it('should provision user successfully in a transaction', async () => {
      const { handleGoogleLogin } = await import('../../services/auth.service.js');
      await createActiveInvitation('success@test.com', 'raw-token3');

      const result = await handleGoogleLogin(
        {
          id: 'g3',
          name: { givenName: 'John', familyName: 'Doe' },
          emails: [{ value: 'success@test.com', verified: true }],
        },
        'device1',
        'raw-token3',
      );

      expect(result.user.email).toBe('success@test.com');

      const dbInvite = await prisma.invitation.findFirst({ where: { email: 'success@test.com' } });
      expect(dbInvite.status).toBe('COMPLETED');
    });

    it('should handle concurrent acceptance requests safely', async () => {
      const { handleGoogleLogin } = await import('../../services/auth.service.js');
      await createActiveInvitation('concurrent@test.com', 'concurrent-token');

      const profile1 = {
        id: 'g_concurrent1',
        name: { givenName: 'C1', familyName: 'Doe' },
        emails: [{ value: 'concurrent@test.com', verified: true }],
      };
      const profile2 = {
        id: 'g_concurrent2',
        name: { givenName: 'C2', familyName: 'Doe' },
        emails: [{ value: 'concurrent@test.com', verified: true }],
      };

      // Fire both concurrently
      const results = await Promise.allSettled([
        handleGoogleLogin(profile1, 'dev1', 'concurrent-token'),
        handleGoogleLogin(profile2, 'dev2', 'concurrent-token'),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly ONE must succeed
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      // Verify the rejected one threw an error (we don't strictly match the string since Prisma might throw P2034/P2002 or our custom ApiError)
      expect(rejected[0].reason).toBeDefined();

      // Verify exactly ONE user was created
      const usersCreated = await prisma.user.count({ where: { email: 'concurrent@test.com' } });
      expect(usersCreated).toBe(1);

      // Verify invitation is COMPLETED
      const invite = await prisma.invitation.findFirst({ where: { email: 'concurrent@test.com' } });
      expect(invite.status).toBe('COMPLETED');
    });
  });
});
