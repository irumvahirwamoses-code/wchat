import Chat, { JOIN_POLICIES, CIRCLE_TYPES } from '../models/Chat.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import JoinRequest from '../models/JoinRequest.js';
import { CATEGORIES, FEATURES } from '../data/categories.js';
import { INTEREST_IDS } from '../data/interests.js';
import { randomBytes } from 'crypto';

const POPULATE_USER_FIELDS = 'firstName lastName username profilePicture isOnline lastSeen';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const populateChat = (chatId) =>
  Chat.findById(chatId)
    .populate('users', POPULATE_USER_FIELDS)
    .populate('groupAdmin', POPULATE_USER_FIELDS);

const isAdmin = (chat, userId) =>
  Boolean(chat.groupAdmin) && chat.groupAdmin.toString() === userId.toString();

const isMember = (chat, userId) =>
  chat.users.some((member) => member.toString() === userId.toString());

/**
 * GET /api/chats
 * All chats the current user belongs to, newest activity first,
 * with their last message.
 */
export const listChats = async (req, res, next) => {
  try {
    const [me, chats] = await Promise.all([
      User.findById(req.user._id)
        .select('pinnedChats chatThemes nicknames')
        .lean(),
      Chat.find({
        users: req.user._id,
        // Personal Circles are profiles, not conversations — they live in Discover.
        circleType: { $ne: 'personal' },
      })
        .sort('-updatedAt')
        .populate('users', POPULATE_USER_FIELDS)
        .populate('groupAdmin', POPULATE_USER_FIELDS)
        .lean(),
    ]);

    const pinnedChats = (me?.pinnedChats || []).map((id) => id.toString());
    const themeFor = new Map(
      (me?.chatThemes || []).map((entry) => [entry.chat.toString(), entry.theme])
    );
    const nicknames = me?.nicknames || [];

    const chatsWithLastMessage = await Promise.all(
      chats.map(async (chat) => {
        const [lastMessage, pinnedCount] = await Promise.all([
          Message.findOne({
            chat: chat._id,
            delivered: { $ne: false },
            $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
          })
            .sort('-createdAt')
            .populate('sender', 'firstName lastName username profilePicture')
            .lean(),
          (chat.pinnedMessages || []).length,
        ]);

        return {
          ...chat,
          lastMessage: lastMessage || null,
          pinned: pinnedChats.includes(chat._id.toString()),
          theme: themeFor.get(chat._id.toString()) || '',
          pinnedCount,
          nicknames: nicknames
            .filter((entry) => entry.chat.toString() === chat._id.toString())
            .map((entry) => ({
              target: entry.target ? entry.target.toString() : null,
              name: entry.name,
            })),
        };
      })
    );

    // Pinned conversations float to the top, keeping recency order inside each
    // group.
    chatsWithLastMessage.sort((a, b) => Number(b.pinned) - Number(a.pinned));

    return res.json(chatsWithLastMessage);
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/chats
 * Access (or create) a private one-to-one chat with another user.
 */
export const createChat = async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot start a chat with yourself' });
    }

    const otherUser = await User.findById(userId);

    if (!otherUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    let chat = await Chat.findOne({
      isGroupChat: false,
      users: { $all: [req.user._id, otherUser._id], $size: 2 },
    });

    const created = !chat;

    if (!chat) {
      chat = await Chat.create({
        chatName: `${otherUser.firstName} ${otherUser.lastName}`.trim(),
        isGroupChat: false,
        users: [req.user._id, otherUser._id],
      });
    }

    const populated = await populateChat(chat._id);

    return res.status(created ? 201 : 200).json(populated);
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/chats/group
 * Create a group chat.
 */
export const createGroupChat = async (req, res, next) => {
  try {
    const {
      chatName,
      users,
      category = 'general',
      features = [],
      groupAvatar,
      description = '',
      interests = [],
      joinPolicy = 'open',
      circleType = 'topic',
      district = '',
      rules = [],
    } = req.body;

    if (!chatName || !String(chatName).trim()) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ message: 'Please add at least one member' });
    }

    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ message: `Invalid category: ${category}` });
    }

    const groupFeatures = Array.isArray(features) ? features : [];
    const invalidFeature = groupFeatures.find((feature) => !FEATURES.includes(feature));

    if (invalidFeature) {
      return res.status(400).json({ message: `Invalid feature: ${invalidFeature}` });
    }

    const groupInterests = Array.isArray(interests) ? interests : [];
    const invalidInterest = groupInterests.find((id) => !INTEREST_IDS.includes(id));

    if (invalidInterest) {
      return res.status(400).json({ message: `Invalid interest: ${invalidInterest}` });
    }

    if (!JOIN_POLICIES.includes(joinPolicy)) {
      return res.status(400).json({ message: `Invalid join policy: ${joinPolicy}` });
    }

    if (!CIRCLE_TYPES.includes(circleType) || circleType === 'personal') {
      return res.status(400).json({ message: 'Invalid circle type' });
    }

    const memberIds = [...new Set([...users.map((id) => String(id)), req.user._id.toString()])];

    const existingMembers = await User.find({ _id: { $in: memberIds } }).select('_id');

    if (existingMembers.length === 0) {
      return res.status(400).json({ message: 'No valid members were provided' });
    }

    const chat = await Chat.create({
      chatName: String(chatName).trim(),
      isGroupChat: true,
      users: memberIds,
      groupAdmin: req.user._id,
      category,
      features: groupFeatures,
      followers: [req.user._id],
      groupAvatar: groupAvatar || undefined,
      circleType,
      joinPolicy,
      description: String(description).slice(0, 280),
      interests: groupInterests,
      district: String(district || '').trim(),
      rules: (Array.isArray(rules) ? rules : []).slice(0, 10).map((rule) => String(rule).slice(0, 160)),
    });

    const populated = await populateChat(chat._id);

    return res.status(201).json(populated);
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/chats/group/add
 * Add a member to a group (admin only).
 */
