import mongoose from 'mongoose';
import User, { GENDERS } from '../models/User.js';
import Chat from '../models/Chat.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import CircleItem from '../models/CircleItem.js';
import JoinRequest from '../models/JoinRequest.js';
import { fileUrl } from '../middleware/uploadMiddleware.js';
import { ensurePersonalCircle } from '../services/circles.js';
import { notify } from '../services/notifications.js';
import {
  INTEREST_IDS,
  MIN_INTERESTS,
  MIN_JOINED_CIRCLES,
} from '../data/interests.js';
import {
  normalizeUsername,
  isValidUsername,
  buildUsernameSuggestions,
  USERNAME_MIN,
  USERNAME_MAX,
} from '../utils/username.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Fields another member may see on a public profile. Email, phone, gender and
 * date of birth are intentionally never exposed.
 */
const PUBLIC_PROFILE_FIELDS =
  'firstName lastName username profilePicture bio category links accountType isPrivate showInSuggestions interests skills address gender isOnline lastSeen onboarding preferences.allowRemix preferences.allowShareToStories preferences.allowDownload';

/**
 * GET /api/users/:id
 * Public profile (viewing another member's profile).
 */
export const getPublicProfile = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid profile id' });
    }
    const user = await User.findById(req.params.id).select(PUBLIC_PROFILE_FIELDS);
    if (!user) return res.status(404).json({ message: 'Profile not found' });
    return res.json(user);
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/users?search=john
 * Search users by username, first name, last name or email.
 */
export const searchUsers = async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();

    const query = { _id: { $ne: req.user._id } };

    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ username: regex }, { firstName: regex }, { lastName: regex }, { email: regex }];
    }

    const users = await User.find(query)
      .limit(20)
      .select('firstName lastName username email phoneNumber profilePicture isOnline lastSeen address');

    return res.json(users);
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/users/check-username/:username
 * Check whether a username is available. Accepts an optional leading '@' or '#'.
 */
