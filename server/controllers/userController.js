import mongoose from 'mongoose';
import User, { GENDERS } from '../models/User.js';
import Chat from '../models/Chat.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import CircleItem from '../models/CircleItem.js';
import JoinRequest from '../models/JoinRequest.js';
import Message from '../models/Message.js';
import Story from '../models/Story.js';
import Note from '../models/Note.js';
import Collection from '../models/Collection.js';
import Notification from '../models/Notification.js';
import FeedEvent from '../models/FeedEvent.js';
import UserInterestProfile from '../models/UserInterestProfile.js';
import Report from '../models/Report.js';
import Feedback from '../models/Feedback.js';
import CircleDecision from '../models/CircleDecision.js';
import CircleOps from '../models/CircleOps.js';
import VerificationCode from '../models/VerificationCode.js';
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
  'firstName lastName username profilePicture profilePictureFrame bio category links accountType isPrivate showInSuggestions interests skills isOnline lastSeen onboarding preferences.allowRemix preferences.allowShareToStories preferences.allowDownload';

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
      query.$or = [{ username: regex }, { firstName: regex }, { lastName: regex }];
    }

    const users = await User.find(query)
      .limit(20)
      .select('firstName lastName username profilePicture profilePictureFrame isOnline lastSeen');

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

const parseProfilePictureFrame = (value, fallback = null) => {
  if (value === undefined) return undefined;
  let raw = value;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { raw = null; }
  }
  if (!raw || typeof raw !== 'object') return fallback;
  const clamp = (n, min, max, def) => {
    const v = Number(n);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
  };
  return {
    zoom: clamp(raw.zoom, 1, 4, 1),
    x: clamp(raw.x, -100, 100, 0),
    y: clamp(raw.y, -100, 100, 0),
  };
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
      if (req.body.profilePictureFrame === undefined) {
        updates.profilePictureFrame = { zoom: 1, x: 0, y: 0 };
      }
    }

    if (req.file) {
      updates.profilePicture = fileUrl(req.file);
      if (req.body.profilePictureFrame === undefined) {
        updates.profilePictureFrame = { zoom: 1, x: 0, y: 0 };
      }
    }

    const frame = parseProfilePictureFrame(req.body.profilePictureFrame);
    if (frame !== undefined) updates.profilePictureFrame = frame;

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

    const listFields = 'firstName lastName username profilePicture profilePictureFrame category isOnline lastSeen';

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
            profilePictureFrame: user.profilePictureFrame,
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

/**
 * GET /api/users/export
 * Download everything tied to the signed-in account as JSON (GDPR-style).
 */
