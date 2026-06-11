import express from 'express';
import { auth } from '../../../middleware/auth.middleware.js';
import { validate } from '../../../middleware/validate.middleware.js';
import * as roleController from '../controllers/role.controller.js';
import * as roleValidator from '../validators/role.validator.js';

const router = express.Router();

router
  .route('/')
  .post(auth('create:roles:any'), validate(roleValidator.createRoleSchema), roleController.createRole)
  .get(auth('read:roles:any'), roleController.getRoles);

router
  .route('/:roleId')
  .get(auth('read:roles:any'), validate(roleValidator.getRoleSchema), roleController.getRoleById)
  .patch(auth('update:roles:any'), validate(roleValidator.updateRoleSchema), roleController.updateRole)
  .delete(auth('delete:roles:any'), validate(roleValidator.getRoleSchema), roleController.deleteRole);

router
  .route('/:roleId/reassign')
  .post(auth('update:roles:any'), validate(roleValidator.reassignRoleSchema), roleController.reassignRole);

router
  .route('/:roleId/permissions')
  .put(auth('update:roles:any'), validate(roleValidator.updateRolePermissionsSchema), roleController.updateRolePermissions);

export const roleRoutes = router;