export const checkUsername = async (req, res, next) => {
  try {
    const username = normalizeUsername(req.params.username);

    if (!username) {
      return res.json({
        available: false,
        username,
        reason: 'Username is required',
      });
    }

    if (!isValidUsername(username)) {
      return res.json({
        available: false,
        username,
        reason: `Username must be ${USERNAME_MIN}-${USERNAME_MAX} characters: letters, numbers, '.' or '_'`,
      });
    }

    const taken = await User.exists({ username });

    return res.json({ available: !taken, username });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/users/username-suggestions?firstName=&lastName=
 * Propose available usernames based on a person's name.
 */
export const suggestUsernames = async (req, res, next) => {
  try {
    const firstName = String(req.query.firstName || '').trim();
    const lastName = String(req.query.lastName || '').trim();

    if (!firstName && !lastName) return res.json({ suggestions: [] });

    const candidates = buildUsernameSuggestions(firstName, lastName);

    if (candidates.length === 0) return res.json({ suggestions: [] });

    const taken = await User.find({ username: { $in: candidates } }).select('username').lean();
    const takenSet = new Set(taken.map((user) => user.username));

    return res.json({
      suggestions: candidates.filter((candidate) => !takenSet.has(candidate)).slice(0, 6),
    });
  } catch (error) {
    return next(error);
  }
};

/** Multipart forms send booleans as strings — normalise them. */
const parseBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

/**
 * PUT /api/users/profile
 * Update the current user's profile (supports JSON and multipart forms).
 */
export const updateProfile = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      username: rawUsername,
      gender,
      bio,
      email,
      phoneNumber,
      dateOfBirth,
      country,
      profilePicture,
      category,
      links,
      accountType,
      isPrivate,
      showInSuggestions,
    } = req.body;

    const updates = {};

    if (firstName !== undefined) updates.firstName = String(firstName).trim();
    if (lastName !== undefined) updates.lastName = String(lastName).trim();

    if (bio !== undefined) updates.bio = String(bio).slice(0, 150);

    if (category !== undefined) updates.category = String(category).trim().slice(0, 40);

    if (links !== undefined) {
      let parsed = links;
      if (typeof links === 'string') {
        try {
          parsed = JSON.parse(links);
        } catch {
          return res.status(400).json({ message: 'Links must be valid JSON' });
        }
      }
      if (!Array.isArray(parsed)) {
        return res.status(400).json({ message: 'Links must be a list' });
      }
      updates.links = parsed
        .filter((l) => l && String(l.url || '').trim())
        .slice(0, 5)
        .map((l) => ({
          title: String(l.title || '').trim().slice(0, 60),
          url: String(l.url).trim().slice(0, 300),
        }));
    }

    if (accountType !== undefined) {
      if (!['personal', 'creator', 'business'].includes(String(accountType))) {
        return res.status(400).json({ message: 'Invalid account type' });
      }
      updates.accountType = String(accountType);
    }

    if (isPrivate !== undefined) updates.isPrivate = parseBool(isPrivate);
    if (showInSuggestions !== undefined)
      updates.showInSuggestions = parseBool(showInSuggestions);


    if (gender !== undefined) {
      if (!GENDERS.includes(String(gender))) {
        return res.status(400).json({ message: 'Invalid gender value' });
      }
      updates.gender = String(gender);
    }

    if (rawUsername !== undefined) {
      const username = normalizeUsername(rawUsername);
      if (!isValidUsername(username)) {
        return res.status(400).json({
          message: `Username must be ${USERNAME_MIN}-${USERNAME_MAX} characters: letters, numbers, '.' or '_'`,
        });
      }
      if (username !== req.user.username) {
        const usernameTaken = await User.exists({
          username,
          _id: { $ne: req.user._id },
        });
        if (usernameTaken) {
          return res.status(400).json({ message: 'That username is already taken' });
        }
        updates.username = username;
      }
    }

    if (email !== undefined) {
      const cleanEmail = String(email).trim().toLowerCase();
      const emailTaken = await User.exists({ email: cleanEmail, _id: { $ne: req.user._id } });
      if (emailTaken) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      updates.email = cleanEmail;
    }

    if (phoneNumber !== undefined) {
      const cleanPhone = String(phoneNumber).trim();
      const phoneTaken = await User.exists({
        phoneNumber: cleanPhone,
        _id: { $ne: req.user._id },
      });
      if (phoneTaken) {
        return res.status(400).json({ message: 'Phone number already in use' });
      }
      updates.phoneNumber = cleanPhone;
    }

    if (dateOfBirth !== undefined) {
      updates.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    }

    if (country !== undefined) {
      updates['address.country'] = String(country).trim();
    }

    if (profilePicture !== undefined) {
      updates.profilePicture = String(profilePicture);
    }

    if (req.file) {
      updates.profilePicture = fileUrl(req.file);
    }

    if (Object.keys(updates).length === 0) {
      return res.json(req.user);
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { returnDocument: 'after', runValidators: true, context: 'query' }
    );

    // Keep the user's personal Circle in sync (name / interests / bio).
    if (user) await ensurePersonalCircle(user);

    return res.json(user);
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/users/:id/follow
 * Toggle following a user.
 */
export const followUser = async (req, res, next) => {
  try {
    const targetId = req.params.id;

    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    const target = await User.findById(targetId);

    if (!target) {
      return res.status(404).json({ message: 'User not found' });
    }

    const me = await User.findById(req.user._id);

    const isFollowing = me.following.some((id) => id.toString() === targetId);

    if (isFollowing) {
      me.following.pull(target._id);
      target.followers.pull(me._id);
    } else {
      me.following.push(target._id);
      target.followers.push(me._id);
    }

    await Promise.all([me.save(), target.save()]);

    // Joining someone's personal Circle = following them → let them know.
    if (!isFollowing) {
      await notify(req, {
        recipient: target._id,
        actor: me._id,
        type: 'join',
        text: 'joined your Circle',
      });
    }

    return res.json({ following: !isFollowing, followerCount: target.followers.length });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/users/:id/social
 *
 * The people a profile is connected to in Wchat's language:
 *   • followers (Joins)   — everyone who joined this person's Circle.
 *   • following           — the people this account has joined.
 *
 * Returns the counts, a small populated list for each side and whether the
 * caller already follows the profile (so a Join button starts in the right
 * state instead of always reading "Join").
 */
export const getUserSocial = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid profile id' });
    }

    const user = await User.findById(req.params.id).select('followers following');
    if (!user) return res.status(404).json({ message: 'Profile not found' });

    const listFields = 'firstName lastName username profilePicture category isOnline lastSeen';

    const [followers, following, me] = await Promise.all([
      User.find({ _id: { $in: user.followers || [] } }).select(listFields).limit(200),
      User.find({ _id: { $in: user.following || [] } }).select(listFields).limit(200),
      User.findById(req.user._id).select('following'),
    ]);

    const isFollowing = (me?.following || []).some(
      (id) => id.toString() === req.params.id
    );

    return res.json({
      followersCount: (user.followers || []).length,
      followingCount: (user.following || []).length,
      isFollowing,
      followers,
      following,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/users/insights
 * Profile insights for the signed-in account (Account Center → Insights).
 * Everything is derived from real activity — no inflated vanity numbers.
 */
export const getProfileInsights = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [me, posts, reels, circleCount] = await Promise.all([
      User.findById(userId).select('followers following'),
      Post.find({ author: userId })
        .select('text media mediaType mediaItems sparks commentCount shareCount savedBy createdAt')
        .sort('-createdAt')
        .lean(),
      CircleItem.find({ author: userId, kind: 'reel' })
        .select('title viewCount sparks createdAt chat')
        .sort('-createdAt')
        .lean(),
      Chat.countDocuments({ isGroupChat: true, users: userId }),
    ]);

    const postIds = posts.map((post) => post._id);
    const commentsThisWeek = postIds.length
      ? await Comment.countDocuments({ createdAt: { $gte: weekAgo }, post: { $in: postIds } })
      : 0;

    const totals = posts.reduce(
      (acc, post) => {
        acc.sparks += (post.sparks || []).length;
        acc.comments += post.commentCount || 0;
        acc.shares += post.shareCount || 0;
        acc.saves += (post.savedBy || []).length;
        return acc;
      },
      { sparks: 0, comments: 0, shares: 0, saves: 0 }
    );

    const reelTotals = reels.reduce(
      (acc, reel) => {
        acc.plays += reel.viewCount || 0;
        acc.sparks += (reel.sparks || []).length;
        return acc;
      },
      { plays: 0, sparks: 0 }
    );

    // A small honest series: what this account published over the last 7 days.
    const dayKey = (value) => new Date(value).toISOString().slice(0, 10);
    const week = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - offset);
      week.push({ date: day.toISOString(), posts: 0, reels: 0 });
    }
    const weekIndex = new Map(week.map((entry) => [dayKey(entry.date), entry]));
    posts
      .filter((post) => new Date(post.createdAt) >= weekAgo)
      .forEach((post) => {
        const entry = weekIndex.get(dayKey(post.createdAt));
        if (entry) entry.posts += 1;
      });
    reels
      .filter((reel) => new Date(reel.createdAt) >= weekAgo)
      .forEach((reel) => {
        const entry = weekIndex.get(dayKey(reel.createdAt));
        if (entry) entry.reels += 1;
      });

    const topPosts = [...posts]
      .sort((a, b) => (b.sparks || []).length - (a.sparks || []).length)
      .slice(0, 5)
      .map((post) => ({
        _id: post._id,
        excerpt: String(post.text || '').slice(0, 140),
        media: post.media || post.mediaItems?.[0]?.url || '',
        mediaType: post.mediaType || post.mediaItems?.[0]?.type || '',
        sparks: (post.sparks || []).length,
        comments: post.commentCount || 0,
        saves: (post.savedBy || []).length,
        createdAt: post.createdAt,
      }));

    return res.json({
      totals: {
        posts: posts.length,
        reels: reels.length,
        circles: circleCount,
        followers: (me?.followers || []).length,
        following: (me?.following || []).length,
        sparks: totals.sparks + reelTotals.sparks,
        comments: totals.comments,
        shares: totals.shares,
        saves: totals.saves,
        reelPlays: reelTotals.plays,
      },
      last7Days: {
        posts: posts.filter((post) => new Date(post.createdAt) >= weekAgo).length,
        reels: reels.filter((reel) => new Date(reel.createdAt) >= weekAgo).length,
        comments: commentsThisWeek,
      },
      week,
      topPosts,
    });
  } catch (error) {
    return next(error);
  }
};

