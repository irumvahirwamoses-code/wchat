/**
 * Every tunable number in the feed lives here.
 *
 * The point of this file is that you can change the ranker's behaviour without
 * reading the ranker. Keep comments next to a weight when you change it.
 */

/** How much each event says about a person's taste. */
export const EVENT_WEIGHTS = {
  impression: 0, // exposure alone is not a signal
  view: 0.3,
  dwell: 0.2, // scaled by dwellMs (capped at 30s)
  video_start: 0.1,
  video_complete: 1.5,
  skip: -0.5,

  spark: 1.0,
  unspark: -1.0,
  comment: 2.0,
  save: 3.0,
  unsave: -1.5,
  share: 3.0,
  click: 1.5,
  join: 4.0,
  follow: 3.0,
  profile_click: 2.0,
  more_like_this: 3.0,

  hide: -3.0,
  not_interested: -5.0,
  less_like_this: -3.0,
  report: -10.0,
  block: -10.0,
  mute_source: -5.0,
  scroll_past_fast: -0.5,
};

export const RANKING = {
  /** Learning rates: lower = slower, steadier. */
  tagAlpha: 0.25,
  creatorAlpha: 0.15,
  circleAlpha: 0.15,

  /** Hard bound for every stored score. */
  profileCap: 5,
  /** Keep the profile small — at most this many keys per dimension. */
  maxProfileKeys: 200,
  /** Multiply every score by this per full day without events. */
  dailyDecay: 0.98,

  /** How many event items we remember for "already seen". */
  maxRecentItems: 300,
  maxHiddenItems: 500,
  maxHiddenAuthors: 200,

  /** Normalise raw scores into a 0..1 feature. */
  scoreScale: 2,

  /** Freshness half-life in hours. */
  freshnessHalfLife: 48,

  /** Candidate pool sizes. */
  circleCandidates: 300,
  followingCandidates: 200,
  discoveryCandidates: 200,
  lookbackDays: 14,
};

export const HOME_WEIGHTS = {
  interest: 0.26,
  affinity: 0.16,
  freshness: 0.15,
  velocity: 0.12,
  locality: 0.1,
  typeAffinity: 0.08,
  language: 0.05,
  quality: 0.05,
  exploration: 0.03,
};

export const PENALTIES = {
  /** Soft penalty for an item shown in the last 24h. */
  seenRecently: 0.08,
  /** Hard filters. */
  hidden: Infinity,
  reported: Infinity,
  mutedSource: Infinity,
};

export const CAPS = {
  /** Per page of `limit` items. */
  maxPerAuthorPerPage: 2,
  maxPerCirclePerPage: 3,
  /** Do not place the same author twice in a row. */
  maxConsecutiveSameAuthor: 1,
  explorationShare: 0.12,
};

export default {
  EVENT_WEIGHTS,
  RANKING,
  HOME_WEIGHTS,
  PENALTIES,
  CAPS,
};
