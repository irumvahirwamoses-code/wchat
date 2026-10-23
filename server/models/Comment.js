import mongoose from 'mongoose';

/**
 * A comment on a Wchat post (flat for now — threads come later).
 */
const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: [true, 'A comment cannot be empty'],
      trim: true,
      maxlength: [1000, 'A comment cannot exceed 1000 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

commentSchema.index({ post: 1, createdAt: 1 });

const Comment = mongoose.model('Comment', commentSchema);

export default Comment;
