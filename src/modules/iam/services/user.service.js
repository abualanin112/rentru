import httpStatus from 'http-status';
import { prisma, runInTransaction } from '../../../infrastructure/prisma.js';
import { ApiError } from '../../../shared/ApiError.js';
import { logEvent } from '../../audit/index.js';
import { destroySession } from './session.service.js';
import { paginate } from '../../../shared/Paginate.js';
import { enforcePrivilegeEscalationGuard } from './role.service.js';
import { getMaxRoleLevel } from './permission.service.js';

/**
 * Fetch a user profile (for the currently authenticated user)
 */
export const getMe = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      branch: {
        select: { id: true, name: true, isActive: true },
      },
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  return user;
};

/**
 * List users (supports pagination and filtering)
 * Note: Silent Guardian automatically filters out archived (deletedAt !== null) users
 * and enforces Branch Isolation unless the actor is a Super Admin.
 */
export const getUsers = async (filter, options) => {
  return paginate(prisma.user, filter, options);
};

/**
 * Get a specific user by ID
 */
export const getUserById = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      branch: {
        select: { id: true, name: true, isActive: true },
      },
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  return user;
};

/**
 * Suspend an active user (isActive: false)
 * Immediately destroys their active session.
 */
export const suspendUser = async (actorId, targetUserId) => {
  if (actorId === targetUserId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'You cannot suspend yourself');
  }

  const user = await getUserById(targetUserId);

  if (!user.isActive) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User is already suspended');
  }

  // Privilege Escalation Guard
  const targetMaxLevel = await getMaxRoleLevel(targetUserId);
  await enforcePrivilegeEscalationGuard(actorId, targetMaxLevel);

  return runInTransaction(async (tx) => {
    await tx.user.updateMany({
      where: { id: targetUserId },
      data: { isActive: false },
    });
    const updatedUser = await tx.user.findFirst({ where: { id: targetUserId } });

    await destroySession(targetUserId);

    await logEvent(
      {
        event: 'iam.user.suspended',
        targetType: 'User',
        targetId: targetUserId,
        actorId,
        action: 'SUSPEND',
      },
      tx,
    );

    return updatedUser;
  });
};

/**
 * Archive a user (Soft Delete: deletedAt = Date)
 * Immediately destroys their active session.
 */
export const archiveUser = async (actorId, targetUserId) => {
  if (actorId === targetUserId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'You cannot archive yourself');
  }

  // Ensure user exists and actor has access before archiving
  await getUserById(targetUserId);

  // Privilege Escalation Guard
  const targetMaxLevel = await getMaxRoleLevel(targetUserId);
  await enforcePrivilegeEscalationGuard(actorId, targetMaxLevel);

  // TODO: Implement Pre-Offboarding Checks
  // Note: Deferred validation requirement. Cannot archive an employee
  // if they have open tasks, financial trusts, or active reservations.
  // Wait until those modules are deployed in the ERP.

  return runInTransaction(async (tx) => {
    await tx.user.updateMany({
      where: { id: targetUserId },
      data: { deletedAt: new Date() },
    });
    // Can't findFirst if it's archived due to Silent Guardian
    const updatedUser = { id: targetUserId, deletedAt: new Date() };

    await destroySession(targetUserId);

    await logEvent(
      {
        event: 'iam.user.archived',
        targetType: 'User',
        targetId: targetUserId,
        actorId,
        action: 'ARCHIVE',
      },
      tx,
    );

    return updatedUser;
  });
};

/**
 * Activate a suspended user
 * Sets isActive = true.
 */
export const activateUser = async (actorId, targetUserId) => {
  const user = await getUserById(targetUserId);

  if (user.isActive) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User is already active');
  }

  // Privilege Escalation Guard
  const targetMaxLevel = await getMaxRoleLevel(targetUserId);
  await enforcePrivilegeEscalationGuard(actorId, targetMaxLevel);

  return runInTransaction(async (tx) => {
    await tx.user.updateMany({
      where: { id: targetUserId },
      data: { isActive: true },
    });
    const updatedUser = await tx.user.findFirst({ where: { id: targetUserId } });

    await logEvent(
      {
        event: 'iam.user.activated',
        targetType: 'User',
        targetId: targetUserId,
        actorId,
        action: 'ACTIVATE',
      },
      tx,
    );

    return updatedUser;
  });
};

/**
 * Restore an archived user (Soft Undelete)
 * Sets deletedAt = null and isActive = true.
 */
export const restoreUser = async (actorId, targetUserId) => {
  // Silent Guardian intercepts `findUnique` and `update` to inject `deletedAt: null`.
  // Therefore, we cannot use Prisma's standard `update` or `findFirst` to interact with an archived user.
  // We must bypass the extension by executing raw SQL.

  return runInTransaction(async (tx) => {
    // 1. Verify the user actually exists and is deleted
    const users = await tx.$queryRaw`SELECT id, "deleted_at" FROM users WHERE id = ${targetUserId}::uuid LIMIT 1`;

    if (!users || users.length === 0) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    if (!users[0].deleted_at) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'User is not archived');
    }

    // Privilege Escalation Guard
    // Since Silent Guardian prevents normal operations, we must calculate the level explicitly
    const targetMaxLevel = await getMaxRoleLevel(targetUserId);
    await enforcePrivilegeEscalationGuard(actorId, targetMaxLevel);

    // 2. Perform the update via Raw SQL to bypass Silent Guardian
    await tx.$executeRaw`UPDATE users SET "deleted_at" = NULL, "is_active" = true WHERE id = ${targetUserId}::uuid`;

    // 3. Log the restoration event
    await logEvent(
      {
        event: 'iam.user.updated',
        targetType: 'User',
        targetId: targetUserId,
        actorId,
        action: 'RESTORE',
      },
      tx,
    );

    // Return the fresh user object via normal Prisma now that they are un-deleted
    return tx.user.findUnique({ where: { id: targetUserId } });
  });
};
