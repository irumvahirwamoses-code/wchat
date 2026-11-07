import mongoose from 'mongoose';

const ObjectId = mongoose.Schema.Types.ObjectId;

const scoreSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    score: { type: Number, default: 0 },
  },
  { _id: false }
);

const countSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    count: { type: Number, default: 0 },
  },
  { _id: false }
);

const seenItemSchema = new mongoose.Schema(
  {
    item: { type: ObjectId, ref: 'Post', required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * A compact, explainable model of what one person engages with.
 *
 * Deliberately not a neural net: arrays of `{ key, score }` are readable in
 * the database, cheap to update from a batch of events, and easy to inspect in
 * the admin debug endpoint. Scores are bounded by `RANKING.profileCap`.
 */
const userInterestProfileSchema = new mongoose.Schema(
  {
    user: {
      type: ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    /** Hashtags and Circle interest tags. */
    tagScores: { type: [scoreSchema], default: [] },
    /** Author ids, stored as strings so they are JSON-friendly. */
    creatorScores: { type: [scoreSchema], default: [] },
    /** Circle ids, stored as strings. */
    circleScores: { type: [scoreSchema], default: [] },
    /** Raw event counts, e.g. { key: 'impression', count: 120 }. */
    eventCounts: { type: [countSchema], default: [] },
    /** Hard filters: never show these items again. */
    hiddenItemIds: [{ type: ObjectId, ref: 'Post' }],
    /** Hard filters: never show content from these people. */
    hiddenAuthorIds: [{ type: ObjectId, ref: 'User' }],
    /** Recently seen items, used for a soft "already seen" penalty. */
    recentItems: { type: [seenItemSchema], default: [] },
    lastEventAt: { type: Date, default: null },
    lastDecayAt: { type: Date, default: Date.now },
    /** Bumped whenever the profile changes, so caches can be invalidated. */
    version: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userInterestProfileSchema.index({ lastEventAt: -1 });

const UserInterestProfile = mongoose.model(
  'UserInterestProfile',
  userInterestProfileSchema
);

export default UserInterestProfile;
