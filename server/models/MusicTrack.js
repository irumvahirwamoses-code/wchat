import mongoose from 'mongoose';

const ObjectId = mongoose.Schema.Types.ObjectId;

/**
 * A track in the Wchat music catalog. Free, built-in tracks are seeded
 * by the server; users can also upload their own audio (stored on Cloudinary
 * or local disk) and attach it to posts, stories and notes.
 */
const musicTrackSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      required: true,
      maxlength: [100, 'Track title too long'],
      index: 'text',
    },
    artist: {
      type: String,
      trim: true,
      required: true,
      maxlength: [100, 'Artist name too long'],
      index: 'text',
    },
    url: {
      type: String,
      trim: true,
      required: true,
    },
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Built-in catalog tracks vs user-uploaded tracks. */
    source: {
      type: String,
      enum: ['catalog', 'upload'],
      default: 'catalog',
    },
    /** The user who uploaded this track (only for source === 'upload'). */
    uploadedBy: {
      type: ObjectId,
      ref: 'User',
      default: null,
    },
    /** Only the uploader can use their own upload; catalog is open to all. */
    isPublic: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

musicTrackSchema.index({ title: 'text', artist: 'text' });
musicTrackSchema.index({ source: 1, uploadedBy: 1 });

const MusicTrack = mongoose.model('MusicTrack', musicTrackSchema);

export default MusicTrack;
