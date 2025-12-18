const express = require('express');
const router = express.Router();
const {
  getPlatformStats,
  refreshPlatformStats,
  getStatsHistory,
  getGrowthAnalytics,
} = require('../controllers/platformStatsController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Public routes
router.get('/', getPlatformStats);
router.get('/growth', getGrowthAnalytics);

// Admin-only routes
router.post('/refresh', protect, adminOnly, refreshPlatformStats);
router.get('/history', protect, adminOnly, getStatsHistory);

module.exports = router;