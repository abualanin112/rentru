import { prisma } from '../../../infrastructure/prisma.js';
import { paginate } from '../../../shared/Paginate.js';

/**
 * Repository layer for User entity using Prisma Client
 */

/**
 * Create a new user
 * @param {Object} userBody
 * @param {Object} [tx=prisma] - Optional Prisma transaction client
 * @returns {Promise<Object>}
 */
const create = async (userBody, tx = prisma) => {
  return tx.user.create({
    data: userBody,
  });
};

/**
 * Find user by ID
 * @param {string} id
 * @param {Object} [tx=prisma] - Optional Prisma transaction client
 * @returns {Promise<Object|null>}
 */
const findById = async (id, options = {}, tx = prisma) => {
  const { select } = options;

  return tx.user.findUnique({
    where: { id },
    ...(select && { select }),
  });
};

/**
 * Find user by email
 * @param {string} email
 * @param {Object} [tx=prisma] - Optional Prisma transaction client
 * @returns {Promise<Object|null>}
 */
const findByEmail = async (email, tx = prisma) => {
  return tx.user.findUnique({
    where: { email },
  });
};

/**
 * Check if email is already taken
 * @param {string} email
 * @param {string} [excludeUserId] - Exclude user with this ID from check
 * @param {Object} [tx=prisma] - Optional Prisma transaction client
 * @returns {Promise<boolean>}
 */
const isEmailTaken = async (email, excludeUserId, tx = prisma) => {
  const user = await tx.user.findFirst({
    where: {
      email,
      NOT: excludeUserId ? { id: excludeUserId } : undefined,
    },
  });
  return !!user;
};

/**
 * Update user by ID
 * @param {string} id
 * @param {Object} updateBody
 * @param {Object} [tx=prisma] - Optional Prisma transaction client
 * @returns {Promise<Object>}
 */
const updateById = async (id, updateBody, tx = prisma) => {
  return tx.user.update({
    where: { id },
    data: updateBody,
  });
};

/**
 * Delete user by ID
 * @param {string} id
 * @param {Object} [tx=prisma] - Optional Prisma transaction client
 * @returns {Promise<Object>}
 */
const deleteById = async (id, tx = prisma) => {
  return tx.user.delete({
    where: { id },
  });
};

/**
 * Paginate users
 * @param {Object} filter - Where filter criteria
 * @param {Object} options - Pagination options
 * @param {Object} [tx=prisma] - Optional Prisma transaction client
 * @returns {Promise<Object>} Standard relational pagination response shape
 */
const paginateUsers = async (filter, options, tx = prisma) => {
  const ALLOWED_POPULATIONS = ['notes'];
  const paginateOptions = { ...options };

  if (paginateOptions.populate) {
    paginateOptions.populate = paginateOptions.populate
      .split(',')
      .map((rel) => rel.trim())
      .filter((rel) => ALLOWED_POPULATIONS.includes(rel))
      .join(',');
  }

  return paginate(tx.user, filter, paginateOptions);
};

export { create, findById, findByEmail, isEmailTaken, updateById, deleteById, paginateUsers };
