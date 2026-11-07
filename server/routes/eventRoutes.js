import express from 'express';
import { batchEvents } from '../controllers/eventController.js';
import { protect } from '../middleware/authMiddleware.js';
import { eventsRateLimit } from '../middleware/rateLimit.js';

const router = express.Router();

/**
 * Batched feed events. One request per flush, not one per impression.
 * The client uses fetch(..., { keepalive: true }) so the final flush still
 * lands when the tab is being closed.
 */
router.post('/batch', protect, eventsRateLimit, batchEvents);

export default router;
