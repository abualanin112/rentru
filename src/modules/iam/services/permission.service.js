import httpStatus from 'http-status';
import { ApiError } from '../../../shared/ApiError.js';
import { prisma } from '../../../infrastructure/prisma.js';
import { logger } from '../../../infrastructure/logger.js';
import { metrics } from '../../../infrastructure/metrics.js';

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────

const WILDCARD_PERMISSION = '*:*:*';

/**
 * Resolve all permission strings for a user by traversing the RBAC graph:
 * User → UserRole → Role → RolePermission → Permission.
 *
 * @param {string} userId - The user's CUID
 * @returns {Promise<Set<string>>} Set of `action:resource:scope` permission strings
 */
const getUserPermissions = async (userId) => {
  // DB query — single round-trip via nested includes
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  // Flatten into `action:subject:scope` strings
  const permissions = new Set();
  userRoles.forEach((ur) => {
    ur.role.permissions.forEach((rp) => {
      const { action, subject, scope } = rp.permission;
      permissions.add(`${action}:${subject}:${scope}`);
    });
  });

  logger.debug(
    { event: 'rbac.permissions.resolved', userId, count: permissions.size },
    'User permissions resolved directly from database',
  );

  return permissions;
};

// ──────────────────────────────────────────────────────────────
// Permission Matching (Pure Logic — No I/O)
// ──────────────────────────────────────────────────────────────

/**
 * Pure function: check if a required permission is satisfied by a set
 * of granted permissions.
 *
 * Match strategies (evaluated in order):
 *  1. **Exact match** — `update:notes:own` in set
 *  2. **Wildcard** — `*:*:*` grants everything (super admin)
 *  3. **Scope escalation** — `:any` implicitly covers `:own`
 *     (e.g., having `update:notes:any` satisfies a check for `update:notes:own`)
 *
 * @param {Set<string>} grantedPermissions - The user's resolved permission set
 * @param {string} requiredPermission - The permission to check (`action:resource:scope`)
 * @returns {boolean}
 */
const matchesPermission = (grantedPermissions, requiredPermission) => {
  // Exact match
  if (grantedPermissions.has(requiredPermission)) return true;

  // Super admin wildcard
  if (grantedPermissions.has(WILDCARD_PERMISSION)) return true;

  // Scope escalation: :any > :branch > :own
  if (requiredPermission.endsWith(':own')) {
    const branchVariant = requiredPermission.replace(/:own$/, ':branch');
    const anyVariant = requiredPermission.replace(/:own$/, ':any');
    if (grantedPermissions.has(branchVariant) || grantedPermissions.has(anyVariant)) return true;
  }

  if (requiredPermission.endsWith(':branch')) {
    const anyVariant = requiredPermission.replace(/:branch$/, ':any');
    if (grantedPermissions.has(anyVariant)) return true;
  }

  return false;
};

/**
 * Convenience wrapper: check if a user holds a specific permission.
 * Involves a direct DB lookup via `getUserPermissions`, then delegates
 * to the pure `matchesPermission` for the actual check.
 *
 * @param {string} userId - The user's CUID
 * @param {string} permission - Permission string in `action:resource:scope` format
 * @returns {Promise<boolean>}
 */
const hasPermission = async (userId, permission) => {
  const permissions = await getUserPermissions(userId);

  // Wildcard short-circuit for max performance
  if (permissions.has(WILDCARD_PERMISSION)) return true;

  return matchesPermission(permissions, permission);
};

// ──────────────────────────────────────────────────────────────
// Role Level Resolution (Escalation Prevention)
// ──────────────────────────────────────────────────────────────

/**
 * Get the highest privilege level across all roles assigned to a user.
 * Returns 0 if the user has no assigned roles.
 *
 * Used for escalation prevention: an actor cannot assign a role
 * with a `level` higher than their own maximum.
 *
 * @param {string} userId - The user's CUID
 * @returns {Promise<number>} The maximum role level (0 if no roles assigned)
 */
const getMaxRoleLevel = async (userId) => {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        select: { level: true },
      },
    },
  });

  if (!userRoles.length) return 0;

  return Math.max(...userRoles.map((ur) => ur.role.level));
};

// ──────────────────────────────────────────────────────────────
// ABAC (Ownership) Utilities for Controllers
// ──────────────────────────────────────────────────────────────

/**
 * Controller utility: Enforce ownership ABAC rules dynamically.
 * Assumes reqUser.permissions has been populated by the auth middleware.
 *
 * @param {Object} reqUser - The user object from the request
 * @param {string} targetUserId - The ID of the owner of the resource being accessed
 * @param {string} permissionBase - The base permission string (e.g. `read:users`)
 * @throws {ApiError} 403 Forbidden if the user lacks scope to access the target
 */
const checkOwnership = (reqUser, targetUserId, permissionBase) => {
  if (reqUser.permissions && reqUser.permissions.has(WILDCARD_PERMISSION)) return;
  if (matchesPermission(reqUser.permissions, `${permissionBase}:any`)) return;
  if (matchesPermission(reqUser.permissions, `${permissionBase}:branch`)) {
    // Branch logic check requires fetching the target's branch, usually done by `checkBranch`
    // If they hold `:branch` but not `:any`, and we are checking purely ownership, we can't confirm branch match here
    // So we fall through to :own check
  }

  if (reqUser.id === targetUserId && matchesPermission(reqUser.permissions, `${permissionBase}:own`)) {
    return;
  }

  metrics.auth.authorizationDenied += 1;
  throw new ApiError(httpStatus.FORBIDDEN, 'Insufficient permissions to access this resource');
};

/**
 * Controller utility: Enforce branch-level ABAC rules dynamically.
 * Assumes reqUser.permissions has been populated by the auth middleware.
 *
 * @param {Object} reqUser - The user object from the request
 * @param {string} targetBranchId - The ID of the branch the resource belongs to
 * @param {string} permissionBase - The base permission string (e.g. `read:users`)
 * @throws {ApiError} 403 Forbidden if the user lacks scope to access the target
 */
const checkBranch = (reqUser, targetBranchId, permissionBase) => {
  if (reqUser.permissions && reqUser.permissions.has(WILDCARD_PERMISSION)) return;
  if (matchesPermission(reqUser.permissions, `${permissionBase}:any`)) return;

  if (reqUser.branchId === targetBranchId && matchesPermission(reqUser.permissions, `${permissionBase}:branch`)) {
    return;
  }

  metrics.auth.authorizationDenied += 1;
  throw new ApiError(httpStatus.FORBIDDEN, 'Insufficient permissions to access resources in this branch');
};

export { getUserPermissions, matchesPermission, hasPermission, getMaxRoleLevel, checkOwnership, checkBranch };
