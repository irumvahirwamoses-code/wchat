import mongoose from 'mongoose';

const ObjectId = mongoose.Schema.Types.ObjectId;

/**
 * A track in the Wchat music catalog. Free, built-in tracks are seeded
 * by the server; users can also upload their own audio and attach it to
 * posts, stories and notes.
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
    albumArt: {
      type: String,
      trim: true,
      default: '',
    },
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Default 5–15 second clip window for stories/notes/reels. */
    defaultStartTime: {
      type: Number,
      default: 0,
      min: 0,
    },
    defaultEndTime: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Synced lyrics for the "lyrics" visual style. Array of { time, text }. */
    lyrics: {
      type: [
        {
          time: { type: Number, default: 0 },
          text: { type: String, trim: true, default: '' },
        },
      ],
      default: [],
    },
    /** Built-in catalog tracks vs user-uploaded tracks. */
    source: {
      type: String,
      enum: ['catalog', 'upload'],
      default: 'catalog',
    },
    /** Browse categories: for-you, trending, genres, moods. */
    category: {
      type: String,
      enum: ['for-you', 'trending', 'genre', 'mood'],
      default: 'for-you',
      index: true,
    },
    genre: {
      type: String,
      trim: true,
      maxlength: [50, 'Genre too long'],
      index: true,
    },
    mood: {
      type: String,
      trim: true,
      maxlength: [50, 'Mood too long'],
      index: true,
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
    /** Trending score for sorting. */
    trendingScore: {
      type: Number,
      default: 0,
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
musicTrackSchema.index({ category: 1, genre: 1, mood: 1 });
musicTrackSchema.index({ trendingScore: -1 });

const MusicTrack = mongoose.model('MusicTrack', musicTrackSchema);

export default MusicTrack;
