import mongoose from 'mongoose';

const ObjectId = mongoose.Schema.Types.ObjectId;

/**
 * An Instagram-style Note: a 60-character status attached to a person
 * (or a Circle) that disappears after 24 hours.
 *
 * `kind` keeps the two contexts apart so a Circle note never leaks to
 * non-members: `personal` notes are visible to people who joined that user's
 * personal Circle, `circle` notes only to Circle members.
 */
const noteSchema = new mongoose.Schema(
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
      required: [true, 'A note needs text'],
      trim: true,
      maxlength: [60, 'A note can be 60 characters at most'],
    },
    /** Optional music attached to the note. */
    music: {
      title: { type: String, trim: true, maxlength: [100, 'Music title is too long'] },
      artist: { type: String, trim: true, maxlength: [100, 'Artist name is too long'] },
      url: { type: String, trim: true },
    },
    /** Optional duration (days) — defaults to 24h. */
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// Purge expired notes automatically.
noteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Note = mongoose.model('Note', noteSchema);

export default Note;
