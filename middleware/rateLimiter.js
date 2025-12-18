const rateLimit = require('express-rate-limit');

// Rate limiter for message endpoints
exports.messageRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute (1 per second average)
  message: {
    success: false,
    message: 'Too many requests, please slow down',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for localhost in development
  skip: (req) => {
    return process.env.NODE_ENV === 'development' && 
           req.ip === '::1' || req.ip === '127.0.0.1';
  }
});

// Stricter rate limiter for conversations endpoint
exports.conversationsRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    success: false,
    message: 'Too many requests to conversations endpoint',
  },
});

// Rate limiter for user search
exports.searchRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20, // 20 searches per minute
  message: {
    success: false,
    message: 'Too many search requests',
  },
});