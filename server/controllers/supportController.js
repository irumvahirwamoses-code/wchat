import mongoose from 'mongoose';
import Feedback, { FEEDBACK_TYPES } from '../models/Feedback.js';
import Report, { REPORT_TARGET_TYPES, REPORT_REASONS } from '../models/Report.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Message from '../models/Message.js';
import Story from '../models/Story.js';

const resolveTargetUser = async (targetType, targetId) => {
  switch (targetType) {
    case 'user':
      return targetId;
    case 'post': {
      const post = await Post.findById(targetId).select('author').lean();
      return post?.author || null;
    }
    case 'comment': {
      const comment = await Comment.findById(targetId).select('author').lean();
      return comment?.author || null;
    }
    case 'message': {
      const message = await Message.findById(targetId).select('sender').lean();
      return message?.sender || null;
    }
    case 'story': {
      const story = await Story.findById(targetId).select('author').lean();
      return story?.author || null;
    }
    default:
      return null;
  }
};

/** POST /api/support/feedback */
export const submitFeedback = async (req, res, next) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ message: 'Please write a message' });

    const type = FEEDBACK_TYPES.includes(req.body?.type) ? req.body.type : 'feedback';
    let rating = null;
    if (req.body?.rating !== undefined && req.body?.rating !== null && req.body?.rating !== '') {
      const n = Number(req.body.rating);
      if (Number.isFinite(n) && n >= 1 && n <= 5) rating = Math.round(n);
    }

    const feedback = await Feedback.create({
      user: req.user._id,
      type,
      rating,
      message: message.slice(0, 2000),
      page: String(req.body?.page || '').slice(0, 120),
    });

    return res.status(201).json({ message: 'Thank you for your feedback!', feedback });
  } catch (error) {
    return next(error);
  }
};

/** GET /api/support/feedback  (my submissions) */
export const myFeedback = async (req, res, next) => {
  try {
    const feedback = await Feedback.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return res.json({ feedback });
  } catch (error) {
    return next(error);
  }
};

/** POST /api/support/report */
export const submitReport = async (req, res, next) => {
  try {
    const targetType = String(req.body?.targetType || '').trim();
    const targetId = String(req.body?.targetId || '').trim();
    const reason = String(req.body?.reason || '').trim();

    if (!REPORT_TARGET_TYPES.includes(targetType)) {
      return res.status(400).json({ message: 'Invalid report target' });
    }
    if (!mongoose.isValidObjectId(targetId)) {
      return res.status(400).json({ message: 'Invalid target id' });
    }
    if (!REPORT_REASONS.includes(reason)) {
      return res.status(400).json({ message: 'Please choose a reason' });
    }

    const targetUser = await resolveTargetUser(targetType, targetId);

    if (targetUser && String(targetUser) === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot report yourself' });
    }

    const existing = await Report.findOne({
      reporter: req.user._id,
      targetType,
      targetId,
      status: { $in: ['open', 'reviewed'] },
    });
    if (existing) {
      return res.status(409).json({ message: 'You already reported this. Our team is reviewing it.' });
    }

    const report = await Report.create({
      reporter: req.user._id,
      targetType,
      targetId,
      targetUser,
      reason,
      details: String(req.body?.details || '').slice(0, 1000),
    });

    return res.status(201).json({ message: 'Report received. Thank you for helping keep Wchat safe.', report });
  } catch (error) {
    return next(error);
  }
};

export default { submitFeedback, myFeedback, submitReport };
