import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config } from '../../../infrastructure/config.js';

export const tokenTypes = {
  ACCESS: 'access',
  REFRESH: 'refresh',
  RESET_PASSWORD: 'resetPassword',
  VERIFY_EMAIL: 'verifyEmail',
};

/**
 * Generate a JWT token
 */
export const generateToken = (userId, sessionId, deviceId, expiresMinutes, type) => {
  const payload = {
    sub: userId,
    sessionId,
    deviceId,
    type,
    jti: crypto.randomUUID(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresMinutes * 60,
  };
  return jwt.sign(payload, config.jwt.secret);
};

/**
 * Generate auth tokens (Access + Refresh)
 */
export const generateAuthTokens = (userId, sessionId, deviceId) => {
  const accessTokenExpires = config.jwt.accessExpirationMinutes;
  const accessToken = generateToken(userId, sessionId, deviceId, accessTokenExpires, tokenTypes.ACCESS);

  const refreshTokenExpires = config.jwt.refreshExpirationDays * 24 * 60;
  const refreshToken = generateToken(userId, sessionId, deviceId, refreshTokenExpires, tokenTypes.REFRESH);

  return {
    access: {
      token: accessToken,
      expires: new Date(Date.now() + accessTokenExpires * 60 * 1000),
    },
    refresh: {
      token: refreshToken,
      expires: new Date(Date.now() + refreshTokenExpires * 60 * 1000),
    },
  };
};

/**
 * Verify JWT signature and expiration
 */
export const verifyToken = (token) => {
  return jwt.verify(token, config.jwt.secret);
};

/**
 * Hash a token using SHA-256 for secure database storage
 */
export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
