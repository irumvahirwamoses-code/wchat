import express from 'express';
import {
  submitFeedback,
  myFeedback,
  submitReport,
} from '../controllers/supportController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/feedback', submitFeedback);
router.get('/feedback', myFeedback);
router.post('/report', submitReport);

export default router;
