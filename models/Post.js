const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    caption: {
      type: String,
      maxlength: [5000, 'Caption cannot exceed 5000 characters'],
    },
    type: {
      type: String,
      enum: ['text', 'image', 'video', 'gallery'],
      default: 'text',
    },
    media: [
      {
        url: String,
        publicId: String,
        type: {
          type: String,
          enum: ['image', 'video'],
        },
        width: Number,
        height: Number,
        // Individual media interactions
        likes: [{
          user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          reaction: { 
            type: String, 
            enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry'],
            default: 'like'
          },
          createdAt: { type: Date, default: Date.now }
        }],
        comments: [{
          type: mongoose.Schema.Types.ObjectId,
          ref: 'MediaComment'
        }],
        taggedUsers: [{
          user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          position: {
            x: Number, // Percentage from left
            y: Number  // Percentage from top
          }
        }],
        likesCount: { type: Number, default: 0 },
        commentsCount: { type: Number, default: 0 }
      }
    ],
    tags: [String],
    tournament: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
    },
    location: {
      name: String,
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },
    // Post-level interactions
    likes: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reaction: { 
          type: String, 
          enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry'],
          default: 'like'
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment',
      },
    ],
    views: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        viewedAt: { type: Date, default: Date.now },
      },
    ],
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 0 },
    // Reaction counts
    reactionCounts: {
      like: { type: Number, default: 0 },
      love: { type: Number, default: 0 },
      haha: { type: Number, default: 0 },
      wow: { type: Number, default: 0 },
      sad: { type: Number, default: 0 },
      angry: { type: Number, default: 0 }
    },
    isPinned: { type: Boolean, default: false },
    isExclusive: { type: Boolean, default: false },
    allowComments: { type: Boolean, default: true },
    allowLikes: { type: Boolean, default: true },
    allowShares: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'published', 'archived'],
      default: 'published',
    },
    scheduledFor: Date,
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
postSchema.index({ author: 1, status: 1, createdAt: -1 });
postSchema.index({ status: 1, isPinned: -1, createdAt: -1 });

// Method to add/update reaction to post
postSchema.methods.addReaction = async function (userId, reaction = 'like') {
  // Check if user already reacted
  const existingReaction = this.likes.find(
    like => like.user.toString() === userId.toString()
  );

  if (existingReaction) {
    // If same reaction, remove it (toggle off)
    if (existingReaction.reaction === reaction) {
      this.likes = this.likes.filter(
        like => like.user.toString() !== userId.toString()
      );
      this.reactionCounts[reaction] = Math.max(0, this.reactionCounts[reaction] - 1);
      this.likesCount = Math.max(0, this.likesCount - 1);
      await this.save();
      return { liked: false, reaction: null, reactionCounts: this.reactionCounts, likesCount: this.likesCount };
    } else {
      // Change reaction
      this.reactionCounts[existingReaction.reaction] = Math.max(0, this.reactionCounts[existingReaction.reaction] - 1);
      existingReaction.reaction = reaction;
      existingReaction.createdAt = Date.now();
      this.reactionCounts[reaction] = (this.reactionCounts[reaction] || 0) + 1;
      await this.save();
      return { liked: true, reaction, reactionCounts: this.reactionCounts, likesCount: this.likesCount };
    }
  } else {
    // Add new reaction
    this.likes.push({ user: userId, reaction, createdAt: Date.now() });
    this.reactionCounts[reaction] = (this.reactionCounts[reaction] || 0) + 1;
    this.likesCount += 1;
    await this.save();
    return { liked: true, reaction, reactionCounts: this.reactionCounts, likesCount: this.likesCount };
  }
};

// Method to add reaction to specific media
postSchema.methods.addMediaReaction = async function (mediaIndex, userId, reaction = 'like') {
  if (!this.media[mediaIndex]) {
    throw new Error('Media not found');
  }

  const media = this.media[mediaIndex];
  const existingReaction = media.likes.find(
    like => like.user.toString() === userId.toString()
  );

  if (existingReaction) {
    if (existingReaction.reaction === reaction) {
      // Remove reaction
      media.likes = media.likes.filter(
        like => like.user.toString() !== userId.toString()
      );
      media.likesCount = Math.max(0, media.likesCount - 1);
      await this.save();
      return { liked: false, reaction: null, likesCount: media.likesCount };
    } else {
      // Change reaction
      existingReaction.reaction = reaction;
      existingReaction.createdAt = Date.now();
      await this.save();
      return { liked: true, reaction, likesCount: media.likesCount };
    }
  } else {
    // Add new reaction
    media.likes.push({ user: userId, reaction, createdAt: Date.now() });
    media.likesCount += 1;
    await this.save();
    return { liked: true, reaction, likesCount: media.likesCount };
  }
};

// Method to add like to post
postSchema.methods.addLike = async function (userId) {
  // Check if user already liked
  const alreadyLiked = this.likes.some(
    like => like.user.toString() === userId.toString()
  );

  if (!alreadyLiked) {
    this.likes.push({ user: userId, reaction: 'like', createdAt: Date.now() });
    this.likesCount += 1;
    this.reactionCounts.like = (this.reactionCounts.like || 0) + 1;
    await this.save();
    return { liked: true, likesCount: this.likesCount };
  }

  return { liked: true, likesCount: this.likesCount };
};

// Method to remove like from post
postSchema.methods.removeLike = async function (userId) {
  const likeIndex = this.likes.findIndex(
    like => like.user.toString() === userId.toString()
  );

  if (likeIndex !== -1) {
    const removedReaction = this.likes[likeIndex].reaction;
    this.likes.splice(likeIndex, 1);
    this.likesCount = Math.max(0, this.likesCount - 1);
    this.reactionCounts[removedReaction] = Math.max(0, this.reactionCounts[removedReaction] - 1);
    await this.save();
    return { liked: false, likesCount: this.likesCount };
  }

  return { liked: false, likesCount: this.likesCount };
};

// Method to increment shares
postSchema.methods.incrementShares = async function () {
  this.sharesCount += 1;
  await this.save();
  return this.sharesCount;
};

// Method to tag user in media
postSchema.methods.tagUserInMedia = async function (mediaIndex, userId, position) {
  if (!this.media[mediaIndex]) {
    throw new Error('Media not found');
  }

  const media = this.media[mediaIndex];
  
  // Check if user already tagged
  const alreadyTagged = media.taggedUsers.find(
    tag => tag.user.toString() === userId.toString()
  );

  if (!alreadyTagged) {
    media.taggedUsers.push({ user: userId, position });
    await this.save();
  }

  return this;
};

// Method to remove tag from media
postSchema.methods.removeTagFromMedia = async function (mediaIndex, userId) {
  if (!this.media[mediaIndex]) {
    throw new Error('Media not found');
  }

  const media = this.media[mediaIndex];
  media.taggedUsers = media.taggedUsers.filter(
    tag => tag.user.toString() !== userId.toString()
  );
  
  await this.save();
  return this;
};

module.exports = mongoose.model('Post', postSchema);