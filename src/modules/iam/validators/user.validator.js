import { z } from 'zod';

const getUsers = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    sortBy: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email().optional(),
    branchId: z.string().uuid().optional(),
    isActive: z
      .string()
      .transform((val) => val === 'true')
      .optional(),
  }),
});

const getUser = z.object({
  params: z.object({
    userId: z.string().uuid(),
  }),
});

const updateStatus = z.object({
  params: z.object({
    userId: z.string().uuid(),
  }),
  body: z.object({
    isActive: z.boolean(),
  }),
});

const archiveUser = z.object({
  params: z.object({
    userId: z.string().uuid(),
  }),
});

const restoreUser = z.object({
  params: z.object({
    userId: z.string().uuid(),
  }),
});

export const userValidator = {
  getUsers,
  getUser,
  updateStatus,
  archiveUser,
  restoreUser,
};
