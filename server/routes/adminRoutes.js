import express from 'express';
import {
  getOverview,
  listUsers,
  blockUser,
  unblockUser,
  setUserRole,
  listReports,
  resolveReport,
  blockReportedUser,
  listFeedback,
  updateFeedback,
  getSystem,
  updateSystem,
} from '../controllers/adminController.js';
import { protect } from '../middleware/authMiddleware.js';
import { superAdminOnly } from '../middleware/adminMiddleware.js';

const router = express.Router();

// Every admin endpoint requires a signed-in super admin.
router.use(protect, superAdminOnly);

router.get('/overview', getOverview);

router.get('/users', listUsers);
router.post('/users/:id/block', blockUser);
router.post('/users/:id/unblock', unblockUser);
router.put('/users/:id/role', setUserRole);

router.get('/reports', listReports);
router.put('/reports/:id', resolveReport);
router.post('/reports/:id/block', blockReportedUser);

router.get('/feedback', listFeedback);
router.put('/feedback/:id', updateFeedback);

router.get('/system', getSystem);
router.put('/system', updateSystem);

export default router;
