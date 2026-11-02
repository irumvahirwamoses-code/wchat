import express from 'express';
import { listNotes, createNote, deleteNote, toggleLikeNote } from '../controllers/noteController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, listNotes);
router.post('/', protect, createNote);
router.delete('/:id', protect, deleteNote);
router.post('/:id/like', protect, toggleLikeNote);

export default router;
