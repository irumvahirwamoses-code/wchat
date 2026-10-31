import mongoose from 'mongoose';

export const STORY_MEDIA_TYPES = ['image', 'video', 'text'];
export const STORY_AUDIENCES = ['public', 'followers', 'closeFriends'];
export const STICKER_TYPES = [
  'location',
  'mention',
  'hashtag',
  'gif',
  'poll',
  'question',
  'quiz',
  'emojiSlider',
  'link',
  'countdown',
  'addYours',
];

const STORY_TTL_HOURS = 24;

/** One interactive / decorative sticker placed on a story. */
const stickerSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: { values: STICKER_TYPES, message: 'Unknown sticker type: {VALUE}' },
      required: true,
    },
    /** Position as a percentage of the media box. */
    x: { type: Number, default: 50, min: 0, max: 100 },
    y: { type: Number, default: 50, min: 0, max: 100 },
    /** Plain label: place name, @mention, #hashtag, link label, countdown title. */
    text: { type: String, trim: true, maxlength: 200, default: '' },
    /** Link / GIF URL. */
    url: { type: String, trim: true, maxlength: 600, default: '' },
    /** Emoji used by the emoji slider. */
    emoji: { type: String, trim: true, maxlength: 16, default: '' },
    /** Prompt shown by poll / question / quiz / slider / Add Yours. */
    prompt: { type: String, trim: true, maxlength: 200, default: '' },
    options: [
      {
        text: { type: String, trim: true, maxlength: 80, default: '' },
        votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      },
    ],
    correctIndex: { type: Number, default: null },
    endsAt: { type: Date, default: null },
    responses: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        text: { type: String, trim: true, maxlength: 300, default: '' },
        value: { type: Number, default: null },
        answerIndex: { type: Number, default: null },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { _id: true }
);

/**
 * An Inkuru story — a photo, video or text card that disappears after 24 hours.
 *
 * Like posts, a story either belongs to a Circle (`circle` set → its members see
 * it) or is a timeline story (`circle: null` → the author + their followers).
 * `audience` and the author's privacy preferences decide who can see it; a TTL
 * index removes expired stories automatically.
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
      default: '',
    },
    mediaType: {
      type: String,
      enum: {
        values: STORY_MEDIA_TYPES,
        message: 'Invalid story media type: {VALUE}',
      },
      default: 'image',
    },
    /** Text shown by text-only stories (and available as an overlay on media). */
    text: {
      type: String,
      trim: true,
      maxlength: [500, 'Story text cannot exceed 500 characters'],
      default: '',
    },
    textStyle: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    stickers: {
      type: [stickerSchema],
      default: [],
    },
    /** Who is allowed to watch this story. */
    audience: {
      type: String,
      enum: { values: STORY_AUDIENCES, message: 'Invalid audience: {VALUE}' },
      default: 'followers',
    },
    /** Accounts that must never see this story (snapshot of the author's prefs). */
    hideFrom: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    allowReplies: { type: Boolean, default: true },
    allowMentions: { type: Boolean, default: true },
    /** Members who liked the story. */
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    /** One emoji reaction per member (reacting again replaces it). */
    reactions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        emoji: { type: String, trim: true, maxlength: 16, required: true },
      },
    ],
    caption: {
      type: String,
      trim: true,
      maxlength: [300, 'A caption cannot exceed 300 characters'],
      default: '',
    },
    music: {
      title: { type: String, trim: true, maxlength: [100, 'Music title is too long'] },
      artist: { type: String, trim: true, maxlength: [100, 'Artist name is too long'] },
      url: { type: String, trim: true },
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

storySchema.pre('validate', function ensureContent() {
  if (!this.media && !this.text) {
    this.invalidate('media', 'A story needs a photo, a video or some text');
  }
});

storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
storySchema.index({ author: 1, createdAt: -1 });
storySchema.index({ circle: 1, createdAt: -1 });

storySchema.statics.ttlHours = STORY_TTL_HOURS;

const Story = mongoose.model('Story', storySchema);

export default Story;
