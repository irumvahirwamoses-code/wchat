import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import { notify, resolveMentions } from '../services/notifications.js';
import { fileUrl } from '../middleware/uploadMiddleware.js';

const AUTHOR_FIELDS =
  'firstName lastName username profilePicture isOnline lastSeen preferences.allowRemix preferences.allowShareToStories preferences.allowDownload';
const CIRCLE_FIELDS = 'chatName groupAvatar circleType';

const isMember = (chat, userId) =>
  chat.users.some((member) => member.toString() === userId.toString());

/** Build the visibility filter for the Home feed: your circles + your timeline posts + timeline from followed users. */
async function buildFeedFilter(user) {
  const userId = user._id;
  const chats = await Chat.find({ users: userId }).select('_id').lean();
  const chatIds = chats.map((chat) => chat._id);
  const me = await User.findById(userId).select('following');
  const following = Array.isArray(me.following) ? me.following : [];
  return {
    $or: [
      { circle: { $in: chatIds } },
      { circle: null, author: { $in: [...following, userId] } },
      { author: userId },
    ],
  };
}

const sameId = (a, b) => String(a?._id || a || '') === String(b?._id || b || '');

/**
 * Explain *why* a post is in someone's stream, the way Instagram's "Why you're
 * seeing this" works.
 *
 *  - `reason`       → the short sentence shown under the post
 *  - `reasonCode`   → stable key the client maps to an icon + explainer
 *  - `reasonDetail` → the specific Circle / person / tag behind the decision
 */
function decorateReason(post, { userId, chatIds = [], following = [] }) {
  const plain = post.toObject ? post.toObject({ virtuals: true }) : { ...post };

  if (sameId(plain.author, userId)) {
    return { ...plain, reason: 'Your post', reasonCode: 'self', reasonDetail: '' };
  }

  if (plain.circle && chatIds.some((id) => sameId(id, plain.circle))) {
    const name = plain.circle?.chatName || 'a Circle you joined';
    return { ...plain, reason: `From ${name}`, reasonCode: 'circle', reasonDetail: name };
  }

  if (following.some((id) => sameId(id, plain.author))) {
    const handle = plain.author?.username ? `@${plain.author.username}` : 'this creator';
    return {
      ...plain,
      reason: `Because you follow ${handle}`,
      reasonCode: 'creator',
      reasonDetail: handle,
    };
  }

  if (plain.tags?.length) {
    return {
      ...plain,
      reason: `Because you're into #${plain.tags[0]}`,
      reasonCode: 'tag',
      reasonDetail: `#${plain.tags[0]}`,
    };
  }

  if (plain.location) {
    return {
      ...plain,
      reason: `Happening in ${plain.location}`,
      reasonCode: 'nearby',
      reasonDetail: plain.location,
    };
  }

  return {
    ...plain,
    reason: 'Trending in Rwanda right now',
    reasonCode: 'trending',
    reasonDetail: '',
  };
}

/**
 * GET /api/posts/feed?page=&limit=
 */
