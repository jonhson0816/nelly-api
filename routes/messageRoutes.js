const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getConversation,
  getAllConversations,
  deleteMessage,
  deleteMessageForEveryone,
  deleteConversation,
  markMessagesAsRead,
  getUnreadCount,
  searchMessages,
  addReaction,
  removeReaction,
  getUsersList,
  createCallRecord, // ✅ NEW FUNCTION
} = require('../controllers/messageController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { uploadImage, uploadMediaWithAudio } = require('../config/cloudinary');

// ============================================
// DEBUG ROUTES (OPTIONAL - Remove in production)
// ============================================
router.get('/debug/all-users', protect, async (req, res) => {
  try {
    const User = require('../models/User');
    
    const allUsers = await User.find({})
      .select('firstName lastName username email role isAdmin isActive _id')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: allUsers.length,
      currentUser: {
        id: req.user.id,
        username: req.user.username,
        isAdmin: req.user.isAdmin,
        role: req.user.role
      },
      allUsers: allUsers.map(u => ({
        id: u._id.toString(),
        name: `${u.firstName} ${u.lastName}`,
        username: u.username,
        email: u.email,
        role: u.role,
        isAdmin: u.isAdmin,
        isActive: u.isActive,
        isCurrentUser: u._id.toString() === req.user.id.toString()
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/debug/check-messages/:userId', protect, async (req, res) => {
  try {
    const Message = require('../models/Message');
    const User = require('../models/User');
    
    const adminUser = await User.findOne({ role: 'admin' });
    const messages = await Message.find({
      $or: [
        { sender: adminUser._id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: adminUser._id }
      ]
    }).populate('sender receiver', 'firstName lastName username role');
    
    res.json({
      success: true,
      adminId: adminUser._id,
      userId: req.params.userId,
      messagesCount: messages.length,
      messages: messages.map(m => ({
        id: m._id,
        from: `${m.sender.firstName} ${m.sender.lastName}`,
        to: `${m.receiver.firstName} ${m.receiver.lastName}`,
        content: m.content,
        createdAt: m.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/debug/check-user-messages/:userId', protect, async (req, res) => {
  try {
    const Message = require('../models/Message');
    const User = require('../models/User');
    const mongoose = require('mongoose');
    
    const userId = req.params.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Get all admins
    const admins = await User.find({ role: 'admin' }).select('_id firstName lastName username role');
    const adminIds = admins.map(a => a._id);
    
    console.log('🔍 DEBUG: User ID:', userId);
    console.log('🔍 DEBUG: User role:', user.role);
    console.log('🔍 DEBUG: Admin IDs:', adminIds);
    
    // Check messages WHERE user is sender
    const sentToAdmins = await Message.find({
      sender: userId,
      receiver: { $in: adminIds }
    }).populate('sender receiver', 'firstName lastName username role');
    
    // Check messages WHERE user is receiver
    const receivedFromAdmins = await Message.find({
      sender: { $in: adminIds },
      receiver: userId
    }).populate('sender receiver', 'firstName lastName username role');
    
    // Check ALL messages involving this user
    const allUserMessages = await Message.find({
      $or: [
        { sender: userId },
        { receiver: userId }
      ]
    }).populate('sender receiver', 'firstName lastName username role');
    
    res.json({
      success: true,
      debug: {
        userId: userId,
        userName: `${user.firstName} ${user.lastName}`,
        userRole: user.role,
        userIsAdmin: user.role === 'admin',
        admins: admins.map(a => ({
          id: a._id.toString(),
          name: `${a.firstName} ${a.lastName}`,
          username: a.username,
          role: a.role
        })),
        sentToAdmins: {
          count: sentToAdmins.length,
          messages: sentToAdmins.map(m => ({
            id: m._id,
            from: `${m.sender.firstName} ${m.sender.lastName} (${m.sender.role})`,
            to: `${m.receiver.firstName} ${m.receiver.lastName} (${m.receiver.role})`,
            content: m.content,
            createdAt: m.createdAt
          }))
        },
        receivedFromAdmins: {
          count: receivedFromAdmins.length,
          messages: receivedFromAdmins.map(m => ({
            id: m._id,
            from: `${m.sender.firstName} ${m.sender.lastName} (${m.sender.role})`,
            to: `${m.receiver.firstName} ${m.receiver.lastName} (${m.receiver.role})`,
            content: m.content,
            createdAt: m.createdAt
          }))
        },
        allUserMessages: {
          count: allUserMessages.length,
          messages: allUserMessages.map(m => ({
            id: m._id,
            from: `${m.sender.firstName} ${m.sender.lastName} (${m.sender.role})`,
            to: `${m.receiver.firstName} ${m.receiver.lastName} (${m.receiver.role})`,
            content: m.content,
            deletedFor: m.deletedFor,
            createdAt: m.createdAt
          }))
        }
      }
    });
  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// MAIN ROUTES
// ============================================

// Send message with optional media
router.post('/', protect, uploadMediaWithAudio.single('media'), sendMessage);

// ✅ NEW: Create call record (for call history)
router.post('/call-record', protect, createCallRecord);

// Get all conversations
router.get('/conversations', protect, getAllConversations);

// Get list of users (ADMIN ONLY)
router.get('/users', protect, adminOnly, getUsersList);

// Get conversation with specific user
router.get('/conversation/:userId', protect, getConversation);

// Get unread count
router.get('/unread-count', protect, getUnreadCount);

// Search messages
router.get('/search', protect, searchMessages);

// Mark messages as read
router.put('/mark-read/:userId', protect, markMessagesAsRead);

// Add reaction to message
router.post('/:id/reaction', protect, addReaction);

// Remove reaction from message
router.delete('/:id/reaction', protect, removeReaction);

// ============================================
// DELETE ROUTES (Order matters!)
// ============================================

// Delete entire conversation (MUST be before /:id routes)
router.delete('/conversation/:userId', protect, deleteConversation);

// Delete message for everyone (MUST be before general delete)
router.delete('/:id/delete-for-everyone', protect, deleteMessageForEveryone);

// Delete message for self
router.delete('/:id', protect, deleteMessage);

module.exports = router;