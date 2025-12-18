const Trending = require('../models/Trending');
const {
  getTopTrending,
  searchByHashtag,
  updateTrendingData,
  cleanupOldTrendingData,
} = require('../utils/trendingUtils');

// @desc    Get top trending hashtags
// @route   GET /api/trending
// @access  Public
exports.getTrending = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const period = req.query.period || 'weekly';

    const trending = await getTopTrending(limit, period);

    // Format response
    const formattedTrending = trending.map(trend => ({
      tag: trend.hashtag,
      displayTag: trend.displayTag,
      count: trend.postsCount + (trend.commentsCount || 0),
      postsCount: trend.postsCount,
      commentsCount: trend.commentsCount || 0,
      engagement: trend.totalEngagement,
      score: trend.trendingScore,
    }));

    res.status(200).json({
      success: true,
      count: formattedTrending.length,
      trending: formattedTrending,
    });
  } catch (error) {
    console.error('Error getting trending:', error);
    next(error);
  }
};

// @desc    Search posts and comments by hashtag
// @route   GET /api/trending/search/:hashtag
// @access  Public
exports.searchByHashtag = async (req, res, next) => {
  try {
    const { hashtag } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const results = await searchByHashtag(hashtag, page, limit);

    res.status(200).json(results);
  } catch (error) {
    console.error('Error searching by hashtag:', error);
    next(error);
  }
};

// @desc    Get hashtag details
// @route   GET /api/trending/:hashtag
// @access  Public
exports.getHashtagDetails = async (req, res, next) => {
  try {
    const { hashtag } = req.params;
    const normalizedTag = hashtag.toLowerCase().replace(/^#/, '');

    const trending = await Trending.findOne({ hashtag: `#${normalizedTag}` })
      .populate('posts', 'caption media author createdAt likesCount commentsCount')
      .populate('comments', 'content author createdAt post');

    if (!trending) {
      return res.status(404).json({
        success: false,
        message: 'Hashtag not found',
      });
    }

    res.status(200).json({
      success: true,
      hashtag: trending,
    });
  } catch (error) {
    console.error('Error getting hashtag details:', error);
    next(error);
  }
};

// @desc    Update trending data (manual trigger)
// @route   POST /api/trending/update
// @access  Private (Admin only)
exports.updateTrending = async (req, res, next) => {
  try {
    const { period } = req.body;

    const result = await updateTrendingData(period || 'weekly');

    res.status(200).json({
      success: true,
      message: 'Trending data updated successfully',
      ...result,
    });
  } catch (error) {
    console.error('Error updating trending:', error);
    next(error);
  }
};

// @desc    Get trending statistics (Admin only)
// @route   GET /api/trending/admin/stats
// @access  Private (Admin only)
exports.getTrendingStats = async (req, res, next) => {
  try {
    const totalHashtags = await Trending.countDocuments();
    const activeHashtags = await Trending.countDocuments({
      $or: [
        { postsCount: { $gt: 0 } },
        { commentsCount: { $gt: 0 } }
      ]
    });
    
    const topTrending = await Trending.find()
      .sort({ trendingScore: -1 })
      .limit(10)
      .select('hashtag displayTag postsCount commentsCount trendingScore totalEngagement');

    const stats = {
      totalHashtags,
      activeHashtags,
      inactiveHashtags: totalHashtags - activeHashtags,
      topTrending,
    };

    res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error getting trending stats:', error);
    next(error);
  }
};

// @desc    Delete trending hashtag (Admin only)
// @route   DELETE /api/trending/:hashtag
// @access  Private (Admin only)
exports.deleteTrendingHashtag = async (req, res, next) => {
  try {
    const { hashtag } = req.params;
    const normalizedTag = hashtag.toLowerCase().replace(/^#/, '');

    const deleted = await Trending.findOneAndDelete({ hashtag: `#${normalizedTag}` });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Hashtag not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Trending hashtag deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting hashtag:', error);
    next(error);
  }
};

// @desc    Clean up old trending data
// @route   POST /api/trending/cleanup
// @access  Private (Admin only)
exports.cleanupTrending = async (req, res, next) => {
  try {
    const deletedCount = await cleanupOldTrendingData();

    res.status(200).json({
      success: true,
      message: `Cleaned up ${deletedCount} old trending records`,
      deletedCount,
    });
  } catch (error) {
    console.error('Error cleaning up trending:', error);
    next(error);
  }
};

module.exports = exports;