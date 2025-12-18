const express = require('express');
const router = express.Router();
const {
  getAllGalleryMedia,
  getPhotos,
  getVideos,
  getAlbums,
} = require('../controllers/galleryController');

// FIXED IMPORT
const { protect, optionalAuth } = require('../middleware/authMiddleware');

// ============================================
// GALLERY ROUTES
// ============================================

// @route   GET /api/gallery
// @desc    Get all media (photos + videos) from posts and profile
// @access  Private
router.get('/', protect, getAllGalleryMedia);

// @route   GET /api/gallery/photos
// @desc    Get photos only
// @access  Private
router.get('/photos', protect, getPhotos);

// @route   GET /api/gallery/videos
// @desc    Get videos only
// @access  Private
router.get('/videos', protect, getVideos);

// @route   GET /api/gallery/albums
// @desc    Get albums (grouped by month/year)
// @access  Private
router.get('/albums', protect, getAlbums);

// @route   GET /api/gallery/user/:userId
// @desc    Get specific user's gallery (for viewing other profiles)
// @access  Private
router.get('/user/:userId', protect, getAllGalleryMedia);

module.exports = router;