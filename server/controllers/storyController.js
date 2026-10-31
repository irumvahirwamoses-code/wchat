import Story, { STICKER_TYPES, STORY_AUDIENCES } from '../models/Story.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import { fileUrl } from '../middleware/uploadMiddleware.js';

const AUTHOR_FIELDS =
  'firstName lastName username profilePicture isOnline lastSeen closeFriends preferences.allowRemix preferences.allowShareToStories preferences.allowDownload preferences.allowMentions preferences.storyHideFrom preferences.storyAudience preferences.storyAllowReplies preferences.storyAllowMentions';
const CIRCLE_FIELDS = 'chatName groupAvatar circleType';

const STICKER_TYPE_SET = new Set(STICKER_TYPES);
const AUDIENCE_SET = new Set(STORY_AUDIENCES);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Accept either a JSON string, an already-parsed object, or a fallback. */
const parseJson = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const asBool = (value, fallback) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
};

const cleanTextStyle = (value) => {
  const raw = parseJson(value, {}) || {};
  const background = String(raw.background || '#111827').slice(0, 32);
  const color = String(raw.color || '#ffffff').slice(0, 32);
  const font = String(raw.font || 'classic').slice(0, 32);
  return { background, color, font };
};

/** Sanitize stickers coming from the composer (JSON string or array). */
const cleanStickers = (value) => {
  const list = parseJson(value, []);
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, 20)
    .map((sticker) => {
      if (!sticker || !STICKER_TYPE_SET.has(sticker.type)) return null;
      const clean = {
        type: sticker.type,
        x: clamp(Number(sticker.x) || 50, 0, 100),
        y: clamp(Number(sticker.y) || 50, 0, 100),
        text: String(sticker.text || '').slice(0, 200),
        url: String(sticker.url || '').slice(0, 600),
        emoji: String(sticker.emoji || '').slice(0, 16),
        prompt: String(sticker.prompt || '').slice(0, 200),
      };
      if (sticker.type === 'poll' || sticker.type === 'quiz') {
        clean.options = (Array.isArray(sticker.options) ? sticker.options : [])
          .slice(0, 4)
          .map((option) => ({
            text: String(typeof option === 'string' ? option : option?.text || '').slice(0, 80),
          }))
          .filter((option) => option.text);
        if (sticker.type === 'quiz') {
          const index = Number(sticker.correctIndex);
          clean.correctIndex = Number.isInteger(index)
            ? clamp(index, 0, Math.max(0, clean.options.length - 1))
            : 0;
        }
      }
      if (sticker.type === 'countdown') {
        const when = new Date(sticker.endsAt);
        clean.endsAt = Number.isNaN(when.getTime())
          ? new Date(Date.now() + 24 * 60 * 60 * 1000)
          : when;
      }
      return clean;
    })
    .filter(Boolean);
};

const sanitizeAuthor = (author) => {
  if (!author) return author;
  const obj = typeof author.toObject === 'function' ? author.toObject() : { ...author };
  delete obj.closeFriends;
  if (obj.preferences) {
    delete obj.preferences.storyHideFrom;
  }
  return obj;
};

/** Hide quiz answers and other private data from everyone but the author. */
const sanitizeStory = (story, viewerId) => {
  const plain = typeof story.toObject === 'function' ? story.toObject({ virtuals: true }) : { ...story };
  delete plain.hideFrom;
  const isAuthor = String(plain.author?._id || plain.author) === String(viewerId);
  if (Array.isArray(plain.stickers)) {
    plain.stickers = plain.stickers.map((sticker) => {
      const copy = { ...sticker };
      if (!isAuthor && copy.type === 'quiz') delete copy.correctIndex;
      if (!isAuthor && Array.isArray(copy.responses)) {
        copy.responses = copy.responses.filter(
          (response) => String(response.user?._id || response.user) === String(viewerId)
        );
      }
      if (Array.isArray(copy.options)) {
        copy.options = copy.options.map((option) => ({
          ...option,
          votes: option.votes || [],
        }));
      }
      return copy;
    });
  }
  plain.author = sanitizeAuthor(plain.author);
  return plain;
};

const canViewStory = (story, viewerId) => {
  const author = story.author;
  if (!author) return false;
  const authorId = String(author._id || author);
  if (authorId === String(viewerId)) return true;

  const hideFrom = (author.preferences?.storyHideFrom || []).map(String);
  if (hideFrom.includes(String(viewerId))) return false;

  if (story.audience === 'closeFriends') {
    const closeFriends = (author.closeFriends || []).map(String);
    return closeFriends.includes(String(viewerId));
  }
  return true;
};

/**
 * GET /api/stories
 * The tray: own stories, followed authors' timeline stories and circle stories,
 * filtered by audience, close-friends and hide-from rules.
 */
