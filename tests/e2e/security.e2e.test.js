import { setupTestDB } from '../utils/setupTestDB.js';
import { prisma } from '../../src/infrastructure/prisma.js';

import * as authorizationService from '../../src/modules/iam/services/authorization.service.js';
import { userOne, userTwo, insertUsers } from '../fixtures/user.fixture.js';

setupTestDB();

describe('Security Regression & Hardening', () => {
  describe('RBAC Bypasses & Escalation', () => {
    test('should prevent vertical privilege escalation when assigning roles', async () => {
      // userTwo will be our level 50 admin
      await insertUsers([userOne, userTwo]);

      // We need a super-admin role and a standard user role in the DB to test this.
      const superAdminRole = await prisma.role.create({
        data: { name: 'super-admin-test', description: 'Super Admin', level: 100 },
      });

      const userRole = await prisma.role.create({
        data: { name: 'user-manager', description: 'User Manager', level: 10 },
      });

      // userTwo has level 50
      const adminRole = await prisma.role.create({
        data: { name: 'admin-role', description: 'Admin', level: 50 },
      });

      // Assign the 'admin-role' to 'userTwo', and give them 'assign:roles:any' permission
      await prisma.userRole.create({
        data: { userId: userTwo.id, roleId: adminRole.id, assignedBy: userTwo.id },
      });

      const assignPerm = await prisma.permission.create({
        data: { action: 'assign', resource: 'roles', scope: 'any', description: 'Assign roles' },
      });

      await prisma.rolePermission.create({
        data: { roleId: adminRole.id, permissionId: assignPerm.id },
      });

      // userTwo (level 50) tries to assign super-admin (level 100) to userOne
      // This MUST be blocked.
      const { assignRoleToUser } = authorizationService;

      await expect(assignRoleToUser({ id: userTwo.id }, userOne.id, superAdminRole.id)).rejects.toThrow(
        'Cannot assign a role with a higher privilege level than your own',
      );

      // userTwo (level 50) tries to assign user-manager (level 10) to userOne
      // This SHOULD succeed.
      const result = await assignRoleToUser({ id: userTwo.id }, userOne.id, userRole.id);
      expect(result).toBeDefined();
      expect(result.roleId).toBe(userRole.id);
    });
  });
});
