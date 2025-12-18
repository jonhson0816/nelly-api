const PlatformStats = require('../models/PlatformStats');
const User = require('../models/User');
const Post = require('../models/Post');
const Achievement = require('../models/Achievement');
const Tournament = require('../models/Tournament');
const Story = require('../models/Story');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const Trending = require('../models/Trending');

// @desc    Get current platform statistics
// @route   GET /api/platform-stats
// @access  Public
exports.getPlatformStats = async (req, res, next) => {
  try {
    // Check if stats were calculated recently (within last hour)
    const recentStats = await PlatformStats.findOne()
      .sort({ 'system.lastCalculated': -1 })
      .lean();

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // If recent stats exist and are fresh, return them
    if (recentStats && recentStats.system.lastCalculated > oneHourAgo) {
      return res.status(200).json({
        success: true,
        stats: recentStats,
        cached: true,
        calculatedAt: recentStats.system.lastCalculated,
      });
    }

    // Otherwise, calculate fresh stats
    const stats = await calculatePlatformStats();

    res.status(200).json({
      success: true,
      stats,
      cached: false,
      calculatedAt: new Date(),
    });
  } catch (error) {
    console.error('Error fetching platform stats:', error);
    next(error);
  }
};

// @desc    Force refresh platform statistics
// @route   POST /api/platform-stats/refresh
// @access  Private (Admin only)
exports.refreshPlatformStats = async (req, res, next) => {
  try {
    const stats = await calculatePlatformStats();

    res.status(200).json({
      success: true,
      message: 'Platform statistics refreshed successfully',
      stats,
      calculatedAt: new Date(),
    });
  } catch (error) {
    console.error('Error refreshing platform stats:', error);
    next(error);
  }
};