export const getFeed = async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 10, 30);
    const filter = await buildFeedFilter(req.user);
    const total = await Post.countDocuments(filter);
    const posts = await Post.find(filter)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('author', AUTHOR_FIELDS)
      .populate('circle', CIRCLE_FIELDS);

    const chats = await Chat.find({ users: req.user._id }).select('_id').lean();
    const me = await User.findById(req.user._id).select('following').lean();

    const decorated = posts.map((post) =>
      decorateReason(post, {
        userId: req.user._id,
        chatIds: chats.map((chat) => chat._id),
        following: Array.isArray(me?.following) ? me.following : [],
      })
    );

    return res.json({
      posts: decorated,
      page,
      limit,
      total,
      hasMore: page * limit < total,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/posts/user/:userId?page=&limit=
 * Timeline posts + posts in common circles (simplified: timeline posts from them + their posts in my circles).
 */
export const getUserPosts = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 10, 30);

    const myChats = await Chat.find({ users: req.user._id }).select('_id').lean();
    const myChatIds = myChats.map((c) => c._id);
    const theirChats = await Chat.find({ users: userId }).select('_id').lean();
    const commonChats = theirChats
      .map((c) => c._id)
      .filter((id) => myChatIds.some((m) => m.toString() === id.toString()));

    const filter = {
      author: userId,
      $or: [{ circle: null }, { circle: { $in: commonChats } }],
    };

    const total = await Post.countDocuments(filter);
    const posts = await Post.find(filter)
      .sort({ pinnedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('author', AUTHOR_FIELDS)
      .populate('circle', CIRCLE_FIELDS);

    return res.json({ posts, page, limit, total, hasMore: page * limit < total });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/posts/circle/:chatId?page=&limit=
 */
export const getCirclePosts = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 10, 30);

    const chat = await Chat.findById(chatId).select('users');
    if (!chat) return res.status(404).json({ message: 'Circle not found' });
    if (!isMember(chat, req.user._id)) {
      return res.status(403).json({ message: 'You are not a member of this Circle' });
    }

    const filter = { circle: chatId };
    const total = await Post.countDocuments(filter);
    const posts = await Post.find(filter)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('author', AUTHOR_FIELDS)
      .populate('circle', CIRCLE_FIELDS);

    return res.json({ posts, page, limit, total, hasMore: page * limit < total });
  } catch (error) {
    return next(error);
  }
};

/**
 * Extract `#hashtags` and `@mentions` from a caption (order preserved, deduped).
 */
