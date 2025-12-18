const express = require('express');
const router = express.Router();
const {
  createAchievement,
  getAchievements,
  getAchievement,
  updateAchievement,
  deleteAchievement,
  addToGallery,
  removeFromGallery,
  getFeaturedAchievements,
  getAchievementsByYear,
  getAchievementStats,
} = require('../controllers/achievementController');

const { protect, adminOnly } = require('../middleware/authMiddleware');
const { uploadImage } = require('../config/cloudinary');

// ============================================
// PUBLIC ROUTES
// ============================================

// Get featured achievements
router.get('/featured', getFeaturedAchievements);

// Get achievement statistics
router.get('/stats/overview', getAchievementStats);

// Get achievements by year
router.get('/year/:year', getAchievementsByYear);

// Get all achievements
router.get('/', getAchievements);

// Get single achievement
router.get('/:id', getAchievement);

// ============================================
// ADMIN ONLY ROUTES
// ============================================

// Create new achievement
router.post('/', protect, adminOnly, uploadImage.single('coverImage'), createAchievement);

// Update achievement
router.put('/:id', protect, adminOnly, uploadImage.single('coverImage'), updateAchievement);

// Delete achievement
router.delete('/:id', protect, adminOnly, deleteAchievement);

// Add image to gallery
router.post('/:id/gallery', protect, adminOnly, uploadImage.single('image'), addToGallery);

// Remove image from gallery
router.delete('/:id/gallery/:imageId', protect, adminOnly, removeFromGallery);

module.exports = router;