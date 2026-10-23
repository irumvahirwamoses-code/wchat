import mongoose from 'mongoose';

export const POST_MEDIA_TYPES = ['', 'image', 'video'];

const ObjectId = mongoose.Schema.Types.ObjectId;

/**
 * A Wchat post. Posts power the Home feed (Instagram-style) and Circle walls.
 *
 * A post either belongs to a **Circle** (`circle` set → visible to its members)
 * or is a **timeline** post (`circle: null` → visible to the author and the
 * people who follow them). Sparks are Wchat "likes".
 */
const postSchema = new mongoose.Schema(
  {
    author: {
      type: ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    circle: {
      type: ObjectId,
      ref: 'Chat',
      default: null,
      index: true,
    },
    text: {
      type: String,
      trim: true,
      maxlength: [3000, 'A post cannot exceed 3000 characters'],
      default: '',
    },
    media: {
      type: String,
      default: '',
    },
    mediaType: {
      type: String,
      enum: {
        values: POST_MEDIA_TYPES,
        message: 'Invalid media type: {VALUE}',
      },
      default: '',
    },
    fileName: {
      type: String,
      default: '',
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    // Sparks = Wchat likes.
    sparks: [
      {
        type: ObjectId,
        ref: 'User',
      },
    ],
    commentCount: {
      type: Number,
      default: 0,
    },
    shareCount: {
      type: Number,
      default: 0,
    },
    // Snapshot of the Circle's interests, used by the Phase E ranking.
    interests: {
      type: [{ type: String }],
      default: [],
    },
    /**
     * Carousel items — up to 10 photos/videos in one swipeable post.
     * The single `media` / `mediaType` fields above remain for the first item
     * (and for older posts) so the feed can render them uniformly.
     */
    mediaItems: {
      type: [
        {
          _id: false,
          url: { type: String, required: true },
          type: { type: String, enum: POST_MEDIA_TYPES, default: 'image' },
          fileName: { type: String, default: '' },
          fileSize: { type: Number, default: 0 },
        },
      ],
      default: [],
      validate: {
        validator: (items) => !items || items.length <= 10,
        message: 'A post can contain at most 10 media items',
      },
    },
    /** Free-form place tag (city/sector/event venue) — never a precise GPS point. */
    location: {
      type: String,
      trim: true,
      maxlength: [120, 'Location tag too long'],
      default: '',
    },
    /** `#hashtag` keywords extracted from the caption. */
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    /** `@username` mentions extracted from the caption. */
    mentions: {
      type: [String],
      default: [],
    },
    /** Bookmarks (Wchat "Saved"). */
    savedBy: {
      type: [ObjectId],
      default: [],
    },
    /** Set when the author pins the post to their profile grid (max 6). */
    pinnedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

postSchema.index({ createdAt: -1 });
postSchema.index({ circle: 1, createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });

postSchema.virtual('sparkCount').get(function () {
  return (this.sparks || []).length;
});

postSchema.virtual('saveCount').get(function () {
  return (this.savedBy || []).length;
});

/** All media for the post, normalised for the client (carousel-aware). */
postSchema.virtual('items').get(function () {
  if (Array.isArray(this.mediaItems) && this.mediaItems.length) {
    return this.mediaItems;
  }
  if (this.media) {
    return [
      {
        url: this.media,
        type: this.mediaType || 'image',
        fileName: this.fileName || '',
        fileSize: this.fileSize || 0,
      },
    ];
  }
  return [];
});

// A post needs either text or media.
postSchema.pre('validate', function () {
  const hasMedia = Boolean(this.media) || (Array.isArray(this.mediaItems) && this.mediaItems.length);
  if (!String(this.text || '').trim() && !hasMedia) {
    this.invalidate('text', 'A post needs text or media');
  }
});

const Post = mongoose.model('Post', postSchema);

export default Post;