function extractTags(text) {
  const tags = new Set();
  const mentions = new Set();
  const re = /([#@][\p{L}\p{N}_]{1,50})/gu;
  let m;
  while ((m = re.exec(String(text || '')))) {
    const token = m[1];
    if (token[0] === '#') tags.add(token.slice(1).toLowerCase());
    else mentions.add(token.slice(1).toLowerCase());
  }
  return { tags: [...tags].slice(0, 20), mentions: [...mentions].slice(0, 20) };
}

function mimetypeToType(mimetype, fallback = '') {
  const mt = String(mimetype || '').toLowerCase();
  if (mt.startsWith('image/')) return 'image';
  if (mt.startsWith('video/')) return 'video';
  return fallback;
}

/**
 * POST /api/posts
 * multipart: `media` (0–10 files → carousel) + `text` + optional `circleId`,
 * `location`, and `filters` (caption-stored client hints).
 */
export const createPost = async (req, res, next) => {
  try {
    const { text = '', circleId, location = '' } = req.body;
    let interests = [];

    // multer's `.array()` gives an ARRAY; `.fields()` gives an object keyed by
    // field name. Support both so the carousel receives every file.
    const rawFiles = req.files;
    const files = Array.isArray(rawFiles)
      ? rawFiles
      : Array.isArray(rawFiles?.media)
        ? rawFiles.media
        : rawFiles?.media
          ? [rawFiles.media]
          : [];

    const mediaItems = files.slice(0, 10).map((file) => ({
      url: fileUrl(file),
      type: mimetypeToType(file.mimetype),
      fileName: file.originalname || '',
      fileSize: file.size || 0,
    }));

    if (!String(text).trim() && !mediaItems.length) {
      return res.status(400).json({ message: 'A post needs text or media' });
    }

    if (circleId) {
      const chat = await Chat.findById(circleId).select('users interests');
      if (!chat) return res.status(404).json({ message: 'Circle not found' });
      if (!isMember(chat, req.user._id)) {
        return res.status(403).json({ message: 'You are not a member of this Circle' });
      }
      if (Array.isArray(chat.interests)) interests = chat.interests;
    }

    const { tags, mentions } = extractTags(text);

    const post = await Post.create({
      author: req.user._id,
      circle: circleId || null,
      text: String(text).slice(0, 3000),
      media: mediaItems[0]?.url || '',
      mediaType: mediaItems[0]?.type || '',
      fileName: mediaItems[0]?.fileName || '',
      fileSize: mediaItems[0]?.fileSize || 0,
      mediaItems,
      location: String(location).slice(0, 120),
      tags,
      mentions,
      interests,
      sparks: [],
      savedBy: [],
      commentCount: 0,
    });

    const populated = await Post.findById(post._id)
      .populate('author', AUTHOR_FIELDS)
      .populate('circle', CIRCLE_FIELDS);

    const io = req.app.get('io');
    if (io) io.emit('post created', { post: populated });

    // Notify everyone that was @mentioned in the caption.
    if (mentions.length) {
      const ids = await resolveMentions(mentions, { actorId: req.user._id });
      await Promise.all(
        ids.map((recipient) =>
          notify(req, {
            recipient,
            actor: req.user._id,
            type: 'mention',
            post: post._id,
            circle: post.circle || undefined,
            text: 'mentioned you in a post',
          })
        )
      );
    }

    return res.status(201).json(populated);
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/posts/:id/spark (toggle)
 */
export const sparkPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const uid = req.user._id.toString();
    const has = (post.sparks || []).some((s) => s.toString() === uid);
    if (has) post.sparks.pull(req.user._id);
    else post.sparks.push(req.user._id);
    await post.save();

    if (!has) {
      await notify(req, {
        recipient: post.author,
        actor: req.user._id,
        type: 'spark',
        post: post._id,
        circle: post.circle || undefined,
        text: 'sparked your post',
      });
    }

    return res.json({ sparked: !has, sparkCount: post.sparks.length });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/posts/:id/save (toggle bookmark)
 */
export const savePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const uid = req.user._id.toString();
    const has = (post.savedBy || []).some((s) => s.toString() === uid);
    if (has) post.savedBy.pull(req.user._id);
    else post.savedBy.push(req.user._id);
    await post.save();
    return res.json({ saved: !has, saveCount: post.savedBy.length });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/posts/saved — your bookmarks.
 */
export const listSaved = async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 10, 30);
    const filter = { savedBy: req.user._id };
    const total = await Post.countDocuments(filter);
    const posts = await Post.find(filter)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('author', AUTHOR_FIELDS)
      .populate('circle', CIRCLE_FIELDS);
    return res.json({ posts, page, limit, total, hasMore: page * limit < total });
  } catch (error) {
    return next(error);
  }
};

const PIN_LIMIT = 6;

/**
 * POST /api/posts/:id/pin (toggle, author only, max 6 pinned).
 */
export const pinPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the author can pin this post' });
    }
    if (post.pinnedAt) {
      post.pinnedAt = null;
      await post.save();
      return res.json({ pinned: false });
    }
    const pinnedCount = await Post.countDocuments({ author: req.user._id, pinnedAt: { $ne: null } });
    if (pinnedCount >= PIN_LIMIT) {
      return res.status(400).json({ message: `You can pin up to ${PIN_LIMIT} posts` });
    }
    post.pinnedAt = new Date();
    await post.save();
    return res.json({ pinned: true });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/posts/explore?q=&tag=&page=
 * Public timeline posts from Circles and people you have NOT joined yet.
 * Sorted by a light freshness + spark/comment score, never pure popularity.
 */
