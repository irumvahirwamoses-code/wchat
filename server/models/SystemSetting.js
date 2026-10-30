import mongoose from 'mongoose';

/**
 * A single document holding platform-wide switches (currently the maintenance
 * / "disable the system" mode). Read on every request through a tiny cache in
 * services/systemSettings.js so toggling is instant.
 */
const systemSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      default: 'global',
      index: true,
    },
    maintenanceEnabled: {
      type: Boolean,
      default: false,
    },
    maintenanceMessage: {
      type: String,
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
      default: 'Wchat is temporarily unavailable while we make improvements. Please check back soon.',
    },
    /** Optional auto-expiry for the maintenance window. */
    maintenanceUntil: {
      type: Date,
      default: null,
    },
    registrationOpen: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);

export default SystemSetting;
