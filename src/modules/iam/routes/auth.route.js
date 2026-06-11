import express from 'express';
import passport from 'passport';
import { validate } from '../../../middleware/validate.middleware.js';
import { authValidation } from '../validators/auth.validator.js';
import * as authController from '../controllers/auth.controller.js';
import { auth } from '../../../middleware/auth.middleware.js';

const router = express.Router();

router.get('/google', validate(authValidation.googleAuth), (req, res, next) => {
  const statePayload = {
    deviceId: req.query.deviceId,
    inviteToken: req.query.inviteToken,
  };
  const stateStr = Buffer.from(JSON.stringify(statePayload)).toString('base64url');

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    state: stateStr,
  })(req, res, next);
});

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  authController.googleCallback,
);

router.post('/refresh', validate(authValidation.refreshToken), authController.refreshTokens);

router.post('/logout', auth(), validate(authValidation.logout), authController.logout);

export const authRoutes = router;
