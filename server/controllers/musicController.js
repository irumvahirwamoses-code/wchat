import MusicTrack from '../models/MusicTrack.js';
import User from '../models/User.js';
import { fileUrl } from '../middleware/uploadMiddleware.js';

/** Fallback built-in catalog used when the DB has no tracks yet. */
const DEFAULT_CATALOG = [
  { title: 'Sunrise', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/sunrise.mp3', duration: 30, category: 'for-you', genre: 'ambient', mood: 'calm', trendingScore: 10 },
  { title: 'Night Drive', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/night-drive.mp3', duration: 30, category: 'trending', genre: 'synthwave', mood: 'energetic', trendingScore: 20 },
  { title: 'Circle Vibes', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/circle-vibes.mp3', duration: 30, category: 'genre', genre: 'afrobeat', mood: 'happy', trendingScore: 15 },
  { title: 'Chill Chat', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/chill-chat.mp3', duration: 30, category: 'mood', genre: 'lo-fi', mood: 'relaxed', trendingScore: 12 },
  { title: 'Reel Flow', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/reel-flow.mp3', duration: 30, category: 'trending', genre: 'hip-hop', mood: 'confident', trendingScore: 25 },
  { title: 'Morning Coffee', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/morning-coffee.mp3', duration: 30, category: 'for-you', genre: 'acoustic', mood: 'peaceful', trendingScore: 8 },
  { title: 'Neon City', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/neon-city.mp3', duration: 30, category: 'genre', genre: 'electronic', mood: 'excited', trendingScore: 18 },
  { title: 'Loops & Beats', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/loops-beats.mp3', duration: 30, category: 'for-you', genre: 'house', mood: 'focused', trendingScore: 14 },
];

/**
 * Seed default catalog tracks if the collection is empty.
 * Runs once at server start via server.js.
 */
export const seedDefaultCatalog = async () => {
  try {
    const count = await MusicTrack.countDocuments({ source: 'catalog' });
    if (count === 0) {
      await MusicTrack.insertMany(
        DEFAULT_CATALOG.map((track) => ({ ...track, source: 'catalog', isPublic: true }))
      );
      console.log(`Wchat: seeded ${DEFAULT_CATALOG.length} default music tracks`);
    }
  } catch (error) {
    console.warn('Could not seed music catalog:', error.message);
  }
};

/**
 * GET /api/music/catalog?q=&category=&genre=&mood=
 * Search public catalog tracks + the current user's own uploads.
 * Supports category (for-you/trending/genre/mood), genre and mood filters.
 */
export const getCatalog = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const category = String(req.query.category || '').trim();
    const genre = String(req.query.genre || '').trim();
    const mood = String(req.query.mood || '').trim();

    const filter = { source: 'catalog', isPublic: true };
    if (category) filter.category = category;
    if (genre) filter.genre = genre;
    if (mood) filter.mood = mood;
    if (q) filter.$text = { $search: q };

    const or = [{ ...filter }];
    if (q) {
      or.push({
        source: 'upload',
        uploadedBy: req.user._id,
        $text: { $search: q },
      });
    } else if (category || genre || mood) {
      // When filtering but no search, also include user uploads matching filters.
      const userFilter = { source: 'upload', uploadedBy: req.user._id, isPublic: true };
      if (category) userFilter.category = category;
      if (genre) userFilter.genre = genre;
      if (mood) userFilter.mood = mood;
      or.push(userFilter);
    } else {
      or.push({ source: 'upload', uploadedBy: req.user._id });
    }

    const tracks = await MusicTrack.find({ $or: or })
      .sort({ trendingScore: -1, createdAt: -1 })
      .limit(50)
      .select('title artist url duration albumArt category genre mood defaultStartTime defaultEndTime lyrics source uploadedBy trendingScore');

    return res.json({ tracks });
  } catch (error) {
    if (error.code === 28 || error.message && /text index/.test(error.message)) {
      try {
        const q = String(req.query.q || '').trim();
        const category = String(req.query.category || '').trim();
        const genre = String(req.query.genre || '').trim();
        const mood = String(req.query.mood || '').trim();

        const regex = q ? { $regex: q, $options: 'i' } : {};
        const baseFilter = { source: 'catalog', isPublic: true };
        if (category) baseFilter.category = category;
        if (genre) baseFilter.genre = genre;
        if (mood) baseFilter.mood = mood;

        const tracks = await MusicTrack.find({
          $or: [
            { ...regex, ...baseFilter, title: regex },
            { source: 'upload', uploadedBy: req.user._id, ...regex },
          ].filter(Boolean),
        })
          .sort({ trendingScore: -1, createdAt: -1 })
          .limit(50)
          .select('title artist url duration albumArt category genre mood defaultStartTime defaultEndTime lyrics source uploadedBy trendingScore');
        return res.json({ tracks });
      } catch (fallbackError) {
        return next(fallbackError);
      }
    }
    return next(error);
  }
};

/**
 * GET /api/music/categories
 * Returns available categories, genres and moods for browsing.
 */
export const getCategories = async (req, res, next) => {
  try {
    const [genres, moods] = await Promise.all([
      MusicTrack.distinct('genre', { source: 'catalog', isPublic: true }),
      MusicTrack.distinct('mood', { source: 'catalog', isPublic: true }),
    ]);
    return res.json({
      categories: [
        { id: 'for-you', label: 'For You' },
        { id: 'trending', label: 'Trending' },
        { id: 'genre', label: 'Genres' },
        { id: 'mood', label: 'Moods' },
      ],
      genres: genres.filter(Boolean).sort(),
      moods: moods.filter(Boolean).sort(),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/music/trending
 * Returns trending catalog tracks.
 */
export const getTrending = async (req, res, next) => {
  try {
    const tracks = await MusicTrack.find({
      source: 'catalog',
      isPublic: true,
    })
      .sort({ trendingScore: -1, createdAt: -1 })
      .limit(20)
      .select('title artist url duration albumArt category genre mood defaultStartTime defaultEndTime lyrics trendingScore');
    return res.json({ tracks });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/music/for-you
 * Returns for-you catalog tracks (mix of genres/moods).
 */
export const getForYou = async (req, res, next) => {
  try {
    const tracks = await MusicTrack.find({
      source: 'catalog',
      isPublic: true,
      $or: [{ category: 'for-you' }, { genre: { $exists: true } }],
    })
      .sort({ trendingScore: -1, createdAt: -1 })
      .limit(30)
      .select('title artist url duration albumArt category genre mood defaultStartTime defaultEndTime lyrics trendingScore');
    return res.json({ tracks });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/music/upload
 * multipart: `media` (audio file) + optional `title`, `artist`, `genre`, `mood`, `albumArt`
 */
export const uploadTrack = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'No audio file provided' });
    const mimetype = (file.mimetype || '').toLowerCase();
    if (!mimetype.startsWith('audio/')) {
      return res.status(400).json({ message: 'Please upload an audio file' });
    }

    const track = await MusicTrack.create({
      title: String(req.body.title || file.originalname || 'Untitled').slice(0, 100),
      artist: String(req.body.artist || 'You').slice(0, 100),
      url: fileUrl(file),
      albumArt: String(req.body.albumArt || '').slice(0, 200),
      duration: Number(req.body.duration) || 0,
      genre: String(req.body.genre || '').slice(0, 50) || undefined,
      mood: String(req.body.mood || '').slice(0, 50) || undefined,
      source: 'upload',
      uploadedBy: req.user._id,
      isPublic: false,
    });

    return res.status(201).json(track);
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/mymusic
 * Current user's uploaded tracks.
 */
export const getMyTracks = async (req, res, next) => {
  try {
    const tracks = await MusicTrack.find({
      source: 'upload',
      uploadedBy: req.user._id,
    }).sort('-createdAt').limit(50).select('title artist url duration albumArt genre mood');
    return res.json({ tracks });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/music/save
 * Body: { trackId } — save a track to the user's library for future use.
 */
export const saveTrack = async (req, res, next) => {
  try {
    const { trackId } = req.body;
    if (!trackId) return res.status(400).json({ message: 'trackId is required' });

    const track = await MusicTrack.findById(trackId);
    if (!track) return res.status(404).json({ message: 'Track not found' });

    const user = await UserModel.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const saved = user.savedAudio || [];
    if (!saved.includes(trackId)) {
      saved.push(trackId);
      user.savedAudio = saved;
      await user.save();
    }

    return res.json({ saved: true, savedAudio: user.savedAudio });
  } catch (error) {
    return next(error);
  }
};

export default {
  getCatalog,
  getCategories,
  getTrending,
  getForYou,
  uploadTrack,
  getMyTracks,
  saveTrack,
  seedDefaultCatalog,
};
