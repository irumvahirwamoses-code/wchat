import mongoose from 'mongoose';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import Story from '../models/Story.js';
import Feedback from '../models/Feedback.js';
import Report from '../models/Report.js';
import SystemSetting from '../models/SystemSetting.js';
import {
  getSystemSettings,
  invalidateSystemSettings,
  SYSTEM_DEFAULTS as DEFAULTS,
} from '../services/systemSettings.js';

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const paginate = (query) => {
  const page = Math.max(1, toInt(query.page, 1));
  const limit = Math.min(100, Math.max(1, toInt(query.limit, 25)));
  return { page, limit, skip: (page - 1) * limit };
};

/* ------------------------------------------------------------------ overview */

export const getOverview = async (req, res, next) => {
  try {
    const now = Date.now();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now - 13 * 24 * 60 * 60 * 1000);
    twoWeeksAgo.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      onlineUsers,
      newUsers7d,
      blockedUsers,
      totalPosts,
      totalReels,
      totalStories,
      totalMessages,
      totalChats,
      totalComments,
      sparkAgg,
      openReports,
      openFeedback,
      mostLikedPosts,
      mostActiveCircles,
      growthRaw,
      recentReports,
      recentFeedback,
      settings,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isOnline: true }),
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
      User.countDocuments({ isBlocked: true }),
      Post.countDocuments({}),
      Post.countDocuments({ mediaType: 'video' }),
      Story.countDocuments({ expiresAt: { $gt: new Date() } }),
      Message.countDocuments({}),
      Chat.countDocuments({}),
      Comment.countDocuments({}),
      Post.aggregate([
        { $project: { c: { $size: { $ifNull: ['$sparks', []] } } } },
        { $group: { _id: null, total: { $sum: '$c' } } },
      ]),
      Report.countDocuments({ status: 'open' }),
      Feedback.countDocuments({ status: 'open' }),
      Post.aggregate([
        { $addFields: { sparkCount: { $size: { $ifNull: ['$sparks', []] } } } },
        { $sort: { sparkCount: -1, createdAt: -1 } },
        { $limit: 6 },
        {
          $lookup: {
            from: 'users',
            localField: 'author',
            foreignField: '_id',
            as: 'author',
          },
        },
        { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            sparkCount: 1,
            commentCount: 1,
            text: 1,
            mediaType: 1,
            createdAt: 1,
            'author._id': 1,
            'author.firstName': 1,
            'author.lastName': 1,
            'author.username': 1,
            'author.profilePicture': 1,
          },
        },
      ]),
      Message.aggregate([
        { $group: { _id: '$chat', messageCount: { $sum: 1 } } },
        { $sort: { messageCount: -1 } },
        { $limit: 6 },
        {
          $lookup: {
            from: 'chats',
            localField: '_id',
            foreignField: '_id',
            as: 'chat',
          },
        },
        { $unwind: { path: '$chat', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            messageCount: 1,
            'chat._id': 1,
            'chat.chatName': 1,
            'chat.groupAvatar': 1,
            'chat.isGroupChat': 1,
            'chat.circleType': 1,
          },
        },
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: twoWeeksAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Report.find({ status: 'open' })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('reporter', 'firstName lastName username profilePicture')
        .populate('targetUser', 'firstName lastName username profilePicture')
        .lean(),
      Feedback.find({ status: 'open' })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user', 'firstName lastName username profilePicture')
        .lean(),
      getSystemSettings(),
    ]);

    // Fill the 14-day growth series so the chart has no gaps.
    const growthMap = new Map(growthRaw.map((d) => [d._id, d.count]));
    const userGrowth = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      userGrowth.push({ date: key, count: growthMap.get(key) || 0 });
    }

    return res.json({
      totals: {
        users: totalUsers,
        onlineUsers,
        newUsers7d,
        blockedUsers,
        posts: totalPosts,
        reels: totalReels,
        stories: totalStories,
        messages: totalMessages,
        chats: totalChats,
        comments: totalComments,
        sparks: sparkAgg[0]?.total || 0,
      },
      openReports,
      openFeedback,
      mostLikedPosts,
      mostActiveCircles,
      userGrowth,
      recentReports,
      recentFeedback,
      system: {
        maintenanceEnabled: Boolean(settings.maintenanceEnabled),
        maintenanceUntil: settings.maintenanceUntil,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/* --------------------------------------------------------------------- users */

const reportCountsByUser = async () => {
  const rows = await Report.aggregate([
    { $match: { targetUser: { $ne: null } } },
    { $group: { _id: '$targetUser', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
};

export const listUsers = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const search = String(req.query.search || '').trim();
    const filter = String(req.query.filter || '').trim();

    const query = {};
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { firstName: regex },
        { lastName: regex },
        { username: regex },
        { email: regex },
        { phoneNumber: regex },
      ];
    }
    if (filter === 'blocked') query.isBlocked = true;
    if (filter === 'admins') query.role = 'superadmin';
    if (filter === 'reported') {
      const reportedIds = await Report.distinct('targetUser', { targetUser: { $ne: null } });
      query._id = { $in: reportedIds.filter(Boolean) };
    }

    const [users, total, reportCounts] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          'firstName lastName username email phoneNumber profilePicture role isBlocked blockedReason blockedAt createdAt isOnline lastSeen'
        )
        .lean(),
      User.countDocuments(query),
      reportCountsByUser(),
    ]);

    const items = users.map((u) => ({
      ...u,
      reportCount: reportCounts.get(String(u._id)) || 0,
    }));

    if (filter === 'reported') {
      items.sort((a, b) => b.reportCount - a.reportCount);
    }

    return res.json({
      users: items,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    return next(error);
  }
};

export const blockUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }
    if (String(id) === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot block yourself' });
    }

    const target = await User.findById(id);
    if (!target) return res.status(404).json({ message: 'Account not found' });
    if (target.role === 'superadmin') {
      return res.status(400).json({ message: 'You cannot block another super admin' });
    }

    target.isBlocked = true;
    target.blockedReason = String(req.body?.reason || '').slice(0, 300);
    target.blockedAt = new Date();
    await target.save();

    return res.json({
      message: 'Account blocked',
      user: {
        _id: target._id,
        isBlocked: target.isBlocked,
        blockedReason: target.blockedReason,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const unblockUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }
    const target = await User.findById(id);
    if (!target) return res.status(404).json({ message: 'Account not found' });

    target.isBlocked = false;
    target.blockedReason = '';
    target.blockedAt = null;
    await target.save();

    return res.json({
      message: 'Account unblocked',
      user: { _id: target._id, isBlocked: target.isBlocked },
    });
  } catch (error) {
    return next(error);
  }
};

export const setUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const role = String(req.body?.role || '').trim();
    if (!['user', 'superadmin'].includes(role)) {
      return res.status(400).json({ message: 'Role must be user or superadmin' });
    }
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }
    if (String(id) === String(req.user._id) && role !== 'superadmin') {
      return res.status(400).json({ message: 'You cannot remove your own admin access' });
    }

    const target = await User.findById(id);
    if (!target) return res.status(404).json({ message: 'Account not found' });

    if (target.role === 'superadmin' && role === 'user') {
      const admins = await User.countDocuments({ role: 'superadmin' });
      if (admins <= 1) {
        return res.status(400).json({ message: 'At least one super admin must remain' });
      }
    }

    target.role = role;
    await target.save();
    return res.json({ message: 'Role updated', user: { _id: target._id, role: target.role } });
  } catch (error) {
    return next(error);
  }
};

