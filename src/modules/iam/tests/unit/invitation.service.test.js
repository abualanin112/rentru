import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError } from '../../../../shared/ApiError.js';

// Mock dependencies
vi.mock('../../../../infrastructure/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    invitation: { findFirst: vi.fn(), findUnique: vi.fn() },
    role: { findUnique: vi.fn() },
  },
  runInTransaction: vi.fn(async (callback) => {
    const tx = {
      invitation: {
        create: vi.fn().mockResolvedValue({ id: 'inv-1', email: 'test@example.com' }),
        findUnique: vi.fn().mockImplementation(async ({ where }) => {
          return prisma.invitation.findUnique({ where });
        }),
        delete: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    return callback(tx);
  }),
}));

vi.mock('../../../audit/index.js', () => ({ logEvent: vi.fn() }));
vi.mock('../../../../infrastructure/email/email.service.js', () => ({ sendInviteEmail: vi.fn().mockResolvedValue(true) }));
vi.mock('../../services/role.service.js', () => ({ enforcePrivilegeEscalationGuard: vi.fn() }));
vi.mock('../../services/permission.service.js', () => ({ hasPermission: vi.fn() }));

import * as invitationService from '../../services/invitation.service.js';
import { prisma } from '../../../../infrastructure/prisma.js';
import { enforcePrivilegeEscalationGuard } from '../../services/role.service.js';
import { hasPermission } from '../../services/permission.service.js';

describe('Invitation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createInvitation', () => {
    it('should create an invitation successfully', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null); // existingUser
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'admin-1', branchId: 'branch-1', firstName: 'A', lastName: 'B' }); // actor
      hasPermission.mockResolvedValue(false); // Not super admin
      prisma.invitation.findFirst.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', level: 10 });

      const result = await invitationService.createInvitation('admin-1', {
        email: 'test@example.com',
        roleId: 'role-1',
        branchId: 'branch-1',
      });

      expect(result.id).toBe('inv-1');
      expect(enforcePrivilegeEscalationGuard).toHaveBeenCalledWith('admin-1', 10);
    });

    it('should throw error if actor tries to invite to different branch', async () => {
      prisma.user.findUnique.mockImplementation(async ({ where }) => {
        if (where.id === 'admin-1') return { id: 'admin-1', branchId: 'branch-1' };
        return null;
      });
      hasPermission.mockResolvedValue(false);
      prisma.invitation.findFirst.mockResolvedValue(null);

      await expect(
        invitationService.createInvitation('admin-1', { email: 'test@example.com', roleId: 'role-1', branchId: 'branch-2' }),
      ).rejects.toThrow(ApiError);
    });

    it('should throw error if user already exists', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1' }); // existingUser

      await expect(
        invitationService.createInvitation('admin-1', { email: 'test@example.com', roleId: 'role-1' }),
      ).rejects.toThrow(ApiError);
    });

    it('should throw error if pending invitation already exists', async () => {
      prisma.user.findUnique.mockImplementation(async ({ where }) => {
        if (where.id === 'admin-1') return { id: 'admin-1', branchId: 'branch-1' };
        return null;
      });
      prisma.invitation.findFirst.mockResolvedValue({ id: 'inv-2' });

      await expect(
        invitationService.createInvitation('admin-1', { email: 'test@example.com', roleId: 'role-1' }),
      ).rejects.toThrow(ApiError);
    });
  });

  describe('revokeInvitation', () => {
    it('should revoke (delete) a pending invitation', async () => {
      prisma.invitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'PENDING',
        email: 'test@example.com',
        role: { level: 10 },
      });

      const result = await invitationService.revokeInvitation('admin-1', 'inv-1');
      expect(result.id).toBe('inv-1');
      expect(enforcePrivilegeEscalationGuard).toHaveBeenCalledWith('admin-1', 10);
    });

    it('should throw error if invitation is not PENDING', async () => {
      prisma.invitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'COMPLETED',
        role: { level: 10 },
      });

      await expect(invitationService.revokeInvitation('admin-1', 'inv-1')).rejects.toThrow(ApiError);
    });
  });
});
