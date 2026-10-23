import mongoose from 'mongoose';

export const STORY_MEDIA_TYPES = ['image', 'video'];

const STORY_TTL_HOURS = 24;

/**
 * An Inkuru story — a photo or video that disappears after 24 hours.
 *
 * Like posts, a story either belongs to a Circle (`circle` set → its members see
 * it) or is a timeline story (`circle: null` → the author + their followers).
 * A TTL index removes expired stories automatically.
 */
const storySchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    circle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      default: null,
      index: true,
    },
    media: {
      type: String,
      required: [true, 'A story needs a photo or video'],
    },
    mediaType: {
      type: String,
      enum: {
        values: STORY_MEDIA_TYPES,
        message: 'Invalid story media type: {VALUE}',
      },
      default: 'image',
    },
    caption: {
      type: String,
      trim: true,
      maxlength: [300, 'A caption cannot exceed 300 characters'],
      default: '',
    },
    viewers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
storySchema.index({ author: 1, createdAt: -1 });
storySchema.index({ circle: 1, createdAt: -1 });

storySchema.statics.ttlHours = STORY_TTL_HOURS;

const Story = mongoose.model('Story', storySchema);

export default Story;
