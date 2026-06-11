/**
 * Explicit response serializer for User objects.
 * Prevents accidental Prisma leakage (e.g., passwords).
 *
 * @param {Object} user Raw Prisma User object
 * @returns {Object} Sanitized user DTO
 */
const serializeUser = (user) => {
  if (!user) return null;
  // Explicit whitelist mapping
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    deletedAt: user.deletedAt,
    branchId: user.branchId,
    lastLoginAt: user.lastLoginAt,
    roles: user.roles, // If included in nested queries
    // explicitly NOT mapping `googleId`, `sessions`
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

/**
 * Serialize an array of users (e.g. for pagination)
 * @param {Array} users
 * @returns {Array}
 */
const serializeUsers = (users) => {
  if (!Array.isArray(users)) return [];
  return users.map(serializeUser);
};

export { serializeUser, serializeUsers };
