const express = require('express');
const router = express.Router();
const {
  createTournament,
  getTournaments,
  getTournament,
  updateTournament,
  deleteTournament,
  updatePerformance,
  addToGallery,
  removeFromGallery,
  getUpcomingTournaments,
  getTournamentStatistics,
} = require('../controllers/tournamentController');

const { protect, adminOnly } = require('../middleware/authMiddleware');
const { uploadImage } = require('../config/cloudinary');

// ============================================
// TOURNAMENT ROUTES
// ============================================

// Get upcoming tournaments
router.get('/upcoming', getUpcomingTournaments);

// Get tournament statistics
router.get('/statistics', getTournamentStatistics);

// Create tournament (Admin only)
router.post('/', protect, adminOnly, uploadImage.single('coverImage'), createTournament);

// Get all tournaments
router.get('/', getTournaments);

// Get single tournament
router.get('/:id', getTournament);

// Update tournament (Admin only)
router.put('/:id', protect, adminOnly, uploadImage.single('coverImage'), updateTournament);

// Delete tournament (Admin only)
router.delete('/:id', protect, adminOnly, deleteTournament);

// Update performance (Admin only)
router.put('/:id/performance', protect, adminOnly, updatePerformance);

// Add image to gallery (Admin only)
router.post('/:id/gallery', protect, adminOnly, uploadImage.single('image'), addToGallery);

// Remove image from gallery (Admin only)
router.delete('/:id/gallery/:imageId', protect, adminOnly, removeFromGallery);

module.exports = router;