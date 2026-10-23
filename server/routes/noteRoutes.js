import express from 'express';
import { listNotes, createNote, deleteNote } from '../controllers/noteController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, listNotes);
router.post('/', protect, createNote);
router.delete('/:id', protect, deleteNote);

export default router;
