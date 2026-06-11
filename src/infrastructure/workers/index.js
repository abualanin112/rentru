import { startSessionCleanupJob, stopSessionCleanupJob } from './session-cleanup.js';
import { startInvitationCleanupJob, stopInvitationCleanupJob } from './invitation-cleanup.js';
import { startAutoDeactivationJob, stopAutoDeactivationJob } from './auto-deactivation.js';

export const startAllWorkers = () => {
  startSessionCleanupJob();
  startInvitationCleanupJob();
  startAutoDeactivationJob();
};

export const stopAllWorkers = () => {
  stopSessionCleanupJob();
  stopInvitationCleanupJob();
  stopAutoDeactivationJob();
};
