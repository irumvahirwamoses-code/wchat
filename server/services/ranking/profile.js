import UserInterestProfile from '../../models/UserInterestProfile.js';
import { EVENT_WEIGHTS, RANKING } from './config.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const unique = (list) => [...new Set(list.filter(Boolean))];

function upsertScore(list, key, signal, alpha, cap) {
  if (!key) return;
  const current = list.find((entry) => entry.key === key);
  const next = current
    ? current.score * (1 - alpha) + signal * alpha
    : signal * alpha * 2; // give the first signal a little more weight
  const bounded = clamp(next, -cap, cap);
  if (current) current.score = bounded;
  else list.push({ key, score: bounded });
}

function incrementCount(list, key, by = 1) {
  const current = list.find((entry) => entry.key === key);
  if (current) current.count += by;
  else list.push({ key, count: by });
}

/** Multiply every stored score by `factor` (daily decay). */
function decayScores(list, factor) {
  for (const entry of list) entry.score *= factor;
}

/** Keep only the strongest keys so the document cannot grow forever. */
function pruneScores(list, max = RANKING.maxProfileKeys) {
  const magnitude = (entry) => Math.abs(entry.score ?? entry.count ?? 0);
  list.sort((a, b) => magnitude(b) - magnitude(a));
  if (list.length > max) list.splice(max);
}

function addHidden(list, id, max) {
  if (!id) return;
  const key = String(id);
  const index = list.findIndex((value) => String(value) === key);
  if (index !== -1) list.splice(index, 1);
  list.push(id);
  if (list.length > max) list.splice(0, list.length - max);
}

function rememberSeen(profile, itemId) {
  if (!itemId) return;
  const key = String(itemId);
  profile.recentItems = (profile.recentItems || []).filter(
    (entry) => String(entry.item) !== key
  );
  profile.recentItems.push({ item: itemId, at: new Date() });
  if (profile.recentItems.length > RANKING.maxRecentItems) {
    profile.recentItems.splice(0, profile.recentItems.length - RANKING.maxRecentItems);
  }
}

/** Load a profile, creating a blank one the first time. */
export async function getProfile(userId) {
  try {
    return await UserInterestProfile.findOneAndUpdate(
      { user: userId },
      { $setOnInsert: { user: userId, lastDecayAt: new Date() } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
  } catch (error) {
    // Two tabs can race to create the first profile. The loser should read the
    // winner's document instead of failing the whole batch.
    if (error?.code === 11000) {
      return UserInterestProfile.findOne({ user: userId });
    }
    throw error;
  }
}

/** Fetch without writing — useful for read-only ranking requests. */
export async function findProfile(userId) {
  return UserInterestProfile.findOne({ user: userId }).lean();
}

function applyOneEvent(profile, event) {
  const eventType = event.eventType;
  let signal = EVENT_WEIGHTS[eventType] ?? 0;

  if (eventType === 'dwell') {
    signal = EVENT_WEIGHTS.dwell * Math.min(1, (event.dwellMs || 0) / 30000);
  }

  incrementCount(profile.eventCounts, eventType);

  if (eventType === 'impression' || eventType === 'view' || eventType === 'dwell') {
    rememberSeen(profile, event.itemId);
  }

  // Explicit negative feedback is a hard filter, not just a lower score.
  if (['hide', 'not_interested', 'report'].includes(eventType)) {
    addHidden(profile.hiddenItemIds, event.itemId, RANKING.maxHiddenItems);
  }
  if (['report', 'block'].includes(eventType) && event.author) {
    addHidden(profile.hiddenAuthorIds, event.author, RANKING.maxHiddenAuthors);
  }

  if (!signal) return;

  const tags = unique(
    [...(event.tags || []), ...(event.interests || [])].map((tag) =>
      String(tag).trim().toLowerCase()
    )
  );

  for (const tag of tags) {
    upsertScore(profile.tagScores, tag, signal, RANKING.tagAlpha, RANKING.profileCap);
  }
  if (event.author) {
    upsertScore(
      profile.creatorScores,
      String(event.author),
      signal,
      RANKING.creatorAlpha,
      RANKING.profileCap
    );
  }
  if (event.circle) {
    upsertScore(
      profile.circleScores,
      String(event.circle),
      signal,
      RANKING.circleAlpha,
      RANKING.profileCap
    );
  }
}

/** True when at least one event can change learned taste (impressions cannot). */
export function hasProfileSignal(events = []) {
  return events.some((event) => (EVENT_WEIGHTS[event.eventType] ?? 0) !== 0);
}

/**
 * Fold a batch of events into one user's profile.
 * Returns the updated profile (or null when there was nothing to do).
 */
export async function applyEventsToProfile(userId, events = []) {
  if (!events.length) return null;

  const profile = await getProfile(userId);
  if (!profile) return null;

  const now = new Date();

  // Decay lazily: only pay the cost when at least a day has passed.
  const lastDecay = profile.lastDecayAt ? new Date(profile.lastDecayAt).getTime() : now.getTime();
  const days = (now.getTime() - lastDecay) / (1000 * 60 * 60 * 24);
  if (days >= 1) {
    const factor = Math.pow(RANKING.dailyDecay, Math.floor(days));
    decayScores(profile.tagScores, factor);
    decayScores(profile.creatorScores, factor);
    decayScores(profile.circleScores, factor);
    profile.lastDecayAt = now;
  }

  for (const event of events) applyOneEvent(profile, event);

  pruneScores(profile.tagScores);
  pruneScores(profile.creatorScores);
  pruneScores(profile.circleScores);
  pruneScores(profile.eventCounts, 40);

  profile.lastEventAt = now;
  profile.version = (profile.version || 0) + 1;

  await profile.save();
  return profile;
}

/** "Reset my recommendations" — keeps hidden filters, clears learned taste. */
export async function resetProfile(userId) {
  return UserInterestProfile.findOneAndUpdate(
    { user: userId },
    {
      $set: {
        tagScores: [],
        creatorScores: [],
        circleScores: [],
        eventCounts: [],
        recentItems: [],
        lastDecayAt: new Date(),
        lastEventAt: null,
      },
      $inc: { version: 1 },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
}

/** Small JSON-safe view used by the admin debug endpoint. */
export function summariseProfile(profile) {
  if (!profile) return null;
  const top = (list, n = 8) =>
    [...(list || [])]
      .sort((a, b) => Math.abs(b.score ?? b.count ?? 0) - Math.abs(a.score ?? a.count ?? 0))
      .slice(0, n)
      .map((entry) => ({
        key: entry.key,
        value: entry.score ?? entry.count ?? 0,
      }));

  return {
    tags: top(profile.tagScores),
    creators: top(profile.creatorScores),
    circles: top(profile.circleScores),
    eventCounts: top(profile.eventCounts, 12),
    hiddenItems: (profile.hiddenItemIds || []).length,
    hiddenAuthors: (profile.hiddenAuthorIds || []).length,
    recentItems: (profile.recentItems || []).length,
    lastEventAt: profile.lastEventAt || null,
    version: profile.version || 0,
  };
}

export default {
  getProfile,
  findProfile,
  applyEventsToProfile,
  hasProfileSignal,
  resetProfile,
  summariseProfile,
};
