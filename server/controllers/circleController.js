import mongoose from 'mongoose';
import CircleItem, { CIRCLE_ITEM_KINDS } from '../models/CircleItem.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import { can, denyFor } from './accessController.js';
import { fileUrl } from '../middleware/uploadMiddleware.js';

const AUTHOR_FIELDS =
  'firstName lastName username profilePicture isOnline lastSeen preferences.allowRemix preferences.allowShareToStories preferences.allowDownload';

const isMember = (chat, userId) =>
  chat.users.some((member) => member.toString() === userId.toString());

const requireMembership = async (chatId, userId) => {
  const chat = await Chat.findById(chatId).select(
    'users chatName isGroupChat groupAdmin memberRoles accessRules'
  );
  if (!chat) return { error: { status: 404, message: 'Circle not found' } };
  if (!isMember(chat, userId)) {
    return { error: { status: 403, message: 'You are not a member of this Circle' } };
  }
  return { chat };
};

const normalizeTags = (tags) =>
  (Array.isArray(tags) ? tags : String(tags || '').split(','))
    .map((tag) => String(tag).trim().replace(/^#/, ''))
    .filter(Boolean)
    .slice(0, 8);

const clamp = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};

/**
 * Pull uploaded files out of the request regardless of whether the route used
 * `.single()`, `.array()` or `.fields()`.
 */
const collectUploads = (req) => {
  const media = [];
  let audio = null;
  let cover = null;

  const push = (file) => {
    if (!file) return;
    const path = fileUrl(file);
    const field = file.fieldname || 'media';
    if (field === 'audio') audio = path;
    else if (field === 'cover') cover = path;
    else media.push(path);
  };

  if (req.file) push(req.file);
  if (Array.isArray(req.files)) {
    req.files.forEach(push);
  } else if (req.files && typeof req.files === 'object') {
    Object.values(req.files).forEach((value) =>
      Array.isArray(value) ? value.forEach(push) : push(value)
    );
  }

  return { media, audio, cover };
};

/** Merge each uploaded clip with its editor settings (trim / speed / filter). */
const normalizeClips = (clips, mediaPaths) => {
  const list = Array.isArray(clips) ? clips : [];
  if (list.length === 0) {
    return mediaPaths.map((path) => ({ media: path, speed: 1 }));
  }
  return list.slice(0, 12).map((clip, index) => {
    const idx = Number.isInteger(clip?.index) ? clip.index : index;
    return {
      media: clip?.media || mediaPaths[idx] || '',
      duration: Math.max(0, Number(clip?.duration) || 0),
      trimStart: Math.max(0, Number(clip?.trimStart) || 0),
      trimEnd: Math.max(0, Number(clip?.trimEnd) || 0),
      speed: clamp(clip?.speed, 0.25, 4, 1),
      filter: clip?.filter ? String(clip.filter).slice(0, 40) : '',
      muted: Boolean(clip?.muted),
    };
  });
};

const normalizeOverlays = (overlays) => {
  if (!Array.isArray(overlays)) return [];
  return overlays
    .slice(0, 20)
    .map((o) => ({
      text: String(o?.text || '').slice(0, 200),
      x: clamp(o?.x, 0, 100, 50),
      y: clamp(o?.y, 0, 100, 50),
      start: Math.max(0, Number(o?.start) || 0),
      end: Math.max(0, Number(o?.end) || 0),
      color: /^#[0-9a-fA-F]{3,8}$/.test(o?.color || '') ? o.color : '#ffffff',
      size: clamp(o?.size, 10, 96, 28),
      align: ['left', 'center', 'right'].includes(o?.align) ? o.align : 'center',
    }))
    .filter((o) => o.text.trim());
};

const parseReel = (reel) => {
  if (!reel) return {};
  if (typeof reel === 'object') return reel;
  try {
    return JSON.parse(reel);
  } catch {
    return null;
  }
};

/**
 * GET /api/circles/:chatId/items?kind=reel
 * List a Circle's items, optionally filtered by section.
 */
export const listItems = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { kind } = req.query;

    const { error } = await requireMembership(chatId, req.user._id);
    if (error) return res.status(error.status).json({ message: error.message });

    const query = { chat: chatId };
    if (kind) {
      if (!CIRCLE_ITEM_KINDS.includes(kind)) {
        return res.status(400).json({ message: `Invalid kind: ${kind}` });
      }
      query.kind = kind;
    }

    const items = await CircleItem.find(query)
      .sort('-createdAt')
      .limit(100)
      .populate('author', AUTHOR_FIELDS);

    return res.json(items);
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/circles/:chatId/items
 * Create an item (reel / library / challenge / event / opportunity).
 * Accepts JSON or multipart (field `media`).
 */
export const createItem = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const {
      kind,
      title,
      description = '',
      link = '',
      date = null,
      location = '',
      tags,
      visibility,
      reel,
    } = req.body;

    if (!CIRCLE_ITEM_KINDS.includes(kind)) {
      return res.status(400).json({ message: `Invalid kind: ${kind}` });
    }

    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: 'A title is required' });
    }

    const { error, chat } = await requireMembership(chatId, req.user._id);
    if (error) return res.status(error.status).json({ message: error.message });

    // Circle access control: publishing into the Circle is a policy too.
    if (!can(chat, req.user._id, 'createItems')) {
      const denied = denyFor(chat, 'createItems');
      return res.status(denied.status).json({ message: denied.message });
    }

    const uploads = collectUploads(req);
    const meta = parseReel(reel);
    if (meta === null) {
      return res.status(400).json({ message: 'Invalid Reel editor data' });
    }

    const mediaPaths = uploads.media;
    const audioPath = uploads.audio || (meta.audio && meta.audio.url) || '';
    const requestedVisibility = meta.visibility || visibility;

    const item = await CircleItem.create({
      chat: chatId,
      author: req.user._id,
      kind,
      title: String(title).trim(),
      description: String(description).slice(0, 2000),
      link: String(link || '').trim(),
      date: date ? new Date(date) : null,
      location: String(location || '').trim(),
      tags: normalizeTags(tags),
      media: mediaPaths[0] || '',
      mediaItems: mediaPaths,
      clips: normalizeClips(meta.clips, mediaPaths),
      cover: uploads.cover || '',
      coverTime: Math.max(0, Number(meta.coverTime) || 0),
      filter: meta.filter ? String(meta.filter).slice(0, 40) : 'none',
      speed: clamp(meta.speed, 0.25, 4, 1),
      audio: audioPath
        ? {
            url: audioPath,
            title: String(meta.audio?.title || 'Original audio').slice(0, 120),
            startAt: Math.max(0, Number(meta.audio?.startAt) || 0),
          }
        : undefined,
      overlays: normalizeOverlays(meta.overlays),
      hashtags: normalizeTags(meta.hashtags || tags),
      durationSec: Math.max(0, Number(meta.durationSec) || 0),
      visibility: ['circle', 'public'].includes(requestedVisibility)
        ? requestedVisibility
        : 'circle',
      remixOf: mongoose.isValidObjectId(meta.remixOf) ? meta.remixOf : null,
      participants: kind === 'challenge' || kind === 'event' ? [req.user._id] : [],
    });

    const populated = await CircleItem.findById(item._id).populate('author', AUTHOR_FIELDS);

    return res.status(201).json(populated);
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/circles/:chatId/items/:id
 * Update an item (author only).
 */
