import mongoose from 'mongoose';

const ObjectId = mongoose.Schema.Types.ObjectId;

/**
 * A user-created collection for organizing saved posts.
 * Like Instagram "Saved collections" — a user can group bookmarked posts
 * under a named, optionally public collection.
 */
const collectionSchema = new mongoose.Schema(
  {
    author: {
      type: ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      required: true,
      maxlength: [60, 'Collection name too long'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, 'Collection description too long'],
      default: '',
    },
    posts: [
      {
        type: ObjectId,
        ref: 'Post',
      },
    ],
    isPublic: {
      type: Boolean,
      default: false,
    },
    coverImage: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

collectionSchema.index({ author: 1, createdAt: -1 });
collectionSchema.virtual('postCount').get(function () {
  return (this.posts || []).length;
});

const Collection = mongoose.model('Collection', collectionSchema);

export default Collection;
