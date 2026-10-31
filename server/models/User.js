import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { generateGenderAvatar } from '../utils/generateAvatar.js';
import { normalizeUsername, USERNAME_REGEX, USERNAME_MIN, USERNAME_MAX } from '../utils/username.js';

export const GENDERS = ['male', 'female', 'other', 'prefer-not-to-say'];

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      lowercase: true,
      trim: true,
      set: normalizeUsername,
      validate: {
        validator: (value) => USERNAME_REGEX.test(String(value || '')),
        message: `Username must be ${USERNAME_MIN}-${USERNAME_MAX} characters: letters, numbers, '.' and '_'`,
      },
    },
    gender: {
      type: String,
      enum: {
        values: GENDERS,
        message: 'Invalid gender: {VALUE}',
      },
      default: 'prefer-not-to-say',
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required'],
      validate: {
        validator(value) {
          if (!value) return false;
          const age = (Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
          return age >= 13 && age < 120;
        },
        message: 'You must be at least 13 years old',
      },
    },
    address: {
      country: {
        type: String,
        trim: true,
      },
      city: {
        type: String,
        trim: true,
      },
    },
    profilePicture: {
      type: String,
      default() {
        // Gender-matched avatar; can be replaced by an uploaded photo later.
        return generateGenderAvatar(this.username || this.firstName || 'wchat', this.gender);
      },
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [150, 'Bio cannot exceed 150 characters'],
      default: '',
    },
    /**
     * A short niche label shown under the name — e.g. "Digital Creator",
     * "Entrepreneur", "Photographer". Free text, like Instagram's category.
     */
    category: {
      type: String,
      trim: true,
      maxlength: [40, 'Category cannot exceed 40 characters'],
      default: '',
    },
    /** External links (up to 5) shown on the public profile. */
    links: {
      type: [
        {
          title: { type: String, trim: true, maxlength: 60, default: '' },
          url: { type: String, trim: true, maxlength: 300, default: '' },
        },
      ],
      default: [],
      validate: {
        validator: (list) => !list || list.length <= 5,
        message: 'You can add up to 5 links',
      },
    },
    /**
     * Personal (friends & family) · Creator (public figures) · Business (brands).
     * Unlocks different tools in the Professional Dashboard.
     */
    accountType: {
      type: String,
      enum: ['personal', 'creator', 'business'],
      default: 'personal',
    },
    /** Private accounts only share posts with approved followers. */
    isPrivate: { type: Boolean, default: false },

    // --- Platform administration ------------------------------------------
    /** `superadmin` can open the admin dashboard and manage the whole app. */
    role: {
      type: String,
      enum: ['user', 'superadmin'],
      default: 'user',
      index: true,
    },
    /** When true the account cannot sign in or use the API until unblocked. */
    isBlocked: { type: Boolean, default: false, index: true },
    blockedReason: { type: String, trim: true, maxlength: 300, default: '' },
    blockedAt: { type: Date, default: null },
    /** Whether Wchat may suggest this profile to similar people. */
    showInSuggestions: { type: Boolean, default: true },

    // --- Wchat onboarding: fields the user picked + Circles they joined ------
    interests: {
      type: [{ type: String }],
      default: [],
    },
    onboarding: {
      interestsDoneAt: { type: Date, default: null },
      joinedCircleIds: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chat' }],
        default: [],
      },
      completedAt: { type: Date, default: null },
    },

    // --- Verification ------------------------------------------------------
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },

    // --- Social graph ------------------------------------------------------
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    /** People who can see "Close Friends" stories. */
    closeFriends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    /** Authors whose stories this member has muted. */
    mutedStories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    language: {
      type: String,
      enum: ['rw', 'en', 'fr', 'sw'],
      default: 'rw',
    },
    /** Self-declared skills, shown on the public profile. */
    skills: {
      type: [{ type: String }],
      default: [],
    },
    /** Up to three conversations pinned to the top of the chat list. */
    pinnedChats: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chat',
      },
    ],
    /** Per-conversation theme id (see client config/chats.js). */
    chatThemes: [
      {
        chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
        theme: { type: String, trim: true, maxlength: 40, default: 'default' },
      },
    ],
    /**
     * Custom per-chat names. `target` is the member being renamed, or null when
     * the member is renaming the group itself.
     */
    nicknames: [
      {
        chat: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Chat',
          required: true,
        },
        target: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null,
        },
        name: { type: String, trim: true, maxlength: 60, default: '' },
      },
    ],
    /** People this account has blocked (they cannot message or mention them). */
    blocked: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    /** System-wide settings (applied on login + editable in Settings). */
    preferences: {
      theme: {
        type: String,
        enum: ['dark', 'light', 'midnight'],
        default: 'light',
      },
      dataSaver: { type: Boolean, default: false },
      autoplayVideos: { type: Boolean, default: true },
      showReadReceipts: { type: Boolean, default: true },
      allowDmFromAnyone: { type: Boolean, default: true },
      /** Upload originals instead of compressing (Settings → Data & storage). */
      highQualityUploads: { type: Boolean, default: true },

      /* --- Sharing & reuse: what other people may do with your content --- */
      /** Let others build on (remix) your Reels. */
      allowRemix: { type: Boolean, default: true },
      /** Let others re-share your posts and Reels. */
      allowShareToStories: { type: Boolean, default: true },
      /** Let others download the photos and videos you post. */
      allowDownload: { type: Boolean, default: true },
      /** Who may @mention you: `everyone` · `people-i-follow` · `no-one`. */
      allowMentions: {
        type: String,
        enum: ['everyone', 'people-i-follow', 'no-one'],
        default: 'everyone',
      },
      /* --- Story privacy & interactions --- */
      /** Default audience for new stories. */
      storyAudience: {
        type: String,
        enum: ['public', 'followers', 'closeFriends'],
        default: 'followers',
      },
      /** Accounts that can never see this member's stories. */
      storyHideFrom: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      /** Allow followers to reply to stories via DM. */
      storyAllowReplies: { type: Boolean, default: true },
      /** Allow mentions in stories. */
      storyAllowMentions: { type: Boolean, default: true },
      /** Activity push: Sparks, comments, mentions, joins. */
      notifyActivity: { type: Boolean, default: true },
      /** Chat notifications (new messages in threads). */
      notifyChats: { type: Boolean, default: true },
      /**
       * "Hidden words" — phrases this member never wants to see. Enforced when
       * rendering comments and direct messages.
       */
      hiddenWords: {
        type: [{ type: String, trim: true, lowercase: true }],
        default: [],
        validate: {
          validator: (list) => !list || list.length <= 100,
          message: 'You can hide up to 100 words',
        },
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual full name (not persisted)
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Virtual @handle for display (never persisted)
userSchema.virtual('handle').get(function () {
  return `@${this.username}`;
});

// Virtual age, used by age-gated features
userSchema.virtual('age').get(function () {
  if (!this.dateOfBirth) return null;
  const diff = Date.now() - new Date(this.dateOfBirth).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
});

// Hash the password before saving when it has changed
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  // Registration verification stores an already-hashed password.
  if (this.$locals && this.$locals.skipPasswordHash) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare a plain text password against the stored hash
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;
