import bcrypt from 'bcryptjs';
import User, { GENDERS } from '../models/User.js';
import VerificationCode, { generateCode, hashCode } from '../models/VerificationCode.js';
import generateToken from '../utils/generateToken.js';
import {
  normalizeUsername,
  isValidUsername,
  buildUsernameSuggestions,
  USERNAME_MIN,
  USERNAME_MAX,
} from '../utils/username.js';
import { isEmailConfigured, sendVerificationEmail } from '../services/mailer.js';
import { isSmsConfigured, sendVerificationSms } from '../services/sms.js';
import { ensurePersonalCircle } from '../services/circles.js';
import { getSystemSettings } from '../services/systemSettings.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;
const CODE_TTL_MINUTES = Number(process.env.VERIFY_CODE_TTL_MINUTES || 10);
const RESEND_COOLDOWN_SECONDS = 60;

/** Remove the password hash from a user document before sending it. */
const stripPassword = (user) => {
  const plain = user.toObject ? user.toObject() : { ...user };
  delete plain.password;
  return plain;
};

/**
 * GET /api/auth/channels
 * Which verification channels the server can actually deliver on right now.
 */
export const getChannels = (req, res) =>
  res.json({
    email: isEmailConfigured(),
    sms: isSmsConfigured(),
    // In development a missing provider is fine: codes are printed/exposed.
    devMode: process.env.NODE_ENV !== 'production',
    codeTtlMinutes: CODE_TTL_MINUTES,
    resendCooldownSeconds: RESEND_COOLDOWN_SECONDS,
  });

/* ------------------------------------------------------------------ helpers */

const cleanEmail = (value) => String(value || '').trim().toLowerCase();
const cleanPhone = (value) => String(value || '').replace(/[\s-]/g, '').trim();

const maskEmail = (email) => {
  const [name, domain] = String(email).split('@');
  if (!domain) return email;
  const visible = name.slice(0, Math.min(3, name.length));
  return `${visible}${'*'.repeat(Math.max(2, name.length - visible.length))}@${domain}`;
};

const maskPhone = (phone) => {
  const raw = String(phone);
  if (raw.length <= 5) return raw;
  return `${raw.slice(0, 5)}${'*'.repeat(Math.max(2, raw.length - 8))}${raw.slice(-3)}`;
};

const maskDestination = (identifier, channel) =>
  channel === 'email' ? maskEmail(identifier) : maskPhone(identifier);

const normalizeIdentifier = (value) => {
  const raw = String(value || '').trim();
  if (raw.includes('@')) return raw.toLowerCase();
  return raw.replace(/[\s-]/g, '');
};

/** Very small in-memory resend guard (per identifier). */
const lastSentAt = new Map();

const secondsUntilResend = (identifier) => {
  const sent = lastSentAt.get(identifier);
  if (!sent) return 0;
  const elapsed = (Date.now() - sent) / 1000;
  return elapsed >= RESEND_COOLDOWN_SECONDS ? 0 : Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed);
};

/**
 * Validate the full registration payload.
 * @returns {{error?: string, data?: object}}
 */