/* ------------------------------------------------------------------ *
 * Wchat onboarding                                                   *
 *   1. Pick at least MIN_INTERESTS fields                            *
 *   2. Join at least MIN_JOINED_CIRCLES Circles                      *
 * ------------------------------------------------------------------ */

const toId = (value) => new mongoose.Types.ObjectId(String(value));

/** Recommend topic/local Circles and people (personal Circles) for a user. */
const buildRecommendations = async (user) => {
  const interests = Array.isArray(user.interests) ? user.interests : [];
  const joinedIds = (user.onboarding?.joinedCircleIds || []).map((id) => toId(id));
  const userId = toId(user._id);
  const hasInterests = interests.length > 0;

  const overlapExpr = {
    $size: {
      $setIntersection: [{ $ifNull: ['$interests', []] }, interests],
    },
  };
  const memberCountExpr = { $size: { $ifNull: ['$users', []] } };

  const circleMatch = {
    isGroupChat: true,
    circleType: { $in: ['topic', 'local'] },
    _id: { $nin: joinedIds },
  };
  if (hasInterests) circleMatch.interests = { $in: interests };

  const circles = await Chat.aggregate([
    { $match: circleMatch },
    {
      $addFields: {
        memberCount: memberCountExpr,
        overlap: overlapExpr,
        isMember: false,
      },
    },
    { $sort: { overlap: -1, memberCount: -1, createdAt: -1 } },
    { $limit: 18 },
    { $project: { users: 0, __v: 0, overlap: 0 } },
  ]);

  const peopleMatch = {
    isGroupChat: true,
    circleType: 'personal',
    ownerUser: { $ne: userId, $nin: [null] },
    _id: { $nin: joinedIds },
  };
  if (hasInterests) peopleMatch.interests = { $in: interests };

  const people = await Chat.aggregate([
    { $match: peopleMatch },
    {
      $addFields: {
        memberCount: memberCountExpr,
        overlap: overlapExpr,
      },
    },
    { $sort: { overlap: -1, memberCount: -1, createdAt: -1 } },
    { $limit: 18 },
    {
      $lookup: {
        from: 'users',
        localField: 'ownerUser',
        foreignField: '_id',
        as: 'ownerUsers',
      },
    },
    { $addFields: { owner: { $arrayElemAt: ['$ownerUsers', 0] } } },
    {
      $project: {
        users: 0,
        __v: 0,
        overlap: 0,
        ownerUsers: 0,
        'owner.password': 0,
        'owner.email': 0,
        'owner.phoneNumber': 0,
        'owner.address': 0,
        'owner.dateOfBirth': 0,
        'owner.followers': 0,
        'owner.following': 0,
        'owner.__v': 0,
      },
    },
  ]);

  return { circles, people };
};