export const getExplore = async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 10, 30);
    const q = String(req.query.q || '').trim().toLowerCase();
    const tag = String(req.query.tag || '').trim().toLowerCase().replace(/^#/, '');

    const myChats = await Chat.find({ users: req.user._id }).select('_id').lean();
    const myChatIds = myChats.map((c) => c._id);

    const me = await User.findById(req.user._id).select('following').lean();
    const following = Array.isArray(me.following) ? me.following : [];

    // Visible-to-everyone content only: timeline posts + open (topic/local) Circles.
    const filter = { circle: null, author: { $ne: req.user._id } };
    if (tag) filter.tags = tag;
    if (q) {
      filter.$or = [
        { text: { $regex: q, $options: 'i' } },
        { tags: q },
        { location: { $regex: q, $options: 'i' } },
      ];
    }

    const total = await Post.countDocuments(filter);
    const posts = await Post.find(filter)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('author', AUTHOR_FIELDS)
      .populate('circle', CIRCLE_FIELDS);

    const decorated = posts.map((post) =>
      decorateReason(post, {
        userId: req.user._id,
        chatIds: myChatIds,
        following,
      })
    );

    return res.json({ posts: decorated, page, limit, total, hasMore: page * limit < total });
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/posts/:id (author or circle admin)
 */
export const deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    let canDelete = post.author.toString() === req.user._id.toString();
    if (!canDelete && post.circle) {
      const chat = await Chat.findById(post.circle).select('groupAdmin admins');
      const adminIds = [chat.groupAdmin, ...(chat.admins || [])].filter(Boolean).map(String);
      if (adminIds.includes(req.user._id.toString())) canDelete = true;
    }
    if (!canDelete) return res.status(403).json({ message: 'You cannot delete this post' });
    await Comment.deleteMany({ post: post._id });
    await post.deleteOne();
    return res.json({ id: req.params.id });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/posts/:id/comments
 */
export const listComments = async (req, res, next) => {
  try {
    const comments = await Comment.find({ post: req.params.id })
      .sort('createdAt')
      .populate('author', AUTHOR_FIELDS);
    return res.json(comments);
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/posts/:id/comments { text }
 */
export const createComment = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!String(text || '').trim()) return res.status(400).json({ message: 'A comment cannot be empty' });
    const post = await Post.findById(req.params.id).select('_id author circle');
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const comment = await Comment.create({
      post: post._id,
      author: req.user._id,
      text: String(text).slice(0, 1000),
    });
    await Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });
    const populated = await Comment.findById(comment._id).populate('author', AUTHOR_FIELDS);
    const io = req.app.get('io');
    if (io) io.emit('comment created', { postId: post._id, comment: populated });

    // Tell the post author (unless they commented on their own post)…
    await notify(req, {
      recipient: post.author,
      actor: req.user._id,
      type: 'comment',
      post: post._id,
      circle: post.circle || undefined,
      text: 'commented on your post',
    });

    // …and everyone @mentioned in the comment.
    const { mentions } = extractTags(text);
    if (mentions.length) {
      const ids = await resolveMentions(mentions, { actorId: req.user._id });
      await Promise.all(
        ids.map((recipient) =>
          notify(req, {
            recipient,
            actor: req.user._id,
            type: 'mention',
            post: post._id,
            text: 'mentioned you in a comment',
          })
        )
      );
    }

    return res.status(201).json(populated);
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/posts/:id/comments/:commentId
 */
export const deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (comment.post.toString() !== req.params.id) return res.status(400).json({ message: 'Mismatched post' });
    let canDelete = comment.author.toString() === req.user._id.toString();
    if (!canDelete) {
      const post = await Post.findById(req.params.id).select('author circle');
      if (post && post.author.toString() === req.user._id.toString()) canDelete = true;
      if (!canDelete && post?.circle) {
        const chat = await Chat.findById(post.circle).select('groupAdmin admins');
        const adminIds = [chat.groupAdmin, ...(chat.admins || [])].filter(Boolean).map(String);
        if (adminIds.includes(req.user._id.toString())) canDelete = true;
      }
    }
    if (!canDelete) return res.status(403).json({ message: 'You cannot delete this comment' });
    await comment.deleteOne();
    await Post.updateOne({ _id: comment.post }, { $inc: { commentCount: -1 } });
    return res.json({ id: req.params.commentId, postId: req.params.id });
  } catch (error) {
    return next(error);
  }
};

export default {
  getFeed,
  getUserPosts,
  getCirclePosts,
  createPost,
  sparkPost,
  savePost,
  listSaved,
  pinPost,
  getExplore,
  deletePost,
  listComments,
  createComment,
  deleteComment,
};
