/**
 * Seed demo Wchat data so you can log in and test immediately.
 *
 * Usage (from the `server` folder):
 *   npm run seed
 *   # or
 *   node scripts/seedUsers.js
 *
 * What it does:
 *   1. Migrates legacy usernames that still carry the old '#' prefix.
 *   2. Creates the public starter Circles (data/circles.js) — idempotent.
 *   3. Creates two demo accounts and their personal Circle.
 *   4. Joins the demo accounts to relevant Circles and marks onboarding done.
 *
 * The script is idempotent: re-running it never duplicates anything.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Chat from '../models/Chat.js';
import { generateGenderAvatar } from '../utils/generateAvatar.js';
import { ensurePersonalCircle, ensureStarterCircles } from '../services/circles.js';

const DEMO_ACCOUNTS = [
  {
    firstName: 'Keza',
    lastName: 'Mugisha',
    username: 'keza',
    gender: 'female',
    email: 'keza@wchat.rw',
    phoneNumber: '+250788000001',
    password: 'Keza1234',
    dateOfBirth: '2000-04-12',
    country: 'Rwanda',
    bio: 'Product designer in Kigali. Coffee, code and circles.',
    interests: ['technology', 'business', 'music', 'education', 'fashion'],
  },
  {
    firstName: 'Eric',
    lastName: 'Niyonzima',
    username: 'eric',
    gender: 'male',
    email: 'eric@wchat.rw',
    phoneNumber: '+250788000002',
    password: 'Eric1234',
    dateOfBirth: '1998-09-30',
    country: 'Rwanda',
    bio: 'Farmer + football fan. Building with technology in Musanze.',
    interests: ['football', 'agriculture', 'technology', 'news', 'gaming'],
  },
];

/** Strip the legacy '#'/'@' prefix from usernames created before the Wchat rebrand. */
const migrateLegacyUsernames = async () => {
  const legacy = await User.find({ username: /^[#@]/ }).select('username');
  let migrated = 0;

  for (const user of legacy) {
    const clean = user.username.replace(/^[#@]+/, '');
    if (!clean) continue;
    const clash = await User.exists({ username: clean, _id: { $ne: user._id } });
    if (clash) continue; // keep the old one rather than break uniqueness
    await User.updateOne({ _id: user._id }, { $set: { username: clean } });
    migrated += 1;
  }

  if (migrated) console.log(`Migrated ${migrated} legacy username(s) to the new format.\n`);
  return migrated;
};

/** Join a user to the best matching public Circles for their interests. */
const autoJoinCircles = async (user, limit = 6) => {
  const interests = user.interests?.length ? user.interests : [];

  const circles = await Chat.find({
    isGroupChat: true,
    circleType: { $in: ['topic', 'local'] },
    ...(interests.length ? { interests: { $in: interests } } : {}),
  })
    .sort({ createdAt: 1 })
    .limit(limit);

  const joinedIds = [];

  for (const circle of circles) {
    const isMember = circle.users.some((id) => id.toString() === user._id.toString());
    if (!isMember) {
      circle.users.push(user._id);
    }
    if (!circle.followers.some((id) => id.toString() === user._id.toString())) {
      circle.followers.push(user._id);
    }
    await circle.save();
    joinedIds.push(circle._id);
  }

  return joinedIds;
};

const seed = async () => {
  await connectDB();

  await migrateLegacyUsernames();

  const starter = await ensureStarterCircles();
  console.log(
    `Starter Circles: ${starter.total} total (${starter.created} created this run).\n`
  );

  const results = [];

  for (const account of DEMO_ACCOUNTS) {
    let user = await User.findOne({ username: account.username });

    if (user) {
      // Keep the demo account fully usable even if it predates newer fields.
      user.gender = account.gender;
      user.emailVerified = true;
      user.phoneVerified = true;
      if (!user.profilePicture) {
        user.profilePicture = generateGenderAvatar(user.username, account.gender);
      }
      if (!user.interests?.length) user.interests = account.interests;
      if (!user.bio) user.bio = account.bio;
      await user.save();
    } else {
      const clash = await User.findOne({
        $or: [{ email: account.email }, { phoneNumber: account.phoneNumber }],
      }).select('username email phoneNumber');

      if (clash) {
        results.push({
          status: `skipped (email/phone belongs to ${clash.username})`,
          username: account.username,
          password: account.password,
          email: account.email,
        });
        continue;
      }

      user = await User.create({
        firstName: account.firstName,
        lastName: account.lastName,
        username: account.username,
        gender: account.gender,
        email: account.email,
        phoneNumber: account.phoneNumber,
        password: account.password,
        dateOfBirth: new Date(account.dateOfBirth),
        address: { country: account.country },
        bio: account.bio,
        interests: account.interests,
        emailVerified: true,
        phoneVerified: true,
      });
    }

    // Personal Circle ("every account is a Circle").
    await ensurePersonalCircle(user);

    // Join a handful of Circles and mark onboarding complete so the demo
    // accounts land straight on the dashboard.
    const joinedIds = await autoJoinCircles(user);
    user.onboarding = user.onboarding || {};
    user.onboarding.joinedCircleIds = joinedIds;
    user.onboarding.interestsDoneAt = user.onboarding.interestsDoneAt || new Date();
    user.onboarding.completedAt = user.onboarding.completedAt || new Date();
    await user.save();

    results.push({
      status: await User.exists({ username: account.username }) ? 'ready' : 'created',
      username: account.username,
      password: account.password,
      email: account.email,
      circles: joinedIds.length,
    });
  }

  console.log('\nWchat demo accounts ready:\n');
  console.table(results);
  console.log('\nLog in with the email (or @username) and the password above.\n');

  await mongoose.connection.close();
  process.exit(0);
};

seed().catch(async (error) => {
  console.error('\nSeeding failed:', error.message);
  try {
    await mongoose.connection.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
