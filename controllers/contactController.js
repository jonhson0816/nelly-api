const User = require('../models/User');
const Message = require('../models/Message');
const { createNotification } = require('./notificationController');

// ============================================
// SUBMIT CONTACT FORM - Logged-in User to ALL Admins
// ============================================
exports.submitContactForm = async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Validate message length
    if (message.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Message must be at least 10 characters long'
      });
    }

    console.log('📧 Contact form submission from logged-in user:', req.user.id);

    // ============================================
    // STEP 1: Get the logged-in user (sender)
    // ============================================
    
    const sender = await User.findById(req.user.id);
    
    if (!sender) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please login again.'
      });
    }

    console.log('✅ Sender:', sender.firstName, sender.lastName, '(', sender.email, ')');

    // ============================================
    // STEP 2: Find ALL admin users
    // ============================================
    
    const adminUsers = await User.find({ 
      role: 'admin',
      isActive: true 
    }).sort({ createdAt: 1 });

    if (!adminUsers || adminUsers.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'No admin available to receive your message. Please try again later.'
      });
    }

    console.log(`👑 Found ${adminUsers.length} admin(s):`, adminUsers.map(a => a.username));

    // ============================================
    // STEP 3: Create formatted message content
    // ============================================
    
    const formattedMessage = `📩 Contact Form Submission

👤 Name: ${name}
📧 Email: ${email}
📌 Subject: ${subject}

💬 Message:
${message}

---
Sent via Contact Form`;

    // ============================================
    // STEP 4: Create message for EACH admin
    // ============================================
    
    const createdMessages = [];
    const notificationPromises = [];

    for (const adminUser of adminUsers) {
      // Skip if sender is admin and trying to send to themselves
      if (adminUser._id.toString() === sender._id.toString()) {
        console.log('⏭️ Skipping self (sender is admin)');
        continue;
      }

      // Create individual message for this admin
      const newMessage = await Message.create({
        sender: sender._id,
        receiver: adminUser._id,
        content: formattedMessage,
        type: 'text',
        status: 'delivered',
        isRead: false
      });

      // Populate sender and receiver details
      await newMessage.populate([
        { path: 'sender', select: 'firstName lastName avatar username email role' },
        { path: 'receiver', select: 'firstName lastName avatar username email role' }
      ]);

      console.log(`✅ Message created for admin ${adminUser.username}:`, newMessage._id);
      createdMessages.push(newMessage);

      // ============================================
      // STEP 5: Create notification for THIS admin
      // ============================================
      
      notificationPromises.push(
        createNotification({
          recipient: adminUser._id,
          sender: sender._id,
          type: 'message',
          message: newMessage._id,
          content: `New contact form submission from ${sender.firstName} ${sender.lastName}`,
          link: `/messenger?userId=${sender._id}`
        })
      );
    }

    // Wait for all notifications to be created
    await Promise.all(notificationPromises);
    console.log(`🔔 ${notificationPromises.length} notification(s) sent to admin(s)`);

    // ============================================
    // STEP 6: Send success response
    // ============================================
    
    res.status(201).json({
      success: true,
      message: 'Your message has been sent successfully! We will respond shortly.',
      data: {
        messagesCreated: createdMessages.length,
        adminCount: adminUsers.length,
        sender: {
          id: sender._id,
          name: `${sender.firstName} ${sender.lastName}`,
          email: sender.email,
          username: sender.username
        },
        adminsNotified: adminUsers.map(admin => ({
          id: admin._id,
          name: `${admin.firstName} ${admin.lastName}`,
          username: admin.username
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error in submitContactForm:', error);
    next(error);
  }
};

// ============================================
// GET CONTACT SUBMISSIONS (ADMIN ONLY)
// ============================================
exports.getContactSubmissions = async (req, res, next) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view contact submissions'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Find all messages that came from contact form
    // (messages containing "Contact Form Submission")
    const submissions = await Message.find({
      receiver: req.user.id,
      content: { $regex: 'Contact Form Submission', $options: 'i' }
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'firstName lastName email username avatar role')
      .populate('receiver', 'firstName lastName username role');

    const total = await Message.countDocuments({
      receiver: req.user.id,
      content: { $regex: 'Contact Form Submission', $options: 'i' }
    });

    res.status(200).json({
      success: true,
      count: submissions.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      submissions
    });

  } catch (error) {
    console.error('❌ Error in getContactSubmissions:', error);
    next(error);
  }
};