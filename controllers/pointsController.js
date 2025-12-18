const pointsService = require('../services/pointsService');
const { Badge } = require('../models/Badge');

// @desc    Get current user's stats
// @route   GET /api/points/stats
// @access  Private
exports.getMyStats = async (req, res, next) => {
  try {
    const result = await pointsService.getUserStats(req.user.id);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// @desc    Get user stats by ID
// @route   GET /api/points/stats/:userId
// @access  Public
exports.getUserStats = async (req, res, next) => {
  try {
    const result = await pointsService.getUserStats(req.params.userId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// @desc    Award points to user (Admin only or system)
// @route   POST /api/points/award
// @access  Private (Admin)
exports.awardPoints = async (req, res, next) => {
  try {
    const { userId, pointsType, metadata } = req.body;

    if (!userId || !pointsType) {
      return res.status(400).json({
        success: false,
        message: 'userId and pointsType are required'
      });
    }

    const result = await pointsService.awardPoints(userId, pointsType, metadata);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// @desc    Check and award badges
// @route   POST /api/points/check-badges
// @access  Private
exports.checkBadges = async (req, res, next) => {
  try {
    const result = await pointsService.checkAndAwardBadges(req.user.id);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all available badges
// @route   GET /api/points/badges
// @access  Private
exports.getAllBadges = async (req, res, next) => {
  try {
    const result = await pointsService.getAllBadges(req.user.id);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's badges
// @route   GET /api/points/my-badges
// @access  Private
exports.getMyBadges = async (req, res, next) => {
  try {
    const badges = await Badge.getUserBadges(req.user.id);

    res.status(200).json({
      success: true,
      count: badges.length,
      badges
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get leaderboard
// @route   GET /api/points/leaderboard
// @access  Public
exports.getLeaderboard = async (req, res, next) => {
  try {
    const type = req.query.type || 'points';
    const limit = parseInt(req.query.limit) || 10;

    const result = await pointsService.getLeaderboard(type, limit);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// @desc    Get points configuration
// @route   GET /api/points/config
// @access  Public
exports.getPointsConfig = (req, res, next) => {
  try {
    const config = Badge.getPointsConfig();
    const levelConfig = Badge.getLevelConfig();
    
    res.status(200).json({
      success: true,
      config: {
        points: config,
        levels: {
          pointsPerLevel: levelConfig.pointsPerLevel,
          multiplier: levelConfig.multiplier
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manual badge award (Admin only)
// @route   POST /api/points/award-badge
// @access  Private (Admin)
exports.awardBadge = async (req, res, next) => {
  try {
    const { userId, badgeId } = req.body;

    if (!userId || !badgeId) {
      return res.status(400).json({
        success: false,
        message: 'userId and badgeId are required'
      });
    }

    const result = await Badge.awardBadge(userId, badgeId);
    
    if (result.alreadyHas) {
      return res.status(400).json({
        success: false,
        message: 'User already has this badge'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Badge awarded successfully',
      badge: result.badge
    });
  } catch (error) {
    next(error);
  }
};

module.exports = exports;