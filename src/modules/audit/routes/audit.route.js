import { Router } from 'express';
import { getAuditLogs } from '../controllers/audit.controller.js';
import { auth } from '../../../middleware/auth.middleware.js';

const router = Router();

// Protect the route so Branch Admins (read:audit:branch) or Super Admins (read:audit:any) can access it
// By requiring 'read:audit:branch', scope escalation automatically allows 'read:audit:any'
router.get('/', auth('read:audit:branch'), getAuditLogs);

export { router as auditRoute };
