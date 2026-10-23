import mongoose from 'mongoose';

const ObjectId = mongoose.Schema.Types.ObjectId;

export const NOTIFICATION_TYPES = [
  'spark',
  'comment',
  'mention',
  'join',
  'invite',
  'announcement',
];

/**
 * An in-app activity notification (the Home bell).
 *
 * Notifications are never created for the actor's own actions, and they always
 * carry enough context to link back to the thing that happened (post, Circle).
 */
const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actor: {
      type: ObjectId,
      ref: 'User',
    },
    type: {
      type: String,
      enum: {
        values: NOTIFICATION_TYPES,
        message: 'Invalid notification type: {VALUE}',
      },
      required: true,
    },
    post: { type: ObjectId, ref: 'Post' },
    circle: { type: ObjectId, ref: 'Chat' },
    /** Short human-readable sentence (already localised by the caller). */
    text: { type: String, default: '', maxlength: 200 },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
