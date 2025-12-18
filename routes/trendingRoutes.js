const express = require('express');
const router = express.Router();
const { protect, adminOnly, optionalAuth } = require('../middleware/authMiddleware');
const {
  getTrending,
  searchByHashtag,
  getHashtagDetails,
  updateTrending,
  getTrendingStats,
  deleteTrendingHashtag,
  cleanupTrending,
} = require('../controllers/trendingController');

// ============================================
// PUBLIC ROUTES
// ============================================

// Get top trending hashtags
router.get('/', optionalAuth, getTrending);

// Search posts and comments by hashtag
router.get('/search/:hashtag', optionalAuth, searchByHashtag);

// Get hashtag details
router.get('/:hashtag', optionalAuth, getHashtagDetails);

// ============================================
// ADMIN ROUTES
// ============================================

// Update trending data (manual trigger)
router.post('/update', protect, adminOnly, updateTrending);

// Get trending statistics
router.get('/admin/stats', protect, adminOnly, getTrendingStats);

// Delete trending hashtag
router.delete('/:hashtag', protect, adminOnly, deleteTrendingHashtag);

// Clean up old trending data
router.post('/cleanup', protect, adminOnly, cleanupTrending);

module.exports = router;