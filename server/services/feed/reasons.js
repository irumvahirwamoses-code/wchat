const sameId = (a, b) => String(a?._id || a || '') === String(b?._id || b || '');

/**
 * Explain *why* a post is in someone's stream, the way Instagram's "Why you're
 * seeing this" works.
 *
 *  - `reason`       → the short sentence shown under the post
 *  - `reasonCode`   → stable key the client maps to an icon + explainer
 *  - `reasonDetail` → the specific Circle / person / tag behind the decision
 */
export function decorateReason(post, { userId, chatIds = [], following = [] }) {
  const plain = post.toObject ? post.toObject({ virtuals: true }) : { ...post };

  if (sameId(plain.author, userId)) {
    return { ...plain, reason: 'Your post', reasonCode: 'self', reasonDetail: '' };
  }

  if (plain.circle && chatIds.some((id) => sameId(id, plain.circle))) {
    const name = plain.circle?.chatName || 'a Circle you joined';
    return { ...plain, reason: `From ${name}`, reasonCode: 'circle', reasonDetail: name };
  }

  if (following.some((id) => sameId(id, plain.author))) {
    const handle = plain.author?.username ? `@${plain.author.username}` : 'this creator';
    return {
      ...plain,
      reason: `Because you follow ${handle}`,
      reasonCode: 'creator',
      reasonDetail: handle,
    };
  }

  if (plain.tags?.length) {
    return {
      ...plain,
      reason: `Because you're into #${plain.tags[0]}`,
      reasonCode: 'tag',
      reasonDetail: `#${plain.tags[0]}`,
    };
  }

  if (plain.location) {
    return {
      ...plain,
      reason: `Happening in ${plain.location}`,
      reasonCode: 'nearby',
      reasonDetail: plain.location,
    };
  }

  return {
    ...plain,
    reason: 'Trending in Rwanda right now',
    reasonCode: 'trending',
    reasonDetail: '',
  };
}

export default decorateReason;
