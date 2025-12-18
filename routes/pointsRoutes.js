const express = require('express');
const router = express.Router();
const {
  getMyStats,
  getUserStats,
  awardPoints,
  checkBadges,
  getAllBadges,
  getMyBadges,
  getLeaderboard,
  getPointsConfig,
  awardBadge
} = require('../controllers/pointsController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ============================================
// PUBLIC ROUTES
// ============================================

// Get leaderboard
router.get('/leaderboard', getLeaderboard);

// Get points configuration
router.get('/config', getPointsConfig);

// Get user stats by ID
router.get('/stats/:userId', getUserStats);

// ============================================
// PROTECTED ROUTES (Login Required)
// ============================================

// Get current user's stats
router.get('/stats', protect, getMyStats);

// Get current user's badges
router.get('/my-badges', protect, getMyBadges);

// Get all available badges
router.get('/badges', protect, getAllBadges);

// Check and award badges
router.post('/check-badges', protect, checkBadges);

// ============================================
// ADMIN ONLY ROUTES
// ============================================

// Award points to user
router.post('/award', protect, adminOnly, awardPoints);

// Manually award badge to user
router.post('/award-badge', protect, adminOnly, awardBadge);

module.exports = router;