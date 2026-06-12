import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError } from '../../../../shared/ApiError.js';
import * as invitationService from '../../services/invitation.service.js';
import { prisma } from '../../../../infrastructure/prisma.js';
import { setupTestDB } from '../../../../../tests/utils/setupTestDB.js';
import { insertUsers, admin, userOne } from '../../../../../tests/fixtures/user.fixture.js';

// We mock email service because it interacts with external API
vi.mock('../../../../infrastructure/email/email.service.js', () => ({
  sendInviteEmail: vi.fn().mockResolvedValue(true),
}));

setupTestDB();

describe('Invitation Service (Integration)', () => {
  beforeEach(async () => {
    await insertUsers([admin, userOne]);
    vi.clearAllMocks();
  });

  describe('createInvitation', () => {
    it('should create an invitation successfully', async () => {
      const standardRole = await prisma.role.findUnique({ where: { name: 'standard_user' } });
      const email = 'newuser@example.com';

      const result = await invitationService.createInvitation(admin.id, {
        email,
        roleId: standardRole.id,
      });

      expect(result).toBeDefined();
      expect(result.email).toBe(email);

      const dbInvitation = await prisma.invitation.findUnique({ where: { id: result.id } });
      expect(dbInvitation).toBeDefined();
      expect(dbInvitation.email).toBe(email);
    });

    it('should throw error if user already exists', async () => {
      const standardRole = await prisma.role.findUnique({ where: { name: 'standard_user' } });

      await expect(
        invitationService.createInvitation(admin.id, { email: userOne.email, roleId: standardRole.id }),
      ).rejects.toThrow(ApiError);
    });

    it('should throw error if pending invitation already exists', async () => {
      const standardRole = await prisma.role.findUnique({ where: { name: 'standard_user' } });
      const email = 'pending@example.com';

      // Create first invitation
      await invitationService.createInvitation(admin.id, { email, roleId: standardRole.id });

      // Second attempt should fail
      await expect(invitationService.createInvitation(admin.id, { email, roleId: standardRole.id })).rejects.toThrow(
        ApiError,
      );
    });
  });

  describe('revokeInvitation', () => {
    it('should revoke (delete) a pending invitation', async () => {
      const standardRole = await prisma.role.findUnique({ where: { name: 'standard_user' } });
      const email = 'revoke-me@example.com';

      const invitation = await invitationService.createInvitation(admin.id, { email, roleId: standardRole.id });

      const result = await invitationService.revokeInvitation(admin.id, invitation.id);
      expect(result.id).toBe(invitation.id);

      const dbInvitation = await prisma.invitation.findUnique({ where: { id: invitation.id } });
      expect(dbInvitation.status).toBe('REVOKED');
    });

    it('should throw error if invitation is not PENDING', async () => {
      // Create and mock it as COMPLETED
      const standardRole = await prisma.role.findUnique({ where: { name: 'standard_user' } });
      const email = 'completed@example.com';

      const invitation = await prisma.invitation.create({
        data: {
          email,
          roleId: standardRole.id,
          status: 'COMPLETED',
          inviteToken: 'some-token',
          expiresAt: new Date(Date.now() + 10000),
        },
      });

      await expect(invitationService.revokeInvitation(admin.id, invitation.id)).rejects.toThrow(ApiError);
    });
  });
});
