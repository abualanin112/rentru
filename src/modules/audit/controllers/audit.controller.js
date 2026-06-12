import httpStatus from 'http-status';
import { getAuditLogsSchema } from '../validators/audit.validator.js';
import { findManyWithCursor } from '../audit.repository.js';
import { catchAsync } from '../../../shared/CatchAsync.js';
import { matchesPermission } from '../../iam/services/permission.service.js';

export const getAuditLogs = catchAsync(async (req, res) => {
  const query = getAuditLogsSchema.parse({ query: req.query }).query;

  // Enforce Branch Isolation Strategy (Mandatory Branch Enforcement)
  // If the user lacks 'read:audit:any', they MUST be restricted to their own branch
  if (!matchesPermission(req.user.permissions, 'read:audit:any')) {
    query.branchId = req.user.branchId;
  }

  const result = await findManyWithCursor(query);

  res.status(httpStatus.OK).json({
    status: 'success',
    ...result,
  });
});