const validateRegistration = (body) => {
  const firstName = String(body.firstName || '').trim();
  const lastName = String(body.lastName || '').trim();
  const username = normalizeUsername(body.username);
  const gender = String(body.gender || '').trim();
  const email = cleanEmail(body.email);
  const phoneNumber = cleanPhone(body.phoneNumber);
  const password = String(body.password || '');
  const dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
  const country = String(body.country || '').trim();
  const channel = String(body.channel || '').trim().toLowerCase();
  const language = String(body.language || 'rw').trim();

  if (!firstName || !lastName) return { error: 'First name and last name are required' };
  if (!username) return { error: 'Username is required' };
  if (!isValidUsername(username))
    return {
      error: `Username must be ${USERNAME_MIN}-${USERNAME_MAX} characters and use only letters, numbers, '.' or '_'`,
    };
  if (!GENDERS.includes(gender)) return { error: 'Please select your gender' };
  if (!EMAIL_REGEX.test(email)) return { error: 'Please enter a valid email address' };
  if (!PHONE_REGEX.test(phoneNumber)) return { error: 'Please enter a valid phone number' };
  if (password.length < 6) return { error: 'Password must be at least 6 characters' };
  if (!dateOfBirth || Number.isNaN(dateOfBirth.getTime()))
    return { error: 'Please provide your date of birth' };
  const age = (Date.now() - dateOfBirth.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (age < 13) return { error: 'You must be at least 13 years old to use Wchat' };
  if (age > 120) return { error: 'Please check your date of birth' };
  if (!country) return { error: 'Please select your country' };
  if (!['email', 'sms'].includes(channel))
    return { error: 'Choose how you want to receive your verification code' };

  return {
    data: {
      firstName,
      lastName,
      username,
      gender,
      email,
      phoneNumber,
      password,
      dateOfBirth,
      country,
      channel,
      language,
    },
  };
};

/**
 * GET /api/auth/usernames?firstName=&lastName=
 * Propose available usernames derived from the person's name.
 */
export const suggestUsernames = async (req, res, next) => {
  try {
    const firstName = String(req.query.firstName || req.body?.firstName || '').trim();
    const lastName = String(req.query.lastName || req.body?.lastName || '').trim();

    if (!firstName && !lastName) {
      return res.json({ suggestions: [] });
    }

    const candidates = buildUsernameSuggestions(firstName, lastName);

    if (candidates.length === 0) {
      return res.json({ suggestions: [] });
    }

    const taken = await User.find({ username: { $in: candidates } })
      .select('username')
      .lean();
    const takenSet = new Set(taken.map((user) => user.username));

    const suggestions = candidates.filter((candidate) => !takenSet.has(candidate)).slice(0, 6);

    return res.json({ suggestions });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/auth/register
 * Step 1 of 2 — validate the details and send a verification code.
 * The account is NOT created until the code is confirmed.
 */
export const requestRegistration = async (req, res, next) => {
  try {
    const settings = await getSystemSettings();
    if (settings.registrationOpen === false) {
      return res.status(403).json({
        message: 'New registrations are temporarily closed. Please check back soon.',
      });
    }

    const { error, data } = validateRegistration(req.body);

    if (error) return res.status(400).json({ message: error });

    const [usernameTaken, emailTaken, phoneTaken] = await Promise.all([
      User.exists({ username: data.username }),
      User.exists({ email: data.email }),
      User.exists({ phoneNumber: data.phoneNumber }),
    ]);

    if (usernameTaken) return res.status(409).json({ message: 'That username is already taken' });
    if (emailTaken) return res.status(409).json({ message: 'That email is already registered' });
    if (phoneTaken) return res.status(409).json({ message: 'That phone number is already in use' });

    const identifier = data.channel === 'email' ? data.email : data.phoneNumber;

    const wait = secondsUntilResend(identifier);
    if (wait > 0) {
      return res.status(429).json({
        message: `Please wait ${wait}s before requesting another code`,
        retryAfter: wait,
      });
    }

    // Drop any previous pending code for this identifier, then create a fresh one.
    await VerificationCode.deleteMany({ identifier, purpose: 'register', consumedAt: null });

    const code = generateCode(6);
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    await VerificationCode.create({
      identifier,
      channel: data.channel,
      purpose: 'register',
      codeHash: hashCode(code),
      // The plain password is hashed here so the short-lived pending record never
      // contains the actual credential.
      payload: {
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
        gender: data.gender,
        email: data.email,
        phoneNumber: data.phoneNumber,
        passwordHash: await bcrypt.hash(data.password, 10),
        dateOfBirth: data.dateOfBirth.toISOString(),
        country: data.country,
        language: data.language,
      },
      expiresAt,
    });

    lastSentAt.set(identifier, Date.now());

    let delivery;
    try {
      delivery =
        data.channel === 'email'
          ? await sendVerificationEmail({
              to: data.email,
              name: data.firstName,
              code,
              minutes: CODE_TTL_MINUTES,
            })
          : await sendVerificationSms({ to: data.phoneNumber, code, minutes: CODE_TTL_MINUTES });
    } catch (sendError) {
      return res.status(502).json({
        message: `We couldn't send the code: ${sendError.message}`,
      });
    }

    const response = {
      message:
        data.channel === 'email'
          ? `We sent a code to ${maskDestination(identifier, data.channel)}`
          : `We sent a code by SMS to ${maskDestination(identifier, data.channel)}`,
      channel: data.channel,
      identifier,
      destination: maskDestination(identifier, data.channel),
      expiresAt,
      resendInSeconds: RESEND_COOLDOWN_SECONDS,
    };

    // Development convenience: when no provider is configured the code is echoed
    // back so the flow can be completed without external services. In production
    // the code is never exposed, whatever happens.
    const devMode = process.env.NODE_ENV !== 'production';
    if (!delivery.delivered && devMode) {
      response.devCode = code;
      response.message = `${response.message} (dev mode: check the server console)`;
    }

    return res.status(202).json(response);
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/auth/register/verify
 * Step 2 of 2 — check the code and create the account.
 */
export const verifyRegistration = async (req, res, next) => {
  try {
    const identifier = normalizeIdentifier(req.body.identifier);
    const code = String(req.body.code || '').trim();

    if (!identifier || !code) {
      return res.status(400).json({ message: 'Enter the verification code we sent you' });
    }

    const record = await VerificationCode.findOne({
      identifier,
      purpose: 'register',
      consumedAt: null,
    }).select('+codeHash');

    if (!record) {
      return res.status(404).json({
        message: 'No pending verification found. Please start the registration again.',
      });
    }

    if (record.expiresAt.getTime() < Date.now()) {
      await record.deleteOne();
      return res.status(410).json({ message: 'That code has expired. Please request a new one.' });
    }

    if (record.attempts >= record.maxAttempts) {
      await record.deleteOne();
      return res.status(429).json({ message: 'Too many attempts. Please request a new code.' });
    }

    if (!record.matches(code)) {
      record.attempts += 1;
      const remaining = Math.max(0, record.maxAttempts - record.attempts);
      await record.save();
      return res.status(400).json({
        message: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`,
      });
    }

    const payload = record.payload || {};

    // Re-check uniqueness in case somebody registered while the code was pending.
    const [usernameTaken, emailTaken, phoneTaken] = await Promise.all([
      User.exists({ username: payload.username }),
      User.exists({ email: payload.email }),
      User.exists({ phoneNumber: payload.phoneNumber }),
    ]);

    if (usernameTaken || emailTaken || phoneTaken) {
      await record.deleteOne();
      const message = usernameTaken
        ? 'That username was just taken. Please try another.'
        : emailTaken
          ? 'That email is already registered'
          : 'That phone number is already in use';
      return res.status(409).json({ message });
    }

    const user = new User({
      firstName: payload.firstName,
      lastName: payload.lastName,
      username: payload.username,
      gender: payload.gender,
      email: payload.email,
      phoneNumber: payload.phoneNumber,
      password: payload.passwordHash,
      dateOfBirth: payload.dateOfBirth,
      address: { country: payload.country },
      language: payload.language,
      emailVerified: record.channel === 'email',
      phoneVerified: record.channel === 'sms',
    });

    // The password stored in the pending record is already hashed — tell the
    // model to skip hashing it a second time.
    user.$locals.skipPasswordHash = true;
    await user.save();

    // Every account is also a Circle on Wchat.
    await ensurePersonalCircle(user);

    record.consumedAt = new Date();
    await record.save();

    const token = generateToken(user._id);

    return res.status(201).json({ token, user: stripPassword(user) });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/auth/register/resend
 * Send a fresh code for the pending registration.
 */
export const resendVerification = async (req, res, next) => {
  try {
    const identifier = normalizeIdentifier(req.body.identifier);

    if (!identifier) {
      return res.status(400).json({ message: 'Missing verification destination' });
    }

    const record = await VerificationCode.findOne({
      identifier,
      purpose: 'register',
      consumedAt: null,
    });

    if (!record) {
      return res.status(404).json({ message: 'Please start the registration again' });
    }

    const wait = secondsUntilResend(identifier);
    if (wait > 0) {
      return res.status(429).json({
        message: `Please wait ${wait}s before requesting another code`,
        retryAfter: wait,
      });
    }

    const code = generateCode(6);
    record.codeHash = hashCode(code);
    record.attempts = 0;
    record.expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);
    await record.save();

    lastSentAt.set(identifier, Date.now());

    let delivery;
    try {
      delivery =
        record.channel === 'email'
          ? await sendVerificationEmail({
              to: record.identifier,
              name: record.payload?.firstName,
              code,
              minutes: CODE_TTL_MINUTES,
            })
          : await sendVerificationSms({ to: record.identifier, code, minutes: CODE_TTL_MINUTES });
    } catch (sendError) {
      return res.status(502).json({ message: `We couldn't send the code: ${sendError.message}` });
    }

    const response = {
      message: 'A new code is on its way',
      channel: record.channel,
      identifier: record.identifier,
      destination: maskDestination(record.identifier, record.channel),
      expiresAt: record.expiresAt,
      resendInSeconds: RESEND_COOLDOWN_SECONDS,
    };

    if (!delivery.delivered && process.env.NODE_ENV !== 'production') {
      response.devCode = code;
    }

    return res.json(response);
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/auth/login
 * Login with email, phone number or username + password.
 */
export const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res
        .status(400)
        .json({ message: 'Please provide your email, phone number or username and your password' });
    }

    const raw = String(identifier).trim();
    const lower = raw.toLowerCase();
    const username = normalizeUsername(raw);

    const or = [{ email: lower }, { phoneNumber: raw.replace(/[\s-]/g, '') }];
    if (isValidUsername(username)) or.push({ username });

    const user = await User.findOne({ $or: or }).select('+password');

    if (!user || !(await user.matchPassword(String(password)))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        message: user.blockedReason
          ? `Your account has been blocked: ${user.blockedReason}`
          : 'Your account has been blocked by an administrator.',
        blocked: true,
      });
    }

    const token = generateToken(user._id);

    return res.json({ token, user: stripPassword(user) });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/auth/me
 * Return the currently authenticated user.
 */
export const getMe = async (req, res) => res.json(req.user);

/**
 * PUT /api/auth/preferences
 * Persist the account's system settings (theme, data saver, privacy toggles).
 */
export const updatePreferences = async (req, res, next) => {
  try {
    const {
      theme,
      dataSaver,
      autoplayVideos,
      showReadReceipts,
      allowDmFromAnyone,
      notifyActivity,
      notifyChats,
      highQualityUploads,
      hiddenWords,
      allowRemix,
      allowShareToStories,
      allowDownload,
      allowMentions,
    } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'Account not found' });

    const prefs = user.preferences || {};
    if (['dark', 'light', 'midnight'].includes(theme)) prefs.theme = theme;
    if (typeof dataSaver === 'boolean') prefs.dataSaver = dataSaver;
    if (typeof autoplayVideos === 'boolean') prefs.autoplayVideos = autoplayVideos;
    if (typeof showReadReceipts === 'boolean') prefs.showReadReceipts = showReadReceipts;
    if (typeof allowDmFromAnyone === 'boolean') prefs.allowDmFromAnyone = allowDmFromAnyone;
    if (typeof notifyActivity === 'boolean') prefs.notifyActivity = notifyActivity;
    if (typeof notifyChats === 'boolean') prefs.notifyChats = notifyChats;
    if (typeof highQualityUploads === 'boolean') prefs.highQualityUploads = highQualityUploads;

    // Sharing & reuse — how other people may use this account's content.
    if (typeof allowRemix === 'boolean') prefs.allowRemix = allowRemix;
    if (typeof allowShareToStories === 'boolean') prefs.allowShareToStories = allowShareToStories;
    if (typeof allowDownload === 'boolean') prefs.allowDownload = allowDownload;
    if (['everyone', 'people-i-follow', 'no-one'].includes(allowMentions)) {
      prefs.allowMentions = allowMentions;
    }

    if (hiddenWords !== undefined) {
      let parsed = hiddenWords;
      if (typeof hiddenWords === 'string') {
        try {
          parsed = JSON.parse(hiddenWords);
        } catch {
          parsed = hiddenWords.split(',');
        }
      }
      if (!Array.isArray(parsed)) {
        return res.status(400).json({ message: 'hiddenWords must be a list' });
      }
      prefs.hiddenWords = [...new Set(
        parsed
          .map((word) => String(word).trim().toLowerCase())
          .filter(Boolean)
      )].slice(0, 50);
    }

    user.preferences = prefs;
    await user.save();

    return res.json({ preferences: user.preferences });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/auth/password
 * Change the account password (Account Center → Password & security).
 * Requires the current password so a hijacked session cannot lock the owner out.
 */
export const changePassword = async (req, res, next) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Enter your current and new password' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Your new password must be at least 6 characters' });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({ message: 'Choose a password different from your current one' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ message: 'Account not found' });

    if (!(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ message: 'Your current password is incorrect' });
    }

    user.password = newPassword; // re-hashed by the pre-save hook
    await user.save();

    return res.json({ message: 'Password updated' });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/auth/block/:userId  |  DELETE /api/auth/block/:userId
 * Block / unblock another account. Blocked accounts cannot start 1:1 chats.
 */
export const toggleBlock = async (req, res, next) => {
  try {
    const targetId = req.params.userId;
    if (String(targetId) === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot block yourself' });
    }
    const target = await User.findById(targetId).select('_id');
    if (!target) return res.status(404).json({ message: 'Account not found' });

    const user = await User.findById(req.user._id).select('blocked');
    const blocked = new Set((user.blocked || []).map(String));
    const shouldBlock = req.method !== 'DELETE';
    if (shouldBlock) blocked.add(String(targetId));
    else blocked.delete(String(targetId));

    user.blocked = [...blocked];
    await user.save();

    return res.json({ blocked: shouldBlock, blockedCount: user.blocked.length });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/auth/blocked  — accounts this user has blocked.
 */
export const listBlocked = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate(
      'blocked',
      'firstName lastName username profilePicture'
    );
    return res.json(user?.blocked || []);
  } catch (error) {
    return next(error);
  }
};

/** Small helper exposed for tests / debugging. */
export const _internal = { validateRegistration, maskDestination };

export default {
  suggestUsernames,
  getChannels,
  requestRegistration,
  verifyRegistration,
  resendVerification,
  login,
  getMe,
  updatePreferences,
  changePassword,
  toggleBlock,
  listBlocked,
};
