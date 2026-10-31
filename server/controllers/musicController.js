import MusicTrack from '../models/MusicTrack.js';
import { fileUrl } from '../middleware/uploadMiddleware.js';

/** Fallback built-in catalog used when the DB has no tracks yet. */
const DEFAULT_CATALOG = [
  { title: 'Sunrise', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/sunrise.mp3', duration: 30 },
  { title: 'Night Drive', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/night-drive.mp3', duration: 30 },
  { title: 'Circle Vibes', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/circle-vibes.mp3', duration: 30 },
  { title: 'Chill Chat', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/chill-chat.mp3', duration: 30 },
  { title: 'Reel Flow', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/reel-flow.mp3', duration: 30 },
  { title: 'Morning Coffee', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/morning-coffee.mp3', duration: 30 },
  { title: 'Neon City', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/neon-city.mp3', duration: 30 },
  { title: 'Loops & Beats', artist: 'Wchat Beats', url: 'https://cdn.wchat.app/music/loops-beats.mp3', duration: 30 },
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
 * GET /api/music/catalog?q=...
 * Search public catalog tracks + the current user's own uploads.
 */
export const getCatalog = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const filter = { source: 'catalog', isPublic: true };
    if (q) {
      filter.$text = { $search: q };
    }
    // Also include the current user's own uploads so they can reuse them.
    const or = [{ ...filter }];
    if (q) {
      or.push({
        source: 'upload',
        uploadedBy: req.user._id,
        $text: { $search: q },
      });
    } else {
      or.push({ source: 'upload', uploadedBy: req.user._id });
    }

    const tracks = await MusicTrack.find({ $or: or })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('title artist url duration source uploadedBy');

    return res.json({ tracks });
  } catch (error) {
    // If a text index doesn't exist yet, fall back to a regex search.
    if (error.code === 28 || error.message && /text index/.test(error.message)) {
      try {
        const q = String(req.query.q || '').trim();
        const regex = q ? { $regex: q, $options: 'i' } : {};
        const tracks = await MusicTrack.find({
          $or: [
            { ...regex, source: 'catalog', isPublic: true, title: regex },
            { source: 'upload', uploadedBy: req.user._id, ...regex },
          ].filter(Boolean),
        })
          .sort({ createdAt: -1 })
          .limit(50)
          .select('title artist url duration source uploadedBy');
        return res.json({ tracks });
      } catch (fallbackError) {
        return next(fallbackError);
      }
    }
    return next(error);
  }
};

/**
 * POST /api/music/upload
 * multipart: `media` (audio file) + optional `title` + `artist`
 * Stores the file and returns a track object the client can attach to posts/stories/notes.
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
      duration: Number(req.body.duration) || 0,
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
    }).sort('-createdAt').limit(50).select('title artist url duration');
    return res.json({ tracks });
  } catch (error) {
    return next(error);
  }
};

export default { getCatalog, uploadTrack, getMyTracks, seedDefaultCatalog };
