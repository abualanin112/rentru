import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma.js';
import { cursorPaginate } from '../../shared/CursorPaginate.js';

/**
 * Create a new audit log
 * @param {Object} data - The audit log data
 * @param {Object} [tx=prisma] - Optional transaction client
 * @returns {Promise<Object>} The created audit log
 */
const create = async (data, tx = prisma) => {
  return tx.auditLog.create({
    data,
  });
};

/**
 * Retrieve audit logs using cursor pagination and bypass Silent Guardian for actors.
 * @param {Object} params
 * @returns {Promise<Object>}
 */
const findManyWithCursor = async ({ cursor, limit = 50, event, targetType, targetId, branchId, action, actorId }) => {
  const where = {};
  if (event) where.event = event;
  if (targetType) where.targetType = targetType;
  if (targetId) where.targetId = targetId;
  if (branchId) where.branchId = branchId;
  if (action) where.action = action;
  if (actorId) where.actorId = actorId;

  const paginationResult = await cursorPaginate(prisma.auditLog, {
    limit,
    cursor,
    where,
    sortByField: 'createdAt',
    sortOrder: 'desc',
  });

  const logs = paginationResult.results;
  const nextCursor = paginationResult.nextCursor;

  // Extract unique actor IDs
  const actorIds = [...new Set(logs.map((log) => log.actorId).filter(Boolean))];

  // Fetch actors using Raw SQL to bypass Silent Guardian (which filters Soft Deleted users)
  let actorsMap = {};
  if (actorIds.length > 0) {
    const actors = await prisma.$queryRaw`
      SELECT id, first_name as "firstName", last_name as "lastName", email, is_active as "isActive", deleted_at as "deletedAt" 
      FROM users 
      WHERE id::text IN (${Prisma.join(actorIds)})
    `;

    actorsMap = actors.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {});
  }

  // Map actors back to logs
  const enrichedLogs = logs.map((log) => ({
    ...log,
    actor: log.actorId ? actorsMap[log.actorId] || null : null,
  }));

  return {
    data: enrichedLogs,
    pagination: {
      nextCursor,
      hasMore: nextCursor !== null,
    },
  };
};

export { create, findManyWithCursor };
