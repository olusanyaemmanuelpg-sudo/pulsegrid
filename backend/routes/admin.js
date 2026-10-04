import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import requireAdmin from '../middleware/requireAdmin.js';
import {
  getAdminOverview,
  getAdminUsers,
  getAdminMonitors,
  updateUserRole,
  adminTestMonitor,
  adminDeleteMonitor,
  getAdminSystemStatus,
  updateAdminSystemStatus,
  createAdminIncident,
  updateAdminIncident,
  deleteAdminIncident,
  toggleMonitorVisibility,
} from '../controller/adminController.js';

const router = Router();

// Enforce both JWT authentication and Administrator role on all admin routes
router.use(requireAuth, requireAdmin);

router.get('/overview', getAdminOverview);
router.get('/users', getAdminUsers);
router.get('/monitors', getAdminMonitors);
router.patch('/users/:id/role', updateUserRole);
router.post('/monitors/:id/test', adminTestMonitor);
router.delete('/monitors/:id', adminDeleteMonitor);

// Status Page & Incident Management
router.get('/system-status', getAdminSystemStatus);
router.put('/system-status', updateAdminSystemStatus);
router.post('/incidents', createAdminIncident);
router.patch('/incidents/:id', updateAdminIncident);
router.delete('/incidents/:id', deleteAdminIncident);
router.patch('/monitors/:id/visibility', toggleMonitorVisibility);

export default router;