export const addGroupMember = async (req, res, next) => {
  try {
    const { chatId, userId } = req.body;

    if (!chatId || !userId) {
      return res.status(400).json({ message: 'chatId and userId are required' });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!chat.isGroupChat) {
      return res.status(400).json({ message: 'This is not a group chat' });
    }

    if (!isAdmin(chat, req.user._id)) {
      return res.status(403).json({ message: 'Only the admin can add members' });
    }

    const target = await User.findById(userId);

    if (!target) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (isMember(chat, target._id)) {
      const populated = await populateChat(chat._id);
      return res.json({ message: 'User is already a member', chat: populated });
    }

    chat.users.push(target._id);
    await chat.save();

    await User.findByIdAndUpdate(target._id, {
      $addToSet: { 'onboarding.joinedCircleIds': chat._id },
    });

    const populated = await populateChat(chat._id);

    return res.json({ message: 'Member added', chat: populated });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/chats/group/rename
 * Rename a group (admin only).
 */
export const renameGroup = async (req, res, next) => {
  try {
    const { chatId, chatName } = req.body;

    if (!chatId || !chatName || !String(chatName).trim()) {
      return res.status(400).json({ message: 'chatId and a group name are required' });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!chat.isGroupChat) {
      return res.status(400).json({ message: 'This is not a group chat' });
    }

    if (!isAdmin(chat, req.user._id)) {
      return res.status(403).json({ message: 'Only the admin can rename the group' });
    }

    chat.chatName = String(chatName).trim();
    await chat.save();

    const populated = await populateChat(chat._id);

    return res.json({ message: 'Group renamed', chat: populated });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/chats/group/leave
 * Leave a group chat.
 */
export const leaveGroup = async (req, res, next) => {
  try {
    const { chatId } = req.body;

    if (!chatId) {
      return res.status(400).json({ message: 'chatId is required' });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!chat.isGroupChat) {
      return res.status(400).json({ message: 'This is not a group chat' });
    }

    chat.users.pull(req.user._id);
    chat.followers.pull(req.user._id);
    await chat.save();

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { 'onboarding.joinedCircleIds': chat._id },
    });

    return res.json({ message: 'You left the group' });
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/chats/group/:id
 * Delete a group chat (admin only).
 */
export const deleteGroup = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!chat.isGroupChat) {
      return res.status(400).json({ message: 'This is not a group chat' });
    }

    if (!isAdmin(chat, req.user._id)) {
      return res.status(403).json({ message: 'Only the admin can delete the group' });
    }

    await Promise.all([
      chat.deleteOne(),
      Message.deleteMany({ chat: chat._id }),
      JoinRequest.deleteMany({ chat: chat._id }),
    ]);

    return res.json({ message: 'Group deleted' });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/chats/discover?search=&category=&feature=&sort=
 * Browse public group chats.
 */
export const discoverGroups = async (req, res, next) => {
  try {
    const { search, category, feature, sort } = req.query;

    const match = { isGroupChat: true };

    if (search && String(search).trim()) {
      match.chatName = { $regex: escapeRegex(String(search).trim()), $options: 'i' };
    }
    if (category) {
      match.category = category;
    }
    if (feature) {
      match.features = feature;
    }

    const sortStages = {
      followers: { followerCount: -1, createdAt: -1 },
      members: { memberCount: -1, createdAt: -1 },
      recent: { createdAt: -1 },
    };

    const groups = await Chat.aggregate([
      { $match: match },
      {
        $addFields: {
          memberCount: { $size: { $ifNull: ['$users', []] } },
          followerCount: { $size: { $ifNull: ['$followers', []] } },
          isMember: { $in: [req.user._id, { $ifNull: ['$users', []] }] },
          isFollowing: { $in: [req.user._id, { $ifNull: ['$followers', []] }] },
        },
      },
      { $sort: sortStages[sort] || sortStages.recent },
      { $limit: 50 },
      {
        $lookup: {
          from: 'users',
          localField: 'groupAdmin',
          foreignField: '_id',
          as: 'adminUsers',
        },
      },
      { $addFields: { groupAdmin: { $arrayElemAt: ['$adminUsers', 0] } } },
      {
        $project: {
          adminUsers: 0,
          users: 0,
          __v: 0,
          'groupAdmin.password': 0,
          'groupAdmin.email': 0,
          'groupAdmin.phoneNumber': 0,
          'groupAdmin.address': 0,
          'groupAdmin.dateOfBirth': 0,
          'groupAdmin.followers': 0,
          'groupAdmin.following': 0,
          'groupAdmin.__v': 0,
        },
      },
    ]);

    return res.json(groups);
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/chats/:id/join-request
 * Request to join a group chat.
 */
export const sendJoinRequest = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);

    if (!chat) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!chat.isGroupChat) {
      return res.status(400).json({ message: 'Join requests are only available for groups' });
    }

    if (isMember(chat, req.user._id)) {
      return res.status(400).json({ message: 'Already a member' });
    }

    const io = req.app.get('io');

    // Open Circles are one tap to join — no approval round-trip.
    if (chat.joinPolicy === 'open') {
      chat.users.push(req.user._id);
      await chat.save();

      await User.findByIdAndUpdate(req.user._id, {
        $addToSet: { 'onboarding.joinedCircleIds': chat._id },
      });

      const populated = await populateChat(chat._id);

      if (io) {
        io.to(`chat:${chat._id}`).emit('member added', {
          chatId: chat._id,
          user: {
            _id: req.user._id,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            username: req.user.username,
            profilePicture: req.user.profilePicture,
          },
        });
      }

      return res.json({ message: 'Joined', joined: true, chat: populated });
    }

    const request = await JoinRequest.findOneAndUpdate(
      { chat: chat._id, user: req.user._id },
      { $set: { status: 'pending' } },
      {
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
        returnDocument: 'after',
      }
    );

    if (io && chat.groupAdmin) {
      io.to(`user:${chat.groupAdmin}`).emit('new join request', {
        chatId: chat._id,
        chatName: chat.chatName,
        user: {
          _id: req.user._id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          username: req.user.username,
          profilePicture: req.user.profilePicture,
        },
      });
    }

    return res.json({ message: 'Join request sent', request });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/chats/join-requests
 * Pending join requests for groups the current user administers.
 */
export const listJoinRequests = async (req, res, next) => {
  try {
    const adminChats = await Chat.find({ groupAdmin: req.user._id }).select('chatName').lean();

    const chatIds = adminChats.map((chat) => chat._id);

    const requests = await JoinRequest.find({ chat: { $in: chatIds }, status: 'pending' })
      .sort('-createdAt')
      .populate('user', 'firstName lastName username profilePicture isOnline')
      .populate('chat', 'chatName category groupAvatar features');

    const chatCounts = adminChats.map((chat) => ({
      chatId: chat._id,
      chatName: chat.chatName,
      count: requests.filter((request) => request.chat._id.toString() === chat._id.toString())
        .length,
    }));

    return res.json({ count: requests.length, chatCounts, requests });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/chats/join-requests/:requestId
 * Accept or reject a join request (group admin only).
 */
export const handleJoinRequest = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "Status must be either 'accepted' or 'rejected'" });
    }

    const request = await JoinRequest.findById(req.params.requestId);

    if (!request) {
      return res.status(404).json({ message: 'Join request not found' });
    }

    const chat = await Chat.findById(request.chat);

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!isAdmin(chat, req.user._id)) {
      return res.status(403).json({ message: 'Only the admin can manage join requests' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: `Request already ${request.status}` });
    }

    if (status === 'accepted' && !isMember(chat, request.user)) {
      chat.users.push(request.user);
      await chat.save();

      await User.findByIdAndUpdate(request.user, {
        $addToSet: { 'onboarding.joinedCircleIds': chat._id },
      });
    }

    request.status = status;
    await request.save();

    const io = req.app.get('io');

    if (io) {
      io.to(`user:${request.user}`).emit('join request responded', {
        chatId: chat._id,
        chatName: chat.chatName,
        status,
      });
    }

    return res.json({
      message: status === 'accepted' ? 'Join request accepted' : 'Join request rejected',
      request,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/chats/:id/follow
 * Toggle following a group chat.
 */
export const followGroup = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!chat.isGroupChat) {
      return res.status(400).json({ message: 'Only group chats can be followed' });
    }

    const userId = req.user._id.toString();
    const alreadyFollowing = (chat.followers || []).some(
      (follower) => follower.toString() === userId
    );

    if (alreadyFollowing) {
      chat.followers = chat.followers.filter(
        (follower) => follower.toString() !== userId
      );
    } else {
      chat.followers.push(req.user._id);
    }

    await chat.save();

    return res.json({
      isFollowing: !alreadyFollowing,
      followerCount: chat.followers.length,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/chats/:id/settings
 * The caller's per-chat settings: theme, nicknames and pinned messages.
 */
export const getChatSettings = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id)
      .select('users pinnedMessages vanishMode')
      .populate({
        path: 'pinnedMessages.message',
        select: 'content contentType fileName sender createdAt',
        populate: { path: 'sender', select: POPULATE_USER_FIELDS },
      })
      .populate('pinnedMessages.user', POPULATE_USER_FIELDS);

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!isMember(chat, req.user._id)) {
      return res.status(403).json({ message: 'You are not a member of this chat' });
    }

    const me = await User.findById(req.user._id).select('chatThemes nicknames').lean();

    const themeEntry = (me?.chatThemes || []).find(
      (entry) => entry.chat.toString() === chat._id.toString()
    );
    const nicknames = (me?.nicknames || [])
      .filter((entry) => entry.chat.toString() === chat._id.toString())
      .map((entry) => ({
        target: entry.target ? entry.target.toString() : null,
        name: entry.name,
      }));

    const pinnedMessages = (chat.pinnedMessages || [])
      .filter((pin) => pin.message)
      .map((pin) => ({
        _id: pin._id,
        pinnedAt: pin.pinnedAt,
        pinnedBy: pin.user,
        message: pin.message,
      }));

    return res.json({
      theme: themeEntry?.theme || '',
      nicknames,
      pinnedMessages,
      vanishMode: Boolean(chat.vanishMode),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/chats/:id/settings
 * Save the caller's theme and/or a nickname for a member (or the group).
 */
export const updateChatSettings = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!isMember(chat, req.user._id)) {
      return res.status(403).json({ message: 'You are not a member of this chat' });
    }

    const { theme, nickname, vanishMode } = req.body;
    const me = await User.findById(req.user._id);

    if (theme !== undefined) {
      const value = String(theme || '').trim().slice(0, 30);
      me.chatThemes = (me.chatThemes || []).filter(
        (entry) => entry.chat.toString() !== chat._id.toString()
      );
      if (value) me.chatThemes.push({ chat: chat._id, theme: value });
    }

    if (nickname !== undefined) {
      const name = String(nickname?.name || '').trim().slice(0, 40);
      const target = nickname?.target ? String(nickname.target) : null;

      if (target && !isMember(chat, target)) {
        return res.status(400).json({ message: 'That person is not in this chat' });
      }

      me.nicknames = (me.nicknames || []).filter(
        (entry) =>
          !(
            entry.chat.toString() === chat._id.toString() &&
            (entry.target ? entry.target.toString() : null) === target
          )
      );

      if (name) me.nicknames.push({ chat: chat._id, target, name });
    }

    await me.save();

    // Vanish Mode is a shared conversation mode, so it lives on the chat.
    if (vanishMode !== undefined) {
      chat.vanishMode = Boolean(vanishMode);
      await chat.save();

      const io = req.app.get('io');
      if (io) {
        io.to(`chat:${chat._id}`).emit('chat settings', {
          chatId: chat._id,
          vanishMode: chat.vanishMode,
        });
      }
    }

    const themeEntry = (me.chatThemes || []).find(
      (entry) => entry.chat.toString() === chat._id.toString()
    );
    const nicknames = (me.nicknames || [])
      .filter((entry) => entry.chat.toString() === chat._id.toString())
      .map((entry) => ({
        target: entry.target ? entry.target.toString() : null,
        name: entry.name,
      }));

    return res.json({
      theme: themeEntry?.theme || '',
      nicknames,
      vanishMode: Boolean(chat.vanishMode),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/chats/:id/pin-message
 * Pin a message to the top of the conversation (max 3).
 */
export const pinMessage = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id).select('users pinnedMessages');

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!isMember(chat, req.user._id)) {
      return res.status(403).json({ message: 'You are not a member of this chat' });
    }

    const { messageId } = req.body;
    const message = await Message.findOne({ _id: messageId, chat: chat._id }).select('_id');

    if (!message) {
      return res.status(404).json({ message: 'Message not found in this chat' });
    }

    const already = (chat.pinnedMessages || []).some(
      (pin) => pin.message.toString() === message._id.toString()
    );

    if (!already) {
      if ((chat.pinnedMessages || []).length >= 3) {
        return res
          .status(400)
          .json({ message: 'You can only pin up to 3 messages. Unpin one first.' });
      }
      chat.pinnedMessages.push({ message: message._id, user: req.user._id });
      await chat.save();
    }

    const io = req.app.get('io');
    if (io) io.to(`chat:${chat._id}`).emit('chat pinned-messages', { chatId: chat._id });

    return res.json({ message: 'Message pinned', pinnedCount: chat.pinnedMessages.length });
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/chats/:id/pin-message/:messageId
 * Remove a pinned message.
 */
export const unpinMessage = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id).select('users pinnedMessages');

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!isMember(chat, req.user._id)) {
      return res.status(403).json({ message: 'You are not a member of this chat' });
    }

    chat.pinnedMessages = (chat.pinnedMessages || []).filter(
      (pin) => pin.message.toString() !== req.params.messageId
    );
    await chat.save();

    const io = req.app.get('io');
    if (io) io.to(`chat:${chat._id}`).emit('chat pinned-messages', { chatId: chat._id });

    return res.json({ message: 'Message unpinned', pinnedCount: chat.pinnedMessages.length });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/chats/:id/pin
 * Pin or unpin this conversation for the current user (max 3 pinned chats).
 */
export const togglePinChat = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id).select('users');

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!isMember(chat, req.user._id)) {
      return res.status(403).json({ message: 'You are not a member of this chat' });
    }

    const me = await User.findById(req.user._id);
    const pinned = (me.pinnedChats || []).map((id) => id.toString());
    const isPinned = pinned.includes(chat._id.toString());

    if (isPinned) {
      me.pinnedChats = me.pinnedChats.filter(
        (id) => id.toString() !== chat._id.toString()
      );
    } else {
      if (me.pinnedChats.length >= 3) {
        return res
          .status(400)
          .json({ message: 'You can only pin 3 chats. Unpin one first.' });
      }
      me.pinnedChats.push(chat._id);
    }

    await me.save();

    return res.json({ pinned: !isPinned, pinnedCount: me.pinnedChats.length });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/chats/join/:code
 * Join (or request to join) a Circle from a shared QR invite.
 */
