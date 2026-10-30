import mongoose from 'mongoose';

export const FEEDBACK_TYPES = ['feedback', 'bug', 'feature', 'content', 'other'];
export const FEEDBACK_STATUSES = ['open', 'reviewed', 'resolved'];

/**
 * Feedback / feature requests / bug reports submitted by members.
 * Visible to super admins in the admin dashboard.
 */
const feedbackSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: FEEDBACK_TYPES,
        message: 'Invalid feedback type: {VALUE}',
      },
      default: 'feedback',
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    message: {
      type: String,
      required: [true, 'Please write a message'],
      trim: true,
      maxlength: [2000, 'Feedback cannot exceed 2000 characters'],
    },
    page: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: FEEDBACK_STATUSES,
        message: 'Invalid feedback status: {VALUE}',
      },
      default: 'open',
      index: true,
    },
    adminReply: {
      type: String,
      trim: true,
      maxlength: [1000, 'Reply cannot exceed 1000 characters'],
      default: '',
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

feedbackSchema.index({ createdAt: -1 });

const Feedback = mongoose.model('Feedback', feedbackSchema);

export default Feedback;
