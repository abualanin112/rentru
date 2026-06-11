import httpStatus from 'http-status';
import { catchAsync } from '../../../shared/CatchAsync.js';
import * as roleService from '../services/role.service.js';

export const createRole = catchAsync(async (req, res) => {
  const role = await roleService.createRole(req.user.id, req.body);
  res.status(httpStatus.CREATED).send(role);
});

export const getRoles = catchAsync(async (req, res) => {
  const roles = await roleService.getRoles();
  res.send(roles);
});

export const getRoleById = catchAsync(async (req, res) => {
  const role = await roleService.getRoleById(req.params.roleId);
  res.send(role);
});

export const updateRole = catchAsync(async (req, res) => {
  const role = await roleService.updateRole(req.user.id, req.params.roleId, req.body);
  res.send(role);
});

export const deleteRole = catchAsync(async (req, res) => {
  await roleService.deleteRole(req.user.id, req.params.roleId);
  res.status(httpStatus.NO_CONTENT).send();
});

export const reassignRole = catchAsync(async (req, res) => {
  const result = await roleService.reassignRole(req.user.id, req.params.roleId, req.body.targetRoleId);
  res.send({ message: `Successfully reassigned ${result.reassigned} users` });
});

export const updateRolePermissions = catchAsync(async (req, res) => {
  await roleService.updateRolePermissions(req.user.id, req.params.roleId, req.body.permissionIds);
  res.status(httpStatus.NO_CONTENT).send();
});
