/**
 * External music-platform search.
 *
 * Aggregates tracks from free/freemium platforms so members can attach a song
 * to a post, story or note without being limited to the built-in catalog.
 *
 * Supported platforms (free tiers):
 *   - Deezer        : no API key required  -> https://developers.deezer.com/
 *   - YouTube       : Data API v3 key      -> https://console.cloud.google.com/ (free quota)
 *   - Spotify       : Client ID + Secret   -> https://developer.spotify.com/ (free developer account)
 *   - Apple Music   : requires paid program (documented below, not enabled)
 *
 * Every platform returns tracks normalised to:
 *   { id, title, artist, url, previewUrl, albumArt, duration, source, platform }
 */

const DEEZER_BASE = 'https://api.deezer.com/search';
const YT_BASE = 'https://www.googleapis.com/youtube/v3/search';
const SPOTIFY_TOKEN = 'https://accounts.spotify.com/api/token';
const SPOTIFY_SEARCH = 'https://api.spotify.com/v1/search';

let spotifyToken = null;
let spotifyTokenExpiry = 0;

const ms = (v) => Number(v) || 0;

/* ------------------------------------------------------------------ Deezer */
const searchDeezer = async (q, limit = 20) => {
  try {
    const res = await fetch(
      `${DEEZER_BASE}?q=${encodeURIComponent(q)}&limit=${limit}&output=json`
    );
    if (!res.ok) return [];
    const json = await res.json();
    const data = Array.isArray(json.data) ? json.data : [];
    return data.map((t) => ({
      id: `deezer:${t.id}`,
      title: t.title || '',
      artist: t.artist?.name || '',
      url: t.link || '',
      previewUrl: t.preview || '',
      albumArt: t.album?.cover_medium || t.album?.cover_big || '',
      duration: ms(t.duration),
      source: 'external',
      platform: 'deezer',
    }));
  } catch {
    return [];
  }
};

/* ---------------------------------------------------------------- YouTube */
const searchYouTube = async (q, limit = 20) => {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `${YT_BASE}?part=snippet&type=video&maxResults=${limit}&q=${encodeURIComponent(
        q
      )}&key=${key}`
    );
    if (!res.ok) return [];
    const json = await res.json();
    const items = Array.isArray(json.items) ? json.items : [];
    return items.map((it) => {
      const sn = it.snippet || {};
      const th = sn.thumbnails || {};
      const art = th.medium?.url || th.high?.url || th.default?.url || '';
      return {
        id: `youtube:${it.id.videoId}`,
        title: sn.title || '',
        artist: sn.channelTitle || '',
        url: `https://www.youtube.com/watch?v=${it.id.videoId}`,
        previewUrl: '',
        albumArt: art,
        duration: 0,
        source: 'external',
        platform: 'youtube',
      };
    });
  } catch {
    return [];
  }
};

/* ----------------------------------------------------------------- Spotify */
const getSpotifyToken = async () => {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (spotifyToken && Date.now() < spotifyTokenExpiry - 30000) return spotifyToken;
  try {
    const res = await fetch(SPOTIFY_TOKEN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) return null;
    const json = await res.json();
    spotifyToken = json.access_token;
    spotifyTokenExpiry = Date.now() + (json.expires_in || 3600) * 1000;
    return spotifyToken;
  } catch {
    return null;
  }
};

const searchSpotify = async (q, limit = 20) => {
  const token = await getSpotifyToken();
  if (!token) return [];
  try {
    const res = await fetch(
      `${SPOTIFY_SEARCH}?type=track&limit=${limit}&q=${encodeURIComponent(q)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const json = await res.json();
    const items = Array.isArray(json.tracks?.items) ? json.tracks.items : [];
    return items.map((t) => {
      const art = t.album?.images?.[0]?.url || '';
      return {
        id: `spotify:${t.id}`,
        title: t.name || '',
        artist: t.artists?.map((a) => a.name).join(', ') || '',
        url: t.external_urls?.spotify || '',
        previewUrl: t.preview_url || '',
        albumArt: art,
        duration: ms(t.duration_ms) / 1000,
        source: 'external',
        platform: 'spotify',
      };
    });
  } catch {
    return [];
  }
};

/**
 * Search across enabled platforms. Deduplicates by title+artist.
 * `platforms` is a comma-separated list (deezer,youtube,spotify). Omits -> all enabled.
 */
export const searchExternalMusic = async (q, { platforms, limit = 20 } = {}) => {
  if (!q || !q.trim()) return [];
  const term = q.trim();

  const want = (p) => {
    if (!platforms) return true;
    const list = String(platforms)
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return list.includes(p);
  };

  const results = [];
  if (want('deezer')) results.push(...(await searchDeezer(term, limit)));
  if (want('youtube')) results.push(...(await searchYouTube(term, limit)));
  if (want('spotify')) results.push(...(await searchSpotify(term, limit)));

  // Dedup by title + artist (case-insensitive).
  const seen = new Set();
  const deduped = [];
  for (const t of results) {
    const key = `${t.title.toLowerCase()}::${t.artist.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(t);
  }
  return deduped.slice(0, limit);
};

/* ----------------------------------------------------------- setup docs */

/**
 * Free API onboarding (copy into server/.env):
 *
 *   # Deezer — no key needed, works immediately.
 *
 *   # YouTube Data API v3 — free quota.
 *   #   1. Go to https://console.cloud.google.com/
 *   #   2. Create a project, enable "YouTube Data API v3".
 *   #   3. Credentials -> Create API key.
 *   #   4. Add: YOUTUBE_API_KEY=AIzaSy...
 *
 *   # Spotify — free developer account.
 *   #   1. Go to https://developer.spotify.com/dashboard
 *   #   2. Create an app -> copy Client ID and Client Secret.
 *   #   3. Add:
 *   #      SPOTIFY_CLIENT_ID=...
 *   #      SPOTIFY_CLIENT_SECRET=...
 *
 *   # Apple Music — requires the paid Apple Developer Program ($99/yr),
 *   #   so it is intentionally not wired here. Add it the same way once you
 *   #   have a MusicKit key if you need it.
 */
