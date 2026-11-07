const PEXELS_BASE = 'https://api.pexels.com/videos';

function pickMp4(files = []) {
  if (!Array.isArray(files) || files.length === 0) return null;
  const mp4 = files.filter((f) => f && f.link && String(f.file_type).includes('mp4'));
  if (mp4.length === 0) return null;
  // prefer smaller/portrait-friendly or just first reasonable
  mp4.sort((a, b) => (Number(b.width || 0) - Number(a.width || 0)));
  return mp4[0]?.link || mp4[mp4.length - 1]?.link || null;
}

export async function searchPexels({ query, page = 1, perPage = 12, orientation = 'portrait' } = {}) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return [];
  const url = new URL(`${PEXELS_BASE}/search`);
  if (query) url.searchParams.set('query', query);
  url.searchParams.set('per_page', String(Math.min(perPage, 15)));
  url.searchParams.set('page', String(page));
  if (orientation) url.searchParams.set('orientation', orientation);

  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const videos = Array.isArray(data.videos) ? data.videos : [];
  return videos
    .map((v) => {
      const src = pickMp4(v.video_files);
      if (!src) return null;
      return {
        provider: 'pexels',
        id: v.id,
        src,
        cover: v.image || '',
        duration: Number(v.duration) || 0,
        width: v.width,
        height: v.height,
        user: v.user ? { name: v.user.name || '', url: v.user.url || '' } : null,
        tags: [],
        title: v.user?.name ? `Pexels by ${v.user.name}` : 'Pexels reel',
        url: v.url || '',
      };
    })
    .filter(Boolean);
}
