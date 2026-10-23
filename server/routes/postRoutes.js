import express from 'express';
import {
  getFeed,
  getUserPosts,
  getCirclePosts,
  createPost,
  sparkPost,
  savePost,
  listSaved,
  pinPost,
  getExplore,
  deletePost,
  listComments,
  createComment,
  deleteComment,
} from '../controllers/postController.js';
import { protect } from '../middleware/authMiddleware.js';
import uploadMiddleware from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Feed, explore, saved & user/circle posts (static paths before /:id)
router.get('/feed', protect, getFeed);
router.get('/explore', protect, getExplore);
router.get('/saved', protect, listSaved);
router.get('/user/:userId', protect, getUserPosts);
router.get('/circle/:chatId', protect, getCirclePosts);

// Create — up to 10 media items (carousel)
router.post('/', protect, uploadMiddleware.array('media', 10), createPost);

// Reactions & actions
router.post('/:id/spark', protect, sparkPost);
router.post('/:id/save', protect, savePost);
router.post('/:id/pin', protect, pinPost);
router.delete('/:id', protect, deletePost);

// Comments
router.get('/:id/comments', protect, listComments);
router.post('/:id/comments', protect, createComment);
router.delete('/:id/comments/:commentId', protect, deleteComment);

export default router;
