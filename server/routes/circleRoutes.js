import express from 'express';
import {
  listItems,
  createItem,
  updateItem,
  deleteItem,
  toggleSpark,
  toggleParticipate,
  remixItem,
  listReelsFeed,
  listDiscoverFeed,
  listMyCommunities,
} from '../controllers/circleController.js';
import {
  getOps,
  startCircle,
  stopCircle,
  restartCircle,
  moveCircle,
} from '../controllers/circleOpsController.js';
import { createDecision, listDecisions } from '../controllers/decisionController.js';
import { protect } from '../middleware/authMiddleware.js';
import uploadMiddleware from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Feeds & overview (static paths first so they don't match `/:chatId`).
router.get('/mine', protect, listMyCommunities);
router.get('/feed/reels', protect, listReelsFeed);
router.get('/feed/discover', protect, listDiscoverFeed);

// Items inside a Circle.
router.get('/:chatId/items', protect, listItems);
router.post(
  '/:chatId/items',
  protect,
  uploadMiddleware.fields([
    { name: 'media', maxCount: 12 },
    { name: 'audio', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
  ]),
  createItem
);
router.put(
  '/:chatId/items/:id',
  protect,
  uploadMiddleware.fields([
    { name: 'media', maxCount: 12 },
    { name: 'audio', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
  ]),
  updateItem
);
router.delete('/:chatId/items/:id', protect, deleteItem);

// Reuse: build a new Reel from someone else's (Sharing & reuse control).
router.post('/:chatId/items/:id/remix', protect, remixItem);

// Reactions.
router.post('/:chatId/items/:id/spark', protect, toggleSpark);
router.post('/:chatId/items/:id/join', protect, toggleParticipate);

// Circle operations — group automation & resource management.
router.get('/:chatId/ops', protect, getOps);
router.post('/:chatId/ops/start', protect, startCircle);
router.post('/:chatId/ops/stop', protect, stopCircle);
router.post('/:chatId/ops/restart', protect, restartCircle);
router.post('/:chatId/ops/move', protect, moveCircle);

// Circle decisions — the group decision support system.
router.post('/:chatId/decisions', protect, createDecision);
router.get('/:chatId/decisions', protect, listDecisions);

export default router;