export const updateItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, link, date, location, tags } = req.body;

    const item = await CircleItem.findById(id);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    if (item.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own posts' });
    }

    if (title !== undefined) item.title = String(title).trim().slice(0, 160);
    if (description !== undefined) item.description = String(description).slice(0, 2000);
    if (link !== undefined) item.link = String(link).trim();
    if (date !== undefined) item.date = date ? new Date(date) : null;
    if (location !== undefined) item.location = String(location).trim();
    if (tags !== undefined) item.tags = normalizeTags(tags);

    const uploads = collectUploads(req);
    if (uploads.media.length) {
      item.media = uploads.media[0];
      item.mediaItems = uploads.media;
    }
    if (uploads.cover) item.cover = uploads.cover;
    if (uploads.audio) {
      if (!item.audio) item.audio = {};
      item.audio.url = uploads.audio;
    }

    await item.save();

    const populated = await CircleItem.findById(item._id).populate('author', AUTHOR_FIELDS);
    return res.json(populated);
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/circles/:chatId/items/:id
 * Delete an item (author or Circle admin).
 */
export const deleteItem = async (req, res, next) => {
  try {
    const { chatId, id } = req.params;

    const item = await CircleItem.findById(id);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    const chat = await Chat.findById(chatId).select('groupAdmin');
    const isAuthor = item.author.toString() === req.user._id.toString();
    const isAdmin = chat?.groupAdmin && chat.groupAdmin.toString() === req.user._id.toString();

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ message: 'You cannot delete this post' });
    }

    await item.deleteOne();
    return res.json({ message: 'Deleted', id });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/circles/:chatId/items/:id/spark
 * Toggle a Spark (like) on an item.
 */
