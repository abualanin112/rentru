import httpStatus from 'http-status';
import { catchAsync } from '../../../shared/CatchAsync.js';
import * as invitationService from '../services/invitation.service.js';
import { pick } from '../../../shared/Pick.js';

const createInvitation = catchAsync(async (req, res) => {
  const invitation = await invitationService.createInvitation(req.user.id, req.body);
  res.status(httpStatus.CREATED).send(invitation);
});

const getInvitations = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['email', 'branchId', 'status']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);

  const result = await invitationService.getInvitations(filter, options);
  res.status(httpStatus.OK).send(result);
});

const revokeInvitation = catchAsync(async (req, res) => {
  await invitationService.revokeInvitation(req.user.id, req.params.inviteId);
  res.status(httpStatus.NO_CONTENT).send();
});

export const invitationController = {
  createInvitation,
  getInvitations,
  revokeInvitation,
};
