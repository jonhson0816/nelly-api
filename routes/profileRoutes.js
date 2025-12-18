const express = require('express');
const {
  getMyProfile,
  getProfile,
  updateProfile,
  updateCoverPhoto,
  updateAvatar,  // ADD THIS LINE
  addToGallery,
  removeFromGallery,
  addFeaturedPost,
  removeFeaturedPost,
  getProfileAnalytics,
  searchProfiles,
} = require('../controllers/profileController');
const { protect, adminOnly, optionalAuth } = require('../middleware/authMiddleware');
const { uploadImage } = require('../config/cloudinary');

const router = express.Router();

// ============================================
// PUBLIC ROUTES
// ============================================

// Search profiles
router.get('/search', searchProfiles);

// Get current user's profile (PLACE THIS BEFORE :identifier)
router.get('/me', protect, getMyProfile);

// Update profile
router.put('/me', protect, updateProfile);

// Update cover photo
router.put('/me/cover', protect, uploadImage.single('coverPhoto'), updateCoverPhoto);

// UPDATE AVATAR PHOTO - ADD THIS LINE
router.put('/me/avatar', protect, uploadImage.single('avatar'), updateAvatar);

// Gallery management
router.post('/me/gallery', protect, uploadImage.single('media'), addToGallery);
router.delete('/me/gallery/:imageId', protect, removeFromGallery);

// Featured posts management (Admin only)
router.post('/me/featured-posts/:postId', protect, adminOnly, addFeaturedPost);
router.delete('/me/featured-posts/:postId', protect, adminOnly, removeFeaturedPost);

// Get profile analytics (Admin only)
router.get('/:identifier/analytics', protect, adminOnly, getProfileAnalytics);

// Get any profile by username or ID (must be LAST)
router.get('/:identifier', optionalAuth, getProfile);

module.exports = router;