import { z } from 'zod';

export const createRoleSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(50),
    description: z.string().max(500).optional(),
    level: z.number().int().min(0).max(100).default(0),
  }),
});

export const updateRoleSchema = z.object({
  params: z.object({
    roleId: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().min(2).max(50).optional(),
    description: z.string().max(500).optional(),
    level: z.number().int().min(0).max(100).optional(),
  }),
});

export const getRoleSchema = z.object({
  params: z.object({
    roleId: z.string().uuid(),
  }),
});

export const reassignRoleSchema = z.object({
  params: z.object({
    roleId: z.string().uuid(), // The source role
  }),
  body: z.object({
    targetRoleId: z.string().uuid(),
  }),
});

export const updateRolePermissionsSchema = z.object({
  params: z.object({
    roleId: z.string().uuid(),
  }),
  body: z.object({
    permissionIds: z.array(z.string().uuid()),
  }),
});
