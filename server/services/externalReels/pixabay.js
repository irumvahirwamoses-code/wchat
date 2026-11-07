const PIXABAY_BASE = 'https://pixabay.com/api/videos/';

function pickMp4(hits = []) {
  // Pixabay returns videos in different sizes; prefer medium/small portrait or mp4
  for (const h of hits) {
    if (h && h.url) return h.url;
    if (h && h.tiny?.url) return h.tiny.url;
    if (h && h.small?.url) return h.small.url;
    if (h && h.medium?.url) return h.medium.url;
  }
  return null;
}

export async function searchPixabay({ query, page = 1, perPage = 12 } = {}) {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) return [];
  const url = new URL(PIXABAY_BASE);
  url.searchParams.set('key', apiKey);
  if (query) url.searchParams.set('q', query);
  url.searchParams.set('per_page', String(Math.min(perPage, 15)));
  url.searchParams.set('page', String(page));
  url.searchParams.set('safesearch', 'true');

  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = await res.json();
  const hits = Array.isArray(data.hits) ? data.hits : [];
  return hits
    .map((h) => {
      const v = h.videos || {};
      const src = v.large?.url || v.medium?.url || v.small?.url || v.tiny?.url || null;
      if (!src) return null;
      return {
        provider: 'pixabay',
        id: h.id,
        src,
        cover: h.picture_id ? `https://i.vimeocdn.com/video/${h.picture_id}_640x360.jpg` : (h.userImageURL || ''),
        duration: Number(h.duration) || 0,
        width: v.large?.width || v.medium?.width || 0,
        height: v.large?.height || v.medium?.height || 0,
        user: h.user ? { name: h.user, url: `https://pixabay.com/users/${h.user}-${h.user_id || ''}/` } : null,
        tags: (h.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
        title: h.tags ? `Pixabay · ${h.tags.split(',')[0].trim()}` : 'Pixabay reel',
        url: h.pageURL || `https://pixabay.com/videos/id-${h.id}/`,
      };
    })
    .filter(Boolean);
}