/* ------------------------------------------------------------------- reports */

export const listReports = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const status = String(req.query.status || '').trim();
    const query = {};
    if (['open', 'reviewed', 'actioned', 'dismissed'].includes(status)) {
      query.status = status;
    }

    const [reports, total] = await Promise.all([
      Report.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('reporter', 'firstName lastName username profilePicture')
        .populate('targetUser', 'firstName lastName username profilePicture isBlocked')
        .lean(),
      Report.countDocuments(query),
    ]);

    return res.json({
      reports,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    return next(error);
  }
};

export const resolveReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid report id' });
    }
    const report = await Report.findById(id);
    if (!report) return res.status(404).json({ message: 'Report not found' });

    const status = String(req.body?.status || 'reviewed');
    if (!['open', 'reviewed', 'actioned', 'dismissed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    report.status = status;
    report.actionTaken = String(req.body?.actionTaken || '').slice(0, 300);
    report.handledBy = req.user._id;
    report.handledAt = new Date();

    if (req.body?.blockUser && report.targetUser) {
      const target = await User.findById(report.targetUser);
      if (target && target.role !== 'superadmin') {
        target.isBlocked = true;
        target.blockedReason = report.reason || 'Reported content';
        target.blockedAt = new Date();
        await target.save();
        report.status = 'actioned';
        report.actionTaken = report.actionTaken || 'Account blocked';
      }
    }

    await report.save();
    return res.json({ message: 'Report updated', report });
  } catch (error) {
    return next(error);
  }
};

