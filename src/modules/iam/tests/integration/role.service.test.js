import { describe, it, expect, beforeEach } from 'vitest';
import httpStatus from 'http-status';
import { ApiError } from '../../../../shared/ApiError.js';
import { prisma } from '../../../../infrastructure/prisma.js';
import * as roleService from '../../services/role.service.js';
import { setupTestDB } from '../../../../../tests/utils/setupTestDB.js';
import { insertUsers, userOne, userTwo, admin } from '../../../../../tests/fixtures/user.fixture.js';

setupTestDB();

describe('Role Service (Integration)', () => {
  beforeEach(async () => {
    await insertUsers([userOne, userTwo, admin]);
  });

  describe('Privilege Escalation Guard', () => {
    it('should allow Super Admin to bypass level checks and create high level role', async () => {
      const result = await roleService.createRole(admin.id, { name: 'NewAdminRole', level: 100 });
      expect(result).toBeDefined();
      expect(result.level).toBe(100);

      const dbRole = await prisma.role.findUnique({ where: { id: result.id } });
      expect(dbRole).toBeDefined();
    });

    it('should reject if actor max level is lower than target role level', async () => {
      // userOne is standard_user (level 10)
      await expect(roleService.createRole(userOne.id, { name: 'Admin', level: 50 })).rejects.toThrowError(
        new ApiError(httpStatus.FORBIDDEN, 'Cannot interact with roles above your own privilege level (10)'),
      );
    });

    it('should allow if actor max level is equal to target role level', async () => {
      // userOne is standard_user (level 10)
      const result = await roleService.createRole(userOne.id, { name: 'SubUserRole', level: 10 });
      expect(result).toBeDefined();
      expect(result.level).toBe(10);
    });
  });

  describe('Delete Role', () => {
    it('should prevent deletion of system roles', async () => {
      // Create an unassigned system role just for this test
      const unassignedSystemRole = await prisma.role.create({
        data: { name: 'unassigned_system', level: 90, isSystem: true },
      });

      await expect(roleService.deleteRole(admin.id, unassignedSystemRole.id)).rejects.toThrowError(
        new ApiError(httpStatus.FORBIDDEN, 'Cannot delete a system role'),
      );
    });

    it('should prevent deletion if role is assigned to users', async () => {
      const standardRole = await prisma.role.findUnique({ where: { name: 'standard_user' } });

      // userOne and userTwo are assigned this role
      await expect(roleService.deleteRole(admin.id, standardRole.id)).rejects.toThrowError(
        new ApiError(httpStatus.CONFLICT, 'Cannot delete role. It is assigned to 2 users. Reassign them first.'),
      );
    });

    it('should allow deletion if role is not assigned to anyone', async () => {
      const newRole = await roleService.createRole(admin.id, { name: 'EmptyRole', level: 20 });

      await roleService.deleteRole(admin.id, newRole.id);

      const dbRole = await prisma.role.findUnique({ where: { id: newRole.id } });
      expect(dbRole).toBeNull();
    });
  });
});
