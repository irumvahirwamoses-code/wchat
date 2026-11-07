import mongoose from 'mongoose';

const ObjectId = mongoose.Schema.Types.ObjectId;

/**
 * Keep this list stable — the ranker, the profile builder and the client all
 * agree on these names. Adding a type is safe; renaming one is a migration.
 */
export const FEED_EVENT_TYPES = [
  // Exposure
  'impression',
  'view',
  'dwell',
  'video_start',
  'video_complete',
  'skip',
  // Positive
  'spark',
  'unspark',
  'comment',
  'save',
  'unsave',
  'share',
  'click',
  'join',
  'follow',
  'profile_click',
  'more_like_this',
  // Negative
  'hide',
  'not_interested',
  'less_like_this',
  'report',
  'block',
  'mute_source',
  'scroll_past_fast',
];

export const FEED_SURFACES = [
  'home',
  'following',
  'explore',
  'reels',
  'news',
  'jobs',
  'profile',
  'other',
];

/**
 * One row per interaction with a feed item.
 *
 * Events are append-only and deliberately cheap to write: the batch endpoint
 * inserts them with `insertMany`, then folds them into `UserInterestProfile`.
 * A TTL index keeps the raw log bounded (180 days) without deleting the
 * aggregated profile.
 */
const feedEventSchema = new mongoose.Schema(
  {
    user: {
      type: ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },
    itemType: {
      type: String,
      enum: ['post'],
      default: 'post',
    },
    itemId: {
      type: ObjectId,
      required: true,
      index: true,
    },
    /** Denormalised from the post so profiles can be rebuilt without joins. */
    author: {
      type: ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    circle: {
      type: ObjectId,
      ref: 'Chat',
      default: null,
      index: true,
    },
    eventType: {
      type: String,
      enum: {
        values: FEED_EVENT_TYPES,
        message: 'Unknown feed event type: {VALUE}',
      },
      required: true,
      index: true,
    },
    surface: {
      type: String,
      enum: {
        values: FEED_SURFACES,
        message: 'Unknown feed surface: {VALUE}',
      },
      default: 'home',
    },
    /** Zero-based position in the rendered feed (useful for position bias). */
    position: {
      type: Number,
      default: 0,
      min: 0,
      max: 500,
    },
    /** Only meaningful for `dwell`; milliseconds the item stayed visible. */
    dwellMs: {
      type: Number,
      default: 0,
      min: 0,
      max: 60 * 60 * 1000,
    },
    tags: {
      type: [String],
      default: [],
    },
    interests: {
      type: [String],
      default: [],
    },
    language: {
      type: String,
      trim: true,
      maxlength: 10,
      default: '',
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

// Batch/profile reads: "everything this person did recently".
feedEventSchema.index({ user: 1, createdAt: -1 });
// Seen-item lookup for the ranker ("did this person already see it?").
feedEventSchema.index({ user: 1, eventType: 1, createdAt: -1 });
// Recency / seen-item checks.
feedEventSchema.index({ user: 1, itemId: 1, eventType: 1, createdAt: -1 });
// Item-level analytics.
feedEventSchema.index({ itemId: 1, eventType: 1, createdAt: -1 });
// Raw log expires after 180 days; the profile stays.
feedEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

const FeedEvent = mongoose.model('FeedEvent', feedEventSchema);

export default FeedEvent;
