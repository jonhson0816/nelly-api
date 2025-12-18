const Settings = require('../models/Settings');
const User = require('../models/User');

// @desc    Get user settings
// @route   GET /api/settings
// @access  Private
exports.getSettings = async (req, res, next) => {
  try {
    // FIX: Use req.user._id instead of req.user.id
    const userId = req.user._id || req.user.id;
    
    let settings = await Settings.findOne({ user: userId });

    // Create default settings if they don't exist
    if (!settings) {
      settings = await Settings.create({ user: userId });
    }

    res.status(200).json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Error in getSettings:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching settings'
    });
  }
};

// @desc    Update privacy settings
// @route   PUT /api/settings/privacy
// @access  Private
exports.updatePrivacySettings = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    
    let settings = await Settings.findOne({ user: userId });

    if (!settings) {
      settings = await Settings.create({ user: userId });
    }

    settings.privacy = {
      ...settings.privacy.toObject(),
      ...req.body
    };

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Privacy settings updated successfully',
      settings
    });
  } catch (error) {
    console.error('Error in updatePrivacySettings:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating privacy settings'
    });
  }
};

// @desc    Update notification settings
// @route   PUT /api/settings/notifications
// @access  Private
exports.updateNotificationSettings = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    
    let settings = await Settings.findOne({ user: userId });

    if (!settings) {
      settings = await Settings.create({ user: userId });
    }

    settings.notifications = {
      ...settings.notifications.toObject(),
      ...req.body
    };

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Notification settings updated successfully',
      settings
    });
  } catch (error) {
    console.error('Error in updateNotificationSettings:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating notification settings'
    });
  }
};

// @desc    Update security settings
// @route   PUT /api/settings/security
// @access  Private
exports.updateSecuritySettings = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    
    let settings = await Settings.findOne({ user: userId });

    if (!settings) {
      settings = await Settings.create({ user: userId });
    }

    const { twoFactorEnabled, loginAlerts, loginApprovals } = req.body;

    if (twoFactorEnabled !== undefined) {
      settings.security.twoFactorEnabled = twoFactorEnabled;
    }
    if (loginAlerts !== undefined) {
      settings.security.loginAlerts = loginAlerts;
    }
    if (loginApprovals !== undefined) {
      settings.security.loginApprovals = loginApprovals;
    }

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Security settings updated successfully',
      settings
    });
  } catch (error) {
    console.error('Error in updateSecuritySettings:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating security settings'
    });
  }
};

// @desc    Update account settings
// @route   PUT /api/settings/account
// @access  Private
exports.updateAccountSettings = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    
    let settings = await Settings.findOne({ user: userId });

    if (!settings) {
      settings = await Settings.create({ user: userId });
    }

    settings.account = {
      ...settings.account.toObject(),
      ...req.body
    };

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Account settings updated successfully',
      settings
    });
  } catch (error) {
    console.error('Error in updateAccountSettings:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating account settings'
    });
  }
};

// @desc    Block user
// @route   POST /api/settings/block/:userId
// @access  Private
exports.blockUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id || req.user.id;

    if (userId === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot block yourself'
      });
    }

    let settings = await Settings.findOne({ user: currentUserId });

    if (!settings) {
      settings = await Settings.create({ user: currentUserId });
    }

    // Check if already blocked
    const isBlocked = settings.blockedUsers.some(
      blocked => blocked.user.toString() === userId
    );

    if (isBlocked) {
      return res.status(400).json({
        success: false,
        message: 'User already blocked'
      });
    }

    settings.blockedUsers.push({ user: userId });
    await settings.save();

    res.status(200).json({
      success: true,
      message: 'User blocked successfully'
    });
  } catch (error) {
    console.error('Error in blockUser:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error blocking user'
    });
  }
};

// @desc    Unblock user
// @route   DELETE /api/settings/block/:userId
// @access  Private
exports.unblockUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id || req.user.id;

    const settings = await Settings.findOne({ user: currentUserId });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Settings not found'
      });
    }

    settings.blockedUsers = settings.blockedUsers.filter(
      blocked => blocked.user.toString() !== userId
    );

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'User unblocked successfully'
    });
  } catch (error) {
    console.error('Error in unblockUser:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error unblocking user'
    });
  }
};

// @desc    Get blocked users
// @route   GET /api/settings/blocked
// @access  Private
exports.getBlockedUsers = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    
    const settings = await Settings.findOne({ user: userId })
      .populate('blockedUsers.user', 'firstName lastName username avatar');

    if (!settings) {
      return res.status(200).json({
        success: true,
        blockedUsers: []
      });
    }

    res.status(200).json({
      success: true,
      blockedUsers: settings.blockedUsers
    });
  } catch (error) {
    console.error('Error in getBlockedUsers:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching blocked users'
    });
  }
};

// @desc    Mute user
// @route   POST /api/settings/mute/:userId
// @access  Private
exports.muteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { duration } = req.body;
    const currentUserId = req.user._id || req.user.id;

    let settings = await Settings.findOne({ user: currentUserId });

    if (!settings) {
      settings = await Settings.create({ user: currentUserId });
    }

    // Check if already muted
    const isMuted = settings.mutedUsers.some(
      muted => muted.user.toString() === userId
    );

    if (isMuted) {
      return res.status(400).json({
        success: false,
        message: 'User already muted'
      });
    }

    const muteData = { user: userId };
    
    if (duration) {
      muteData.mutedUntil = new Date(Date.now() + duration * 60 * 60 * 1000);
    }

    settings.mutedUsers.push(muteData);
    await settings.save();

    res.status(200).json({
      success: true,
      message: duration 
        ? `User muted for ${duration} hours` 
        : 'User muted indefinitely'
    });
  } catch (error) {
    console.error('Error in muteUser:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error muting user'
    });
  }
};

// @desc    Unmute user
// @route   DELETE /api/settings/mute/:userId
// @access  Private
exports.unmuteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id || req.user.id;

    const settings = await Settings.findOne({ user: currentUserId });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Settings not found'
      });
    }

    settings.mutedUsers = settings.mutedUsers.filter(
      muted => muted.user.toString() !== userId
    );

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'User unmuted successfully'
    });
  } catch (error) {
    console.error('Error in unmuteUser:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error unmuting user'
    });
  }
};

// @desc    Get active sessions
// @route   GET /api/settings/sessions
// @access  Private
exports.getActiveSessions = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    
    const settings = await Settings.findOne({ user: userId });

    if (!settings) {
      return res.status(200).json({
        success: true,
        sessions: []
      });
    }

    res.status(200).json({
      success: true,
      sessions: settings.security.activeSessions || []
    });
  } catch (error) {
    console.error('Error in getActiveSessions:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching sessions'
    });
  }
};

// @desc    Remove session
// @route   DELETE /api/settings/sessions/:sessionId
// @access  Private
exports.removeSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id || req.user.id;

    const settings = await Settings.findOne({ user: userId });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Settings not found'
      });
    }

    settings.security.activeSessions = settings.security.activeSessions.filter(
      session => session._id.toString() !== sessionId
    );

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Session removed successfully'
    });
  } catch (error) {
    console.error('Error in removeSession:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error removing session'
    });
  }
};