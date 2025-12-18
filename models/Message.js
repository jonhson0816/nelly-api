const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Message must have a sender'],
      index: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Message must have a receiver'],
      index: true,
    },
    content: {
      type: String,
      trim: true,
      maxlength: [5000, 'Message cannot exceed 5000 characters'],
    },
    type: {
      type: String,
      enum: ['text', 'image', 'video', 'audio', 'file', 'sticker', 'emoji', 'call'],
      default: 'text',
    },
    // ✅ FIXED: Media attachment - Using Mixed type for flexibility
    media: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Sticker data
    sticker: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Call data (for call history)
    callData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Message reactions
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        emoji: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Reply to message
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read', 'deleted'],
      default: 'sent',
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Edited status
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, isRead: 1 });
messageSchema.index({ content: 'text' }); // Text search index

// Mark message as read
messageSchema.methods.markAsRead = async function () {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = Date.now();
    this.status = 'read';
    await this.save();
  }
};

// Add reaction
messageSchema.methods.addReaction = async function (userId, emoji) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(
    (r) => r.user.toString() !== userId.toString()
  );
  
  // Add new reaction
  this.reactions.push({ user: userId, emoji });
  await this.save();
  return this;
};

// Remove reaction
messageSchema.methods.removeReaction = async function (userId) {
  this.reactions = this.reactions.filter(
    (r) => r.user.toString() !== userId.toString()
  );
  await this.save();
  return this;
};

// Check if deleted for user
messageSchema.methods.isDeletedForUser = function (userId) {
  return this.deletedFor.some((id) => id.toString() === userId.toString());
};

// Get unread count
messageSchema.statics.getUnreadCount = async function (userId) {
  return await this.countDocuments({
    receiver: userId,
    isRead: false,
    deletedFor: { $ne: userId },
  });
};

// Get conversation
messageSchema.statics.getConversation = async function (
  user1Id,
  user2Id,
  page = 1,
  limit = 50
) {
  const skip = (page - 1) * limit;
  
  const messages = await this.find({
    $or: [
      { sender: user1Id, receiver: user2Id },
      { sender: user2Id, receiver: user1Id },
    ],
    deletedFor: { $nin: [user1Id, user2Id] },
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('sender', 'firstName lastName avatar username isAdmin')
    .populate('receiver', 'firstName lastName avatar username isAdmin')
    .populate('replyTo', 'content sender type')
    .populate('reactions.user', 'firstName lastName avatar');
  
  return messages.reverse();
};

module.exports = mongoose.model('Message', messageSchema);