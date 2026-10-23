import mongoose from 'mongoose';
import { CATEGORIES, FEATURES } from '../data/categories.js';
import { INTEREST_IDS } from '../data/interests.js';
import { generateAvatar } from '../utils/generateAvatar.js';

/**
 * A "Circle" is Wchat's group primitive. It reuses the chat document so
 * messaging, join requests and membership keep working, and adds the
 * community/discovery fields the product needs.
 *
 *  - topic    → interest / category based community
 *  - local    → tied to a place (district / sector)
 *  - personal → automatically created for every account ("every account is a
 *               Circle"). Joining a personal Circle is Wchat's way of following
 *               that person.
 */
export const CIRCLE_TYPES = ['topic', 'local', 'personal'];
export const JOIN_POLICIES = ['open', 'request'];

// --- Circle access control (GBAC) -----------------------------------------
/**
 * Who is allowed to do what inside a Circle. Instead of one rule per member,
 * a Circle stores one *policy* that every member is measured against, so the
 * same answer applies everywhere — the admin sets it once, in one panel.
 */
export const ACCESS_CAPABILITIES = [
  'postMessages',
  'sendMedia',
  'createItems',
  'inviteMembers',
  'manageMembers',
  'startDecisions',
];

/**
 * `everyone` → every member, `staff` → admins and moderators, `admin` → the
 * Circle admin only. The values are ordered by privilege so a check can be a
 * simple numeric comparison instead of a branching statement.
 */
export const ACCESS_ROLES = ['everyone', 'staff', 'admin'];
const ACCESS_RANK = { everyone: 0, staff: 1, admin: 2 };

export const CIRCLE_ROLES = ['owner', 'admin', 'moderator', 'member'];
const ROLE_RANK = { owner: 3, admin: 2, moderator: 1, member: 0 };
/**
 * `required` may be either a Circle role or an access level ('staff'/'everyone'),
 * so both vocabularies are ranked here. Missing a key must never silently pass
 * a check — it falls back to "everyone", the lowest bar.
 */
const REQUIRED_RANK = { ...ROLE_RANK, everyone: 0, staff: 1 };

/** The most privileged access role the Circle role maps to. */
export const roleToAccess = (circleRole) =>
  circleRole === 'owner' || circleRole === 'admin'
    ? 'admin'
    : circleRole === 'moderator'
      ? 'staff'
      : 'everyone';

/** True when `circleRole` is at least as privileged as `required`. */
export const roleAllows = (circleRole, required) =>
  (ROLE_RANK[circleRole ?? 'member'] ?? 0) >= (REQUIRED_RANK[required] ?? 0);

/** True when the Circle's stored policy lets `circleRole` perform `capability`. */
export const accessAllows = (rules, circleRole, capability) => {
  const rule = rules?.[capability] ?? 'everyone';
  return ACCESS_RANK[roleToAccess(circleRole)] >= ACCESS_RANK[rule];
};

const chatSchema = new mongoose.Schema(
  {
    chatName: {
      type: String,
      trim: true,
    },
    isGroupChat: {
      type: Boolean,
      default: false,
    },
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    groupAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    category: {
      type: String,
      default: 'general',
      enum: {
        values: CATEGORIES,
        message: 'Invalid category: {VALUE}',
      },
    },
    features: {
      type: [
        {
          type: String,
          enum: {
            values: FEATURES,
            message: 'Invalid feature: {VALUE}',
          },
        },
      ],
      default: [],
    },
    groupAvatar: {
      type: String,
      default() {
        return generateAvatar(this.chatName || 'wchat', 'identicon');
      },
    },
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // --- Wchat Circle fields ------------------------------------------------
    circleType: {
      type: String,
      enum: {
        values: CIRCLE_TYPES,
        message: 'Invalid circle type: {VALUE}',
      },
      default: 'topic',
    },
    // Personal circles are the "profile as a Circle" of one user.
    ownerUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // open = one tap to join, request = the admin approves.
    joinPolicy: {
      type: String,
      enum: {
        values: JOIN_POLICIES,
        message: 'Invalid join policy: {VALUE}',
      },
      default: 'open',
    },
    /**
     * Short, shareable code behind a Circle's QR invite. Created on demand and
     * unique across Circles. The field is left out entirely until a code is
     * minted, which is what makes the sparse unique index work.
     */
    inviteCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [280, 'Description cannot exceed 280 characters'],
      default: '',
    },
    // Interest ids (see data/interests.js) that describe this Circle.
    interests: {
      type: [
        {
          type: String,
          enum: {
            values: INTEREST_IDS,
            message: 'Invalid interest: {VALUE}',
          },
        },
      ],
      default: [],
    },
    // Place for local circles, e.g. "Kicukiro" or "Rwanda".
    district: {
      type: String,
      trim: true,
      default: '',
    },
    rules: {
      type: [{ type: String, trim: true, maxlength: 160 }],
      default: [],
    },
    /** Up to three messages pinned to the top of the conversation. */
    pinnedMessages: [
      {
        message: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Message',
          required: true,
        },
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        pinnedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    /** When on, new messages in this conversation disappear after a while. */
    vanishMode: {
      type: Boolean,
      default: false,
    },

    // --- Circle access control ------------------------------------------
    /**
     * Extra privileged members beyond the admin: moderators and admins. The
     * owner is always `groupAdmin` and is not stored here, which keeps a Move
     * (transferring the Circle to a new owner) a single-field change.
     */
    memberRoles: {
      type: [
        {
          user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
          },
          role: {
            type: String,
            enum: { values: CIRCLE_ROLES, message: 'Invalid Circle role: {VALUE}' },
            default: 'member',
          },
          grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          grantedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    /**
     * One policy for the whole Circle. Every rule defaults to `everyone` so
     * existing Circles keep behaving exactly as before.
     */
    accessRules: {
      type: Object,
      default: () =>
        Object.fromEntries(ACCESS_CAPABILITIES.map((cap) => [cap, 'everyone'])),
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Group chats must have a name
chatSchema.pre('validate', function () {
  if (this.isGroupChat && (!this.chatName || !this.chatName.trim())) {
    this.invalidate('chatName', 'Group name is required');
  }
});

const Chat = mongoose.model('Chat', chatSchema);

export default Chat;
