import Post from '../models/Post.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import { decorateReason } from '../services/feed/reasons.js';
import {
  buildCandidates,
  rankCandidates,
  explainPost,
} from '../services/ranking/rank.js';
import { findProfile, summariseProfile, resetProfile } from '../services/ranking/profile.js';

const AUTHOR_FIELDS =
  'firstName lastName username profilePicture isOnline lastSeen accountType preferences.allowRemix preferences.allowShareToStories preferences.allowDownload';
const CIRCLE_FIELDS = 'chatName groupAvatar circleType';

/** Chronological "Following" tab: Circles + people you follow, nothing else. */
async function buildFollowingFilter(user) {
  const [chats, me] = await Promise.all([
    Chat.find({ users: user._id, isGroupChat: true }).select('_id').lean(),
    User.findById(user._id).select('following blocked').lean(),
  ]);

  const chatIds = chats.map((chat) => chat._id);
  const following = Array.isArray(me?.following) ? me.following : [];
  const blocked = new Set(
    (Array.isArray(me?.blocked) ? me.blocked : []).map(String)
  );

  return {
    chatIds,
    following,
    filter: {
      archivedAt: null,
      author: { $nin: [...blocked] },
      $or: [
        { circle: { $in: chatIds } },
        {
          circle: null,
          author: {
            $in: [...following, user._id].filter(
              (id) => Boolean(id) && !blocked.has(String(id))
            ),
          },
        },
      ],
    },
  };
}

/**
 * GET /api/feeds/home?tab=for_you|following&page=&limit=
 *
 * `for_you` runs the transparent ranker; `following` is the chronological
 * escape hatch. Both return the same shape as the legacy /posts/feed.
 */
export const getHomeFeed = async (req, res, next) => {
  try {
    const personalisationOff = req.user.preferences?.personalisedFeed === false;
    const tab =
      req.query.tab !== 'following' && !personalisationOff ? 'for_you' : 'following';
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 10), 30);

    if (tab === 'following') {
      const { filter, chatIds, following } = await buildFollowingFilter(req.user);
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
          chatIds,
          following,
        })
      );

      return res.json({
        posts: decorated,
        page,
        limit,
        total,
        hasMore: page * limit < total,
        tab,
        personalisedFeed: !personalisationOff,
      });
    }

    const { candidates, profile, context, pool } = await buildCandidates(req.user, {
      tab,
    });

    const ranked = rankCandidates(candidates, {
      profile,
      context,
      page,
      limit,
    });

    return res.json({
      ...ranked,
      page,
      limit,
      tab,
      pool,
      personalisedFeed: !personalisationOff,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/feeds/profile — the member's own learned preferences.
 * The raw scores are summarised; nothing here is shared with other members.
 */
export const getMyProfile = async (req, res, next) => {
  try {
    const profile = await findProfile(req.user._id);
    return res.json({
      personalisedFeed: req.user.preferences?.personalisedFeed !== false,
      profile: summariseProfile(profile),
    });
  } catch (error) {
    return next(error);
  }
};

/** PUT /api/feeds/profile { personalised: boolean } — opt out of ranking. */
export const updateFeedPreferences = async (req, res, next) => {
  try {
    if (typeof req.body?.personalised !== 'boolean') {
      return res
        .status(400)
        .json({ message: 'personalised must be true or false' });
    }
    const personalised = req.body.personalised;
    await User.updateOne(
      { _id: req.user._id },
      { $set: { 'preferences.personalisedFeed': personalised } }
    );
    return res.json({ personalisedFeed: personalised });
  } catch (error) {
    return next(error);
  }
};

/** DELETE /api/feeds/profile — "reset my recommendations". */
export const resetMyProfile = async (req, res, next) => {
  try {
    await resetProfile(req.user._id);
    return res.json({ reset: true });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/feeds/debug/:itemId — super-admin only.
 * Returns the full feature breakdown for one post, for one viewer.
 */
export const getFeedDebug = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.itemId)
      .populate('author', AUTHOR_FIELDS)
      .populate('circle', CIRCLE_FIELDS);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const explanation = await explainPost(post, req.user);
    const profile = await findProfile(req.user._id);

    return res.json({
      item: {
        _id: post._id,
        text: post.text,
        author: post.author,
        circle: post.circle,
        tags: post.tags,
        createdAt: post.createdAt,
      },
      ...explanation,
      profile: summariseProfile(profile),
    });
  } catch (error) {
    return next(error);
  }
};

export default { getHomeFeed, getFeedDebug, getMyProfile, updateFeedPreferences, resetMyProfile };
