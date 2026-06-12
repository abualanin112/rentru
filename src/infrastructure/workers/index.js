import { startSessionCleanupJob, stopSessionCleanupJob } from './session-cleanup.js';
import { startInvitationCleanupJob, stopInvitationCleanupJob } from './invitation-cleanup.js';
import { startAutoDeactivationJob, stopAutoDeactivationJob } from './auto-deactivation.js';
import { startAuditExportJob, stopAuditExportJob } from './audit-export.worker.js';

export const startAllWorkers = () => {
  startSessionCleanupJob();
  startInvitationCleanupJob();
  startAutoDeactivationJob();
  startAuditExportJob();
};

export const stopAllWorkers = () => {
  stopSessionCleanupJob();
  stopInvitationCleanupJob();
  stopAutoDeactivationJob();
  stopAuditExportJob();
};
