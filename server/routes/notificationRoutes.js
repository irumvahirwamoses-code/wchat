import express from 'express';
import {
  listNotifications,
  unreadCount,
  markRead,
  deleteNotification,
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, listNotifications);
router.get('/unread-count', protect, unreadCount);
router.put('/read', protect, markRead);
router.put('/:id/read', protect, markRead);
router.delete('/:id', protect, deleteNotification);

export default router;
