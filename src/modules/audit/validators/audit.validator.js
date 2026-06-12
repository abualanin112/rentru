import { z } from 'zod';
import { genericCursorSchema } from '../../../shared/CursorPaginate.js';

export const getAuditLogsSchema = z.object({
  query: z.object({
    cursor: genericCursorSchema,
    limit: z.coerce.number().min(1).max(100).default(50),
    event: z.string().optional(),
    targetType: z.string().optional(),
    targetId: z.string().uuid().optional(),
    branchId: z.string().uuid().optional(),
    action: z.string().optional(),
    actorId: z.string().uuid().optional(),
  }),
});
