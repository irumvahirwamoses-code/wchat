import mongoose from 'mongoose';

export const REPORT_TARGET_TYPES = ['user', 'post', 'comment', 'message', 'story'];
export const REPORT_REASONS = [
  'spam',
  'harassment',
  'hate',
  'nudity',
  'violence',
  'misinformation',
  'scam',
  'other',
];
export const REPORT_STATUSES = ['open', 'reviewed', 'actioned', 'dismissed'];

/**
 * A report filed by a member against another account or a piece of content.
 * `targetUser` always resolves to the owner of the reported thing so admins can
 * count how often an account has been reported and block repeat offenders.
 */
const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: {
        values: REPORT_TARGET_TYPES,
        message: 'Invalid report target: {VALUE}',
      },
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    reason: {
      type: String,
      enum: {
        values: REPORT_REASONS,
        message: 'Invalid report reason: {VALUE}',
      },
      required: true,
    },
    details: {
      type: String,
      trim: true,
      maxlength: [1000, 'Details cannot exceed 1000 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: REPORT_STATUSES,
        message: 'Invalid report status: {VALUE}',
      },
      default: 'open',
      index: true,
    },
    actionTaken: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },
    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    handledAt: {
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

reportSchema.index({ targetUser: 1, status: 1 });
reportSchema.index({ createdAt: -1 });

const Report = mongoose.model('Report', reportSchema);

export default Report;
