const Message = require('../models/Message');
const User = require('../models/User');
const { deleteFile } = require('../config/cloudinary');
const { createNotification } = require('./notificationController');

// ============================================
// SEND MESSAGE - FIXED VERSION
// ============================================
exports.sendMessage = async (req, res, next) => {
  try {
    const { receiverId, content, type, sticker, replyTo } = req.body;

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Receiver not found',
      });
    }

    // Prevent sending message to yourself
    if (receiverId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send message to yourself',
      });
    }

    // ============================================
    // MESSAGING RULES
    // ============================================
    
    if (req.user.isAdmin) {
      console.log('✅ Admin sending message to:', receiver.isAdmin ? 'Admin' : 'User');
    } else {
      if (!receiver.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'You can only send messages to admins. Normal users cannot message each other.',
        });
      }
      console.log('✅ Normal user sending message to admin');
    }

    // Create message data
    const messageData = {
      sender: req.user.id,
      receiver: receiverId,
      content: content || '',
      type: type || 'text',
      status: 'delivered',
    };

    // Handle sticker
    if (sticker) {
      messageData.type = 'sticker';
      messageData.sticker = typeof sticker === 'string' ? JSON.parse(sticker) : sticker;
    }

    // Handle reply
    if (replyTo) {
      messageData.replyTo = replyTo;
    }

   // ✅ CRITICAL: Handle media upload with network error recovery
    if (req.file) {
      try {
        let mediaType = 'file';
        let contentType = req.file.mimetype;
        
        if (req.file.mimetype.startsWith('image')) {
          mediaType = 'image';
        } else if (req.file.mimetype.startsWith('video')) {
          mediaType = 'video';
        } else if (req.file.mimetype.startsWith('audio')) {
          mediaType = 'audio';
          contentType = 'audio/mpeg'; // Cloudinary converts to MP3
        }

        // ✅ Check if file was uploaded to Cloudinary successfully
        if (!req.file.path) {
          throw new Error('File upload to Cloudinary failed - no URL returned');
        }

        // Verify the URL is accessible
        if (!req.file.path.includes('cloudinary.com')) {
          throw new Error('Invalid Cloudinary URL received');
        }

        // ✅ CRITICAL FIX: For audio, ensure MP3 URL format
        let finalUrl = req.file.path;
        
        if (mediaType === 'audio') {
          console.log('🎵 Original Cloudinary URL:', finalUrl);
          
          // Cloudinary returns URLs like:
          // https://res.cloudinary.com/[cloud]/video/upload/v[version]/[path].webm
          // We need to convert to:
          // https://res.cloudinary.com/[cloud]/video/upload/fl_attachment/v[version]/[path].mp3
          
          const parts = finalUrl.split('/upload/');
          if (parts.length === 2) {
            const basePart = parts[0] + '/upload/';
            let filePart = parts[1];
            
            // Remove existing extension and add .mp3
            filePart = filePart.replace(/\.[^/.]+$/, '') + '.mp3';
            
            // Add fl_attachment flag for better streaming
            finalUrl = basePart + 'fl_attachment/' + filePart;
            
            console.log('✅ Converted to MP3 URL:', finalUrl);
          }
        }

        messageData.media = {
          url: finalUrl,
          publicId: req.file.filename,
          type: mediaType,
          size: req.file.size,
          filename: req.file.originalname,
          mimeType: contentType,
          format: mediaType === 'audio' ? 'mp3' : req.file.format
        };
        
        messageData.type = mediaType;
        
        console.log('✅ Media uploaded successfully:', {
          type: mediaType,
          url: finalUrl,
          size: req.file.size,
          mimeType: contentType
        });

      } catch (uploadError) {
        console.error('❌ Cloudinary upload error:', uploadError.message);
        
        // ✅ CHECK IF IT'S A NETWORK ERROR
        if (uploadError.code === 'EAI_AGAIN' || 
            uploadError.message.includes('getaddrinfo') ||
            uploadError.message.includes('ENOTFOUND') ||
            uploadError.message.includes('ETIMEDOUT')) {
          
          return res.status(503).json({
            success: false,
            message: 'Network error: Cannot reach cloud storage. Please check your internet connection and try again.',
            error: 'Network connectivity issue',
            code: 'NETWORK_ERROR'
          });
        }
        
        // Other upload errors
        return res.status(500).json({
          success: false,
          message: 'Failed to upload media to cloud storage. Please try again.',
          error: uploadError.message,
          details: 'Cloudinary upload failed'
        });
      }
    }

    // Create message in database
    const message = await Message.create(messageData);

    // Populate related fields
    await message.populate([
      { path: 'sender', select: 'firstName lastName avatar username isAdmin' },
      { path: 'receiver', select: 'firstName lastName avatar username isAdmin' },
      { path: 'replyTo', select: 'content sender type' },
    ]);

    // ✅ CREATE NOTIFICATION FOR MESSAGE RECEIVER
    try {
      await createNotification({
        recipient: receiverId,
        sender: req.user.id,
        type: 'message',
        message: message._id,
        content: `${req.user.firstName} ${req.user.lastName} sent you a message`,
        link: `/chat?userId=${req.user.id}`,
      });
    } catch (notifError) {
      console.error('❌ Error creating notification:', notifError.message);
      // Don't fail the request if notification fails
    }

    console.log('✅ Message created successfully:', message._id);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message,
    });

  } catch (error) {
    console.error('❌ Error sending message:', error);
    
    // Send user-friendly error message
    res.status(500).json({
      success: false,
      message: 'Failed to send message. Please try again.',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// ============================================
// GET CONVERSATION
// ============================================
exports.getConversation = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Security check: Normal users can only view conversations with admins
    if (!req.user.isAdmin && !user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You can only view conversations with admins',
      });
    }

    const messages = await Message.getConversation(req.user.id, userId, page, limit);

    // ✅ FIX: Filter out duplicate call records
    // For call messages, only show the one where current user is the sender
    const filteredMessages = messages.filter((msg) => {
      if (msg.type === 'call') {
        // Only show call record if current user is the sender (their perspective)
        return msg.sender._id.toString() === req.user.id;
      }
      return true; // Show all non-call messages
    });

    // Mark received messages as read
    const unreadMessages = filteredMessages.filter(
      (msg) => msg.receiver.toString() === req.user.id && !msg.isRead
    );

    for (const msg of unreadMessages) {
      await msg.markAsRead();
    }

    res.status(200).json({
      success: true,
      count: filteredMessages.length,
      page,
      messages: filteredMessages,
      otherUser: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        username: user.username,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// GET ALL CONVERSATIONS
// ============================================
exports.getAllConversations = async (req, res, next) => {
  try {
    console.log('🔍 Getting conversations for user:', req.user.id, 'isAdmin:', req.user.isAdmin, 'role:', req.user.role);
    
    let userIds;

    if (req.user.isAdmin) {
      // Admin sees ALL users they've messaged (other admins + normal users)
      const sentMessages = await Message.distinct('receiver', {
        sender: req.user.id,
      });

      const receivedMessages = await Message.distinct('sender', {
        receiver: req.user.id,
      });

      // ✅ FIX: Convert to Set to remove duplicates, then back to array
      userIds = [...new Set([...sentMessages, ...receivedMessages])]
        .filter(id => id.toString() !== req.user.id.toString())
        .map(id => id.toString()); // Convert all to strings for comparison
      
      console.log('👑 Admin - Found user IDs:', userIds.length);
    } else {
      // Get all admin users BY ROLE
      const adminUsers = await User.find({ role: 'admin' }).select('_id firstName lastName');
      const adminIds = adminUsers.map(admin => admin._id);
      
      console.log('👤 Regular user - Found admins:', adminIds.length);
      console.log('🆔 Admin ObjectIds:', adminIds);
      
      if (adminIds.length === 0) {
        console.log('⚠️ No admins found in database!');
        return res.status(200).json({
          success: true,
          count: 0,
          conversations: [],
        });
      }

      // Find ALL messages between this user and ANY admin
      const messages = await Message.find({
        $or: [
          { sender: req.user.id, receiver: { $in: adminIds } },
          { sender: { $in: adminIds }, receiver: req.user.id }
        ],
        deletedFor: { $ne: req.user.id }
      }).select('sender receiver content createdAt');

      console.log('📧 Total messages found:', messages.length);
      
      if (messages.length > 0) {
        console.log('📨 Sample message:', {
          sender: messages[0].sender.toString(),
          receiver: messages[0].receiver.toString(),
          content: messages[0].content?.substring(0, 50) || 'N/A'
        });
      }

      // ✅ FIX: Use Set to get unique admin IDs
      const adminIdsFromMessages = new Set();
      
      messages.forEach(msg => {
        const senderId = msg.sender.toString();
        const receiverId = msg.receiver.toString();
        const currentUserId = req.user.id.toString();
        
        if (senderId === currentUserId) {
          adminIdsFromMessages.add(receiverId);
        } else {
          adminIdsFromMessages.add(senderId);
        }
      });

      userIds = Array.from(adminIdsFromMessages);
      
      console.log('📋 User conversations with admins:', userIds.length);
      console.log('🆔 Conversation Admin IDs:', userIds);
    }

    // ✅ FIX: Ensure userIds are unique before processing
    const uniqueUserIds = [...new Set(userIds.map(id => id.toString()))];
    
    console.log(`🔧 Removed ${userIds.length - uniqueUserIds.length} duplicate IDs`);

    // Build conversation list
    const conversations = await Promise.all(
      uniqueUserIds.map(async (userId) => {
        const lastMessage = await Message.findOne({
          $or: [
            { sender: req.user.id, receiver: userId },
            { sender: userId, receiver: req.user.id },
          ],
          deletedFor: { $ne: req.user.id },
        })
          .sort({ createdAt: -1 })
          .populate('sender', 'firstName lastName avatar username role')
          .populate('receiver', 'firstName lastName avatar username role');

        if (!lastMessage) {
          console.log('⚠️ No last message found for userId:', userId);
          return null;
        }

        const unreadCount = await Message.countDocuments({
          sender: userId,
          receiver: req.user.id,
          isRead: false,
          deletedFor: { $ne: req.user.id },
        });

        const otherUser =
          lastMessage.sender._id.toString() === req.user.id.toString()
            ? lastMessage.receiver
            : lastMessage.sender;

        const isOtherUserAdmin = otherUser.role === 'admin';
        
        console.log('✅ Conversation:', otherUser.firstName, otherUser.lastName, '(Role:', otherUser.role, ', Admin:', isOtherUserAdmin + ')');

        return {
          user: {
            _id: otherUser._id,
            firstName: otherUser.firstName,
            lastName: otherUser.lastName,
            username: otherUser.username,
            avatar: otherUser.avatar,
            isAdmin: isOtherUserAdmin,
            isOnline: false,
          },
          lastMessage: {
            content: lastMessage.content,
            type: lastMessage.type,
            createdAt: lastMessage.createdAt,
            isRead: lastMessage.isRead,
            sender: lastMessage.sender._id,
          },
          unreadCount,
        };
      })
    );

    const validConversations = conversations
      .filter((conv) => conv !== null)
      .sort((a, b) => b.lastMessage.createdAt - a.lastMessage.createdAt);

    console.log('📬 Total conversations to return:', validConversations.length);

    res.status(200).json({
      success: true,
      count: validConversations.length,
      conversations: validConversations,
    });
  } catch (error) {
    console.error('❌ Error in getAllConversations:', error);
    next(error);
  }
};

// ============================================
// GET USERS LIST (ADMIN ONLY)
// ============================================
exports.getUsersList = async (req, res, next) => {
  try {
    // Only admin can access this
    if (!req.user.isAdmin && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    const search = req.query.search || '';
    const limit = parseInt(req.query.limit) || 100;

    console.log('🔍 Admin searching users');
    console.log('👤 Current admin ID:', req.user.id);
    console.log('🔎 Search term:', search);

    // Get ALL active users
    let allUsers = await User.find({ isActive: true })
      .select('firstName lastName avatar username email role isAdmin')
      .sort({ firstName: 1, lastName: 1 })
      .limit(limit);

    console.log('📊 Total users in DB:', allUsers.length);

    // Filter: Remove current admin (keep other admins + all normal users)
    let filteredUsers = allUsers.filter(user => {
      if (user._id.toString() === req.user.id.toString()) {
        console.log('⏭️ Skipping current admin:', user.username);
        return false;
      }
      return true;
    });

    console.log('✅ Users after filtering:', filteredUsers.length);
    console.log('📋 User types:', {
      admins: filteredUsers.filter(u => u.isAdmin).length,
      normalUsers: filteredUsers.filter(u => !u.isAdmin).length
    });

    // Apply search filter if provided
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filteredUsers = filteredUsers.filter(user => {
        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
        const username = user.username?.toLowerCase() || '';
        const email = user.email?.toLowerCase() || '';
        
        return fullName.includes(searchLower) || 
               username.includes(searchLower) || 
               email.includes(searchLower);
      });
      console.log('🔍 Users after search filter:', filteredUsers.length);
    }

    res.status(200).json({
      success: true,
      count: filteredUsers.length,
      total: filteredUsers.length,
      users: filteredUsers,
    });
  } catch (error) {
    console.error('❌ Error in getUsersList:', error);
    next(error);
  }
};

// ============================================
// ADD REACTION
// ============================================
exports.addReaction = async (req, res, next) => {
  try {
    const { emoji } = req.body;
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Check if user is part of conversation
    if (
      message.sender.toString() !== req.user.id &&
      message.receiver.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    await message.addReaction(req.user.id, emoji);

    res.status(200).json({
      success: true,
      message: 'Reaction added',
      reactions: message.reactions,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// REMOVE REACTION
// ============================================
exports.removeReaction = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    await message.removeReaction(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Reaction removed',
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// DELETE MESSAGE
// ============================================
exports.deleteMessage = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    if (
      message.sender.toString() !== req.user.id &&
      message.receiver.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    if (!message.deletedFor.includes(req.user.id)) {
      message.deletedFor.push(req.user.id);
    }

    if (message.deletedFor.length === 2) {
      if (message.media && message.media.publicId) {
        await deleteFile(message.media.publicId);
      }
      await message.deleteOne();
    } else {
      await message.save();
    }

    res.status(200).json({
      success: true,
      message: 'Message deleted',
    });
  } catch (error) {
    next(error);
  }
};

// DELETE MESSAGE FOR EVERYONE (Sender only - permanent delete)
exports.deleteMessageForEveryone = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // ✅ IMPORTANT: Only the sender can delete for everyone
    if (message.sender.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the sender can delete this message for everyone',
      });
    }

    // Delete media from Cloudinary if exists
    if (message.media && message.media.publicId) {
      await deleteFile(message.media.publicId);
    }

    // Permanently delete the message from database
    await message.deleteOne();

    console.log('✅ Message deleted for everyone:', message._id);

    res.status(200).json({
      success: true,
      message: 'Message deleted for everyone',
    });
  } catch (error) {
    console.error('❌ Error deleting message for everyone:', error);
    next(error);
  }
};

// ============================================
// MARK MESSAGES AS READ
// ============================================
exports.markMessagesAsRead = async (req, res, next) => {
  try {
    const { userId } = req.params;

    await Message.updateMany(
      {
        sender: userId,
        receiver: req.user.id,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: Date.now(),
          status: 'read',
        },
      }
    );

    res.status(200).json({
      success: true,
      message: 'Messages marked as read',
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// GET UNREAD COUNT
// ============================================
exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await Message.getUnreadCount(req.user.id);

    res.status(200).json({
      success: true,
      unreadCount: count,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// SEARCH MESSAGES
// ============================================
exports.searchMessages = async (req, res, next) => {
  try {
    const { query } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const searchQuery = {
      $or: [
        { sender: req.user.id },
        { receiver: req.user.id },
      ],
      content: { $regex: query, $options: 'i' },
      deletedFor: { $ne: req.user.id },
    };

    const messages = await Message.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'firstName lastName avatar username')
      .populate('receiver', 'firstName lastName avatar username');

    const total = await Message.countDocuments(searchQuery);

    res.status(200).json({
      success: true,
      count: messages.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      messages,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// DELETE ENTIRE CONVERSATION
// ============================================
exports.deleteConversation = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Verify the other user exists
    const otherUser = await User.findById(userId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Delete all messages between these two users
    const result = await Message.deleteMany({
      $or: [
        { sender: req.user.id, receiver: userId },
        { sender: userId, receiver: req.user.id }
      ]
    });

    console.log(`✅ Deleted ${result.deletedCount} messages in conversation with ${otherUser.firstName}`);

    res.status(200).json({
      success: true,
      message: 'Conversation deleted successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('❌ Error deleting conversation:', error);
    next(error);
  }
};

// ============================================
// CREATE CALL RECORD (For Call History) - FIXED
// ============================================
exports.createCallRecord = async (req, res, next) => {
  try {
    const { receiverId, duration, callType, status } = req.body;

    console.log('📞 Creating call record:', {
      sender: req.user.id,
      receiver: receiverId,
      duration,
      callType,
      status
    });

    // Validate receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Receiver not found',
      });
    }

    // Determine call status for SENDER (current user who made the request)
    let senderStatus = 'missed'; // Default
    let receiverStatus = 'missed'; // Default
    
    if (status === 'completed' && duration > 0) {
      senderStatus = 'completed';
      receiverStatus = 'completed';
    } else if (status === 'declined') {
      senderStatus = 'declined';
      receiverStatus = 'declined';
    } else if (status === 'missed' || duration === 0) {
      // ✅ CRITICAL FIX: Different status based on who created the record
      // If sender (initiator) creates record → they see "missed" (no answer)
      // If receiver creates record → they see "missed" (they missed it)
      senderStatus = 'missed';
      receiverStatus = 'missed';
    }

    console.log('📋 Sender status:', senderStatus);
    console.log('📋 Receiver status:', receiverStatus);

    // ✅ Create call record for SENDER (current user)
    const senderCallRecord = await Message.create({
      sender: req.user.id,
      receiver: receiverId,
      type: 'call',
      content: '',
      callData: {
        duration,
        callType: callType || 'audio',
        status: senderStatus,
        timestamp: new Date(),
      },
      status: 'delivered',
    });

    await senderCallRecord.populate([
      { path: 'sender', select: 'firstName lastName avatar username isAdmin' },
      { path: 'receiver', select: 'firstName lastName avatar username isAdmin' },
    ]);

    // ✅ Create call record for RECEIVER (for their chat history)
    const receiverCallRecord = await Message.create({
      sender: receiverId,
      receiver: req.user.id,
      type: 'call',
      content: '',
      callData: {
        duration,
        callType: callType || 'audio',
        status: receiverStatus,
        timestamp: new Date(),
      },
      status: 'delivered',
    });

    await receiverCallRecord.populate([
      { path: 'sender', select: 'firstName lastName avatar username isAdmin' },
      { path: 'receiver', select: 'firstName lastName avatar username isAdmin' },
    ]);

    console.log('✅ Call records created for both users');

    res.status(201).json({
      success: true,
      message: 'Call record created',
      data: senderCallRecord,
    });
  } catch (error) {
    console.error('❌ Error creating call record:', error);
    next(error);
  }
};