export const exportAccountData = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const MESSAGE_LIMIT = 10000;

    const [user, posts, comments, stories, notes, collections, circleItems, chats, profile, feedback, reports] =
      await Promise.all([
        User.findById(userId).lean(),
        Post.find({ author: userId }).sort({ createdAt: 1 }).lean(),
        Comment.find({ author: userId }).sort({ createdAt: 1 }).lean(),
        Story.find({ author: userId }).sort({ createdAt: 1 }).lean(),
        Note.find({ author: userId }).sort({ createdAt: 1 }).lean(),
        Collection.find({ author: userId }).sort({ createdAt: 1 }).lean(),
        CircleItem.find({ author: userId }).sort({ createdAt: 1 }).lean(),
        Chat.find({ users: userId })
          .select('chatName isGroupChat circleType ownerUser groupAdmin users createdAt')
          .lean(),
        UserInterestProfile.findOne({ user: userId }).lean(),
        Feedback.find({ user: userId }).sort({ createdAt: 1 }).lean(),
        Report.find({ reporter: userId }).sort({ createdAt: 1 }).lean(),
      ]);

    const messageCount = await Message.countDocuments({ sender: userId });
    const messages = await Message.find({ sender: userId })
      .sort({ createdAt: 1 })
      .limit(MESSAGE_LIMIT)
      .lean();

    const account = user || {};
    delete account.password;

    const payload = {
      exportedAt: new Date().toISOString(),
      formatVersion: 1,
      account,
      posts,
      comments,
      stories,
      notes,
      collections,
      circleItems,
      chats,
      messages,
      messagesTruncated: messageCount > MESSAGE_LIMIT,
      messageCount,
      feedProfile: profile || null,
      feedback,
      reportsFiled: reports,
    };

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `wchat-export-${user?.username || 'account'}-${stamp}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/users/account
 * Permanently delete the signed-in account and its content. A password is
 * required so a stolen session cannot erase the account on its own.
 */
export const deleteAccount = async (req, res, next) => {
  try {
    const password = String(req.body.password || '');
    if (!password) {
      return res.status(400).json({ message: 'Enter your password to delete your account' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ message: 'Account not found' });

    if (!(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Your password is incorrect' });
    }

    const userId = user._id;
    const userIdStr = String(userId);

    const [postIds, commentIds, commentPostIds, authoredItems, chats] = await Promise.all([
      Post.find({ author: userId }).distinct('_id'),
      Comment.find({ author: userId }).distinct('_id'),
      Comment.find({ author: userId }).distinct('post'),
      CircleItem.find({ author: userId }).distinct('_id'),
      Chat.find({ users: userId })
        .select('_id isGroupChat circleType ownerUser groupAdmin users')
        .lean(),
    ]);

    // Chats that only exist for this account: personal Circles and 1:1 DMs.
    const removedChatIds = chats
      .filter((chat) => {
        const owner = chat.ownerUser ? String(chat.ownerUser) : '';
        return owner === userIdStr || !chat.isGroupChat;
      })
      .map((chat) => chat._id);
    const removedChatIdStrings = removedChatIds.map(String);

    // Group Circles survive; the member is removed (and ownership transferred).
    const keptChats = chats.filter(
      (chat) => !removedChatIdStrings.includes(String(chat._id))
    );
    for (const chat of keptChats) {
      const others = (chat.users || [])
        .map(String)
        .filter((memberId) => memberId !== userIdStr);

      if (others.length === 0) {
        removedChatIds.push(chat._id);
        removedChatIdStrings.push(String(chat._id));
        continue;
      }

      const update = {
        $pull: {
          users: userId,
          memberRoles: { user: userId },
          pinnedMessages: { user: userId },
        },
      };
      if (String(chat.groupAdmin || '') === userIdStr) {
        update.$set = { groupAdmin: others[0] };
      }
      await Chat.updateOne({ _id: chat._id }, update);
    }

    if (removedChatIds.length) {
      await Promise.all([
        Chat.deleteMany({ _id: { $in: removedChatIds } }),
        Message.deleteMany({ chat: { $in: removedChatIds } }),
        JoinRequest.deleteMany({ chat: { $in: removedChatIds } }),
        CircleItem.deleteMany({ chat: { $in: removedChatIds } }),
        CircleDecision.deleteMany({ chat: { $in: removedChatIds } }),
        CircleOps.deleteMany({ chat: { $in: removedChatIds } }),
        Notification.deleteMany({ circle: { $in: removedChatIds } }),
      ]);
    }

    // Content authored by the account.
    await Promise.all([
      Post.deleteMany({ author: userId }),
      Comment.deleteMany({ author: userId }),
      Story.deleteMany({ author: userId }),
      Note.deleteMany({ author: userId }),
      Collection.deleteMany({ author: userId }),
      CircleItem.deleteMany({ author: userId }),
      Feedback.deleteMany({ user: userId }),
      Report.deleteMany({ $or: [{ reporter: userId }, { targetUser: userId }] }),
      Notification.deleteMany({ $or: [{ recipient: userId }, { actor: userId }] }),
      JoinRequest.deleteMany({ user: userId }),
      FeedEvent.deleteMany({
        $or: [{ user: userId }, { author: userId }, { itemId: { $in: postIds } }],
      }),
    ]);

    // Comments on the deleted posts, and replies that pointed at deleted comments.
    if (postIds.length) {
      await Comment.deleteMany({ post: { $in: postIds } });
    }
    if (commentIds.length) {
      await Comment.updateMany(
        { parentComment: { $in: commentIds } },
        { $set: { parentComment: null } }
      );
    }

    // Recalculate comment counts for posts that lost comments.
    const deletedPostIds = new Set(postIds.map(String));
    const keptCommentPosts = commentPostIds.filter((id) => !deletedPostIds.has(String(id)));
    if (keptCommentPosts.length) {
      const counts = await Comment.aggregate([
        { $match: { post: { $in: keptCommentPosts } } },
        { $group: { _id: '$post', count: { $sum: 1 } } },
      ]);
      const countMap = new Map(counts.map((row) => [String(row._id), row.count]));
      await Post.bulkWrite(
        keptCommentPosts.map((id) => ({
          updateOne: {
            filter: { _id: id },
            update: { $set: { commentCount: countMap.get(String(id)) || 0 } },
          },
        }))
      );
    }

    // Remove the account from everyone else's content and social graph.
    await Promise.all([
      Message.deleteMany({ sender: userId }),
      Message.updateMany(
        { chat: { $in: chats.map((chat) => chat._id) } },
        { $pull: { seenBy: userId, reactions: { user: userId } } }
      ),
      Post.updateMany(
        { $or: [{ sparks: userId }, { savedBy: userId }, { collaborators: userId }] },
        { $pull: { sparks: userId, savedBy: userId, collaborators: userId } }
      ),
      Story.updateMany(
        {
          $or: [
            { likes: userId },
            { viewers: userId },
            { hideFrom: userId },
            { 'reactions.user': userId },
          ],
        },
        { $pull: { likes: userId, viewers: userId, hideFrom: userId, reactions: { user: userId } } }
      ),
      Note.updateMany({ likes: userId }, { $pull: { likes: userId } }),
      Collection.updateMany({ posts: { $in: postIds } }, { $pull: { posts: { $in: postIds } } }),
      CircleItem.updateMany(
        { $or: [{ sparks: userId }, { participants: userId }] },
        { $pull: { sparks: userId, participants: userId } }
      ),
      CircleItem.updateMany({ remixOf: { $in: authoredItems } }, { $set: { remixOf: null } }),
      CircleDecision.updateMany(
        { 'ideas.author': userId },
        { $pull: { ideas: { author: userId } } }
      ),
      CircleDecision.updateMany(
        { 'ideas.ratings.user': userId },
        { $pull: { 'ideas.$[idea].ratings': { user: userId } } },
        { arrayFilters: [{ 'idea.ratings.user': userId }] }
      ),
      CircleDecision.updateMany(
        { 'log.actor': userId },
        { $pull: { log: { actor: userId } } }
      ),
      CircleDecision.updateMany({ 'decision.decidedBy': userId }, { $set: { 'decision.decidedBy': null } }),
      CircleOps.updateMany(
        { $or: [{ 'failed.member': userId }, { 'history.actor': userId }] },
        { $pull: { failed: { member: userId }, history: { actor: userId } } }
      ),
      User.updateMany(
        {
          $or: [
            { followers: userId },
            { following: userId },
            { closeFriends: userId },
            { mutedStories: userId },
            { blocked: userId },
          ],
        },
        {
          $pull: {
            followers: userId,
            following: userId,
            closeFriends: userId,
            mutedStories: userId,
            blocked: userId,
          },
        }
      ),
      UserInterestProfile.deleteMany({ user: userId }),
      UserInterestProfile.updateMany(
        {
          $or: [
            { hiddenAuthorIds: userId },
            { 'creatorScores.key': userIdStr },
            { 'circleScores.key': { $in: removedChatIdStrings } },
            { 'recentItems.item': { $in: postIds } },
          ],
        },
        {
          $pull: {
            hiddenAuthorIds: userId,
            creatorScores: { key: userIdStr },
            circleScores: { key: { $in: removedChatIdStrings } },
            recentItems: { item: { $in: postIds } },
          },
        }
      ),
      VerificationCode.deleteMany({
        $or: [
          { identifier: user.email },
          { identifier: user.phoneNumber },
          { 'payload.userId': userIdStr },
        ],
      }),
    ]);

    await User.deleteOne({ _id: userId });

    // Close any live sockets belonging to the deleted account.
    req.app?.get('io')?.in(`user:${userId}`).disconnectSockets(true);

    return res.json({ message: 'Your account and its content have been deleted.' });
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
  getPublicProfile,
  exportAccountData,
  deleteAccount,
};
