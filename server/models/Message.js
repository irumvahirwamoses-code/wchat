import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Message sender is required'],
    },
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: [true, 'Message chat is required'],
    },
    contentType: {
      type: String,
      enum: {
        values: ['text', 'image', 'audio', 'video', 'file', 'location'],
        message: 'Invalid message type: {VALUE}',
      },
      default: 'text',
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
    },
    // For `file` messages: the original name + size, used by the download card.
    fileName: {
      type: String,
      default: '',
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    seenBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    editedAt: {
      type: Date,
      default: null,
    },
    /** Emoji reactions. One reaction per member — reacting again replaces it. */
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        emoji: {
          type: String,
          required: true,
          trim: true,
          maxlength: [16, 'Reaction is too long'],
        },
      },
    ],
    /** The message this one quotes (Instagram-style reply). */
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    /**
     * Scheduled messages are stored right away but only revealed to the room at
     * `scheduledAt`. `delivered` flips to true once a scheduler has sent it.
     */
    scheduledAt: {
      type: Date,
      default: null,
    },
    delivered: {
      type: Boolean,
      default: true,
    },
    /**
     * Vanish Mode: when the chat has vanish mode on, messages get an `expiresAt`
     * and are deleted once it passes.
     */
    expiresAt: {
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

messageSchema.index({ chat: 1, createdAt: 1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;
