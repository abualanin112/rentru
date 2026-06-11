import httpStatus from 'http-status';
import { catchAsync } from '../../../shared/CatchAsync.js';
import * as userService from '../services/user.service.js';
import { serializeUser, serializeUsers } from '../user.serializer.js';
import { pick } from '../../../shared/Pick.js';

const getMe = catchAsync(async (req, res) => {
  const user = await userService.getMe(req.user.id);
  res.status(httpStatus.OK).send(serializeUser(user));
});

const getUsers = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['firstName', 'lastName', 'email', 'branchId', 'isActive']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);

  const result = await userService.getUsers(filter, options);

  res.status(httpStatus.OK).send({
    results: serializeUsers(result.results),
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
    totalResults: result.totalResults,
  });
});

const getUser = catchAsync(async (req, res) => {
  const user = await userService.getUserById(req.params.userId);
  res.status(httpStatus.OK).send(serializeUser(user));
});

const updateStatus = catchAsync(async (req, res) => {
  const { isActive } = req.body;
  const { userId } = req.params;
  const actorId = req.user.id;

  let user;
  if (isActive) {
    user = await userService.activateUser(actorId, userId);
  } else {
    user = await userService.suspendUser(actorId, userId);
  }

  res.status(httpStatus.OK).send(serializeUser(user));
});

const archiveUser = catchAsync(async (req, res) => {
  const user = await userService.archiveUser(req.user.id, req.params.userId);
  res.status(httpStatus.OK).send(serializeUser(user));
});

const restoreUser = catchAsync(async (req, res) => {
  const user = await userService.restoreUser(req.user.id, req.params.userId);
  res.status(httpStatus.OK).send(serializeUser(user));
});

export const userController = {
  getMe,
  getUsers,
  getUser,
  updateStatus,
  archiveUser,
  restoreUser,
};
