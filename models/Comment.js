const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
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
    likesCount: { type: Number, default: 0 },
    repliesCount: { type: Number, default: 0 },
    // Image/GIF attachments in comments
    media: {
      url: String,
      publicId: String,
      type: {
        type: String,
        enum: ['image', 'gif'],
      },
    },
    isEdited: { type: Boolean, default: false },
    editedAt: Date,
    mentionedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
  },
  {
    timestamps: true,
  }
);

// Index for performance
commentSchema.index({ post: 1, createdAt: -1 });
commentSchema.index({ author: 1 });
commentSchema.index({ parentComment: 1 });

// Add/update reaction to comment
commentSchema.methods.addReaction = async function (userId, reaction = 'like') {
  const existingReaction = this.likes.find(
    like => like.user.toString() === userId.toString()
  );

  if (existingReaction) {
    if (existingReaction.reaction === reaction) {
      // Remove reaction (toggle off)
      this.likes = this.likes.filter(
        like => like.user.toString() !== userId.toString()
      );
      this.likesCount = Math.max(0, this.likesCount - 1);
      await this.save();
      return { liked: false, reaction: null, likesCount: this.likesCount };
    } else {
      // Change reaction
      existingReaction.reaction = reaction;
      existingReaction.createdAt = Date.now();
      await this.save();
      return { liked: true, reaction, likesCount: this.likesCount };
    }
  } else {
    // Add new reaction
    this.likes.push({ user: userId, reaction, createdAt: Date.now() });
    this.likesCount += 1;
    await this.save();
    return { liked: true, reaction, likesCount: this.likesCount };
  }
};

// Update comment
commentSchema.methods.updateContent = async function (newContent) {
  this.content = newContent;
  this.isEdited = true;
  this.editedAt = Date.now();
  await this.save();
  return this;
};

module.exports = mongoose.model('Comment', commentSchema);