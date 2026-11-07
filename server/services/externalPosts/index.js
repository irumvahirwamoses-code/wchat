import { searchPexels } from '../externalReels/pexels.js';
import { searchPixabay } from '../externalReels/pixabay.js';
import { getCache, setCache, makeKey } from './cache.js';

const DEFAULT_QUERIES = ['community life', 'africa city', 'technology people', 'sports culture', 'creative work', 'nature travel'];

function normalize(raw) {
  if (!raw?.src) return null;
  const provider = raw.provider || 'external';
  const pid = String(raw.id || raw.src);
  const id = `ext:${provider}:post:${pid}`;
  const name = raw.user?.name || provider;
  const hashtags = Array.isArray(raw.tags) ? raw.tags.slice(0, 6) : [];
  return {
    _id: id,
    isExternal: true,
    source: { provider, id: raw.id, url: raw.url || '', authorName: name, authorUrl: raw.user?.url || '' },
    author: {
      _id: `ext-author:${provider}:${pid}`,
      firstName: name,
      lastName: '',
      username: provider,
      profilePicture: '',
      preferences: { allowShareToStories: false, allowDownload: false, allowRemix: false },
    },
    circle: null,
    text: raw.title || `A moment from ${name}`,
    media: raw.src,
    mediaType: 'video',
    fileName: '',
    fileSize: 0,
    mediaItems: [{ url: raw.src, type: 'video', fileName: '' }],
    items: [{ url: raw.src, type: 'video', fileName: '' }],
    location: '',
    tags: hashtags,
    interests: hashtags,
    collaborators: [],
    audio: null,
    sparks: [],
    savedBy: [],
    sparkCount: 0,
    commentCount: 0,
    shareCount: 0,
    createdAt: new Date().toISOString(),
    reasonCode: 'external',
    reason: `From ${provider.charAt(0).toUpperCase() + provider.slice(1)}`,
    reasonDetail: name,
  };
}

export async function fetchExternalPosts({ query, page = 1, perPage = 6 } = {}) {
  const q = (query && String(query).trim()) || DEFAULT_QUERIES[Math.floor(Math.random() * DEFAULT_QUERIES.length)];
  const key = makeKey('ext-post', q, page, perPage);
  const cached = getCache(key, 15 * 60 * 1000);
  if (cached) return cached;

  const [pexels, pixabay] = await Promise.all([
    searchPexels({ query: q, page, perPage }).catch(() => []),
    searchPixabay({ query: q, page, perPage }).catch(() => []),
  ]);
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
