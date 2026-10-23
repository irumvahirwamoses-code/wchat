import Notification from '../models/Notification.js';

const ACTOR_FIELDS = 'firstName lastName username profilePicture';

/**
 * GET /api/notifications?page=&limit=
 */
export const listNotifications = async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    const filter = { recipient: req.user._id };
    const total = await Notification.countDocuments(filter);
    const notifications = await Notification.find(filter)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('actor', ACTOR_FIELDS)
      .populate('circle', 'chatName groupAvatar')
      .lean();

    return res.json({ notifications, page, limit, total, hasMore: page * limit < total });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/notifications/unread-count
 */
export const unreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      read: false,
    });
    return res.json({ count });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/notifications/read  — mark everything read.
 * PUT /api/notifications/:id/read — mark one read.
 */
export const markRead = async (req, res, next) => {
  try {
    if (req.params.id) {
      await Notification.updateOne(
        { _id: req.params.id, recipient: req.user._id },
        { read: true }
      );
      return res.json({ id: req.params.id, read: true });
    }
    await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true });
    return res.json({ read: true });
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/notifications/:id
 */
export const deleteNotification = async (req, res, next) => {
  try {
    await Notification.deleteOne({ _id: req.params.id, recipient: req.user._id });
    return res.json({ id: req.params.id });
  } catch (error) {
    return next(error);
  }
};

export default { listNotifications, unreadCount, markRead, deleteNotification };
