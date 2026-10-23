import Message from '../models/Message.js';

const SENDER_FIELDS = 'firstName lastName username profilePicture isOnline lastSeen';

/** How long a Vanish Mode message lives before it is swept away. */
export const VANISH_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const populateForDelivery = (messageId) =>
  Message.findById(messageId)
    .populate('sender', SENDER_FIELDS)
    .populate('reactions.user', SENDER_FIELDS)
    .populate({
      path: 'replyTo',
      select: 'content contentType fileName sender createdAt',
      populate: { path: 'sender', select: SENDER_FIELDS },
    });

/**
 * Send any scheduled messages whose time has come. Each delivered message is
 * broadcast to its conversation so open clients append it in real time.
 */
export const deliverScheduledMessages = async (io) => {
  const now = new Date();

  const due = await Message.find({
    delivered: false,
    scheduledAt: { $ne: null, $lte: now },
  }).select('_id chat');

  if (!due.length) return 0;

  for (const item of due) {
    await Message.updateOne({ _id: item._id }, { $set: { delivered: true } });

    if (io) {
      const populated = await populateForDelivery(item._id);
      if (populated) io.to(`chat:${item.chat}`).emit('message received', populated);
    }
  }

  return due.length;
};

/**
 * Delete Vanish Mode messages once they expire and tell the conversation to
 * drop them from the thread.
 */
export const purgeExpiredMessages = async (io) => {
  const now = new Date();

  const expired = await Message.find({
    expiresAt: { $ne: null, $lte: now },
  }).select('_id chat');

  if (!expired.length) return 0;

  await Message.deleteMany({ _id: { $in: expired.map((m) => m._id) } });

  if (io) {
    for (const item of expired) {
      io.to(`chat:${item.chat}`).emit('message deleted', { messageId: item._id });
    }
  }

  return expired.length;
};

/** Start the periodic sweep. Returns the interval so callers can clear it. */
export const startChatScheduler = (io) => {
  const run = async () => {
    try {
      await deliverScheduledMessages(io);
      await purgeExpiredMessages(io);
    } catch (error) {
      console.error('chat scheduler:', error.message);
    }
  };

  run();
  return setInterval(run, 15000);
};
