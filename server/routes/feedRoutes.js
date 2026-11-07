import express from 'express';
import {
  getHomeFeed,
  getFeedDebug,
  getMyProfile,
  updateFeedPreferences,
  resetMyProfile,
} from '../controllers/feedController.js';
import { protect } from '../middleware/authMiddleware.js';
import { superAdminOnly } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.get('/home', protect, getHomeFeed);

// Member control: see, reset or opt out of personalisation.
router.get('/profile', protect, getMyProfile);
router.put('/profile', protect, updateFeedPreferences);
router.delete('/profile', protect, resetMyProfile);

// Admin-only explainability endpoint — never expose scores to members.
router.get('/debug/:itemId', protect, superAdminOnly, getFeedDebug);

export default router;
