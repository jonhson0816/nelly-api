const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ============================================
// PROTECT ROUTES - JWT VERIFICATION
// ============================================
exports.protect = async (req, res, next) => {
  let token;

  // Check for token in Authorization header (Bearer token)
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Check for token in cookies (alternative method)
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route. Please login.',
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Token invalid.',
      });
    }

    // Check if user account is active
    if (!req.user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated.',
      });
    }

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Not authorized. Invalid token.',
    });
  }
};

// ============================================
// ADMIN ONLY - Restrict to Nelly/Admin
// ============================================
exports.adminOnly = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.',
    });
  }
};

// ============================================
// ADMIN OR OWNER - User can access own resources
// ============================================
exports.adminOrOwner = (resourceUserId) => {
  return (req, res, next) => {
    // If admin, allow access
    if (req.user.isAdmin) {
      return next();
    }

    // If owner of resource, allow access
    if (req.user.id === resourceUserId.toString()) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Not authorized to access this resource.',
    });
  };
};

// ============================================
// VERIFIED USERS ONLY - Email verification required
// ============================================
exports.verifiedOnly = (req, res, next) => {
  if (req.user && req.user.isVerified) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Please verify your email to access this feature.',
      verificationRequired: true,
    });
  }
};

// ============================================
// OPTIONAL AUTH - Attach user if token exists
// ============================================
exports.optionalAuth = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id);
    } catch (error) {
      // Token invalid, but continue without user
      req.user = null;
    }
  }

  next();
};

// ============================================
// NON-ADMIN USERS - Block admin from posting as regular user
// ============================================
exports.nonAdminOnly = (req, res, next) => {
  if (req.user && !req.user.isAdmin) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Admin cannot perform this action',
    });
  }
};