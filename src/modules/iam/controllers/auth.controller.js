import httpStatus from 'http-status';
import { catchAsync } from '../../../shared/CatchAsync.js';
import * as authService from '../services/auth.service.js';
import { config } from '../../../infrastructure/config.js';

export const googleCallback = catchAsync(async (req, res) => {
  let statePayload = {};
  try {
    if (req.query.state) {
      const decodedStr = Buffer.from(req.query.state, 'base64url').toString('utf-8');
      statePayload = JSON.parse(decodedStr);
    }
  } catch {
    // Ignore malformed state
  }

  const { deviceId = 'unknown-device', inviteToken } = statePayload;

  const result = await authService.handleGoogleLogin(req.user, deviceId, inviteToken, req.ip);

  // Set Refresh Token in HttpOnly cookie
  res.cookie('refreshToken', result.tokens.refresh.token, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'strict',
    maxAge: config.jwt.refreshExpirationDays * 24 * 60 * 60 * 1000,
  });

  // Redirect to frontend with access token in fragment or query
  const frontendUrl = config.cors.origins[0];
  res.redirect(`${frontendUrl}/auth/callback?accessToken=${result.tokens.access.token}&userId=${result.user.id}`);
});

export const refreshTokens = catchAsync(async (req, res) => {
  const { deviceId } = req.body;
  const refreshToken = req.cookies.refreshToken;

  const tokens = await authService.refreshAuth(refreshToken, deviceId, req.ip);

  res.cookie('refreshToken', tokens.refresh.token, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'strict',
    maxAge: config.jwt.refreshExpirationDays * 24 * 60 * 60 * 1000,
  });

  res.status(httpStatus.OK).json({
    message: 'Tokens refreshed',
    data: { access: tokens.access },
  });
});

export const logout = catchAsync(async (req, res) => {
  await authService.logout(req.user.id);

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'strict',
  });

  res.status(httpStatus.NO_CONTENT).send();
});
