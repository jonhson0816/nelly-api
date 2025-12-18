const mongoose = require('mongoose');

const mediaCommentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    mediaIndex: {
      type: Number,
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
      ref: 'MediaComment',
      default: null,
    },
    likes: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    likesCount: { type: Number, default: 0 },
    repliesCount: { type: Number, default: 0 },
    isEdited: { type: Boolean, default: false },
    editedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Index for performance
mediaCommentSchema.index({ post: 1, mediaIndex: 1, createdAt: -1 });
mediaCommentSchema.index({ parentComment: 1 });

// Add like to comment
mediaCommentSchema.methods.addLike = async function (userId) {
  const alreadyLiked = this.likes.find(
    like => like.user.toString() === userId.toString()
  );

  if (alreadyLiked) {
    // Unlike
    this.likes = this.likes.filter(
      like => like.user.toString() !== userId.toString()
    );
    this.likesCount = Math.max(0, this.likesCount - 1);
  } else {
    // Like
    this.likes.push({ user: userId, createdAt: Date.now() });
    this.likesCount += 1;
  }

  await this.save();
  return { liked: !alreadyLiked, likesCount: this.likesCount };
};

module.exports = mongoose.model('MediaComment', mediaCommentSchema);