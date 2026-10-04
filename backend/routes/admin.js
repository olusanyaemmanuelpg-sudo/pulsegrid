import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import requireAdmin from '../middleware/requireAdmin.js';
import {
  getAdminOverview,
  getAdminUsers,
  getAdminMonitors,
  updateUserRole,
} from '../controller/adminController.js';

const router = Router();

// Enforce both JWT authentication and Administrator role on all admin routes
router.use(requireAuth, requireAdmin);

router.get('/overview', getAdminOverview);
router.get('/users', getAdminUsers);
router.get('/monitors', getAdminMonitors);
router.patch('/users/:id/role', updateUserRole);

export default router;
