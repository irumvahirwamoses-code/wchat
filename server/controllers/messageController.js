import Message from '../models/Message.js';
import Chat from '../models/Chat.js';
import { VANISH_TTL_MS } from '../services/chatScheduler.js';
import { can, denyFor } from './accessController.js';
import { fileUrl } from '../middleware/uploadMiddleware.js';

const SENDER_FIELDS = 'firstName lastName username profilePicture isOnline lastSeen';

const isMember = (chat, userId) =>
  chat.users.some((member) => member.toString() === userId.toString());

/** Load a message with its sender, quoted message and reactions populated. */
const populateMessage = (messageId) =>
  Message.findById(messageId)
    .populate('sender', SENDER_FIELDS)
    .populate('reactions.user', SENDER_FIELDS)
    .populate({
      path: 'replyTo',
      select: 'content contentType fileName sender createdAt',
      populate: { path: 'sender', select: SENDER_FIELDS },
    });

/**
 * GET /api/messages/:chatId
 * All messages in a chat (oldest first) with sender details populated.
 */
export const getMessages = async (req, res, next) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId).select('users');

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!isMember(chat, req.user._id)) {
      return res.status(403).json({ message: 'You are not a member of this chat' });
    }

    const messages = await Message.find({
      chat: chatId,
      // Hide scheduled messages from everyone except their author, and drop
      // Vanish Mode messages that have already expired.
      $and: [
        { $or: [{ delivered: { $ne: false } }, { sender: req.user._id }] },
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
      ],
    })
      .sort({ createdAt: 1 })
      .populate('sender', SENDER_FIELDS)
      .populate('reactions.user', SENDER_FIELDS)
      .populate({
        path: 'replyTo',
        select: 'content contentType fileName sender createdAt',
        populate: { path: 'sender', select: SENDER_FIELDS },
      });

    return res.json(messages);
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/messages
 * Send a message (text or an uploaded file).
 */
