const express = require('express');
const router = express.Router();
const {
  createComment,
  getPostComments,
  getCommentReplies,
  updateComment,
  deleteComment,
  toggleCommentLike,
  togglePinComment,
  reportComment,
  getCommentStats,
} = require('../controllers/commentController');

const { protect, adminOnly, optionalAuth } = require('../middleware/authMiddleware');

// ============================================
// COMMENT ROUTES
// ============================================

// Create comment on a post
router.post('/posts/:postId/comments', protect, createComment);

// Get all comments for a post
router.get('/posts/:postId/comments', optionalAuth, getPostComments);

// Get replies for a specific comment
router.get('/comments/:commentId/replies', optionalAuth, getCommentReplies);

// Update comment (owner or admin only)
router.put('/comments/:id', protect, updateComment);

// Delete comment (owner or admin only)
router.delete('/comments/:id', protect, deleteComment);

// Like/Unlike comment
router.put('/comments/:id/like', protect, toggleCommentLike);

// Pin/Unpin comment (Admin only)
router.put('/comments/:id/pin', protect, adminOnly, togglePinComment);

// Report comment
router.put('/comments/:id/report', protect, reportComment);

// Get comment stats (Admin only)
router.get('/comments/:id/stats', protect, adminOnly, getCommentStats);

module.exports = router;