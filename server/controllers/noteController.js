import Note from '../models/Note.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import { parseJson } from '../utils/jsonHelpers.js';

const AUTHOR_FIELDS = 'firstName lastName username profilePicture';

const NOTE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * GET /api/notes
 * Notes from: me + people whose personal Circle I joined + my Circles' notes.
 * Visibility is enforced server-side by membership.
 */
export const listNotes = async (req, res, next) => {
  try {
    const me = await User.findById(req.user._id).select('following').lean();
    const following = Array.isArray(me.following) ? me.following : [];

    const myChats = await Chat.find({ users: req.user._id }).select('_id').lean();
    const chatIds = myChats.map((c) => c._id);

    const or = [
      { author: req.user._id, circle: null },
      { author: { $in: following }, circle: null },
      { circle: { $in: chatIds } },
    ];

    const notes = await Note.find({
      $or: or,
      expiresAt: { $gt: new Date() },
    })
      .sort('-createdAt')
      .populate('author', AUTHOR_FIELDS)
      .populate('circle', 'chatName');

    return res.json(notes);
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/notes { text, circleId? }
 */
export const createNote = async (req, res, next) => {
  try {
    const { text, circleId, music } = req.body;
    const body = String(text || '').trim();

    if (!body) return res.status(400).json({ message: 'A note needs text' });
    if (body.length > 60) {
      return res.status(400).json({ message: 'A note can be 60 characters at most' });
    }

    let circle = null;
    if (circleId) {
      const chat = await Chat.findById(circleId).select('users');
      if (!chat) return res.status(404).json({ message: 'Circle not found' });
      if (!chat.users.some((u) => u.toString() === req.user._id.toString())) {
        return res.status(403).json({ message: 'You are not a member of this Circle' });
      }
      circle = chat._id;
    }

    // Keep one active note per person/Circle (replaces the previous one).
    await Note.deleteMany({ author: req.user._id, circle });

    const musicObj = parseJson(music, null);

    const note = await Note.create({
      author: req.user._id,
      circle,
      text: body,
      music: musicObj
        ? {
            title: String(musicObj.title || '').slice(0, 100),
            artist: String(musicObj.artist || '').slice(0, 100),
            url: String(musicObj.url || ''),
          }
        : undefined,
      expiresAt: new Date(Date.now() + NOTE_TTL_MS),
    });

    const populated = await Note.findById(note._id).populate('author', AUTHOR_FIELDS);
    return res.status(201).json(populated);
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/notes/:id
 */
export const deleteNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });
    if (note.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You cannot delete this note' });
    }
    await note.deleteOne();
    return res.json({ id: req.params.id });
  } catch (error) {
    return next(error);
  }
};

export default { listNotes, createNote, deleteNote };