export const toggleSpark = async (req, res, next) => {
  try {
    const { id } = req.params;

    const item = await CircleItem.findById(id);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    const userId = req.user._id.toString();
    const has = (item.sparks || []).some((spark) => spark.toString() === userId);

    if (has) item.sparks.pull(req.user._id);
    else item.sparks.push(req.user._id);

    await item.save();

    return res.json({
      sparked: !has,
      sparkCount: item.sparks.length,
      id,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/circles/:chatId/items/:id/join
 * Join/leave a challenge or event.
 */
export const toggleParticipate = async (req, res, next) => {
  try {
    const { id } = req.params;

    const item = await CircleItem.findById(id);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    if (!['challenge', 'event'].includes(item.kind)) {
      return res.status(400).json({ message: 'Only challenges and events can be joined' });
    }

    const userId = req.user._id.toString();
    const has = (item.participants || []).some((p) => p.toString() === userId);

    if (has) item.participants.pull(req.user._id);
    else item.participants.push(req.user._id);

    await item.save();

    return res.json({
      participating: !has,
      count: item.participants.length,
      id,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/circles/:chatId/items/:id/remix
 * Reuse a Reel in a Circle you belong to.
 *
 * Wchat's remix is a *reuse*, not a copy-edit: the source Reel's clips, audio,
 * overlays and styling are carried into a new item authored by you and linked
 * back through `remixOf`. Honours the creator's **Allow remixes** control.
 */
export const remixItem = async (req, res, next) => {
  try {
    const { chatId, id } = req.params;

    const source = await CircleItem.findById(id).populate('author', 'preferences.allowRemix');
    if (!source) return res.status(404).json({ message: 'Reel not found' });

    if (source.kind !== 'reel') {
      return res.status(400).json({ message: 'Only Reels can be remixed' });
    }

    if (source.author && source.author.preferences?.allowRemix === false) {
      return res.status(403).json({ message: 'This creator has turned off remixes' });
    }

    const { error } = await requireMembership(chatId, req.user._id);
    if (error) return res.status(error.status).json({ message: error.message });

    const { title, description, visibility } = req.body || {};

    const remix = await CircleItem.create({
      chat: chatId,
      author: req.user._id,
      kind: 'reel',
      title: String(title || `${source.title} (remix)`)
        .trim()
        .slice(0, 160),
      description: String(description ?? source.description ?? '').slice(0, 2000),
      media: source.media,
      mediaItems: source.mediaItems,
      cover: source.cover,
      coverTime: source.coverTime,
      speed: source.speed,
      filter: source.filter,
      audio: source.audio,
      overlays: source.overlays,
      hashtags: source.hashtags,
      tags: source.tags,
      durationSec: source.durationSec,
      clips: source.clips,
      location: source.location,
      visibility: ['circle', 'public'].includes(visibility) ? visibility : 'circle',
      remixOf: source._id,
    });

    const populated = await CircleItem.findById(remix._id)
      .populate('author', AUTHOR_FIELDS)
      .populate('chat', 'chatName groupAvatar');

    return res.status(201).json(populated);
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/circles/feed/reels?search=
 * Reels from every Circle the user belongs to (the "Reels" tab).
 */
export const listReelsFeed = async (req, res, next) => {
  try {
    const { search, scope } = req.query;

    const chats = await Chat.find({ users: req.user._id }).select('_id').lean();
    const chatIds = chats.map((chat) => chat._id);

    // Reels from the member's Circles, plus any public Reel so that creators can
    // reach people who don't follow them yet (Instagram's Reels discovery).
    const query = { kind: 'reel' };
    if (scope === 'discover') {
      query.visibility = 'public';
      query.chat = { $nin: chatIds };
    } else {
      query.$or = [{ chat: { $in: chatIds } }, { visibility: 'public' }];
    }

    if (search && String(search).trim()) {
      const safe = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = { $regex: safe, $options: 'i' };
      query.$and = [{ $or: [{ title: regex }, { description: regex }, { hashtags: regex }] }];
    }

    const reels = await CircleItem.find(query)
      .sort('-createdAt')
      .limit(60)
      .populate('author', AUTHOR_FIELDS)
      .populate('chat', 'chatName groupAvatar joinPolicy');

    const me = await User.findById(req.user._id).select('following interests').lean();
    const following = (me?.following || []).map((id) => String(id));
    const interests = (me?.interests || []).map((interest) => String(interest).toLowerCase());
    const myChatIds = chatIds.map((id) => String(id));

    // Explain why each Reel is in the feed, and whether the viewer is already in
    // its Circle (so the client can offer "Open" instead of "Join").
    const decorated = reels.map((reel) => {
      const plain = reel.toObject({ virtuals: true });
      const circleId = String(plain.chat?._id || plain.chat || '');
      const isMember = myChatIds.includes(circleId);
      const hashtags = (plain.hashtags || []).map((tag) => String(tag).replace(/^#/, ''));

      let reason = 'Trending on Reels';
      let reasonCode = 'trending';
      let reasonDetail = '';

      if (isMember) {
        reason = `From ${plain.chat?.chatName || 'your Circle'}`;
        reasonCode = 'circle';
        reasonDetail = plain.chat?.chatName || '';
      } else if (following.includes(String(plain.author?._id || ''))) {
        reason = `Because you follow @${plain.author?.username || 'them'}`;
        reasonCode = 'creator';
        reasonDetail = `@${plain.author?.username || ''}`;
      } else {
        const matched = hashtags.find((tag) => interests.includes(tag.toLowerCase()));
        if (matched) {
          reason = `Because you're into #${matched}`;
          reasonCode = 'tag';
          reasonDetail = `#${matched}`;
        } else if (hashtags.length) {
          reason = `Reels tagged #${hashtags[0]}`;
          reasonCode = 'tag';
          reasonDetail = `#${hashtags[0]}`;
        } else {
          reason = 'Trending on Reels';
          reasonCode = 'trending';
        }
      }

      return { ...plain, reason, reasonCode, reasonDetail, isMember };
    });

    return res.json(decorated);
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/circles/feed/opportunities
 * Opportunities/events/challenges from the user's Circles (Discover → Opportunities).
 */
export const listDiscoverFeed = async (req, res, next) => {
  try {
    const { kind } = req.query;

    const chats = await Chat.find({ users: req.user._id }).select('_id').lean();
    const chatIds = chats.map((chat) => chat._id);

    const query = { chat: { $in: chatIds } };
    if (kind && CIRCLE_ITEM_KINDS.includes(kind)) query.kind = kind;
    else if (kind) return res.status(400).json({ message: `Invalid kind: ${kind}` });

    const items = await CircleItem.find(query)
      .sort('-createdAt')
      .limit(60)
      .populate('author', AUTHOR_FIELDS)
      .populate('chat', 'chatName groupAvatar');

    return res.json(items);
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/circles/mine
 * The Circles the user belongs to, with a count of items per section.
 */
export const listMyCommunities = async (req, res, next) => {
  try {
    const chats = await Chat.find({
      users: req.user._id,
      circleType: { $ne: 'personal' },
    })
      .sort('-updatedAt')
      .lean();

    const chatIds = chats.map((chat) => chat._id);

    const grouped = await CircleItem.aggregate([
      { $match: { chat: { $in: chatIds } } },
      { $group: { _id: { chat: '$chat', kind: '$kind' }, count: { $sum: 1 } } },
    ]);

    const countsByChat = new Map();
    grouped.forEach((row) => {
      const key = String(row._id.chat);
      if (!countsByChat.has(key)) countsByChat.set(key, {});
      countsByChat.get(key)[row._id.kind] = row.count;
    });

    const communities = chats.map((chat) => ({
      ...chat,
      memberCount: (chat.users || []).length,
      counts: countsByChat.get(String(chat._id)) || {},
    }));

    return res.json(communities);
  } catch (error) {
    return next(error);
  }
};

export default {
  listItems,
  createItem,
  updateItem,
  deleteItem,
  toggleSpark,
  toggleParticipate,
  remixItem,
  listReelsFeed,
  listDiscoverFeed,
  listMyCommunities,
};