// @desc    Get platform stats history
// @route   GET /api/platform-stats/history
// @access  Private (Admin only)
exports.getStatsHistory = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const history = await PlatformStats.find({
      date: { $gte: startDate },
    })
      .sort({ date: -1 })
      .limit(days)
      .lean();

    res.status(200).json({
      success: true,
      count: history.length,
      days,
      history,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get growth analytics
// @route   GET /api/platform-stats/growth
// @access  Public
exports.getGrowthAnalytics = async (req, res, next) => {
  try {
    const currentStats = await PlatformStats.findOne()
      .sort({ date: -1 })
      .lean();

    const lastWeekStats = await PlatformStats.findOne({
      date: { $lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    })
      .sort({ date: -1 })
      .lean();

    if (!currentStats) {
      return res.status(404).json({
        success: false,
        message: 'No statistics available',
      });
    }

    const growth = {
      users: calculateGrowthPercentage(
        lastWeekStats?.users.total,
        currentStats.users.total
      ),
      posts: calculateGrowthPercentage(
        lastWeekStats?.posts.total,
        currentStats.posts.total
      ),
      engagement: calculateGrowthPercentage(
        lastWeekStats?.engagement.totalLikes,
        currentStats.engagement.totalLikes
      ),
      achievements: calculateGrowthPercentage(
        lastWeekStats?.achievements.total,
        currentStats.achievements.total
      ),
    };

    res.status(200).json({
      success: true,
      growth,
      current: currentStats,
      previous: lastWeekStats,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

// Calculate all platform statistics
async function calculatePlatformStats() {
  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0));
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // USER STATS
  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ isActive: true });
  const newToday = await User.countDocuments({ createdAt: { $gte: today } });
  const newThisWeek = await User.countDocuments({ createdAt: { $gte: weekAgo } });
  const newThisMonth = await User.countDocuments({ createdAt: { $gte: monthAgo } });
  const admins = await User.countDocuments({ role: 'admin' });
  const verified = await User.countDocuments({ isVerified: true });

  // POST STATS
  const totalPosts = await Post.countDocuments();
  const publishedPosts = await Post.countDocuments({ status: 'published' });
  const todayPosts = await Post.countDocuments({
    status: 'published',
    createdAt: { $gte: today },
  });
  const weekPosts = await Post.countDocuments({
    status: 'published',
    createdAt: { $gte: weekAgo },
  });
  const monthPosts = await Post.countDocuments({
    status: 'published',
    createdAt: { $gte: monthAgo },
  });
  const images = await Post.countDocuments({ type: 'image' });
  const videos = await Post.countDocuments({ type: 'video' });
  const galleries = await Post.countDocuments({ type: 'gallery' });

  // ENGAGEMENT STATS
  const engagementData = await Post.aggregate([
    { $match: { status: 'published' } },
    {
      $group: {
        _id: null,
        totalLikes: { $sum: '$likesCount' },
        totalComments: { $sum: '$commentsCount' },
        totalShares: { $sum: '$sharesCount' },
        totalViews: { $sum: '$viewsCount' },
      },
    },
  ]);

  const engagement = engagementData[0] || {
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    totalViews: 0,
  };

  engagement.avgLikesPerPost = publishedPosts > 0 
    ? Math.round(engagement.totalLikes / publishedPosts) 
    : 0;
  engagement.avgCommentsPerPost = publishedPosts > 0
    ? Math.round(engagement.totalComments / publishedPosts)
    : 0;

  // ACHIEVEMENT STATS
  const totalAchievements = await Achievement.countDocuments();
  const publishedAchievements = await Achievement.countDocuments({ isPublished: true });
  const majors = await Achievement.countDocuments({ isMajor: true });
  const featuredAchievements = await Achievement.countDocuments({ isFeatured: true });
  
  const achievementViewsData = await Achievement.aggregate([
    { $match: { isPublished: true } },
    { $group: { _id: null, totalViews: { $sum: '$views' } } },
  ]);
  const achievementViews = achievementViewsData[0]?.totalViews || 0;

  // TOURNAMENT STATS
  const totalTournaments = await Tournament.countDocuments();
  const upcomingTournaments = await Tournament.countDocuments({ status: 'upcoming' });
  const ongoingTournaments = await Tournament.countDocuments({ status: 'ongoing' });
  const completedTournaments = await Tournament.countDocuments({ status: 'completed' });
  const featuredTournaments = await Tournament.countDocuments({ isFeatured: true });

  // STORY STATS
  let storyStats = { total: 0, active: 0, expired: 0, totalViews: 0 };
  try {
    const totalStories = await Story.countDocuments();
    const activeStories = await Story.countDocuments({ expiresAt: { $gt: now } });
    const expiredStories = await Story.countDocuments({ expiresAt: { $lte: now } });
    
    const storyViewsData = await Story.aggregate([
      { $group: { _id: null, totalViews: { $sum: { $size: '$views' } } } },
    ]);
    
    storyStats = {
      total: totalStories,
      active: activeStories,
      expired: expiredStories,
      totalViews: storyViewsData[0]?.totalViews || 0,
    };
  } catch (err) {
    console.log('Story stats calculation skipped:', err.message);
  }

  // MESSAGE STATS
  let messageStats = { total: 0, todayMessages: 0, conversations: 0 };
  try {
    const totalMessages = await Message.countDocuments();
    const todayMessages = await Message.countDocuments({ createdAt: { $gte: today } });
    const conversations = await Message.distinct('conversation').then((c) => c.length);
    
    messageStats = { total: totalMessages, todayMessages, conversations };
  } catch (err) {
    console.log('Message stats calculation skipped:', err.message);
  }

  // NOTIFICATION STATS
  let notificationStats = { total: 0, unread: 0, todayNotifications: 0 };
  try {
    const totalNotifications = await Notification.countDocuments();
    const unreadNotifications = await Notification.countDocuments({ isRead: false });
    const todayNotifications = await Notification.countDocuments({
      createdAt: { $gte: today },
    });
    
    notificationStats = {
      total: totalNotifications,
      unread: unreadNotifications,
      todayNotifications,
    };
  } catch (err) {
    console.log('Notification stats calculation skipped:', err.message);
  }

  // TRENDING STATS
  let trendingStats = {
    totalHashtags: 0,
    activeHashtags: 0,
    topHashtag: '',
    topHashtagCount: 0,
  };
  try {
    const totalHashtags = await Trending.countDocuments();
    const activeHashtags = await Trending.countDocuments({ count: { $gt: 0 } });
    
    const topTrending = await Trending.findOne().sort({ score: -1 }).limit(1);
    
    trendingStats = {
      totalHashtags,
      activeHashtags,
      topHashtag: topTrending?.tag || '',
      topHashtagCount: topTrending?.count || 0,
    };
  } catch (err) {
    console.log('Trending stats calculation skipped:', err.message);
  }

  // GALLERY STATS (placeholder - implement if you have gallery model)
  const galleryStats = {
    totalImages: 0,
    totalAlbums: 0,
    totalSize: 0,
  };

  // Create/Update stats record
  const stats = await PlatformStats.create({
    date: new Date(),
    users: {
      total: totalUsers,
      active: activeUsers,
      newToday,
      newThisWeek,
      newThisMonth,
      admins,
      verified,
    },
    posts: {
      total: totalPosts,
      published: publishedPosts,
      todayPosts,
      weekPosts,
      monthPosts,
      images,
      videos,
      galleries,
    },
    engagement,
    achievements: {
      total: totalAchievements,
      published: publishedAchievements,
      majors,
      featured: featuredAchievements,
      totalViews: achievementViews,
    },
    tournaments: {
      total: totalTournaments,
      upcoming: upcomingTournaments,
      ongoing: ongoingTournaments,
      completed: completedTournaments,
      featured: featuredTournaments,
    },
    stories: storyStats,
    messages: messageStats,
    notifications: notificationStats,
    trending: trendingStats,
    gallery: galleryStats,
    system: {
      uptime: Math.floor(process.uptime() / 3600), // hours
      lastCalculated: new Date(),
    },
  });

  return stats;
}

// Calculate growth percentage
function calculateGrowthPercentage(previous, current) {
  if (!previous || previous === 0) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

module.exports = exports;