import { searchPexels } from '../externalReels/pexels.js';
import { searchPixabay } from '../externalReels/pixabay.js';
import { getCache, setCache, makeKey } from './cache.js';

const DEFAULT_QUERIES = ['community life', 'africa city', 'technology people', 'sports culture', 'creative work', 'nature travel'];

async function searchPixabayImages({ query, page = 1, perPage = 6 } = {}) {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) return [];
  const url = new URL('https://pixabay.com/api/');
  url.searchParams.set('key', apiKey);
  if (query) url.searchParams.set('q', query);
  url.searchParams.set('per_page', String(Math.min(perPage, 12)));
  url.searchParams.set('page', String(page));
  url.searchParams.set('safesearch', 'true');
  url.searchParams.set('image_type', 'photo');
  const res = await fetch(url.toString()).catch(() => null);
  if (!res?.ok) return [];
  const data = await res.json().catch(() => null);
  const hits = Array.isArray(data?.hits) ? data.hits : [];
  return hits.map((h) => ({
    provider: 'pixabay', id: h.id, type: 'image',
    src: h.largeImageURL || h.webformatURL || h.previewURL,
    cover: h.webformatURL || h.previewURL || '',
    user: h.user ? { name: h.user, url: `https://pixabay.com/users/${h.user}-${h.user_id || ''}/` } : null,
    tags: String(h.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
    title: h.tags ? 'Photo · ' + h.tags.split(',')[0].trim() : 'Pixabay photo',
    url: h.pageURL || '',
  })).filter((x) => x.src);
}

async function searchPexelsPhotos({ query, page = 1, perPage = 6 } = {}) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return [];
  const url = new URL('https://api.pexels.com/v1/search');
  if (query) url.searchParams.set('query', query);
  url.searchParams.set('per_page', String(Math.min(perPage, 12)));
  url.searchParams.set('page', String(page));
  const res = await fetch(url.toString(), { headers: { Authorization: apiKey } }).catch(() => null);
  if (!res?.ok) return [];
  const data = await res.json().catch(() => null);
  const photos = Array.isArray(data?.photos) ? data.photos : [];
  return photos.map((p) => ({
    provider: 'pexels', id: p.id, type: 'image',
    src: p.src?.large2x || p.src?.large || p.src?.original || p.src?.medium,
    cover: p.src?.medium || p.src?.small || '',
    user: p.photographer ? { name: p.photographer, url: p.photographer_url || '' } : null,
    tags: [],
    title: p.photographer ? 'Photo by ' + p.photographer : 'Pexels photo',
    url: p.url || '',
  })).filter((x) => x.src);
}

function normalize(raw) {
  if (!raw?.src) return null;
  const provider = raw.provider || 'external';
  const pid = String(raw.id || raw.src);
  const type = raw.type === 'image' ? 'image' : 'video';
  const id = `ext:${provider}:${type}:post:${pid}`;
  const name = raw.user?.name || provider;
  const hashtags = Array.isArray(raw.tags) ? raw.tags.slice(0, 6) : [];
  const item = { url: raw.src, type, fileName: '' };
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
    mediaType: type,
    fileName: '',
    fileSize: 0,
    mediaItems: [item],
    items: [item],
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
  const key = makeKey('ext-post-v3', q, page, perPage);
  const cached = getCache(key, 15 * 60 * 1000);
  if (cached) return cached;

  const half = Math.max(2, Math.ceil(perPage / 2));
  const [pixabayVideo, pixabayImage, pexelsVideo, pexelsImage] = await Promise.all([
    searchPixabay({ query: q, page, perPage: half }).catch(() => []),
    searchPixabayImages({ query: q, page, perPage: half }).catch(() => []),
    searchPexels({ query: q, page, perPage: half }).catch(() => []),
    searchPexelsPhotos({ query: q, page, perPage: half }).catch(() => []),
  ]);
  const buckets = [pixabayImage, pixabayVideo, pexelsImage, pexelsVideo].filter((a) => a?.length);
  const mixed = [];
  const max = Math.max(0, ...buckets.map((b) => b.length));
  for (let i = 0; i < max; i++) for (const b of buckets) if (b[i]) mixed.push(b[i]);
  const result = mixed.map(normalize).filter(Boolean).slice(0, perPage);
  setCache(key, result);
  return result;
}
