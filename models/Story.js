const mongoose = require('mongoose');

const storySchema = new mongoose.Schema(
  {
    // Story Owner (Only Admin can post stories)
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Story Type
    storyType: {
      type: String,
      enum: ['media', 'text', 'mixed'], // media = images/videos, text = text-only, mixed = both
      default: 'media',
    },

    // Multiple Media Support
    mediaItems: [
      {
        mediaType: {
          type: String,
          enum: ['image', 'video'],
        },
        mediaUrl: {
          type: String,
        },
        publicId: {
          type: String, // Cloudinary public ID
        },
        thumbnail: {
          type: String, // Video thumbnail
        },
        duration: {
          type: Number,
          default: 5, // seconds for each slide
        },
      },
    ],

    // Text Content (for text-only or overlay text)
    textContent: {
      text: {
        type: String,
        maxlength: 1000,
      },
      fontSize: {
        type: String,
        default: 'medium', // small, medium, large
      },
      fontFamily: {
        type: String,
        default: 'Arial',
      },
      textColor: {
        type: String,
        default: '#FFFFFF',
      },
      textAlign: {
        type: String,
        default: 'center', // left, center, right
      },
      backgroundColor: {
        type: String,
        default: '#000000',
      },
      gradient: {
        type: String, // CSS gradient string
      },
    },

    // Caption/Description
    caption: {
      type: String,
      maxlength: 500,
      trim: true,
    },

    // Stickers and Emojis
    stickers: [
      {
        type: {
          type: String,
          enum: ['emoji', 'gif', 'sticker'],
        },
        content: String, // emoji character or URL
        position: {
          x: Number,
          y: Number,
        },
        size: {
          type: Number,
          default: 50,
        },
        rotation: {
          type: Number,
          default: 0,
        },
      },
    ],

    // Story Metadata
    backgroundColor: {
      type: String,
      default: '#000000',
    },

    // Privacy & Visibility
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      index: true,
    },

    // Engagement Stats
    stats: {
      totalViews: { type: Number, default: 0 },
      totalLikes: { type: Number, default: 0 },
      totalComments: { type: Number, default: 0 },
      totalShares: { type: Number, default: 0 },
    },

    // Viewers
    viewers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
        viewDuration: {
          type: Number,
          default: 0,
        },
        completed: {
          type: Boolean,
          default: false,
        },
      },
    ],

    // Likes
    likes: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        likedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Comments
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        text: {
          type: String,
          required: true,
          maxlength: 500,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Story Settings
    allowComments: {
      type: Boolean,
      default: true,
    },
    allowLikes: {
      type: Boolean,
      default: true,
    },
    allowSharing: {
      type: Boolean,
      default: true,
    },

    // Highlight
    isHighlight: {
      type: Boolean,
      default: false,
    },
    highlightCategory: {
      type: String,
      enum: ['tournaments', 'training', 'lifestyle', 'behind-the-scenes', 'other'],
    },

    // Poll (Optional)
    poll: {
      question: String,
      options: [
        {
          text: String,
          votes: [
            {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'User',
            },
          ],
        },
      ],
    },

    // Music (Optional)
    music: {
      title: String,
      artist: String,
      url: String,
    },

    // Link
    link: {
      url: String,
      title: String,
    },

    // Reports
    reports: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        reason: String,
        reportedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes
storySchema.index({ author: 1, createdAt: -1 });
storySchema.index({ expiresAt: 1 });
storySchema.index({ isActive: 1, expiresAt: 1 });

// Virtual - Check if expired
storySchema.virtual('isExpired').get(function () {
  return new Date() > this.expiresAt && !this.isHighlight;
});

// Virtual - Time remaining
storySchema.virtual('timeRemaining').get(function () {
  if (this.isHighlight) return null;
  const remaining = this.expiresAt - new Date();
  return remaining > 0 ? remaining : 0;
});

// Methods
storySchema.methods.addViewer = async function (userId, viewDuration = 0, completed = false) {
  const existingViewer = this.viewers.find(
    (v) => v.user.toString() === userId.toString()
  );

  if (!existingViewer) {
    this.viewers.push({
      user: userId,
      viewedAt: Date.now(),
      viewDuration,
      completed,
    });
    this.stats.totalViews += 1;
  } else {
    existingViewer.viewDuration = Math.max(existingViewer.viewDuration, viewDuration);
    existingViewer.completed = completed || existingViewer.completed;
    existingViewer.viewedAt = Date.now();
  }

  await this.save();
  return this;
};

storySchema.methods.addLike = async function (userId) {
  const alreadyLiked = this.likes.find(
    (like) => like.user.toString() === userId.toString()
  );

  if (!alreadyLiked) {
    this.likes.push({ user: userId, likedAt: Date.now() });
    this.stats.totalLikes += 1;
    await this.save();
  }

  return this;
};

storySchema.methods.removeLike = async function (userId) {
  const likeIndex = this.likes.findIndex(
    (like) => like.user.toString() === userId.toString()
  );

  if (likeIndex !== -1) {
    this.likes.splice(likeIndex, 1);
    this.stats.totalLikes = Math.max(0, this.stats.totalLikes - 1);
    await this.save();
  }

  return this;
};

storySchema.methods.addComment = async function (userId, text) {
  this.comments.push({
    user: userId,
    text,
    createdAt: Date.now(),
  });
  this.stats.totalComments += 1;
  await this.save();
  return this;
};

storySchema.methods.deleteComment = async function (commentId) {
  const commentIndex = this.comments.findIndex(
    (comment) => comment._id.toString() === commentId.toString()
  );

  if (commentIndex !== -1) {
    this.comments.splice(commentIndex, 1);
    this.stats.totalComments = Math.max(0, this.stats.totalComments - 1);
    await this.save();
  }

  return this;
};

storySchema.methods.incrementShares = async function () {
  this.stats.totalShares += 1;
  await this.save();
  return this;
};

storySchema.methods.hasUserViewed = function (userId) {
  return this.viewers.some((v) => v.user.toString() === userId.toString());
};

storySchema.methods.hasUserLiked = function (userId) {
  return this.likes.some((like) => like.user.toString() === userId.toString());
};

storySchema.methods.votePoll = async function (userId, optionIndex) {
  if (!this.poll || !this.poll.options[optionIndex]) {
    throw new Error('Invalid poll option');
  }

  const alreadyVoted = this.poll.options.some((option) =>
    option.votes.includes(userId)
  );

  if (alreadyVoted) {
    throw new Error('User has already voted');
  }

  this.poll.options[optionIndex].votes.push(userId);
  await this.save();
  return this;
};

// Static methods
storySchema.statics.getActiveStories = async function () {
  return this.find({
    isActive: true,
    $or: [
      { expiresAt: { $gt: new Date() } },
      { isHighlight: true },
    ],
  }).sort({ createdAt: -1 });
};

storySchema.statics.deleteExpiredStories = async function () {
  const expiredStories = await this.find({
    expiresAt: { $lt: new Date() },
    isHighlight: false,
  });

  const { deleteFile } = require('../config/cloudinary');
  for (const story of expiredStories) {
    for (const media of story.mediaItems) {
      if (media.publicId) {
        await deleteFile(media.publicId);
      }
    }
  }

  await this.deleteMany({
    expiresAt: { $lt: new Date() },
    isHighlight: false,
  });

  return expiredStories.length;
};

module.exports = mongoose.model('Story', storySchema);