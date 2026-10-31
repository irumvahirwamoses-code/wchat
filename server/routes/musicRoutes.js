import express from 'express';
import {
  getCatalog,
  getCategories,
  getTrending,
  getForYou,
  uploadTrack,
  getMyTracks,
  saveTrack,
} from '../controllers/musicController.js';
import { protect } from '../middleware/authMiddleware.js';
import uploadMiddleware from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.get('/catalog', protect, getCatalog);
router.get('/categories', protect, getCategories);
router.get('/trending', protect, getTrending);
router.get('/for-you', protect, getForYou);
router.get('/my', protect, getMyTracks);
router.post('/upload', protect, uploadMiddleware.single('media'), uploadTrack);
router.post('/save', protect, saveTrack);

export default router;
