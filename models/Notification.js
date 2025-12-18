const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: [
        'like',           // Someone liked your post
        'comment',        // Someone commented on your post
        'reply',          // Someone replied to your comment
        'message',        // New message received
        'follow',         // Someone followed you
        'mention',        // Someone mentioned you
        'achievement',    // New achievement unlocked
        'tournament',     // Tournament update
        'admin_post',     // Admin created a new post
      ],
      required: true,
    },
    // Reference to the related entity
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
    },
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
    },
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
    // Notification content
    content: {
      type: String,
      required: true,
      maxlength: 500,
    },
    // Notification link (where to redirect when clicked)
    link: {
      type: String,
      required: true,
    },
    // Read status
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function (userId) {
  return await this.countDocuments({
    recipient: userId,
    isRead: false,
  });
};

// Static method to mark all as read
notificationSchema.statics.markAllAsRead = async function (userId) {
  return await this.updateMany(
    { recipient: userId, isRead: false },
    { 
      $set: { 
        isRead: true, 
        readAt: new Date() 
      } 
    }
  );
};

// Instance method to mark single notification as read
notificationSchema.methods.markAsRead = async function () {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    await this.save();
  }
  return this;
};

module.exports = mongoose.model('Notification', notificationSchema);