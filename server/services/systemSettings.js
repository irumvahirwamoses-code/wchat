import SystemSetting from '../models/SystemSetting.js';

let cache = { value: null, at: 0 };
const TTL_MS = 5000;

const DEFAULTS = {
  maintenanceEnabled: false,
  maintenanceMessage:
    'Wchat is temporarily unavailable while we make improvements. Please check back soon.',
  maintenanceUntil: null,
  registrationOpen: true,
};

/**
 * The platform switches (maintenance mode etc). Cached for a few seconds so we
 * can consult it on every API call without hammering MongoDB.
 */
export async function getSystemSettings({ force = false } = {}) {
  if (!force && cache.value && Date.now() - cache.at < TTL_MS) {
    return cache.value;
  }
  let doc = await SystemSetting.findOne({ key: 'global' }).lean();
  if (!doc) {
    doc = await SystemSetting.create({ key: 'global', ...DEFAULTS });
    doc = doc.toObject();
  }
  cache = { value: doc, at: Date.now() };
  return doc;
}

export function invalidateSystemSettings() {
  cache = { value: null, at: 0 };
}

/** True while the maintenance window is active (respecting auto-expiry). */
export function isMaintenanceActive(settings) {
  if (!settings?.maintenanceEnabled) return false;
  if (settings.maintenanceUntil && new Date(settings.maintenanceUntil).getTime() < Date.now()) {
    return false;
  }
  return true;
}

export { DEFAULTS as SYSTEM_DEFAULTS };
