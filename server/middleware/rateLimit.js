import rateLimit from 'express-rate-limit';

/**
 * Shared in-memory rate limits for a single Render/Koyeb instance.
 * Good enough for the free tier; add Redis-backed limits later if needed.
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: 'Too many API requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Feed events are batched, so a normal member sends a handful of requests per
 * minute. This cap still leaves room for several tabs while blocking scripts.
 */
export const eventsRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Too many feed events, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});
