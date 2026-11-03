import express from 'express';
import {
  submitFeedback,
  myFeedback,
  submitReport,
  replyFeedback,
  adminFeedback,
} from '../controllers/supportController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/feedback', submitFeedback);
router.get('/feedback', myFeedback);
router.get('/feedback/admin', adminFeedback);
router.patch('/feedback/:id/reply', replyFeedback);
router.post('/report', submitReport);

export default router;
