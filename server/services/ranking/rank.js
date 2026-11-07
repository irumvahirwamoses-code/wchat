import Post from '../../models/Post.js';
import Chat from '../../models/Chat.js';
import User from '../../models/User.js';
import FeedEvent from '../../models/FeedEvent.js';
import { findProfile } from './profile.js';
import { HOME_WEIGHTS, RANKING, CAPS, PENALTIES } from './config.js';

const AUTHOR_FIELDS =
  'firstName lastName username profilePicture isOnline lastSeen accountType preferences.allowRemix preferences.allowShareToStories preferences.allowDownload';
const CIRCLE_FIELDS = 'chatName groupAvatar circleType';

const POST_FIELDS =
  'author circle text media mediaType fileName fileSize mediaItems location tags interests collaborators createdAt archivedAt sparks savedBy commentCount shareCount pinnedAt audio';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const sameId = (a, b) => String(a?._id || a || '') === String(b?._id || b || '');
const asKey = (value) => String(value?._id || value || '');

/** Map an unbounded learned score into a 0..1 feature (0.5 = neutral). */
const unitScore = (raw) =>
  clamp((Math.tanh((raw || 0) / RANKING.scoreScale) + 1) / 2, 0, 1);

/** Deterministic jitter, so pagination does not reshuffle between requests. */
function hashUnit(input) {
  let hash = 2166136261;
  const text = String(input || '');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function scoreMap(list) {
  const map = new Map();
  for (const entry of list || []) map.set(entry.key, entry.score ?? entry.count ?? 0);
  return map;
}

/**
 * Load the graph context once per request: Circles, following, blocked people,
 * private accounts that should not leak into discovery, and declared interests.
 */
export async function loadFeedContext(user) {
  const userId = user._id;
  const seenSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [chats, privateAccounts, fresh, recentItemIds] = await Promise.all([
    Chat.find({ users: userId, isGroupChat: true }).select('_id').lean(),
    User.find({ isPrivate: true, _id: { $nin: [userId] } })
      .select('_id')
      .lean(),
    User.findById(userId)
      .select('following blocked interests address language')
      .lean(),
    FeedEvent.distinct('itemId', {
      user: userId,
      eventType: { $in: ['impression', 'view', 'dwell'] },
      createdAt: { $gte: seenSince },
    }),
  ]);

  const following = (fresh?.following || user.following || []).map(String);
  const followingSet = new Set(following);
  const privateAuthorIds = privateAccounts
    .filter((account) => !followingSet.has(String(account._id)))
    .map((account) => account._id);

  return {
    userId,
    chatIds: chats.map((chat) => chat._id),
    following,
    followingSet,
    privateAuthorIds,
    blockedIds: (fresh?.blocked || user.blocked || []).map(String),
    interests: (fresh?.interests || user.interests || []).map((tag) =>
      String(tag).trim().toLowerCase()
    ),
    city: String(fresh?.address?.city || user.address?.city || '').trim().toLowerCase(),
    language: fresh?.language || user.language || 'rw',
    seenItemIds: new Set((recentItemIds || []).map(String)),
  };
}

async function fetchGraphPosts(context) {
  const since = new Date(Date.now() - RANKING.lookbackDays * 24 * 60 * 60 * 1000);

  // Blocked authors are excluded everywhere. Private accounts are different:
  // membership of a Circle grants visibility to that Circle's posts, so a
  // private author's Circle post must still reach fellow members.
  const visibility = {
    archivedAt: null,
    createdAt: { $gte: since },
    author: { $nin: context.blockedIds },
  };

  const [circlePosts, followingPosts] = await Promise.all([
    Post.find({
      ...visibility,
      circle: { $in: context.chatIds },
    })
      .select(POST_FIELDS)
      .sort('-createdAt')
      .limit(RANKING.circleCandidates)
      .populate('author', AUTHOR_FIELDS)
      .populate('circle', CIRCLE_FIELDS),
    Post.find({
      ...visibility,
      circle: null,
      author: {
        $in: [...context.following, context.userId].filter(
          (id) => Boolean(id) && !context.blockedIds.includes(String(id))
        ),
      },
    })
      .select(POST_FIELDS)
      .sort('-createdAt')
      .limit(RANKING.followingCandidates)
      .populate('author', AUTHOR_FIELDS)
      .populate('circle', CIRCLE_FIELDS),
  ]);

  return [...circlePosts, ...followingPosts];
}

async function fetchDiscoveryPosts(context) {
  const since = new Date(Date.now() - RANKING.lookbackDays * 24 * 60 * 60 * 1000);
  const excluded = [
    ...context.privateAuthorIds,
    ...context.blockedIds,
    context.userId,
  ];

  return Post.find({
    archivedAt: null,
    circle: null,
    createdAt: { $gte: since },
    author: { $nin: excluded },
  })
    .select(POST_FIELDS)
    .sort('-createdAt')
    .limit(RANKING.discoveryCandidates)
    .populate('author', AUTHOR_FIELDS)
    .populate('circle', CIRCLE_FIELDS);
}

function dedupeById(posts) {
  const seen = new Set();
  const result = [];
  for (const post of posts) {
    const key = String(post._id);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(post);
  }
  return result;
}

/**
 * Fetch a bounded, visibility-safe candidate pool.
 * `for_you` adds a fresh public pool; `following` is the chronological escape hatch.
 */
export async function buildCandidates(user, { tab = 'for_you' } = {}) {
  const context = await loadFeedContext(user);
  const profile = await findProfile(context.userId);

  const graphPosts = await fetchGraphPosts(context);
  const discoveryPosts =
    tab === 'for_you' ? await fetchDiscoveryPosts(context) : [];

  const hiddenItems = new Set((profile?.hiddenItemIds || []).map(String));
  const hiddenAuthors = new Set((profile?.hiddenAuthorIds || []).map(String));

  const candidates = dedupeById([...graphPosts, ...discoveryPosts]).filter((post) => {
    const authorId = asKey(post.author);
    return !hiddenItems.has(String(post._id)) && !hiddenAuthors.has(authorId);
  });

  return {
    candidates,
    profile,
    context,
    pool: {
      graph: graphPosts.length,
      discovery: discoveryPosts.length,
      usable: candidates.length,
    },
  };
}

function interestRaw(post, profile, context) {
  const tagScores = scoreMap(profile?.tagScores);
  const tags = [
    ...(post.tags || []),
    ...(post.interests || []),
  ].map((tag) => String(tag).trim().toLowerCase());

  let raw = 0;
  for (const tag of tags) raw += tagScores.get(tag) || 0;
  if (tags.length) raw /= tags.length;

  // Cold start: declared onboarding interests are a strong explicit signal.
  const declared = tags.filter((tag) => context.interests.includes(tag));
  if (declared.length) raw = Math.max(raw, 1.2);
  return raw;
}

function topMatchedTag(post, profile, context) {
  const tagScores = scoreMap(profile?.tagScores);
  const tags = [...(post.tags || []), ...(post.interests || [])].map((tag) =>
    String(tag).trim().toLowerCase()
  );
  let best = null;
  let bestScore = -Infinity;
  for (const tag of tags) {
    const value = tagScores.get(tag) || (context.interests.includes(tag) ? 1 : 0);
    if (value > bestScore) {
      bestScore = value;
      best = tag;
    }
  }
  return best ? { tag: best, score: bestScore } : null;
}

/** Compute every ranking feature for one post. Exposed for the debug endpoint. */
export function computeFeatures(post, { profile, context, position = 0 }) {
  const ageHours = Math.max(
    0,
    (Date.now() - new Date(post.createdAt).getTime()) / (60 * 60 * 1000)
  );
  const freshness = Math.exp(-ageHours / RANKING.freshnessHalfLife);

  const interestSignal = interestRaw(post, profile, context);
  const interest = unitScore(interestSignal);

  const creatorRaw = scoreMap(profile?.creatorScores).get(asKey(post.author)) || 0;
  const isFollowing = context.followingSet.has(asKey(post.author));
  let affinity = unitScore(creatorRaw);
  if (isFollowing) affinity = Math.max(affinity, 0.65);

  const circleId = asKey(post.circle);
  const circleRaw = circleId ? scoreMap(profile?.circleScores).get(circleId) || 0 : 0;
  const isMyCircle = Boolean(circleId) && context.chatIds.some((id) => sameId(id, circleId));
  if (isMyCircle) affinity = Math.max(affinity, 0.75, unitScore(circleRaw));

  const engagement =
    (post.sparks?.length || 0) +
    (post.commentCount || 0) * 2 +
    (post.savedBy?.length || 0) * 2 +
    (post.shareCount || 0) * 2;
  const velocity = clamp(
    Math.log1p(engagement / Math.max(ageHours, 1)) / Math.log1p(10),
    0,
    1
  );

  const location = String(post.location || '').trim().toLowerCase();
  let locality = 0.3;
  if (location) locality = context.city && location.includes(context.city) ? 1 : 0.2;
  else if (post.circle) locality = 0.4;

  const hasMedia = Boolean(post.media) || (post.mediaItems?.length || 0) > 0;
  const typeAffinity = hasMedia ? 0.8 : 0.55;

  // Posts do not carry a language field yet; keep a neutral value until they do.
  const language = 0.5;
  const quality = post.author?.accountType === 'business' ? 0.65 : 0.5;
  const exploration = hashUnit(`${context.userId}:${post._id}`);

  const seenRecently =
    context.seenItemIds?.has(String(post._id)) ||
    (profile?.recentItems || []).some(
      (entry) =>
        String(entry.item) === String(post._id) &&
        Date.now() - new Date(entry.at).getTime() < 24 * 60 * 60 * 1000
    );
  const seenPenalty = seenRecently ? PENALTIES.seenRecently : 0;

  const score =
    HOME_WEIGHTS.interest * interest +
    HOME_WEIGHTS.affinity * affinity +
    HOME_WEIGHTS.freshness * freshness +
    HOME_WEIGHTS.velocity * velocity +
    HOME_WEIGHTS.locality * locality +
    HOME_WEIGHTS.typeAffinity * typeAffinity +
    HOME_WEIGHTS.language * language +
    HOME_WEIGHTS.quality * quality +
    HOME_WEIGHTS.exploration * exploration -
    seenPenalty;

  return {
    score,
    ageHours,
    seenRecently,
    features: {
      interest,
      affinity,
      freshness,
      velocity,
      locality,
      typeAffinity,
      language,
      quality,
      exploration,
      seenPenalty,
    },
    signals: {
      interestRaw: interestSignal,
      creatorRaw,
      circleRaw,
      isFollowing,
      isMyCircle,
      hasMedia,
      position,
    },
  };
}

/** Pick the most useful explanation for a ranked post. */
export function pickReason(post, info, { context }) {
  if (sameId(post.author, context.userId)) {
    return { reason: 'Your post', reasonCode: 'self', reasonDetail: '' };
  }

  if (info.signals.isMyCircle) {
    const name = post.circle?.chatName || 'a Circle you joined';
    return { reason: `From ${name}`, reasonCode: 'circle', reasonDetail: name };
  }

  if (info.signals.isFollowing || info.signals.creatorRaw > 0.4) {
    const handle = post.author?.username ? `@${post.author.username}` : 'this creator';
    return {
      reason: `Because you follow ${handle}`,
      reasonCode: 'creator',
      reasonDetail: handle,
    };
  }

  const matched = topMatchedTag(post, info.profile, context);
  if (matched && matched.score > 0.2) {
    return {
      reason: `Because you're into #${matched.tag}`,
      reasonCode: 'tag',
      reasonDetail: `#${matched.tag}`,
    };
  }

  if (post.location) {
    return {
      reason: `Happening in ${post.location}`,
      reasonCode: 'nearby',
      reasonDetail: post.location,
    };
  }

  return {
    reason: 'Trending in Rwanda right now',
    reasonCode: 'trending',
    reasonDetail: '',
  };
}

/**
 * Order ranked candidates with simple diversity caps:
 * no author twice in a row, at most 2 posts per author and 3 per Circle
 * within a page-sized window. Deterministic for a given candidate set.
 */
function applyDiversity(sorted, limit) {
  const selected = [];
  const deferred = [];

  const sameCircle = (a, b) => {
    const left = asKey(a);
    const right = asKey(b);
    return Boolean(left) && left === right;
  };

  for (const item of sorted) {
    const window = selected.slice(-Math.max(1, limit));
    const sameAuthorInWindow = window.filter((entry) =>
      sameId(entry.post.author, item.post.author)
    ).length;
    const sameCircleInWindow = window.filter((entry) =>
      sameCircle(entry.post.circle, item.post.circle)
    ).length;
    const last = selected[selected.length - 1];

    if (sameAuthorInWindow >= CAPS.maxPerAuthorPerPage) {
      deferred.push(item);
      continue;
    }
    if (sameCircleInWindow >= CAPS.maxPerCirclePerPage) {
      deferred.push(item);
      continue;
    }
    if (last && sameId(last.post.author, item.post.author)) {
      deferred.push(item);
      continue;
    }
    selected.push(item);
  }

  return [...selected, ...deferred];
}

/**
 * Rank candidates. Returns the requested page plus the explanation metadata.
 */
export function rankCandidates(
  candidates,
  { profile, context, page = 1, limit = 10, includeRank = false }
) {
  const ranked = candidates
    .map((post) => {
      const info = computeFeatures(post, { profile, context });
      return {
        post,
        ...info,
        profile,
      };
    })
    .sort((a, b) => b.score - a.score);

  const ordered = applyDiversity(ranked, limit);
  const offset = Math.max(0, (page - 1) * limit);
  const pageItems = ordered.slice(offset, offset + limit);

  const items = pageItems.map((entry, index) => {
    const reason = pickReason(entry.post, entry, { context });
    const plain = entry.post.toObject
      ? entry.post.toObject({ virtuals: true })
      : { ...entry.post };
    return {
      ...plain,
      ...reason,
      ...(includeRank
        ? {
            rank: {
              score: Number(entry.score.toFixed(4)),
              position: offset + index,
            },
          }
        : {}),
    };
  });

  return {
    posts: items,
    total: ordered.length,
    hasMore: offset + limit < ordered.length,
  };
}

/** Debug helper: explain one item for one viewer, with every feature exposed. */
export async function explainPost(post, user) {
  const context = await loadFeedContext(user);
  const profile = await findProfile(user._id);
  const plain = post.toObject ? post.toObject({ virtuals: true }) : post;
  const info = computeFeatures(plain, { profile, context });
  return {
    ...info,
    reason: pickReason(plain, { ...info, profile }, { context }),
    profile: { userId: context.userId, interests: context.interests, city: context.city },
  };
}

export default {
  loadFeedContext,
  buildCandidates,
  computeFeatures,
  rankCandidates,
  pickReason,
  explainPost,
};
