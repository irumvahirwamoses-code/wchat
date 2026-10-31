import express from 'express';
import {
  getStoryFeed,
  createStory,
  viewStory,
  deleteStory,
  likeStory,
  reactToStory,
  replyToStory,
  voteSticker,
  answerQuiz,
  slideSticker,
  answerQuestion,
  listViewers,
} from '../controllers/storyController.js';
import { protect } from '../middleware/authMiddleware.js';
import uploadMiddleware from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.get('/', protect, getStoryFeed);
router.post('/', protect, uploadMiddleware.single('media'), createStory);

router.post('/:id/view', protect, viewStory);
router.get('/:id/viewers', protect, listViewers);
router.post('/:id/like', protect, likeStory);
router.post('/:id/react', protect, reactToStory);
router.post('/:id/reply', protect, replyToStory);

router.post('/:id/stickers/:stickerId/vote', protect, voteSticker);
router.post('/:id/stickers/:stickerId/quiz', protect, answerQuiz);
router.post('/:id/stickers/:stickerId/slider', protect, slideSticker);
router.post('/:id/stickers/:stickerId/answer', protect, answerQuestion);

router.delete('/:id', protect, deleteStory);

export default router;
