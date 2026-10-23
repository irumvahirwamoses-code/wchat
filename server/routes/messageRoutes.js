import express from 'express';
import {
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  reactMessage,
  markChatSeen,
  startLiveLocation,
  updateLiveLocation,
  stopLiveLocation,
} from '../controllers/messageController.js';
import { protect } from '../middleware/authMiddleware.js';
import uploadMiddleware from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.put('/:chatId/seen', protect, markChatSeen);

router.put('/:id/react', protect, reactMessage);
router.put('/:id/live-location/stop', protect, stopLiveLocation);
router.put('/:id/live-location', protect, updateLiveLocation);
router.put('/:id', protect, editMessage);
router.delete('/:id', protect, deleteMessage);

router.get('/:chatId', protect, getMessages);
router.post('/live-location', protect, startLiveLocation);
router.post(
  '/',
  protect,
  uploadMiddleware.fields([{ name: 'file', maxCount: 1 }]),
  sendMessage
);

export default router;