export const getStoryFeed = async (req, res, next) => {
  try {
    const viewerId = String(req.user._id);
    const me = await User.findById(req.user._id)
      .select('following mutedStories')
      .lean();
    const following = Array.isArray(me?.following) ? me.following : [];
    const muted = new Set((me?.mutedStories || []).map(String));

    const chats = await Chat.find({ users: req.user._id }).select('_id').lean();
    const chatIds = chats.map((chat) => chat._id);

    const stories = await Story.find({
      $or: [
        { author: req.user._id },
        { author: { $in: following }, circle: null },
        { circle: { $in: chatIds } },
      ],
      expiresAt: { $gt: new Date() },
    })
      .sort('createdAt')
      .populate('author', AUTHOR_FIELDS)
      .populate('circle', CIRCLE_FIELDS);

    const visible = stories.filter((story) => {
      const authorId = String(story.author?._id || story.author || '');
      if (!authorId) return false;
      if (authorId !== viewerId && muted.has(authorId)) return false;
      return canViewStory(story, viewerId);
    });

    const grouped = new Map();
    visible.forEach((story) => {
      const key = String(story.author?._id || story.author);
      if (!grouped.has(key)) {
        grouped.set(key, {
          owner: sanitizeAuthor(story.author),
          circle: story.circle,
          stories: [],
          seen: false,
          latestAt: story.createdAt,
        });
      }
      grouped.get(key).stories.push(sanitizeStory(story, viewerId));
      if (new Date(story.createdAt) > new Date(grouped.get(key).latestAt)) {
        grouped.get(key).latestAt = story.createdAt;
      }
    });

    const rings = Array.from(grouped.values()).map((ring) => {
      const seen = ring.stories.every((story) =>
        (story.viewers || []).some((viewer) => String(viewer) === viewerId)
      );
      return { ...ring, seen };
    });

    // My ring first; then unseen; then newest.
    rings.sort((a, b) => {
      const am = String(a.owner?._id) === viewerId;
      const bm = String(b.owner?._id) === viewerId;
      if (am !== bm) return am ? -1 : 1;
      if (a.seen !== b.seen) return a.seen ? 1 : -1;
      return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime();
    });

    return res.json({ rings });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/stories
 * Supports a media upload, a text-only story, or both, plus stickers and privacy.
 */
export const createStory = async (req, res, next) => {
  try {
    const author = await User.findById(req.user._id);
    if (!author) return res.status(404).json({ message: 'Account not found' });

    const text = String(req.body.text || '').slice(0, 500).trim();
    if (!req.file && !text) {
      return res.status(400).json({ message: 'Add a photo, a video or some text' });
    }

    let circle = null;
    if (req.body.circleId) {
      const chat = await Chat.findById(req.body.circleId).select('users');
      if (!chat) return res.status(404).json({ message: 'Circle not found' });
      if (!chat.users.some((user) => String(user) === String(req.user._id))) {
        return res.status(403).json({ message: 'You are not a member of this Circle' });
      }
      circle = chat._id;
    }

    let mediaType = 'text';
    if (req.file) {
      const mimetype = (req.file.mimetype || '').toLowerCase();
      mediaType = mimetype.startsWith('video/') ? 'video' : 'image';
      if (req.body.mediaType === 'video' || req.body.mediaType === 'image') {
        mediaType = req.body.mediaType;
      }
    }

    const prefs = author.preferences || {};
    const audience = AUDIENCE_SET.has(req.body.audience)
      ? req.body.audience
      : prefs.storyAudience || 'followers';

    const hideFrom = (prefs.storyHideFrom || [])
      .map(String)
      .filter((id) => id && id !== String(author._id));

    const music = parseJson(req.body.music, null);

    // Respect each mentioned member's "who can mention me" preference.
    let stickers = cleanStickers(req.body.stickers);
    const mentionNames = stickers
      .filter((sticker) => sticker.type === 'mention')
      .map((sticker) => String(sticker.text || '').replace(/^@/, '').trim().toLowerCase())
      .filter(Boolean);
    if (mentionNames.length > 0) {
      const mentioned = await User.find({ username: { $in: mentionNames } }).select(
        'username preferences.allowMentions'
      );
      const blocked = new Set(
        mentioned
          .filter((member) => {
            const rule = member.preferences?.allowMentions || 'everyone';
            if (rule === 'no-one') return true;
            if (rule === 'people-i-follow') {
              return !(author.following || []).some(
                (id) => String(id) === String(member._id)
              );
            }
            return false;
          })
          .map((member) => member.username)
      );
      if (blocked.size > 0) {
        stickers = stickers.filter(
          (sticker) =>
            sticker.type !== 'mention' ||
            !blocked.has(
              String(sticker.text || '').replace(/^@/, '').trim().toLowerCase()
            )
        );
      }
    }

    const story = await Story.create({
      author: author._id,
      circle,
      media: req.file ? fileUrl(req.file) : '',
      mediaType,
      text,
      textStyle: cleanTextStyle(req.body.textStyle),
      stickers,
      audience,
      hideFrom,
      allowReplies: asBool(req.body.allowReplies, prefs.storyAllowReplies !== false),
      allowMentions: asBool(req.body.allowMentions, prefs.storyAllowMentions !== false),
      caption: String(req.body.caption || '').slice(0, 300),
      music: music
        ? {
            title: String(music.title || '').slice(0, 100),
            artist: String(music.artist || '').slice(0, 100),
            url: String(music.url || ''),
          }
        : undefined,
      viewers: [],
      expiresAt: new Date(Date.now() + Story.ttlHours * 60 * 60 * 1000),
    });

    const populated = await Story.findById(story._id)
      .populate('author', AUTHOR_FIELDS)
      .populate('circle', CIRCLE_FIELDS);

    const io = req.app.get('io');
    if (io) io.emit('story created', { story: sanitizeStory(populated, author._id) });

    return res.status(201).json(sanitizeStory(populated, author._id));
  } catch (error) {
    return next(error);
  }
};

/** POST /api/stories/:id/view */
export const viewStory = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id).select('_id author');
    if (!story) return res.status(404).json({ message: 'Story not found' });
    if (String(story.author) !== String(req.user._id)) {
      await Story.updateOne(
        { _id: req.params.id },
        { $addToSet: { viewers: req.user._id } }
      );
    }
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
};

