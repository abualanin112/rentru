import { describe, it, expect, beforeEach, vi } from 'vitest';
import httpStatus from 'http-status';
import { ApiError } from '../../../../shared/ApiError.js';
import { prisma } from '../../../../infrastructure/prisma.js';
import * as permissionService from '../../services/permission.service.js';
import * as roleService from '../../services/role.service.js';

vi.mock('../../../../infrastructure/prisma.js', () => ({
  prisma: {
    role: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    userRole: {
      count: vi.fn(),
    },
  },
  runInTransaction: vi.fn((cb) =>
    cb({
      userRole: { findMany: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
      role: { update: vi.fn() },
      rolePermission: { deleteMany: vi.fn(), createMany: vi.fn() },
    }),
  ),
}));

vi.mock('../../services/permission.service.js', () => ({
  getMaxRoleLevel: vi.fn(),
  hasPermission: vi.fn(),
}));

describe('Role Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Privilege Escalation Guard', () => {
    it('should allow Super Admin to bypass level checks', async () => {
      permissionService.hasPermission.mockResolvedValue(true); // Super Admin

      prisma.role.create.mockResolvedValue({ id: 'r1', level: 100 });

      await expect(roleService.createRole('admin-1', { name: 'Admin', level: 100 })).resolves.toBeDefined();
      expect(permissionService.getMaxRoleLevel).not.toHaveBeenCalled();
    });

    it('should reject if actor max level is lower than target role level', async () => {
      permissionService.hasPermission.mockResolvedValue(false);
      permissionService.getMaxRoleLevel.mockResolvedValue(10); // Actor is level 10

      await expect(roleService.createRole('user-1', { name: 'Admin', level: 50 })).rejects.toThrowError(
        new ApiError(httpStatus.FORBIDDEN, 'Cannot interact with roles above your own privilege level (10)'),
      );
    });

    it('should allow if actor max level is equal to target role level', async () => {
      permissionService.hasPermission.mockResolvedValue(false);
      permissionService.getMaxRoleLevel.mockResolvedValue(50);

      prisma.role.create.mockResolvedValue({ id: 'r1', level: 50 });

      await expect(roleService.createRole('user-1', { name: 'Admin', level: 50 })).resolves.toBeDefined();
    });
  });

  describe('Delete Role', () => {
    it('should prevent deletion of system roles', async () => {
      permissionService.hasPermission.mockResolvedValue(true);
      prisma.role.findUnique.mockResolvedValue({ id: 'r1', level: 50, isSystem: true });

      await expect(roleService.deleteRole('admin-1', 'r1')).rejects.toThrowError(
        new ApiError(httpStatus.FORBIDDEN, 'Cannot delete a system role'),
      );
    });

    it('should prevent deletion if role is assigned to users', async () => {
      permissionService.hasPermission.mockResolvedValue(true);
      prisma.role.findUnique.mockResolvedValue({ id: 'r1', level: 50, isSystem: false });
      prisma.userRole.count.mockResolvedValue(5);

      await expect(roleService.deleteRole('admin-1', 'r1')).rejects.toThrowError(
        new ApiError(httpStatus.CONFLICT, 'Cannot delete role. It is assigned to 5 users. Reassign them first.'),
      );
    });
  });
});
