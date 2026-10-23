import mongoose from 'mongoose';

/**
 * Circle Decisions — a group decision support system (GDSS).
 *
 *   • **brainstorm** — parallel communication: every member contributes ideas
 *     at the same time, each stored the moment it is written.
 *   • **delphi**     — structured thinking: rounds of *anonymous* rating, so a
 *     group converges on the strongest ideas instead of the loudest voice.
 *   • **vote**       — a single round of rating then decide.
 *
 * The **shared workspace** is the `published` flag on an idea: a member can keep
 * an idea personal while they work on it, then publish it to the whole Circle.
 * Everything anyone does is appended to `log`, which is the automatic
 * recordkeeping the group can review later.
 */
export const DECISION_KINDS = ['brainstorm', 'delphi', 'vote'];
export const DECISION_STATES = ['collecting', 'rating', 'decided'];

const ideaSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: [true, 'An idea needs some text'],
      trim: true,
      maxlength: [1000, 'Idea text is limited to 1000 characters'],
    },
    /** Personal work stays private until the author publishes it to the group. */
    published: { type: Boolean, default: true },
    /** The Delphi round this idea took part in (0 = initial collection). */
    round: { type: Number, default: 0 },
    /**
     * Anonymous ratings: everyone sees the *average*, never who scored what.
     * One rating per member per idea, overwritten on re-rating.
     */
    ratings: {
      type: [
        {
          user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          score: { type: Number, min: 1, max: 5 },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

const circleDecisionSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'A decision needs a title'],
      trim: true,
      maxlength: [120, 'Title is limited to 120 characters'],
    },
    prompt: {
      type: String,
      trim: true,
      maxlength: [600, 'Prompt is limited to 600 characters'],
      default: '',
    },
    kind: {
      type: String,
      enum: { values: DECISION_KINDS, message: 'Invalid decision kind: {VALUE}' },
      default: 'brainstorm',
    },
    state: {
      type: String,
      enum: { values: DECISION_STATES, message: 'Invalid decision state: {VALUE}' },
      default: 'collecting',
    },
    /** Which Delphi round we are in; rating rounds start at 1. */
    round: { type: Number, default: 0 },
    ideas: { type: [ideaSchema], default: [] },
    decision: {
      text: { type: String, trim: true, maxlength: 1000, default: '' },
      idea: { type: mongoose.Schema.Types.ObjectId, default: null },
      decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      decidedAt: { type: Date },
    },
    /** Automatic recordkeeping — every action, in order. */
    log: {
      type: [
        {
          actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          action: { type: String },
          detail: { type: String, maxlength: 200 },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/** Average score of an idea, ignoring unpublished/private ones. */
circleDecisionSchema.virtual('ranked').get(function () {
  return this.ideas
    .filter((idea) => idea.published)
    .map((idea) => ({
      _id: idea._id,
      text: idea.text,
      average: idea.ratings.length
        ? idea.ratings.reduce((sum, r) => sum + r.score, 0) / idea.ratings.length
        : 0,
      ratings: idea.ratings.length,
    }))
    .sort((a, b) => b.average - a.average);
});

const CircleDecision = mongoose.model('CircleDecision', circleDecisionSchema);

export default CircleDecision;