/** DELETE /api/stories/:id */
export const deleteStory = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: 'Story not found' });
    if (String(story.author) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You cannot delete this story' });
    }
    await story.deleteOne();
    return res.json({ id: req.params.id });
  } catch (error) {
    return next(error);
  }
};

/** POST /api/stories/:id/like — toggle a like. */
export const likeStory = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: 'Story not found' });

    const me = String(req.user._id);
    const liked = story.likes.some((id) => String(id) === me);
    if (liked) story.likes.pull(req.user._id);
    else story.likes.push(req.user._id);
    await story.save();

    return res.json({ liked: !liked, likeCount: story.likes.length });
  } catch (error) {
    return next(error);
  }
};

/** POST /api/stories/:id/react — add or replace an emoji reaction. */
export const reactToStory = async (req, res, next) => {
  try {
    const emoji = String(req.body.emoji || '').trim().slice(0, 16);
    if (!emoji) return res.status(400).json({ message: 'Choose an emoji to react with' });

    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: 'Story not found' });

    const me = String(req.user._id);
    story.reactions = story.reactions.filter((reaction) => String(reaction.user) !== me);
    story.reactions.push({ user: req.user._id, emoji });
    await story.save();

    return res.json({ reactions: story.reactions });
  } catch (error) {
    return next(error);
  }
};

/** POST /api/stories/:id/reply — send a story reply as a direct message. */
export const replyToStory = async (req, res, next) => {
  try {
    const text = String(req.body.text || '').trim().slice(0, 1000);
    if (!text) return res.status(400).json({ message: 'Write a reply first' });

    const story = await Story.findById(req.params.id).select(
      'author allowReplies media mediaType text'
    );
    if (!story) return res.status(404).json({ message: 'Story not found' });

    const authorId = String(story.author);
    if (authorId === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot reply to your own story' });
    }
    if (story.allowReplies === false) {
      return res.status(403).json({ message: 'Replies are turned off for this story' });
    }

    let chat = await Chat.findOne({
      isGroupChat: false,
      users: { $all: [req.user._id, story.author] },
    });
    if (chat && chat.users.length !== 2) chat = null;
    if (!chat) {
      chat = await Chat.create({
        users: [req.user._id, story.author],
        isGroupChat: false,
      });
    }

    const message = await Message.create({
      sender: req.user._id,
      chat: chat._id,
      contentType: 'text',
      content: text,
      seenBy: [req.user._id],
    });
    const populated = await Message.findById(message._id).populate(
      'sender',
      'firstName lastName username profilePicture'
    );

    const io = req.app.get('io');
    if (io) io.to(`chat:${chat._id}`).emit('message received', populated);

    return res.status(201).json({ chatId: chat._id, message: populated });
  } catch (error) {
    return next(error);
  }
};

/** Load a story and one of its stickers, ensuring the caller may interact. */
const findSticker = async (req, res) => {
  const story = await Story.findById(req.params.id);
  if (!story) {
    res.status(404).json({ message: 'Story not found' });
    return null;
  }
  const sticker = story.stickers.id(req.params.stickerId);
  if (!sticker) {
    res.status(404).json({ message: 'Sticker not found' });
    return null;
  }
  if (String(story.author) === String(req.user._id)) {
    res.status(400).json({ message: 'You cannot interact with your own sticker' });
    return null;
  }
  return { story, sticker };
};

