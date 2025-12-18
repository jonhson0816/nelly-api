const express = require('express');
const {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  updateAvatar,
  updatePassword,
  forgotPassword,
  resetPassword,
  deleteAccount,
  registerAdmin, // ADD THIS IMPORT
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { uploadImage } = require('../config/cloudinary');

const router = express.Router();

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// Register new user
router.post('/register', register);

// Register admin user (protected by secret key)
router.post('/register-admin', registerAdmin); // ADD THIS LINE

// Login user
router.post('/login', login);

// Forgot password
router.post('/forgotpassword', forgotPassword);

// Reset password
router.put('/resetpassword/:resetToken', resetPassword);

// ============================================
// PROTECTED ROUTES (Authentication required)
// ============================================

// Get current user
router.get('/me', protect, getMe);

// Logout user
router.get('/logout', protect, logout);

// Update profile
router.put('/profile', protect, updateProfile);

// Update avatar
router.put('/avatar', protect, uploadImage.single('avatar'), updateAvatar);

// Update password
router.put('/password', protect, updatePassword);

// Delete account
router.delete('/account', protect, deleteAccount);

module.exports = router;