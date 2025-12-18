const User = require('../models/User');
const { Badge, BADGE_DEFINITIONS, POINTS_CONFIG, LEVEL_CONFIG } = require('../models/Badge');

// ============================================
// AWARD POINTS TO USER
// ============================================

exports.awardPoints = async (userId, pointsType, metadata = {}) => {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const points = POINTS_CONFIG[pointsType] || 0;
    
    if (points === 0) {
      return { success: false, message: 'Invalid points type' };
    }

    // Update user points
    user.stats.points += points;
    await user.save();

    // Check for level up
    const oldLevel = LEVEL_CONFIG.getLevelFromPoints(user.stats.points - points);
    const newLevel = LEVEL_CONFIG.getLevelFromPoints(user.stats.points);
    
    let leveledUp = false;
    let newBadges = [];

    if (newLevel > oldLevel) {
      leveledUp = true;
      
      // Award level badges
      if (newLevel >= 5 && !await Badge.userHasBadge(userId, 'BRONZE_MEMBER')) {
        const result = await Badge.awardBadge(userId, 'BRONZE_MEMBER');
        if (!result.alreadyHas) newBadges.push(result.badge);
      }
      if (newLevel >= 10 && !await Badge.userHasBadge(userId, 'SILVER_MEMBER')) {
        const result = await Badge.awardBadge(userId, 'SILVER_MEMBER');
        if (!result.alreadyHas) newBadges.push(result.badge);
      }
      if (newLevel >= 20 && !await Badge.userHasBadge(userId, 'GOLD_MEMBER')) {
        const result = await Badge.awardBadge(userId, 'GOLD_MEMBER');
        if (!result.alreadyHas) newBadges.push(result.badge);
      }
      if (newLevel >= 50 && !await Badge.userHasBadge(userId, 'PLATINUM_MEMBER')) {
        const result = await Badge.awardBadge(userId, 'PLATINUM_MEMBER');
        if (!result.alreadyHas) newBadges.push(result.badge);
      }
    }

    return {
      success: true,
      points: {
        awarded: points,
        total: user.stats.points,
        action: pointsType
      },
      level: {
        current: newLevel,
        previous: oldLevel,
        leveledUp,
        title: LEVEL_CONFIG.getLevelTitle(newLevel)
      },
      newBadges
    };
  } catch (error) {
    console.error('Error awarding points:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// CHECK AND AWARD BADGES
// ============================================

exports.checkAndAwardBadges = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const newBadges = [];

    // Check First Post Badge
    if (user.stats.totalPosts === 1) {
      const result = await Badge.awardBadge(userId, 'FIRST_POST');
      if (!result.alreadyHas) newBadges.push(result.badge);
    }

    // Check Social Butterfly (100 posts)
    if (user.stats.totalPosts >= 100 && !await Badge.userHasBadge(userId, 'SOCIAL_BUTTERFLY')) {
      const result = await Badge.awardBadge(userId, 'SOCIAL_BUTTERFLY');
      if (!result.alreadyHas) newBadges.push(result.badge);
    }

    // Check Prolific Writer (500 posts)
    if (user.stats.totalPosts >= 500 && !await Badge.userHasBadge(userId, 'PROLIFIC_WRITER')) {
      const result = await Badge.awardBadge(userId, 'PROLIFIC_WRITER');
      if (!result.alreadyHas) newBadges.push(result.badge);
    }

    // Check Legend (1000 posts)
    if (user.stats.totalPosts >= 1000 && !await Badge.userHasBadge(userId, 'LEGEND')) {
      const result = await Badge.awardBadge(userId, 'LEGEND');
      if (!result.alreadyHas) newBadges.push(result.badge);
    }

    // Check Popular (1000 likes)
    if (user.stats.totalLikes >= 1000 && !await Badge.userHasBadge(userId, 'POPULAR')) {
      const result = await Badge.awardBadge(userId, 'POPULAR');
      if (!result.alreadyHas) newBadges.push(result.badge);
    }

    // Check Influencer (5000 likes)
    if (user.stats.totalLikes >= 5000 && !await Badge.userHasBadge(userId, 'INFLUENCER')) {
      const result = await Badge.awardBadge(userId, 'INFLUENCER');
      if (!result.alreadyHas) newBadges.push(result.badge);
    }

    // Check Superstar (10000 likes)
    if (user.stats.totalLikes >= 10000 && !await Badge.userHasBadge(userId, 'SUPERSTAR')) {
      const result = await Badge.awardBadge(userId, 'SUPERSTAR');
      if (!result.alreadyHas) newBadges.push(result.badge);
    }

    // Check Commentator (100 comments)
    if (user.stats.totalComments >= 100 && !await Badge.userHasBadge(userId, 'COMMENTATOR')) {
      const result = await Badge.awardBadge(userId, 'COMMENTATOR');
      if (!result.alreadyHas) newBadges.push(result.badge);
    }

    // Check Conversation Master (500 comments)
    if (user.stats.totalComments >= 500 && !await Badge.userHasBadge(userId, 'CONVERSATION_MASTER')) {
      const result = await Badge.awardBadge(userId, 'CONVERSATION_MASTER');
      if (!result.alreadyHas) newBadges.push(result.badge);
    }

    // Check Veteran (1 year member)
    const accountAge = Date.now() - user.createdAt.getTime();
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    
    if (accountAge >= oneYear && !await Badge.userHasBadge(userId, 'VETERAN')) {
      const result = await Badge.awardBadge(userId, 'VETERAN');
      if (!result.alreadyHas) newBadges.push(result.badge);
    }

    // Check Legend Status (3 years member)
    const threeYears = 3 * oneYear;
    if (accountAge >= threeYears && !await Badge.userHasBadge(userId, 'LEGEND_STATUS')) {
      const result = await Badge.awardBadge(userId, 'LEGEND_STATUS');
      if (!result.alreadyHas) newBadges.push(result.badge);
    }

    return {
      success: true,
      newBadges,
      message: newBadges.length > 0 ? `Earned ${newBadges.length} new badge(s)!` : 'No new badges'
    };
  } catch (error) {
    console.error('Error checking badges:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// GET USER STATS & PROGRESS
// ============================================

exports.getUserStats = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const badges = await Badge.getUserBadges(userId);
    const currentLevel = LEVEL_CONFIG.getLevelFromPoints(user.stats.points);
    const pointsForNextLevel = LEVEL_CONFIG.getPointsForLevel(currentLevel + 1);
    
    // Calculate points needed for current level
    let totalPointsForCurrentLevel = 0;
    for (let i = 1; i < currentLevel; i++) {
      totalPointsForCurrentLevel += LEVEL_CONFIG.getPointsForLevel(i);
    }
    
    const pointsInCurrentLevel = user.stats.points - totalPointsForCurrentLevel;
    const progressPercentage = (pointsInCurrentLevel / pointsForNextLevel) * 100;

    return {
      success: true,
      stats: {
        totalPoints: user.stats.points,
        totalPosts: user.stats.totalPosts,
        totalComments: user.stats.totalComments,
        totalLikes: user.stats.totalLikes,
        level: {
          current: currentLevel,
          title: LEVEL_CONFIG.getLevelTitle(currentLevel),
          pointsInLevel: pointsInCurrentLevel,
          pointsNeeded: pointsForNextLevel,
          progress: Math.min(progressPercentage, 100)
        },
        badges: {
          total: badges.length,
          byCategory: {
            milestone: badges.filter(b => b.category === 'milestone').length,
            activity: badges.filter(b => b.category === 'activity').length,
            engagement: badges.filter(b => b.category === 'engagement').length,
            loyalty: badges.filter(b => b.category === 'loyalty').length,
            level: badges.filter(b => b.category === 'level').length,
            special: badges.filter(b => b.category === 'special').length
          },
          recent: badges.slice(0, 5)
        },
        accountAge: {
          days: Math.floor((Date.now() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
          memberSince: user.createdAt
        }
      }
    };
  } catch (error) {
    console.error('Error getting user stats:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// GET LEADERBOARD
// ============================================

exports.getLeaderboard = async (type = 'points', limit = 10) => {
  try {
    let sortField = 'stats.points';
    
    if (type === 'posts') sortField = 'stats.totalPosts';
    if (type === 'likes') sortField = 'stats.totalLikes';
    if (type === 'comments') sortField = 'stats.totalComments';

    const users = await User.find({ isActive: true })
      .sort({ [sortField]: -1 })
      .limit(limit)
      .select('firstName lastName username avatar stats badges createdAt');

    const leaderboard = users.map((user, index) => {
      const level = LEVEL_CONFIG.getLevelFromPoints(user.stats.points);
      
      return {
        rank: index + 1,
        user: {
          id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          username: user.username,
          avatar: user.avatar?.url
        },
        stats: {
          points: user.stats.points,
          level: level,
          levelTitle: LEVEL_CONFIG.getLevelTitle(level),
          posts: user.stats.totalPosts,
          likes: user.stats.totalLikes,
          comments: user.stats.totalComments
        },
        badgeCount: user.badges?.length || 0
      };
    });

    return {
      success: true,
      type,
      leaderboard
    };
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// GET ALL AVAILABLE BADGES
// ============================================

exports.getAllBadges = async (userId) => {
  try {
    const userBadges = await Badge.getUserBadges(userId);
    const userBadgeIds = userBadges.map(b => b.badgeId);
    
    const allBadges = Object.keys(BADGE_DEFINITIONS).map(key => {
      const def = BADGE_DEFINITIONS[key];
      const earned = userBadgeIds.includes(key);
      
      return {
        id: key,
        ...def,
        earned,
        earnedAt: earned ? userBadges.find(b => b.badgeId === key)?.earnedAt : null
      };
    });

    // Group by category
    const grouped = {
      milestone: allBadges.filter(b => b.category === 'milestone'),
      activity: allBadges.filter(b => b.category === 'activity'),
      engagement: allBadges.filter(b => b.category === 'engagement'),
      loyalty: allBadges.filter(b => b.category === 'loyalty'),
      level: allBadges.filter(b => b.category === 'level'),
      special: allBadges.filter(b => b.category === 'special')
    };

    return {
      success: true,
      badges: allBadges,
      grouped,
      earned: userBadges.length,
      total: allBadges.length
    };
  } catch (error) {
    console.error('Error getting all badges:', error);
    return { success: false, error: error.message };
  }
};

module.exports = exports;