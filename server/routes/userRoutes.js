import express from 'express';
import {
  searchUsers,
  checkUsername,
  suggestUsernames,
  updateProfile,
  followUser,
  getUserSocial,
  getOnboarding,
  updateInterests,
  joinCircle,
  leaveCircle,
  completeOnboarding,
  getPublicProfile,
  getProfileInsights,
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import uploadMiddleware from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.get('/', protect, searchUsers);
// Public: username availability + suggestions are used while registering
router.get('/check-username/:username', checkUsername);
router.get('/username-suggestions', suggestUsernames);

// Wchat onboarding (fields + Circles)
router.get('/onboarding', protect, getOnboarding);
// Profile insights for the signed-in account (before /:id so it is not shadowed)
router.get('/insights', protect, getProfileInsights);
router.put('/interests', protect, updateInterests);
router.post('/onboarding/join', protect, joinCircle);
router.post('/onboarding/leave', protect, leaveCircle);
router.post('/onboarding/complete', protect, completeOnboarding);

router.put('/profile', protect, uploadMiddleware.single('profilePicture'), updateProfile);
router.post('/:id/follow', protect, followUser);
// The people a profile is connected to (Joins + Following).
router.get('/:id/social', protect, getUserSocial);
// Public profile — declared after the static routes above so it cannot shadow them.
router.get('/:id', protect, getPublicProfile);

export default router;
