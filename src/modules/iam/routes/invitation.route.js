import express from 'express';
import { auth } from '../../../middleware/auth.middleware.js';
import { validate } from '../../../middleware/validate.middleware.js';
import { invitationValidator } from '../validators/invitation.validator.js';
import { invitationController } from '../controllers/invitation.controller.js';

const router = express.Router();

router
  .route('/')
  .post(
    auth('create:invitation:branch'),
    validate(invitationValidator.createInvitation),
    invitationController.createInvitation,
  )
  .get(auth('read:invitation:branch'), validate(invitationValidator.getInvitations), invitationController.getInvitations);

router
  .route('/:inviteId')
  .delete(
    auth('delete:invitation:branch'),
    validate(invitationValidator.revokeInvitation),
    invitationController.revokeInvitation,
  );

export { router as invitationRoutes };
