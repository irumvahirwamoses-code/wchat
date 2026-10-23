import mongoose from 'mongoose';

const joinRequestSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: [true, 'Join request chat is required'],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Join request user is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'accepted', 'rejected'],
        message: 'Invalid join request status: {VALUE}',
      },
      default: 'pending',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

joinRequestSchema.index({ chat: 1, user: 1 }, { unique: true });

const JoinRequest = mongoose.model('JoinRequest', joinRequestSchema);

export default JoinRequest;
