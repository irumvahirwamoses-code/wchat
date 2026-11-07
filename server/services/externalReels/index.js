import { searchPexels } from './pexels.js';
import { searchPixabay } from './pixabay.js';
import { getCache, setCache, makeKey } from './cache.js';

const DEFAULT_QUERIES = ['kigali city', 'africa lifestyle', 'technology workspace', 'sports training', 'creative studio', 'nature portrait'];

function normalize(raw) {
  if (!raw?.src) return null;
  const provider = raw.provider || 'external';
  const pid = String(raw.id || raw.src);
  const id = `ext:${provider}:${pid}`;
  const name = raw.user?.name || provider;
  const hashtags = Array.isArray(raw.tags) ? raw.tags.slice(0, 6) : [];
  const reason = `From ${provider.charAt(0).toUpperCase() + provider.slice(1)}`;
  return {
    _id: id,
    kind: 'reel',
    source: { provider, id: raw.id, url: raw.url || '', authorName: name, authorUrl: raw.user?.url || '' },
    title: raw.title || 'External reel',
    description: '',
    hashtags,
    tags: hashtags,
    clips: [{ src: raw.src, duration: raw.duration || 0, trimStart: 0, trimEnd: raw.duration || 0, speed: 1 }],
    media: raw.src,
    cover: raw.cover || '',
    visibility: 'public',
    author: {
      _id: `ext-author:${provider}:${pid}`,
      firstName: name,
      lastName: '',
      username: provider,
      profilePicture: '',
      preferences: { allowShareToStories: true, allowDownload: true, allowRemix: false },
    },
    chat: null,
    sparks: [],
    sparkCount: 0,
    viewCount: 0,
    createdAt: new Date().toISOString(),
    reasonCode: 'external',
    reason,
    reasonDetail: name,
    isMember: false,
    isExternal: true,
  };
}

export async function fetchExternalReels({ query, page = 1, perPage = 8 } = {}) {
  const q = (query && String(query).trim()) || DEFAULT_QUERIES[Math.floor(Math.random() * DEFAULT_QUERIES.length)];
  const key = makeKey('ext', q, page, perPage);
  const cached = getCache(key, 15 * 60 * 1000);
  if (cached) return cached;

  const [pexels, pixabay] = await Promise.all([
    searchPexels({ query: q, page, perPage }).catch(() => []),
    searchPixabay({ query: q, page, perPage }).catch(() => []),
  ]);

  // interleave providers
  const mixed = [];
  const max = Math.max(pexels.length, pixabay.length);
  for (let i = 0; i < max; i++) {
    if (pexels[i]) mixed.push(pexels[i]);
    if (pixabay[i]) mixed.push(pixabay[i]);
  }
  const result = mixed.map(normalize).filter(Boolean).slice(0, perPage);
  setCache(key, result);
  return result;
}
