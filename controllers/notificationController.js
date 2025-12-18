const Notification = require('../models/Notification');

// ============================================
// GET ALL NOTIFICATIONS
// ============================================
exports.getNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({
      recipient: req.user.id,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'firstName lastName avatar username')
      .populate('post', 'caption media')
      .populate('comment', 'content');

    const total = await Notification.countDocuments({
      recipient: req.user.id,
    });

    const unreadCount = await Notification.getUnreadCount(req.user.id);

    res.status(200).json({
      success: true,
      count: notifications.length,
      total,
      unreadCount,
      page,
      pages: Math.ceil(total / limit),
      notifications,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    next(error);
  }
};

// ============================================
// GET UNREAD COUNT
// ============================================
exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.getUnreadCount(req.user.id);

    res.status(200).json({
      success: true,
      unreadCount: count,
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    next(error);
  }
};

// ============================================
// MARK NOTIFICATION AS READ
// ============================================
exports.markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    // Check if notification belongs to user
    if (notification.recipient.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    await notification.markAsRead();

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      notification,
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    next(error);
  }
};

// ============================================
// MARK ALL AS READ
// ============================================
exports.markAllAsRead = async (req, res, next) => {
  try {
    await Notification.markAllAsRead(req.user.id);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('Error marking all as read:', error);
    next(error);
  }
};

// ============================================
// DELETE NOTIFICATION
// ============================================
exports.deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    // Check if notification belongs to user
    if (notification.recipient.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    await notification.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    next(error);
  }
};

// ============================================
// DELETE ALL NOTIFICATIONS
// ============================================
exports.deleteAllNotifications = async (req, res, next) => {
  try {
    await Notification.deleteMany({
      recipient: req.user.id,
    });

    res.status(200).json({
      success: true,
      message: 'All notifications deleted',
    });
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    next(error);
  }
};

// ============================================
// CREATE NOTIFICATION (Helper function for other controllers)
// ============================================
exports.createNotification = async (data) => {
  try {
    const { recipient, sender, type, post, comment, message, content, link } = data;

    // Don't create notification if sender and recipient are the same
    if (recipient.toString() === sender.toString()) {
      return null;
    }

    const notification = await Notification.create({
      recipient,
      sender,
      type,
      post,
      comment,
      message,
      content,
      link,
    });

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};