export const joinByCode = async (req, res, next) => {
  try {
    const code = String(req.params.code || '').trim().toLowerCase();

    if (!code) {
      return res.status(400).json({ message: 'That invite code is missing' });
    }

    const chat = await Chat.findOne({ inviteCode: code });

    if (!chat) {
      return res.status(404).json({ message: 'That invite code is not valid' });
    }

    if (isMember(chat, req.user._id)) {
      return res.json({ message: 'You are already in this Circle', chat, joined: true });
    }

    // Request-only Circles send the admin an approval instead of adding you.
    if (chat.joinPolicy === 'request') {
      await JoinRequest.findOneAndUpdate(
        { chat: chat._id, user: req.user._id },
        { $set: { status: 'pending' } },
        { upsert: true, setDefaultsOnInsert: true, returnDocument: 'after' }
      );

      const io = req.app.get('io');
      if (io && chat.groupAdmin) {
        io.to(`user:${chat.groupAdmin}`).emit('new join request', {
          chatId: chat._id,
          chatName: chat.chatName,
          user: {
            _id: req.user._id,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            username: req.user.username,
            profilePicture: req.user.profilePicture,
          },
        });
      }

      return res.json({
        message: 'Request sent — the Circle admin will approve you',
        chat,
        joined: false,
        pending: true,
      });
    }

    chat.users.push(req.user._id);
    await chat.save();

    const populated = await populateChat(chat._id);

    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${chat._id}`).emit('member added', {
        chatId: chat._id,
        user: {
          _id: req.user._id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          username: req.user.username,
          profilePicture: req.user.profilePicture,
        },
      });
    }

    return res.json({ message: 'Joined', chat: populated, joined: true });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/chats/:id/invite
 * Fetch (creating it the first time) a Circle's QR invite code.
 */
export const getInviteCode = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);

    if (!chat) {
      return res.status(404).json({ message: 'Circle not found' });
    }

    if (!isMember(chat, req.user._id)) {
      return res.status(403).json({ message: 'You are not a member of this Circle' });
    }

    if (!chat.inviteCode) {
      // Retry on the off chance a code collides.
      for (let attempt = 0; attempt < 5 && !chat.inviteCode; attempt += 1) {
        const candidate = randomBytes(4).toString('hex');
        // eslint-disable-next-line no-await-in-loop
        const taken = await Chat.exists({ inviteCode: candidate });
        if (!taken) chat.inviteCode = candidate;
      }
      await chat.save();
    }

    return res.json({
      chatId: chat._id,
      inviteCode: chat.inviteCode,
      joinPolicy: chat.joinPolicy,
      chatName: chat.chatName,
    });
  } catch (error) {
    return next(error);
  }
};

export default {
  listChats,
  createChat,
  createGroupChat,
  addGroupMember,
  renameGroup,
  leaveGroup,
  deleteGroup,
  discoverGroups,
  sendJoinRequest,
  listJoinRequests,
  handleJoinRequest,
  followGroup,
  getChatSettings,
  updateChatSettings,
  pinMessage,
  unpinMessage,
  togglePinChat,
  joinByCode,
  getInviteCode,
};