export const sendMessage = async (req, res, next) => {
  try {
    const { chatId, contentType = 'text', text, replyTo, scheduledAt } = req.body;

    if (!chatId) {
      return res.status(400).json({ message: 'chatId is required' });
    }

    const allowedTypes = ['text', 'image', 'audio', 'video', 'file'];

    if (!allowedTypes.includes(contentType)) {
      return res.status(400).json({ message: `Invalid message type: ${contentType}` });
    }

    const chat = await Chat.findById(chatId).select(
      'users vanishMode isGroupChat groupAdmin memberRoles accessRules'
    );

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!isMember(chat, req.user._id)) {
      return res.status(403).json({ message: 'You are not a member of this chat' });
    }

    // Circle access control: the Circle policy decides who may say what.
    const capability = contentType === 'text' ? 'postMessages' : 'sendMedia';
    if (!can(chat, req.user._id, capability)) {
      const denied = denyFor(chat, capability);
      return res.status(denied.status).json({ message: denied.message });
    }

    let content;
    let fileName = '';
    let fileSize = 0;

    if (contentType === 'text') {
      content = String(text || '').trim();

      if (!content) {
        return res.status(400).json({ message: 'Message text is required' });
      }
    } else {
      const file = req.files && req.files.file ? req.files.file[0] : null;

      if (!file) {
        return res.status(400).json({ message: `A ${contentType} file is required` });
      }

      content = fileUrl(file);
      fileName = file.originalname || '';
      fileSize = file.size || 0;
    }

    // A quoted reply must point at a message in this same chat.
    let quotedId = null;
    if (replyTo) {
      const quoted = await Message.findOne({ _id: replyTo, chat: chatId }).select('_id');
      if (!quoted) {
        return res.status(400).json({ message: 'The quoted message is not in this chat' });
      }
      quotedId = quoted._id;
    }

    // "Send later" — up to 29 days ahead, at least a minute into the future.
    const MAX_SCHEDULE_MS = 29 * 24 * 60 * 60 * 1000;
    let scheduledFor = null;
    let delivered = true;

    if (scheduledAt) {
      const when = new Date(scheduledAt);

      if (Number.isNaN(when.getTime())) {
        return res.status(400).json({ message: 'That schedule time is not valid' });
      }

      const delta = when.getTime() - Date.now();

      if (delta < 60000) {
        return res.status(400).json({ message: 'Schedule a message at least a minute ahead' });
      }

      if (delta > MAX_SCHEDULE_MS) {
        return res.status(400).json({ message: 'You can schedule up to 29 days ahead' });
      }

      scheduledFor = when;
      delivered = false;
    }

    // Vanish Mode: every message in the conversation expires.
    const expiresAt = chat.vanishMode
      ? new Date(Date.now() + VANISH_TTL_MS)
      : null;

    const message = await Message.create({
      sender: req.user._id,
      chat: chatId,
      contentType,
      content,
      fileName,
      fileSize,
      replyTo: quotedId,
      scheduledAt: scheduledFor,
      delivered,
      expiresAt,
      seenBy: [req.user._id],
    });

    const populated = await populateMessage(message._id);

    return res.status(201).json(populated);
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/messages/:id
 * Edit a text message (author only).
 */
export const editMessage = async (req, res, next) => {
  try {
    const { text } = req.body;
    const content = String(text || '').trim();

    if (!content) {
      return res.status(400).json({ message: 'Message text is required' });
    }

    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own messages' });
    }

    if (message.contentType !== 'text') {
      return res.status(400).json({ message: 'Only text messages can be edited' });
    }

    // Instagram-style edit window: 15 minutes from send time.
    const EDIT_WINDOW_MS = 15 * 60 * 1000;
    const sentAt = message.updatedAt instanceof Date ? message.updatedAt : new Date(message.updatedAt);
    if (Date.now() - sentAt.getTime() > EDIT_WINDOW_MS) {
      return res
        .status(400)
        .json({ message: 'Messages can only be edited within 15 minutes' });
    }

    message.content = content;
    message.editedAt = new Date();
    await message.save();

    const populated = await populateMessage(message._id);

    const io = req.app.get('io');
    if (io) io.to(`chat:${message.chat}`).emit('message edited', populated);

    return res.json(populated);
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/messages/:id
 * Delete a message (author only).
 */
export const deleteMessage = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own messages' });
    }

    const chatId = message.chat.toString();
    await message.deleteOne();

    const io = req.app.get('io');
    if (io) io.to(`chat:${chatId}`).emit('message deleted', { messageId: req.params.id, chatId });

    return res.json({ message: 'Message deleted', messageId: req.params.id, chatId });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/messages/:chatId/seen
 * Mark every message in a chat that the user has not seen yet as seen.
 */
export const markChatSeen = async (req, res, next) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId).select('users');

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!isMember(chat, req.user._id)) {
      return res.status(403).json({ message: 'You are not a member of this chat' });
    }

    await Message.updateMany(
      { chat: chatId, sender: { $ne: req.user._id }, seenBy: { $ne: req.user._id } },
      { $addToSet: { seenBy: req.user._id } }
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${chatId}`).emit('chat seen', {
        chatId,
        userId: req.user._id,
      });
    }

    return res.json({ chatId, seenBy: req.user._id });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/messages/:id/react
 * Add, change or clear the caller's reaction on a message.
 * An empty emoji removes the existing reaction.
 */
export const reactMessage = async (req, res, next) => {
  try {
    const emoji = String(req.body.emoji || '').trim();

    if (emoji.length > 16) {
      return res.status(400).json({ message: 'That reaction is too long' });
    }

    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const chat = await Chat.findById(message.chat).select('users');

    if (!chat || !isMember(chat, req.user._id)) {
      return res.status(403).json({ message: 'You are not a member of this chat' });
    }

    const reactions = (message.reactions || []).filter(
      (reaction) => reaction.user.toString() !== req.user._id.toString()
    );

    if (emoji) {
      reactions.push({ user: req.user._id, emoji });
    }

    message.reactions = reactions;
    await message.save();

    const populated = await populateMessage(message._id);

    const io = req.app.get('io');
    if (io) io.to(`chat:${message.chat}`).emit('message reacted', populated);

    return res.json(populated);
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/messages/live-location
 * Start sharing a live location in a chat (up to one hour).
 */
export const startLiveLocation = async (req, res, next) => {
  try {
    const { chatId, latitude, longitude, durationMinutes } = req.body;

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({ message: 'A valid latitude is required' });
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ message: 'A valid longitude is required' });
    }

    const chat = await Chat.findById(chatId).select('users');

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    if (!isMember(chat, req.user._id)) {
      return res.status(403).json({ message: 'You are not a member of this chat' });
    }

    // Live location runs for 5–60 minutes, exactly like the app it mirrors.
    // The deadline lives inside the payload (not `expiresAt`) so ended shares
    // stay in the thread instead of being swept up by the Vanish Mode purge.
    const minutes = Math.min(Math.max(Number(durationMinutes) || 60, 5), 60);
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

    const message = await Message.create({
      sender: req.user._id,
      chat: chatId,
      contentType: 'location',
      content: JSON.stringify({ latitude: lat, longitude: lng, live: true, expiresAt }),
      seenBy: [req.user._id],
    });

    const populated = await populateMessage(message._id);

    return res.status(201).json(populated);
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/messages/:id/live-location
 * Move an active live location. Only the sharer can move it, and only until it
 * expires.
 */
export const updateLiveLocation = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: 'A valid position is required' });
    }

    const message = await Message.findById(req.params.id);

    if (!message || message.contentType !== 'location') {
      return res.status(404).json({ message: 'Live location not found' });
    }
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only move your own live location' });
    }

    let payload = {};
    try {
      payload = JSON.parse(message.content);
    } catch {
      payload = {};
    }

    if (!payload.live) {
      return res.status(400).json({ message: 'This location is no longer being shared' });
    }
    if (payload.expiresAt && new Date(payload.expiresAt).getTime() <= Date.now()) {
      return res.status(400).json({ message: 'This live location has ended' });
    }

    message.content = JSON.stringify({ ...payload, latitude: lat, longitude: lng, live: true });
    await message.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${message.chat}`).emit('location updated', {
        messageId: message._id,
        chatId: message.chat,
        latitude: lat,
        longitude: lng,
        live: true,
      });
    }

    return res.json({ messageId: message._id, latitude: lat, longitude: lng, live: true });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/messages/:id/live-location/stop
 * End a live location early, keeping the last known position in the thread.
 */
export const stopLiveLocation = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message || message.contentType !== 'location') {
      return res.status(404).json({ message: 'Live location not found' });
    }
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only stop your own live location' });
    }

    let payload = {};
    try {
      payload = JSON.parse(message.content);
    } catch {
      payload = {};
    }

    message.content = JSON.stringify({ ...payload, live: false });
    await message.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${message.chat}`).emit('location updated', {
        messageId: message._id,
        chatId: message.chat,
        live: false,
      });
    }

    return res.json({ messageId: message._id, live: false });
  } catch (error) {
    return next(error);
  }
};

export default {
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  reactMessage,
  markChatSeen,
  startLiveLocation,
  updateLiveLocation,
  stopLiveLocation,
};
