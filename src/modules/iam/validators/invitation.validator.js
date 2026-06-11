import { z } from 'zod';

const createInvitation = z.object({
  body: z.object({
    email: z.string().email(),
    roleId: z.string().uuid(),
    branchId: z.string().uuid().optional(),
  }),
});

const getInvitations = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    sortBy: z.string().optional(),
    email: z.string().email().optional(),
    branchId: z.string().uuid().optional(),
    status: z.enum(['PENDING', 'COMPLETED', 'REVOKED', 'EXPIRED']).optional(),
  }),
});

const revokeInvitation = z.object({
  params: z.object({
    inviteId: z.string().uuid(),
  }),
});

export const invitationValidator = {
  createInvitation,
  getInvitations,
  revokeInvitation,
};
