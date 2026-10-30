import Story from '../models/Story.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import { fileUrl } from '../middleware/uploadMiddleware.js';

const AUTHOR_FIELDS =
  'firstName lastName username profilePicture isOnline lastSeen preferences.allowRemix preferences.allowShareToStories preferences.allowDownload';
const CIRCLE_FIELDS = 'chatName groupAvatar circleType';

/**
 * Group stories by owner (author) — treat stories with circle as "from Circle" context;
 * but for the ring, group under the story's author. For a Circle story authored by someone,
 * the ring shows that author's story? Keep it simple: group by story.author and include circle name.
 */
export const getStoryFeed = async (req, res, next) => {
  try {
    const me = await User.findById(req.user._id).select('following').lean();
    const following = Array.isArray(me.following) ? me.following : [];

    const chats = await Chat.find({ users: req.user._id }).select('_id').lean();
    const chatIds = chats.map((chat) => chat._id);

    const or = [
      { author: req.user._id },
      { author: { $in: following }, circle: null },
      { circle: { $in: chatIds } },
    ];

    const stories = await Story.find({ $or: or, expiresAt: { $gt: new Date() } })
      .sort('createdAt')
      .populate('author', AUTHOR_FIELDS)
      .populate('circle', CIRCLE_FIELDS);

    const grouped = new Map();
    stories.forEach((story) => {
      const key = story.author?._id?.toString() || story.author?.toString();
      if (!key) return;
      if (!grouped.has(key)) {
        grouped.set(key, {
          owner: story.author,
          circle: story.circle,
          stories: [],
          seen: false,
          latestAt: story.createdAt,
        });
      }
      grouped.get(key).stories.push(story);
      if (new Date(story.createdAt) > new Date(grouped.get(key).latestAt)) {
        grouped.get(key).latestAt = story.createdAt;
      }
    });

    const rings = Array.from(grouped.values()).map((ring) => {
      const uid = req.user._id.toString();
      const seen = ring.stories.every((s) => (s.viewers || []).some((v) => v.toString() === uid));
      return { ...ring, seen };
    });

    // My ring first; then unseen; then newest.
    rings.sort((a, b) => {
      const am = a.owner?._id?.toString() === req.user._id.toString();
      const bm = b.owner?._id?.toString() === req.user._id.toString();
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
 * POST /api/stories (single media)
 */
export const createStory = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'An image or video is required' });
    }
    const { caption = '', circleId, mediaType: mt, music } = req.body;
    const mimetype = (req.file.mimetype || '').toLowerCase();
    let mediaType = 'image';
    if (mimetype.startsWith('video/')) mediaType = 'video';
    if (mt === 'video' || mt === 'image') mediaType = mt;
    if (mediaType === 'video' && !mimetype.startsWith('video/') && !mimetype.includes('mp4')) {
      // still allow if extension matches; multer already filtered broadly
    }

    let circle = null;
    if (circleId) {
      const chat = await Chat.findById(circleId).select('users');
      if (!chat) return res.status(404).json({ message: 'Circle not found' });
      if (!chat.users.some((u) => u.toString() === req.user._id.toString())) {
        return res.status(403).json({ message: 'You are not a member of this Circle' });
      }
      circle = chat._id;
    }

    const story = await Story.create({
      author: req.user._id,
      circle,
      media: fileUrl(req.file),
      mediaType,
      caption: String(caption).slice(0, 300),
      music: music ? { title: String(music.title || '').slice(0, 100), artist: String(music.artist || '').slice(0, 100), url: String(music.url || '') } : undefined,
      viewers: [req.user._id],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const populated = await Story.findById(story._id)
      .populate('author', AUTHOR_FIELDS)
      .populate('circle', CIRCLE_FIELDS);

    const io = req.app.get('io');
    if (io) io.emit('story created', { story: populated });

    return res.status(201).json(populated);
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/stories/:id/view
 */
export const viewStory = async (req, res, next) => {
  try {
    await Story.updateOne({ _id: req.params.id }, { $addToSet: { viewers: req.user._id } });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/stories/:id
 */
export const deleteStory = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: 'Story not found' });
    if (story.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You cannot delete this story' });
    }
    await story.deleteOne();
    return res.json({ id: req.params.id });
  } catch (error) {
    return next(error);
  }
};

export default {
  getStoryFeed,
  createStory,
  viewStory,
  deleteStory,
};
