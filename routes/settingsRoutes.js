const express = require('express');
const router = express.Router();
const {
  getSettings,
  updatePrivacySettings,
  updateNotificationSettings,
  updateSecuritySettings,
  updateAccountSettings,
  blockUser,
  unblockUser,
  getBlockedUsers,
  muteUser,
  unmuteUser,
  getActiveSessions,
  removeSession
} = require('../controllers/settingsController');
const { protect } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// Main settings route
router.route('/').get(getSettings);

// Privacy settings
router.route('/privacy').put(updatePrivacySettings);

// Notification settings
router.route('/notifications').put(updateNotificationSettings);

// Security settings
router.route('/security').put(updateSecuritySettings);

// Account settings
router.route('/account').put(updateAccountSettings);

// Block/Unblock users
router.route('/block/:userId')
  .post(blockUser)
  .delete(unblockUser);

router.route('/blocked').get(getBlockedUsers);

// Mute/Unmute users
router.route('/mute/:userId')
  .post(muteUser)
  .delete(unmuteUser);

// Sessions management
router.route('/sessions')
  .get(getActiveSessions);

router.route('/sessions/:sessionId')
  .delete(removeSession);

module.exports = router;