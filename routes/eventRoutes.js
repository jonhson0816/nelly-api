const express = require('express');
const router = express.Router();
const {
  createEvent,
  getEvents,
  getEvent,
  updateEvent,
  deleteEvent,
  respondToEvent,
  addDiscussionComment,
  getMyEvents,
  getMyOrganizedEvents
} = require('../controllers/eventController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { uploadImage } = require('../config/cloudinary');

// Public routes (with optional auth)
router.route('/')
  .get(optionalAuth, getEvents)
  .post(protect, uploadImage.single('coverPhoto'), createEvent);

// My events routes
router.route('/my/attending').get(protect, getMyEvents);
router.route('/my/organizing').get(protect, getMyOrganizedEvents);

// Single event routes
router.route('/:id')
  .get(optionalAuth, getEvent)
  .put(protect, uploadImage.single('coverPhoto'), updateEvent)
  .delete(protect, deleteEvent);

// Event interactions
router.route('/:id/respond').put(protect, respondToEvent);
router.route('/:id/discussion').post(protect, addDiscussionComment);

module.exports = router;