import express from 'express';
import {
  getCatalog,
  uploadTrack,
  getMyTracks,
} from '../controllers/musicController.js';
import { protect } from '../middleware/authMiddleware.js';
import uploadMiddleware from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.get('/catalog', protect, getCatalog);
router.get('/my', protect, getMyTracks);
router.post('/upload', protect, uploadMiddleware.single('media'), uploadTrack);

export default router;
