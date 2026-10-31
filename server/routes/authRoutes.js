import express from 'express';
import {
  suggestUsernames,
  getChannels,
  requestRegistration,
  verifyRegistration,
  resendVerification,
  login,
  getMe,
  updatePreferences,
  toggleMuteStories,
  changePassword,
  toggleBlock,
  listBlocked,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public: username suggestions while typing a name
router.get('/usernames', suggestUsernames);
// Public: which verification channels are deliverable
router.get('/channels', getChannels);

// Two-step registration: request a code, then confirm it to create the account
router.post('/register', requestRegistration);
router.post('/register/verify', verifyRegistration);
router.post('/register/resend', resendVerification);

router.post('/login', login);
router.get('/me', protect, getMe);

// Account preferences (theme, data saver, privacy, sharing) + blocked accounts
router.put('/preferences', protect, updatePreferences);
router.post('/mute-stories/:userId', protect, toggleMuteStories);
router.delete('/mute-stories/:userId', protect, toggleMuteStories);
router.put('/password', protect, changePassword);
router.get('/blocked', protect, listBlocked);
router.post('/block/:userId', protect, toggleBlock);
router.delete('/block/:userId', protect, toggleBlock);

export default router;
