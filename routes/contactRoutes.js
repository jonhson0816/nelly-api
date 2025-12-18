const express = require('express');
const router = express.Router();
const {
  submitContactForm,
  getContactSubmissions
} = require('../controllers/contactController');
const { protect } = require('../middleware/authMiddleware');

// ============================================
// PROTECTED ROUTES - User must be logged in
// ============================================

// Submit contact form (requires authentication)
router.post('/submit', protect, submitContactForm);

// Get all contact form submissions (admin only)
router.get('/submissions', protect, getContactSubmissions);

module.exports = router;