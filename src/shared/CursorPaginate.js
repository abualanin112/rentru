import httpStatus from 'http-status';
import { z } from 'zod';
import { ApiError } from './ApiError.js';

/**
 * Universal Chronological Cursor Pagination Engine
 *
 * Performs cursor-based pagination using a deterministic tuple (createdAt, id).
 * This eliminates the risk of missing or duplicating records when multiple
 * events occur in the exact same millisecond.
 *
 * It is fully compatible with UUIDv4 primary keys and Prisma delegates.
 *
 * @param {object} model - The Prisma model delegate (e.g. prisma.auditLog)
 * @param {object} options - Pagination options
 * @param {string} [options.cursor] - Base64 encoded JSON string of the last seen record's tuple
 * @param {number} [options.limit=10] - The number of records to fetch
 * @param {object} [options.where] - Additional Prisma filters
 * @param {object} [options.include] - Relational selections to include
 * @param {string} [options.sortByField='createdAt'] - Primary chronological field
 * @param {string} [options.sortOrder='desc'] - Sorting direction ('desc' or 'asc')
 * @returns {Promise<{results: Array, nextCursor: string|null, hasNextPage: boolean}>}
 */
const cursorPaginate = async (model, options = {}) => {
  const limit = options.limit && parseInt(options.limit, 10) > 0 ? parseInt(options.limit, 10) : 10;
  const sortByField = options.sortByField || 'createdAt';
  const sortOrder = options.sortOrder || 'desc';
  const take = limit + 1; // Fetch one extra to determine hasNextPage

  let parsedCursor = null;
  if (options.cursor) {
    try {
      const decoded = Buffer.from(options.cursor, 'base64').toString('utf-8');
      parsedCursor = JSON.parse(decoded);
    } catch {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid cursor format');
    }
  }

  const baseWhere = options.where || {};
  let cursorWhere = {};

  if (parsedCursor) {
    // eslint-disable-next-line security/detect-object-injection
    const primaryValue = parsedCursor[sortByField];
    const secondaryValue = parsedCursor.id;

    if (sortOrder === 'desc') {
      cursorWhere = {
        OR: [
          { [sortByField]: { lt: primaryValue } },
          {
            [sortByField]: primaryValue,
            id: { lt: secondaryValue },
          },
        ],
      };
    } else {
      cursorWhere = {
        OR: [
          { [sortByField]: { gt: primaryValue } },
          {
            [sortByField]: primaryValue,
            id: { gt: secondaryValue },
          },
        ],
      };
    }
  }

  const finalWhere = parsedCursor ? { AND: [baseWhere, cursorWhere] } : baseWhere;

  const results = await model.findMany({
    take,
    where: finalWhere,
    ...(options.include && { include: options.include }),
    orderBy: [
      { [sortByField]: sortOrder },
      { id: sortOrder }, // Must match the primary sort direction to prevent chaotic interleaving
    ],
  });

  const hasNextPage = results.length > limit;
  const data = hasNextPage ? results.slice(0, -1) : results;

  let nextCursor = null;
  if (hasNextPage) {
    const lastRecord = data[data.length - 1];
    const nextCursorObj = {
      // eslint-disable-next-line security/detect-object-injection
      [sortByField]: lastRecord[sortByField],
      id: lastRecord.id,
    };
    nextCursor = Buffer.from(JSON.stringify(nextCursorObj)).toString('base64');
  }

  return {
    results: data,
    nextCursor,
    hasNextPage,
  };
};

/**
 * Universal generic cursor schema for validation.
 * It validates that the string is a valid Base64 payload, decodes to JSON,
 * and contains a valid UUID `id` along with at least one chronological field.
 */
const genericCursorSchema = z
  .string()
  .refine(
    (val) => {
      try {
        const decoded = Buffer.from(val, 'base64').toString('utf-8');

        // Must not be empty or whitespace only
        if (!decoded.trim()) return false;

        const parsed = JSON.parse(decoded);

        if (!parsed || typeof parsed !== 'object') return false;

        // Ensure it has an id which is a UUID
        if (!parsed.id || typeof parsed.id !== 'string') return false;

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(parsed.id)) return false;

        // Must have at least one other field for tuple sorting (e.g. createdAt)
        const keys = Object.keys(parsed);
        if (keys.length < 2) return false;

        return true;
      } catch {
        return false;
      }
    },
    {
      message: 'Invalid cursor format',
    },
  )
  .optional();

export { cursorPaginate, genericCursorSchema };
