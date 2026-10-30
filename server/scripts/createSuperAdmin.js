import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import { ensurePersonalCircle } from '../services/circles.js';

/**
 * Create (or promote) the super admin account.
 *
 * Run with:
 *   npm run create-admin            # inside server/
 *
 * Override any of these with environment variables:
 *   SUPERADMIN_USERNAME, SUPERADMIN_EMAIL, SUPERADMIN_PHONE,
 *   SUPERADMIN_PASSWORD, SUPERADMIN_FIRSTNAME, SUPERADMIN_LASTNAME,
 *   SUPERADMIN_DOB
 */
const username = String(process.env.SUPERADMIN_USERNAME || 'wutadmin').trim().toLowerCase();
const email = String(process.env.SUPERADMIN_EMAIL || 'admin@wutcompany.com').trim().toLowerCase();
const phoneNumber = String(process.env.SUPERADMIN_PHONE || '+250700000001').trim();
const password = String(process.env.SUPERADMIN_PASSWORD || 'WchatSuperAdmin123!');
const firstName = String(process.env.SUPERADMIN_FIRSTNAME || 'WUT').trim();
const lastName = String(process.env.SUPERADMIN_LASTNAME || 'Admin').trim();
const dateOfBirth = new Date(process.env.SUPERADMIN_DOB || '1990-01-01');

const run = async () => {
  await connectDB();

  let user = await User.findOne({
    $or: [{ username }, { email }, { phoneNumber }],
  }).select('+password');

  if (user) {
    user.role = 'superadmin';
    user.isBlocked = false;
    user.blockedReason = '';
    user.blockedAt = null;
    user.emailVerified = true;
    if (!user.onboarding) user.onboarding = {};
    if (!user.onboarding.completedAt) user.onboarding.completedAt = new Date();
    await user.save();
    console.log(`\nPromoted existing account to super admin: @${user.username}`);
  } else {
    user = new User({
      firstName,
      lastName,
      username,
      email,
      phoneNumber,
      password,
      gender: 'prefer-not-to-say',
      dateOfBirth,
      address: { country: 'Rwanda' },
      role: 'superadmin',
      emailVerified: true,
      phoneVerified: true,
      onboarding: { completedAt: new Date() },
    });
    await user.save();
    console.log(`\nCreated super admin: @${user.username}`);
  }

  try {
    await ensurePersonalCircle(user);
  } catch (error) {
    console.warn(`Could not create personal circle: ${error.message}`);
  }

  console.log('--------------------------------------------------');
  console.log('Super admin credentials');
  console.log(`  Username: ${username}`);
  console.log(`  Email:    ${email}`);
  console.log(`  Phone:    ${phoneNumber}`);
  if (password === 'WchatSuperAdmin123!') {
    console.log(`  Password: ${password}  <-- default, change it after login!`);
  } else {
    console.log('  Password: (from SUPERADMIN_PASSWORD)');
  }
  console.log('--------------------------------------------------\n');

  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (error) => {
  console.error('Failed to create super admin:', error.message);
  try {
    await mongoose.connection.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