export const blockReportedUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid report id' });
    }
    const report = await Report.findById(id);
    if (!report) return res.status(404).json({ message: 'Report not found' });
    if (!report.targetUser) {
      return res.status(400).json({ message: 'This report is not linked to an account' });
    }
    const target = await User.findById(report.targetUser);
    if (!target) return res.status(404).json({ message: 'Reported account not found' });
    if (target.role === 'superadmin') {
      return res.status(400).json({ message: 'You cannot block another super admin' });
    }

    target.isBlocked = true;
    target.blockedReason = `Blocked after ${report.reason} report`;
    target.blockedAt = new Date();
    await target.save();

    report.status = 'actioned';
    report.actionTaken = 'Account blocked';
    report.handledBy = req.user._id;
    report.handledAt = new Date();
    await report.save();

    return res.json({ message: 'Reported account blocked', report });
  } catch (error) {
    return next(error);
  }
};

/* ------------------------------------------------------------------ feedback */

export const listFeedback = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const status = String(req.query.status || '').trim();
    const query = {};
    if (['open', 'reviewed', 'resolved'].includes(status)) query.status = status;

    const [feedback, total] = await Promise.all([
      Feedback.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'firstName lastName username profilePicture')
        .lean(),
      Feedback.countDocuments(query),
    ]);

    return res.json({
      feedback,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    return next(error);
  }
};

export const updateFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid feedback id' });
    }
    const feedback = await Feedback.findById(id);
    if (!feedback) return res.status(404).json({ message: 'Feedback not found' });

    const status = String(req.body?.status || '').trim();
    if (['open', 'reviewed', 'resolved'].includes(status)) feedback.status = status;
    if (typeof req.body?.adminReply === 'string') {
      feedback.adminReply = req.body.adminReply.slice(0, 1000);
    }
    if (feedback.status === 'resolved') feedback.resolvedBy = req.user._id;

    await feedback.save();
    return res.json({ message: 'Feedback updated', feedback });
  } catch (error) {
    return next(error);
  }
};

/* -------------------------------------------------------------------- system */

export const getSystem = async (req, res, next) => {
  try {
    const settings = await getSystemSettings({ force: true });
    return res.json(settings);
  } catch (error) {
    return next(error);
  }
};

export const updateSystem = async (req, res, next) => {
  try {
    let doc = await SystemSetting.findOne({ key: 'global' });
    if (!doc) doc = new SystemSetting({ key: 'global', ...DEFAULTS });

    if (typeof req.body?.maintenanceEnabled === 'boolean') {
      doc.maintenanceEnabled = req.body.maintenanceEnabled;
    }
    if (typeof req.body?.maintenanceMessage === 'string') {
      doc.maintenanceMessage = req.body.maintenanceMessage.slice(0, 500);
    }
    if (req.body?.maintenanceUntil !== undefined) {
      doc.maintenanceUntil = req.body.maintenanceUntil ? new Date(req.body.maintenanceUntil) : null;
    }
    if (typeof req.body?.registrationOpen === 'boolean') {
      doc.registrationOpen = req.body.registrationOpen;
    }
    doc.updatedBy = req.user._id;

    await doc.save();
    invalidateSystemSettings();

    return res.json({ message: 'System settings saved', system: doc });
  } catch (error) {
    return next(error);
  }
};

export default {
  getOverview,
  listUsers,
  blockUser,
  unblockUser,
  setUserRole,
  listReports,
  resolveReport,
  blockReportedUser,
  listFeedback,
  updateFeedback,
  getSystem,
  updateSystem,
};
