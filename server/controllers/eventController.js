import FeedEvent, { FEED_EVENT_TYPES, FEED_SURFACES } from '../models/FeedEvent.js';
import Post from '../models/Post.js';
import {
  applyEventsToProfile,
  hasProfileSignal,
} from '../services/ranking/profile.js';

/** Keep a batch small enough to validate cheaply and write in one round-trip. */
const MAX_BATCH = 50;
const MAX_META_BYTES = 2000;
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/**
 * Client metadata is optional and untrusted. Strip prototypes/functions by
 * round-tripping JSON and drop anything oversized so one event cannot bloat
 * the log.
 */
function cleanMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return undefined;
  try {
    const text = JSON.stringify(meta);
    if (!text || text.length > MAX_META_BYTES) return undefined;
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * POST /api/events/batch
 * body: { sessionId, events: [{ itemId, eventType, surface, position, dwellMs, meta }] }
 *
 * The client never sends author/circle/tags: those are resolved from the post
 * so a malicious client cannot poison someone's interest profile.
 */
export const batchEvents = async (req, res, next) => {
  try {
    const body = req.body || {};
    const rawEvents = Array.isArray(body.events) ? body.events : [];

    if (!rawEvents.length) {
      return res.status(400).json({ message: 'events must be a non-empty array' });
    }
    if (rawEvents.length > MAX_BATCH) {
      return res.status(413).json({ message: `At most ${MAX_BATCH} events per batch` });
    }

    const sessionId = String(body.sessionId || '').slice(0, 100);
    const allowedTypes = new Set(FEED_EVENT_TYPES);
    const allowedSurfaces = new Set(FEED_SURFACES);

    const clean = [];
    for (const raw of rawEvents) {
      if (!raw || !OBJECT_ID.test(String(raw.itemId || ''))) continue;
      const eventType = String(raw.eventType || '');
      if (!allowedTypes.has(eventType)) continue;

      clean.push({
        itemId: raw.itemId,
        eventType,
        surface: allowedSurfaces.has(String(raw.surface)) ? String(raw.surface) : 'home',
        position: Math.min(500, Math.max(0, Number(raw.position) || 0)),
        dwellMs: Math.min(3600000, Math.max(0, Number(raw.dwellMs) || 0)),
        meta: cleanMeta(raw.meta),
      });
    }

    if (!clean.length) {
      return res.status(400).json({ message: 'No valid events in the batch' });
    }

    const itemIds = [...new Set(clean.map((event) => String(event.itemId)))];
    const posts = await Post.find({ _id: { $in: itemIds } })
      .select('_id author circle tags interests')
      .lean();
    const postMap = new Map(posts.map((post) => [String(post._id), post]));

    const docs = [];
    for (const event of clean) {
      const post = postMap.get(String(event.itemId));
      if (!post) continue; // deleted or never existed — do not store noise
      docs.push({
        user: req.user._id,
        sessionId,
        itemType: 'post',
        itemId: post._id,
        author: post.author,
        circle: post.circle,
        eventType: event.eventType,
        surface: event.surface,
        position: event.position,
        dwellMs: event.dwellMs,
        tags: post.tags || [],
        interests: post.interests || [],
        meta: event.meta,
        createdAt: new Date(),
      });
    }

    if (!docs.length) {
      return res.json({
        accepted: 0,
        skipped: rawEvents.length,
        profileUpdated: false,
      });
    }

    await FeedEvent.insertMany(docs, { ordered: false });

    // The write above succeeded; a profile failure must not lose the events.
    let profileUpdated = false;
    if (hasProfileSignal(docs)) {
      try {
        await applyEventsToProfile(req.user._id, docs);
        profileUpdated = true;
      } catch (profileError) {
        console.error('Profile update failed:', profileError.message);
      }
    }

    return res.status(202).json({
      accepted: docs.length,
      skipped: rawEvents.length - docs.length,
      profileUpdated,
    });
  } catch (error) {
    return next(error);
  }
};

export default { batchEvents };
