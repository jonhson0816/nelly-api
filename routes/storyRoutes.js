const express = require('express');
const {
  createStory,
  getAllStories,
  getStoryById,
  recordView,
  likeStory,
  unlikeStory,
  commentOnStory,
  deleteComment,
  shareStory,
  votePoll,
  getStoryAnalytics,
  deleteStory,
  saveAsHighlight,
  getHighlights,
  reportStory,
} = require('../controllers/storyController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { uploadVideo } = require('../config/cloudinary');

const router = express.Router();

// ============================================
// PUBLIC ROUTES
// ============================================
router.get('/highlights', getHighlights);

// ============================================
// PROTECTED ROUTES
// ============================================
router.get('/', protect, getAllStories);
router.get('/:id', protect, getStoryById);
router.post('/:id/view', protect, recordView);
router.post('/:id/like', protect, likeStory);
router.delete('/:id/like', protect, unlikeStory);
router.post('/:id/comment', protect, commentOnStory);
router.delete('/:id/comment/:commentId', protect, deleteComment);
router.post('/:id/share', protect, shareStory);
router.post('/:id/poll/vote', protect, votePoll);
router.post('/:id/report', protect, reportStory);

// ============================================
// ADMIN ONLY ROUTES
// ============================================

// Create story - supports multiple files (up to 10)
router.post(
  '/',
  protect,
  adminOnly,
  uploadVideo.array('media', 10), // Allow up to 10 files
  createStory
);

router.get('/:id/analytics', protect, adminOnly, getStoryAnalytics);
router.put('/:id/highlight', protect, adminOnly, saveAsHighlight);
router.delete('/:id', protect, adminOnly, deleteStory);

module.exports = router;