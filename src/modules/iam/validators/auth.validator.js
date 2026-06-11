import { z } from 'zod';

export const authValidation = {
  // We use query parameter for deviceId on initial login
  googleAuth: z.object({
    query: z.object({
      deviceId: z.string().min(1, 'Device ID is required').max(255),
      inviteToken: z.string().optional(),
    }),
  }),

  refreshToken: z.object({
    body: z.object({
      deviceId: z.string().min(1, 'Device ID is required').max(255),
    }),
    cookies: z.object({
      refreshToken: z.string().min(1, 'Refresh token cookie is required'),
    }),
  }),

  logout: z.object({
    body: z.object({
      deviceId: z.string().min(1, 'Device ID is required').max(255),
    }),
  }),
};
