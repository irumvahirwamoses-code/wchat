import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * A one-time verification code (OTP) used to confirm ownership of an email
 * address or phone number before the account is created.
 *
 * The code itself is never stored in plain text — only a SHA-256 hash — and the
 * document is removed automatically once it expires (TTL index).
 */
const verificationCodeSchema = new mongoose.Schema(
  {
    /** Lowercased email or E.164 phone number that received the code. */
    identifier: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ['email', 'sms'],
      required: true,
    },
    purpose: {
      type: String,
      enum: ['register', 'login', 'reset-password'],
      default: 'register',
    },
    codeHash: {
      type: String,
      required: true,
    },
    /** Pending registration data, applied once the code is verified. */
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
  },
  { timestamps: true }
);

verificationCodeSchema.index({ identifier: 1, purpose: 1 });

/** Generate a cryptographically random N-digit code. */
export const generateCode = (digits = 6) => {
  const max = 10 ** digits;
  const value = crypto.randomInt(0, max);
  return String(value).padStart(digits, '0');
};

export const hashCode = (code) =>
  crypto.createHash('sha256').update(String(code)).digest('hex');

verificationCodeSchema.methods.matches = function (code) {
  const incoming = Buffer.from(hashCode(code));
  const stored = Buffer.from(this.codeHash);
  if (incoming.length !== stored.length) return false;
  return crypto.timingSafeEqual(incoming, stored);
};

const VerificationCode = mongoose.model('VerificationCode', verificationCodeSchema);

export default VerificationCode;