/**
 * GET /api/users/onboarding
 * Everything the onboarding flow needs: current picks + recommendations.
 */
export const getOnboarding = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ message: 'User not found' });

    const joinedCircleIds = (user.onboarding?.joinedCircleIds || []).map((id) =>
      String(id)
    );

    const recommendations = await buildRecommendations(user);

    return res.json({
      interests: user.interests || [],
      interestsDoneAt: user.onboarding?.interestsDoneAt || null,
      completedAt: user.onboarding?.completedAt || null,
      joinedCircleIds,
      joinedCount: joinedCircleIds.length,
      minInterests: MIN_INTERESTS,
      minJoinedCircles: MIN_JOINED_CIRCLES,
      recommendations,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/users/interests
 * Save the fields the user picked during onboarding (minimum 5).
 */
export const updateInterests = async (req, res, next) => {
  try {
    const { interests } = req.body;

    if (!Array.isArray(interests)) {
      return res.status(400).json({ message: 'interests must be an array' });
    }

    const cleaned = [...new Set(interests.map((value) => String(value)))];
    const invalid = cleaned.find((value) => !INTEREST_IDS.includes(value));

    if (invalid) {
      return res.status(400).json({ message: `Unknown interest: ${invalid}` });
    }

    if (cleaned.length < MIN_INTERESTS) {
      return res
        .status(400)
        .json({ message: `Please pick at least ${MIN_INTERESTS} fields` });
    }

    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ message: 'User not found' });

    user.interests = cleaned;
    user.onboarding = user.onboarding || {};
    user.onboarding.interestsDoneAt = new Date();
    await user.save();

    await ensurePersonalCircle(user);

    return res.json({
      message: 'Interests saved',
      interests: user.interests,
      interestsDoneAt: user.onboarding.interestsDoneAt,
      minJoinedCircles: MIN_JOINED_CIRCLES,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/users/onboarding/join
 * Join a Circle. Open Circles join immediately; request Circles create a
 * JoinRequest for the admin to approve.
 */
export const joinCircle = async (req, res, next) => {
  try {
    const { chatId } = req.body;

    if (!chatId) {
      return res.status(400).json({ message: 'chatId is required' });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) return res.status(404).json({ message: 'Circle not found' });

    if (!chat.isGroupChat) {
      return res.status(400).json({ message: 'This is not a Circle' });
    }

    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ message: 'User not found' });

    user.onboarding = user.onboarding || {};
    user.onboarding.joinedCircleIds = user.onboarding.joinedCircleIds || [];

    const isMember = chat.users.some((id) => id.toString() === user._id.toString());
    const isRecorded = user.onboarding.joinedCircleIds.some(
      (id) => id.toString() === chat._id.toString()
    );

    if (isMember) {
      if (!isRecorded) {
        user.onboarding.joinedCircleIds.push(chat._id);
        await user.save();
      }
      return res.json({
        joined: true,
        pending: false,
        message: 'Already a member',
        joinedCount: user.onboarding.joinedCircleIds.length,
      });
    }

    if (chat.joinPolicy === 'request') {
      const request = await JoinRequest.findOneAndUpdate(
        { chat: chat._id, user: user._id },
        { $set: { status: 'pending' } },
        {
          upsert: true,
          setDefaultsOnInsert: true,
          runValidators: true,
          returnDocument: 'after',
        }
      );

      const io = req.app.get('io');

      if (io && chat.groupAdmin) {
        io.to(`user:${chat.groupAdmin}`).emit('new join request', {
          chatId: chat._id,
          chatName: chat.chatName,
          user: {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            profilePicture: user.profilePicture,
          },
        });
      }

      return res.json({
        joined: false,
        pending: true,
        message: 'Join request sent',
        request,
      });
    }

    chat.users.push(user._id);
    if (!chat.followers.some((id) => id.toString() === user._id.toString())) {
      chat.followers.push(user._id);
    }
    await chat.save();

    user.onboarding.joinedCircleIds.push(chat._id);

    // Joining someone's personal Circle is Wchat's way of following them.
    if (
      chat.circleType === 'personal' &&
      chat.ownerUser &&
      chat.ownerUser.toString() !== user._id.toString()
    ) {
      if (!user.following.some((id) => id.toString() === chat.ownerUser.toString())) {
        user.following.push(chat.ownerUser);
      }
      const owner = await User.findById(chat.ownerUser);
      if (owner && !owner.followers.some((id) => id.toString() === user._id.toString())) {
        owner.followers.push(user._id);
        await owner.save();
      }
    }

    await user.save();

    return res.json({
      joined: true,
      pending: false,
      message: `You joined ${chat.chatName}`,
      joinedCount: user.onboarding.joinedCircleIds.length,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/users/onboarding/leave
 * Leave a Circle.
 */
export const leaveCircle = async (req, res, next) => {
  try {
    const { chatId } = req.body;

    if (!chatId) {
      return res.status(400).json({ message: 'chatId is required' });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) return res.status(404).json({ message: 'Circle not found' });

    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ message: 'User not found' });

    chat.users.pull(user._id);
    chat.followers.pull(user._id);
    await chat.save();

    if (user.onboarding?.joinedCircleIds) {
      user.onboarding.joinedCircleIds = user.onboarding.joinedCircleIds.filter(
        (id) => id.toString() !== chat._id.toString()
      );
      await user.save();
    }

    return res.json({
      joined: false,
      message: `You left ${chat.chatName}`,
      joinedCount: user.onboarding?.joinedCircleIds?.length || 0,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/users/onboarding/complete
 * Finish onboarding once the user has enough interests and Circles.
 */
export const completeOnboarding = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ message: 'User not found' });

    const interestCount = (user.interests || []).length;
    const joinedCount = (user.onboarding?.joinedCircleIds || []).length;

    if (interestCount < MIN_INTERESTS) {
      return res.status(400).json({
        message: `Pick at least ${MIN_INTERESTS} fields first`,
        interestsCount: interestCount,
        minInterests: MIN_INTERESTS,
      });
    }

    if (joinedCount < MIN_JOINED_CIRCLES) {
      return res.status(400).json({
        message: `Join at least ${MIN_JOINED_CIRCLES} Circles first`,
        joinedCount,
        minJoinedCircles: MIN_JOINED_CIRCLES,
      });
    }

    user.onboarding = user.onboarding || {};
    user.onboarding.completedAt = new Date();
    await user.save();

    return res.json(user);
  } catch (error) {
    return next(error);
  }
};

export default {
  searchUsers,
  checkUsername,
  suggestUsernames,
  updateProfile,
  followUser,
  getUserSocial,
  getProfileInsights,
  getOnboarding,
  updateInterests,
  joinCircle,
  leaveCircle,
  completeOnboarding,
};
