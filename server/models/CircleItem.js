import mongoose from 'mongoose';

/**
 * A single piece of content inside a Wchat Circle.
 *
 * Wchat Circles are mini social networks, so instead of one model per section we
 * keep a small, typed model that powers all five community sections:
 *
 *   reel         → a short video (Circle Reels)
 *   library      → a guide / document / trusted answer (Circle Library)
 *   challenge    → a competition / collaborative project (Circle Challenges)
 *   event        → a meeting / livestream / workshop with a date (Circle Events)
 *   opportunity  → a job / scholarship / mentorship / project (Circle Opportunities)
 *
 * Every item belongs to a Circle (`chat`) and has an author. `media` holds an
 * uploaded file path (`/uploads/...`) and `link` an external URL (e.g. a job
 * posting or a YouTube reel).
 */
export const CIRCLE_ITEM_KINDS = [
  'reel',
  'library',
  'challenge',
  'event',
  'opportunity',
];

const circleItemSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    kind: {
      type: String,
      enum: {
        values: CIRCLE_ITEM_KINDS,
        message: 'Invalid circle item kind: {VALUE}',
      },
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'A title is required'],
      trim: true,
      maxlength: [160, 'Title cannot exceed 160 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: '',
    },
    // Uploaded file path (video for reels, document for library…).
    media: {
      type: String,
      default: '',
    },
    /**
     * Reels can be stitched from several clips. `mediaItems` keeps the ordered
     * list of uploads; `media` mirrors the first clip for backwards
     * compatibility (older Reels and simple players keep working).
     */
    mediaItems: {
      type: [{ type: String }],
      default: [],
    },
    /* ------------------------------------------------------------ Reels tools */
    /** Cover image path. Empty means "use a frame of the video at coverTime". */
    cover: { type: String, default: '' },
    /** Which second of the video to use as the cover frame. */
    coverTime: { type: Number, default: 0, min: 0 },
    /** Playback speed multiplier applied on top of each clip's own speed. */
    speed: { type: Number, min: 0.25, max: 3, default: 1 },
    /** Named visual filter (maps to a CSS filter on the client). */
    filter: { type: String, default: 'none' },
    /** Music bed or voiceover. `original` keeps the recorded audio. */
    audio: {
      url: { type: String, default: '' },
      title: { type: String, trim: true, default: '' },
      startAt: { type: Number, default: 0 },
      volume: { type: Number, default: 1 },
    },
    /** Timed on-screen text (Instagram-style text overlays). */
    overlays: [
      {
        text: { type: String, trim: true, maxlength: 200, default: '' },
        x: { type: Number, default: 50 },
        y: { type: Number, default: 50 },
        start: { type: Number, default: 0 },
        end: { type: Number, default: 0 },
        color: { type: String, default: '#ffffff' },
        size: { type: Number, default: 24 },
        align: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
      },
    ],
    /** Hashtags used by the Reels/Explore discovery surfaces. */
    hashtags: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    /** Total runtime in seconds (all clips, after trimming and speed). */
    durationSec: { type: Number, default: 0, min: 0 },
    viewCount: { type: Number, default: 0, min: 0 },

    /**
     * Per-clip edit metadata for a Reel: which uploaded file it uses, how it is
     * trimmed, and how it is played. Kept alongside `mediaItems` (the raw
     * ordered list of upload paths) so the editor round-trips losslessly.
     */
    clips: {
      type: [
        {
          media: { type: String, default: '' },
          duration: { type: Number, default: 0, min: 0 },
          trimStart: { type: Number, default: 0, min: 0 },
          trimEnd: { type: Number, default: 0, min: 0 },
          speed: { type: Number, default: 1, min: 0.25, max: 4 },
          filter: { type: String, default: '' },
          muted: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
    /** Circle-only by default; `public` lets a Reel reach Explore. */
    visibility: {
      type: String,
      enum: ['circle', 'public'],
      default: 'circle',
      index: true,
    },
    /** Set when this Reel is a remix of someone else's. */
    remixOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CircleItem',
      default: null,
    },
    viewCount: { type: Number, default: 0, min: 0 },
    // External URL (job post, video link, registration form…).
    link: {
      type: String,
      trim: true,
      default: '',
    },
    // Events: when it happens. Opportunities/challenges: an optional deadline.
    date: {
      type: Date,
      default: null,
    },
    location: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
    },
    // e.g. "job", "scholarship", "mentorship" for opportunities.
    tags: {
      type: [{ type: String, trim: true, maxlength: 40 }],
      default: [],
    },
    // Sparks = Wchat likes, available on every item.
    sparks: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    // Challenges & events: who is taking part.
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

circleItemSchema.index({ chat: 1, kind: 1, createdAt: -1 });
circleItemSchema.index({ kind: 1, createdAt: -1 });

circleItemSchema.virtual('sparkCount').get(function () {
  return (this.sparks || []).length;
});

const CircleItem = mongoose.model('CircleItem', circleItemSchema);

export default CircleItem;
