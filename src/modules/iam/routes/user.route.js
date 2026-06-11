import express from 'express';
import { auth } from '../../../middleware/auth.middleware.js';
import { validate } from '../../../middleware/validate.middleware.js';
import { userValidator } from '../validators/user.validator.js';
import { userController } from '../controllers/user.controller.js';

const router = express.Router();

router.route('/me').get(auth(), userController.getMe);

router.route('/').get(auth('read:users:branch'), validate(userValidator.getUsers), userController.getUsers);

router
  .route('/:userId')
  .get(auth('read:users:branch'), validate(userValidator.getUser), userController.getUser)
  .delete(auth('delete:users:any'), validate(userValidator.archiveUser), userController.archiveUser);

router
  .route('/:userId/status')
  .patch(auth('update:users:status'), validate(userValidator.updateStatus), userController.updateStatus);

router
  .route('/:userId/restore')
  .post(auth('update:users:status'), validate(userValidator.restoreUser), userController.restoreUser);

export { router as userRoutes };