const serializeSticker = (sticker, viewerId) => {
  const plain = sticker.toObject ? sticker.toObject() : { ...sticker };
  if (plain.type === 'quiz') delete plain.correctIndex;
  if (Array.isArray(plain.responses) && viewerId) {
    plain.responses = plain.responses.filter(
      (response) => String(response.user?._id || response.user) === String(viewerId)
    );
  }
  return plain;
};

/** POST /api/stories/:id/stickers/:stickerId/vote — poll vote. */
export const voteSticker = async (req, res, next) => {
  try {
    const index = Number(req.body.optionIndex);
    const found = await findSticker(req, res);
    if (!found) return undefined;
    const { story, sticker } = found;
    if (sticker.type !== 'poll') {
      return res.status(400).json({ message: 'This sticker is not a poll' });
    }
    if (!Number.isInteger(index) || index < 0 || index >= sticker.options.length) {
      return res.status(400).json({ message: 'Choose a valid option' });
    }

    sticker.options.forEach((option, optionIndex) => {
      const hasVote = option.votes.some((id) => String(id) === String(req.user._id));
      if (optionIndex === index && !hasVote) option.votes.push(req.user._id);
      if (optionIndex !== index && hasVote) option.votes.pull(req.user._id);
    });

    await story.save();
    return res.json({ sticker: serializeSticker(sticker, req.user._id) });
  } catch (error) {
    return next(error);
  }
};

/** POST /api/stories/:id/stickers/:stickerId/quiz — answer a quiz. */
export const answerQuiz = async (req, res, next) => {
  try {
    const index = Number(req.body.answerIndex);
    const found = await findSticker(req, res);
    if (!found) return undefined;
    const { story, sticker } = found;
    if (sticker.type !== 'quiz') {
      return res.status(400).json({ message: 'This sticker is not a quiz' });
    }
    if (!Number.isInteger(index) || index < 0 || index >= sticker.options.length) {
      return res.status(400).json({ message: 'Choose a valid answer' });
    }

    const me = String(req.user._id);
    sticker.responses = sticker.responses.filter((response) => String(response.user) !== me);
    sticker.responses.push({ user: req.user._id, answerIndex: index });
    await story.save();

    return res.json({
      sticker: serializeSticker(sticker, req.user._id),
      correctIndex: sticker.correctIndex,
      correct: index === sticker.correctIndex,
      answerIndex: index,
    });
  } catch (error) {
    return next(error);
  }
};

/** POST /api/stories/:id/stickers/:stickerId/slider — emoji slider response. */
export const slideSticker = async (req, res, next) => {
  try {
    const value = clamp(Number(req.body.value), 0, 100);
    const found = await findSticker(req, res);
    if (!found) return undefined;
    const { story, sticker } = found;
    if (sticker.type !== 'emojiSlider') {
      return res.status(400).json({ message: 'This sticker is not an emoji slider' });
    }

    const me = String(req.user._id);
    sticker.responses = sticker.responses.filter((response) => String(response.user) !== me);
    sticker.responses.push({ user: req.user._id, value });
    await story.save();

    return res.json({ sticker: serializeSticker(sticker, req.user._id), value });
  } catch (error) {
    return next(error);
  }
};

/** POST /api/stories/:id/stickers/:stickerId/answer — question sticker reply. */
export const answerQuestion = async (req, res, next) => {
  try {
    const text = String(req.body.text || '').trim().slice(0, 300);
    if (!text) return res.status(400).json({ message: 'Write an answer first' });
    const found = await findSticker(req, res);
    if (!found) return undefined;
    const { story, sticker } = found;
    if (sticker.type !== 'question') {
      return res.status(400).json({ message: 'This sticker is not a question' });
    }

    const me = String(req.user._id);
    sticker.responses = sticker.responses.filter((response) => String(response.user) !== me);
    sticker.responses.push({ user: req.user._id, text });
    await story.save();

    return res.json({ sticker: serializeSticker(sticker, req.user._id) });
  } catch (error) {
    return next(error);
  }
};

/** GET /api/stories/:id/viewers — the author's viewer list. */
export const listViewers = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id).populate(
      'viewers',
      'firstName lastName username profilePicture'
    );
    if (!story) return res.status(404).json({ message: 'Story not found' });
    if (String(story.author) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You cannot see this list' });
    }
    return res.json({ viewers: story.viewers });
  } catch (error) {
    return next(error);
  }
};

export default {
  getStoryFeed,
  createStory,
  viewStory,
  deleteStory,
  likeStory,
  reactToStory,
  replyToStory,
  voteSticker,
  answerQuiz,
  slideSticker,
  answerQuestion,
  listViewers,
};
