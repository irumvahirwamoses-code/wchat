import express from 'express';
import {
  listCollections,
  getCollection,
  createCollection,
  addPostToCollection,
  removePostFromCollection,
  updateCollection,
  deleteCollection,
} from '../controllers/collectionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, listCollections);
router.get('/:id', protect, getCollection);
router.post('/', protect, createCollection);
router.post('/:id/posts', protect, addPostToCollection);
router.delete('/:id/posts/:postId', protect, removePostFromCollection);
router.patch('/:id', protect, updateCollection);
router.delete('/:id', protect, deleteCollection);

export default router;
