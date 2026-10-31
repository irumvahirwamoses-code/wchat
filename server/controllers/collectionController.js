import Collection from '../models/Collection.js';
import Post from '../models/Post.js';

const AUTHOR_FIELDS =
  'firstName lastName username profilePicture isOnline lastSeen';

/**
 * GET /api/collections — list the current user's collections.
 */
export const listCollections = async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const filter = { author: req.user._id };
    const total = await Collection.countDocuments(filter);
    const collections = await Collection.find(filter)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('posts', AUTHOR_FIELDS)
      .lean();

    return res.json({
      collections,
      page,
      limit,
      total,
      hasMore: page * limit < total,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/collections/:id — get one collection with its posts.
 */
export const getCollection = async (req, res, next) => {
  try {
    const collection = await Collection.findById(req.params.id)
      .populate('author', AUTHOR_FIELDS)
      .populate({
        path: 'posts',
        populate: { path: 'author', select: AUTHOR_FIELDS },
        options: { sort: { createdAt: -1 } },
      })
      .lean();

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    // Only the author or public collections are readable.
    if (!collection.isPublic && collection.author._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'This collection is private' });
    }

    return res.json(collection);
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/collections — create a new collection.
 */
export const createCollection = async (req, res, next) => {
  try {
    const { name, description, isPublic, coverImage } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Collection name is required' });
    }

    const collection = await Collection.create({
      author: req.user._id,
      name: String(name).trim(),
      description: String(description || '').trim(),
      isPublic: Boolean(isPublic),
      coverImage: String(coverImage || '').trim(),
      posts: [],
    });

    return res.status(201).json(collection);
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/collections/:id/posts — add a post to a collection (author only).
 */
export const addPostToCollection = async (req, res, next) => {
  try {
    const { postId } = req.body;
    if (!postId) {
      return res.status(400).json({ message: 'postId is required' });
    }

    const collection = await Collection.findById(req.params.id);
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }
    if (collection.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the collection owner can add posts' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const already = collection.posts.some((p) => p.toString() === postId);
    if (already) {
      return res.status(400).json({ message: 'Post already in this collection' });
    }

    collection.posts.push(postId);
    await collection.save();

    return res.json({ added: true, postCount: collection.posts.length });
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/collections/:id/posts/:postId — remove a post from a collection.
 */
export const removePostFromCollection = async (req, res, next) => {
  try {
    const collection = await Collection.findById(req.params.id);
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }
    if (collection.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the collection owner can remove posts' });
    }

    collection.posts = collection.posts.filter(
      (p) => p.toString() !== req.params.postId
    );
    await collection.save();

    return res.json({ removed: true, postCount: collection.posts.length });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/collections/:id — update collection metadata (author only).
 */
export const updateCollection = async (req, res, next) => {
  try {
    const collection = await Collection.findById(req.params.id);
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }
    if (collection.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the collection owner can edit this' });
    }

    const { name, description, isPublic, coverImage } = req.body;
    if (name !== undefined) collection.name = String(name).trim();
    if (description !== undefined) collection.description = String(description).trim();
    if (isPublic !== undefined) collection.isPublic = Boolean(isPublic);
    if (coverImage !== undefined) collection.coverImage = String(coverImage).trim();

    await collection.save();
    return res.json(collection);
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/collections/:id — delete a collection (author only).
 */
export const deleteCollection = async (req, res, next) => {
  try {
    const collection = await Collection.findById(req.params.id);
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }
    if (collection.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the collection owner can delete this' });
    }

    await collection.deleteOne();
    return res.json({ id: req.params.id });
  } catch (error) {
    return next(error);
  }
};

export default {
  listCollections,
  getCollection,
  createCollection,
  addPostToCollection,
  removePostFromCollection,
  updateCollection,
  deleteCollection,
};
