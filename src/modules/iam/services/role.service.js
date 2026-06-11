import httpStatus from 'http-status';
import { prisma, runInTransaction } from '../../../infrastructure/prisma.js';
import { ApiError } from '../../../shared/ApiError.js';
import { getMaxRoleLevel, hasPermission } from './permission.service.js';

/**
 * Ensures the actor's privilege level is sufficient to interact with the target role level.
 * @param {string} actorId
 * @param {number} targetLevel
 */
export const enforcePrivilegeEscalationGuard = async (actorId, targetLevel) => {
  // Super Admin bypasses escalation guard
  const isSuperAdmin = await hasPermission(actorId, '*:*:*');
  if (isSuperAdmin) return;

  const actorMaxLevel = await getMaxRoleLevel(actorId);
  if (actorMaxLevel < targetLevel) {
    throw new ApiError(httpStatus.FORBIDDEN, `Cannot interact with roles above your own privilege level (${actorMaxLevel})`);
  }
};

/**
 * Create a new Role
 */
export const createRole = async (actorId, roleData) => {
  await enforcePrivilegeEscalationGuard(actorId, roleData.level || 0);

  // Prevent creation of system roles through API
  const data = { ...roleData, isSystem: false };

  return prisma.role.create({
    data,
  });
};

/**
 * Get all roles (can be paginated later, but usually a small dataset)
 */
export const getRoles = async () => {
  return prisma.role.findMany({
    orderBy: { level: 'desc' },
  });
};

/**
 * Get a single role by ID, including its permissions
 */
export const getRoleById = async (roleId) => {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  });

  if (!role) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Role not found');
  }

  return role;
};

/**
 * Update a role's metadata or permissions.
 * Automatically increments the version to trigger Smart Invalidation for all users holding this role.
 */
export const updateRole = async (actorId, roleId, updateData) => {
  const role = await getRoleById(roleId);

  await enforcePrivilegeEscalationGuard(actorId, role.level);

  // If level is being changed, ensure actor is authorized for the new level too
  if (updateData.level !== undefined) {
    await enforcePrivilegeEscalationGuard(actorId, updateData.level);
  }

  // Prevent modifying isSystem flag
  delete updateData.isSystem;

  return prisma.role.update({
    where: { id: roleId },
    data: {
      ...updateData,
    },
  });
};

/**
 * Delete a role.
 * Cannot delete system roles.
 * Cannot delete if users are currently assigned to it.
 */
export const deleteRole = async (actorId, roleId) => {
  const role = await getRoleById(roleId);

  await enforcePrivilegeEscalationGuard(actorId, role.level);

  if (role.isSystem) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Cannot delete a system role');
  }

  const assignedUsersCount = await prisma.userRole.count({
    where: { roleId },
  });

  if (assignedUsersCount > 0) {
    throw new ApiError(
      httpStatus.CONFLICT,
      `Cannot delete role. It is assigned to ${assignedUsersCount} users. Reassign them first.`,
    );
  }

  await prisma.role.delete({
    where: { id: roleId },
  });
};

/**
 * Reassign all users from a source role to a target role.
 */
export const reassignRole = async (actorId, sourceRoleId, targetRoleId) => {
  if (sourceRoleId === targetRoleId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Source and target roles must be different');
  }

  const sourceRole = await getRoleById(sourceRoleId);
  const targetRole = await getRoleById(targetRoleId);

  await enforcePrivilegeEscalationGuard(actorId, sourceRole.level);
  await enforcePrivilegeEscalationGuard(actorId, targetRole.level);

  return runInTransaction(async (tx) => {
    // Find all users assigned to the source role
    const usersInSource = await tx.userRole.findMany({
      where: { roleId: sourceRoleId },
    });

    if (usersInSource.length === 0) return { reassigned: 0 };

    // We can't easily bulk-upsert pivot tables with Prisma to avoid duplicates if a user already has the target role.
    // Easiest robust path: create missing links, then delete source links.
    const usersInTarget = await tx.userRole.findMany({
      where: { roleId: targetRoleId, userId: { in: usersInSource.map((u) => u.userId) } },
    });

    const targetUserIds = new Set(usersInTarget.map((u) => u.userId));

    const missingAssignments = usersInSource
      .filter((u) => !targetUserIds.has(u.userId))
      .map((u) => ({
        userId: u.userId,
        roleId: targetRoleId,
      }));

    if (missingAssignments.length > 0) {
      await tx.userRole.createMany({
        data: missingAssignments,
      });
    }

    // Delete the source roles for all those users
    await tx.userRole.deleteMany({
      where: { roleId: sourceRoleId },
    });

    return { reassigned: usersInSource.length };
  });
};

/**
 * Completely overwrite the permissions for a role.
 * @param {string} actorId
 * @param {string} roleId
 * @param {string[]} permissionIds Array of permission UUIDs
 */
export const updateRolePermissions = async (actorId, roleId, permissionIds) => {
  const role = await getRoleById(roleId);

  await enforcePrivilegeEscalationGuard(actorId, role.level);

  return runInTransaction(async (tx) => {
    // Wipe existing permissions for this role
    await tx.rolePermission.deleteMany({
      where: { roleId },
    });

    // Insert new permissions
    if (permissionIds.length > 0) {
      const data = permissionIds.map((permId) => ({
        roleId,
        permissionId: permId,
      }));

      await tx.rolePermission.createMany({
        data,
      });
    }
  });
};
