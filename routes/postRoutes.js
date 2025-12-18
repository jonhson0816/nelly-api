const express = require('express');
const router = express.Router();
const { protect, optionalAuth, adminOnly } = require('../middleware/authMiddleware');
const { uploadMedia } = require('../config/cloudinary');

const {
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost,
  sharePost,
  getPostStats,
  toggleLike,
  // New enhanced routes
  reactToPost,
  reactToMedia,
  getPostReactions,
  getMediaReactions,
  commentOnMedia,
  getMediaComments,
  tagUserInMedia,
  removeTagFromMedia,
  likeMediaComment,
  editComment,
  deleteComment,
} = require('../controllers/postController');

// ============================================
// POST ROUTES
// ============================================

// Get all posts (with optional auth)
router.get('/', optionalAuth, getPosts);

// Create new post (Admin only)
router.post('/', protect, adminOnly, uploadMedia.array('media', 10), createPost);

// Get single post
router.get('/:id', optionalAuth, getPost);

// Update post (Admin only)
router.put('/:id', protect, adminOnly, updatePost);

// Delete post (Admin only)
router.delete('/:id', protect, adminOnly, deletePost);

// Share post
router.put('/:id/share', protect, sharePost);

// Like/Unlike post (ADD THIS LINE)
router.put('/:id/like', protect, toggleLike);

// Get post stats (Admin only)
router.get('/:id/stats', protect, adminOnly, getPostStats);

// ============================================
// REACTION ROUTES
// ============================================

// React to post (like, love, haha, wow, sad, angry)
router.put('/:id/react', protect, reactToPost);

// Get who reacted to post
router.get('/:id/reactions', protect, getPostReactions);

// React to specific media
router.put('/:id/media/:mediaIndex/react', protect, reactToMedia);

// Get who reacted to specific media
router.get('/:id/media/:mediaIndex/reactions', protect, getMediaReactions);

// ============================================
// MEDIA COMMENT ROUTES
// ============================================

// Comment on specific media
router.post('/:id/media/:mediaIndex/comments', protect, commentOnMedia);

// Get comments on specific media
router.get('/:id/media/:mediaIndex/comments', protect, getMediaComments);

// Like media comment
router.put('/media-comments/:commentId/like', protect, likeMediaComment);

// ============================================
// TAGGING ROUTES
// ============================================

// Tag user in media (Admin only)
router.post('/:id/media/:mediaIndex/tag', protect, adminOnly, tagUserInMedia);

// Remove tag from media (Admin or tagged user)
router.delete('/:id/media/:mediaIndex/tag/:userId', protect, removeTagFromMedia);

// ============================================
// COMMENT MANAGEMENT ROUTES
// ============================================

// Edit comment (works for both post and media comments)
router.put('/comments/:commentId', protect, editComment);

// Delete comment (works for both post and media comments)
router.delete('/comments/:commentId', protect, deleteComment);

module.exports = router;