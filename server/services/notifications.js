import Notification from '../models/Notification.js';
import User from '../models/User.js';

const ACTOR_FIELDS = 'firstName lastName username profilePicture';

/**
 * Create a notification and push it to the recipient's socket room in real time.
 * No notification is created for someone's own action.
 */
export async function notify(req, { recipient, actor, type, post, circle, text = '' }) {
  try {
    if (!recipient) return null;
    if (actor && String(recipient) === String(actor)) return null;

    // Respect the recipient's notification preferences (Settings → Notifications).
    const recipientUser = await User.findById(recipient)
      .select('preferences.notifyActivity')
      .lean();
    if (recipientUser && recipientUser.preferences?.notifyActivity === false) {
      return null;
    }

    const notification = await Notification.create({
      recipient,
      actor: actor || null,
      type,
      post: post || null,
      circle: circle || null,
      text: String(text).slice(0, 200),
    });

    const io = req?.app?.get?.('io');
    if (io) {
      const populated = await Notification.findById(notification._id)
        .populate('actor', ACTOR_FIELDS)
        .lean();
      io.to(`user:${recipient}`).emit('notification', populated);
    }

    return notification;
  } catch (error) {
    // Notifications must never break the action that triggered them.
    console.error('notify error:', error.message);
    return null;
  }
}

/**
 * Turn `@username` mentions into user ids (unknown names are ignored).
 *
 * Respects each mentioned account's **Sharing & reuse** preference
 * (`preferences.allowMentions`): `no-one` drops the mention entirely,
 * `people-i-follow` only keeps mentions from people the recipient follows.
 * Pass the acting user's id so the follow rule can be checked.
 */
export async function resolveMentions(usernames = [], { actorId = null } = {}) {
  const clean = [...new Set((usernames || []).map((u) => String(u).toLowerCase()).filter(Boolean))];
  if (!clean.length) return [];

  const users = await User.find({ username: { $in: clean } })
    .select('preferences.allowMentions following')
    .lean();

  return users
    .filter((user) => {
      const policy = user.preferences?.allowMentions || 'everyone';
      if (policy === 'no-one') return false;
      if (policy === 'people-i-follow') {
        if (!actorId) return false;
        return (user.following || []).some((id) => String(id) === String(actorId));
      }
      return true;
    })
    .map((user) => user._id);
}

export default { notify, resolveMentions };
