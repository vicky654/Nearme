import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireAdmin } from '../middleware/requireAdmin';
import {
  getAdminStats,
  getAdminUsers,
  updateUserStatus,
  deleteUserAccount,
  getAdminReports,
} from '../controllers/adminController';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/stats', getAdminStats);
router.get('/users', getAdminUsers);
router.patch('/users/:targetUserId', updateUserStatus);
router.delete('/users/:targetUserId', deleteUserAccount);
router.get('/reports', getAdminReports);

export default router;
