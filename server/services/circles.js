import Chat from '../models/Chat.js';
import { STARTER_CIRCLES } from '../data/circles.js';
import { generateAvatar } from '../utils/generateAvatar.js';

/**
 * Every Wchat account is also a Circle. This creates (or refreshes) the personal
 * Circle that represents a user's profile, so people can "Join" them.
 */
export const ensurePersonalCircle = async (user) => {
  if (!user?._id) return null;

  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;
  const interests = Array.isArray(user.interests) ? user.interests : [];
  const avatar = user.profilePicture || generateAvatar(name, 'identicon');

  return Chat.findOneAndUpdate(
    { circleType: 'personal', ownerUser: user._id },
    {
      $set: {
        chatName: name,
        description: user.bio || "Someone's personal Circle on Wchat.",
        interests,
        groupAvatar: avatar,
      },
      $setOnInsert: {
        isGroupChat: true,
        users: [user._id],
        groupAdmin: user._id,
        followers: [user._id],
        circleType: 'personal',
        ownerUser: user._id,
        joinPolicy: 'open',
        category: 'general',
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
};

/**
 * Idempotently create the public starter Circles. Safe to call on every boot or
 * from the seed script; existing Circles are left untouched (only missing ones
 * are inserted).
 */
export const ensureStarterCircles = async () => {
  const existing = await Chat.find({
    chatName: { $in: STARTER_CIRCLES.map((circle) => circle.chatName) },
  })
    .select('chatName')
    .lean();

  const existingNames = new Set(existing.map((chat) => chat.chatName));
  const missing = STARTER_CIRCLES.filter((circle) => !existingNames.has(circle.chatName));

  if (missing.length === 0) return { created: 0, total: STARTER_CIRCLES.length };

  const docs = missing.map((circle) => ({
    chatName: circle.chatName,
    isGroupChat: true,
    users: [],
    followers: [],
    category: circle.category || 'general',
    circleType: circle.circleType || 'topic',
    joinPolicy: circle.joinPolicy || 'open',
    description: circle.description || '',
    interests: circle.interests || [],
    district: circle.district || '',
    groupAvatar: circle.groupAvatar || undefined,
  }));

  await Chat.insertMany(docs);

  return { created: docs.length, total: STARTER_CIRCLES.length };
};

export default { ensurePersonalCircle, ensureStarterCircles };
