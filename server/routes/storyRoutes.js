import express from 'express';
import { getStoryFeed, createStory, viewStory, deleteStory } from '../controllers/storyController.js';
import { protect } from '../middleware/authMiddleware.js';
import uploadMiddleware from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.get('/', protect, getStoryFeed);
router.post('/', protect, uploadMiddleware.single('media'), createStory);
router.post('/:id/view', protect, viewStory);
router.delete('/:id', protect, deleteStory);

export default router;
