import express from 'express';
import {
  getDecision,
  addIdea,
  publishIdea,
  rateIdea,
  advanceDecision,
  decide,
} from '../controllers/decisionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// One decision session.
router.get('/:id', protect, getDecision);

// Ideas — everyone contributes in parallel.
router.post('/:id/ideas', protect, addIdea);
router.post('/:id/ideas/:ideaId/publish', protect, publishIdea);
router.post('/:id/ideas/:ideaId/rate', protect, rateIdea);

// Running the session (staff) — rounds, then the recorded decision.
router.post('/:id/advance', protect, advanceDecision);
router.post('/:id/decide', protect, decide);

export default router;
