const mongoose = require('mongoose');

// ============================================
// BADGE DEFINITIONS - All Available Badges
// ============================================

const BADGE_DEFINITIONS = {
  // Welcome Badges
  WELCOME: {
    id: 'welcome',
    name: 'Welcome to Nelly Korda Family',
    icon: '🎉',
    description: 'Joined the community',
    category: 'milestone',
    points: 0,
    tier: 'common',
    color: '#4CAF50'
  },

  // Activity Badges
  FIRST_POST: {
    id: 'first_post',
    name: 'First Post',
    icon: '✍️',
    description: 'Created your first post',
    category: 'activity',
    points: 10,
    tier: 'common',
    color: '#2196F3'
  },
  
  SOCIAL_BUTTERFLY: {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    icon: '🦋',
    description: 'Created 100 posts',
    category: 'activity',
    points: 1000,
    tier: 'rare',
    color: '#9C27B0'
  },

  PROLIFIC_WRITER: {
    id: 'prolific_writer',
    name: 'Prolific Writer',
    icon: '📝',
    description: 'Created 500 posts',
    category: 'activity',
    points: 5000,
    tier: 'epic',
    color: '#FF9800'
  },

  LEGEND: {
    id: 'legend',
    name: 'Legend',
    icon: '👑',
    description: 'Created 1000 posts',
    category: 'activity',
    points: 10000,
    tier: 'legendary',
    color: '#FFD700'
  },

  // Engagement Badges
  POPULAR: {
    id: 'popular',
    name: 'Popular',
    icon: '⭐',
    description: 'Received 1000 likes',
    category: 'engagement',
    points: 500,
    tier: 'rare',
    color: '#F44336'
  },

  INFLUENCER: {
    id: 'influencer',
    name: 'Influencer',
    icon: '🌟',
    description: 'Received 5000 likes',
    category: 'engagement',
    points: 2500,
    tier: 'epic',
    color: '#E91E63'
  },

  SUPERSTAR: {
    id: 'superstar',
    name: 'Superstar',
    icon: '💫',
    description: 'Received 10000 likes',
    category: 'engagement',
    points: 5000,
    tier: 'legendary',
    color: '#9C27B0'
  },

  // Loyalty Badges
  VETERAN: {
    id: 'veteran',
    name: 'Veteran',
    icon: '🎖️',
    description: 'Member for 1 year',
    category: 'loyalty',
    points: 1000,
    tier: 'rare',
    color: '#795548'
  },

  LEGEND_STATUS: {
    id: 'legend_status',
    name: 'Legend Status',
    icon: '🏆',
    description: 'Member for 3 years',
    category: 'loyalty',
    points: 3000,
    tier: 'legendary',
    color: '#FFD700'
  },

  // Daily Login Badges
  DEDICATED: {
    id: 'dedicated',
    name: 'Dedicated',
    icon: '📅',
    description: 'Logged in 30 days in a row',
    category: 'loyalty',
    points: 300,
    tier: 'uncommon',
    color: '#00BCD4'
  },

  UNSTOPPABLE: {
    id: 'unstoppable',
    name: 'Unstoppable',
    icon: '🔥',
    description: 'Logged in 100 days in a row',
    category: 'loyalty',
    points: 1000,
    tier: 'rare',
    color: '#FF5722'
  },

  // Comment Badges
  COMMENTATOR: {
    id: 'commentator',
    name: 'Commentator',
    icon: '💬',
    description: 'Posted 100 comments',
    category: 'engagement',
    points: 100,
    tier: 'uncommon',
    color: '#03A9F4'
  },

  CONVERSATION_MASTER: {
    id: 'conversation_master',
    name: 'Conversation Master',
    icon: '🗣️',
    description: 'Posted 500 comments',
    category: 'engagement',
    points: 500,
    tier: 'rare',
    color: '#3F51B5'
  },

  // Profile Badges
  COMPLETE_PROFILE: {
    id: 'complete_profile',
    name: 'Profile Complete',
    icon: '✅',
    description: 'Completed your profile 100%',
    category: 'milestone',
    points: 50,
    tier: 'common',
    color: '#4CAF50'
  },

  // Special Admin Badge
  ADMINISTRATOR: {
    id: 'administrator',
    name: 'Administrator',
    icon: '👑',
    description: 'Platform Administrator',
    category: 'special',
    points: 0,
    tier: 'legendary',
    color: '#FFD700'
  },

  // Level Badges
  BRONZE_MEMBER: {
    id: 'bronze_member',
    name: 'Bronze Member',
    icon: '🥉',
    description: 'Reached Level 5',
    category: 'level',
    points: 0,
    tier: 'uncommon',
    color: '#CD7F32'
  },

  SILVER_MEMBER: {
    id: 'silver_member',
    name: 'Silver Member',
    icon: '🥈',
    description: 'Reached Level 10',
    category: 'level',
    points: 0,
    tier: 'rare',
    color: '#C0C0C0'
  },

  GOLD_MEMBER: {
    id: 'gold_member',
    name: 'Gold Member',
    icon: '🥇',
    description: 'Reached Level 20',
    category: 'level',
    points: 0,
    tier: 'epic',
    color: '#FFD700'
  },

  PLATINUM_MEMBER: {
    id: 'platinum_member',
    name: 'Platinum Member',
    icon: '💎',
    description: 'Reached Level 50',
    category: 'level',
    points: 0,
    tier: 'legendary',
    color: '#E5E4E2'
  }
};

// ============================================
// POINTS CONFIGURATION
// ============================================

const POINTS_CONFIG = {
  // Post Actions
  CREATE_POST: 10,
  POST_WITH_MEDIA: 15,
  RECEIVE_LIKE: 5,
  RECEIVE_COMMENT: 3,
  POST_SHARED: 10,
  
  // Comment Actions
  CREATE_COMMENT: 3,
  COMMENT_LIKED: 2,
  
  // Profile Actions
  COMPLETE_PROFILE: 50,
  UPDATE_AVATAR: 5,
  UPDATE_COVER: 5,
  
  // Daily Login
  DAILY_LOGIN: 2,
  STREAK_BONUS: 5, // Extra per week of streak
  
  // Special
  FIRST_POST_BONUS: 20,
  FIRST_COMMENT_BONUS: 10,
  PROFILE_COMPLETION_BONUS: 50
};

// ============================================
// LEVEL CONFIGURATION
// ============================================

const LEVEL_CONFIG = {
  pointsPerLevel: 100, // Base points needed per level
  multiplier: 1.5, // Multiplier for each level
  
  // Calculate points needed for specific level
  getPointsForLevel: (level) => {
    return Math.floor(100 * Math.pow(1.5, level - 1));
  },
  
  // Calculate level from total points
  getLevelFromPoints: (points) => {
    let level = 1;
    let totalPointsNeeded = 0;
    
    while (totalPointsNeeded <= points) {
      totalPointsNeeded += LEVEL_CONFIG.getPointsForLevel(level);
      if (totalPointsNeeded <= points) level++;
    }
    
    return level;
  },
  
  // Get level title
  getLevelTitle: (level) => {
    if (level >= 50) return 'Platinum Legend';
    if (level >= 20) return 'Gold Champion';
    if (level >= 10) return 'Silver Star';
    if (level >= 5) return 'Bronze Member';
    return 'Newcomer';
  }
};

// ============================================
// BADGE SCHEMA
// ============================================

const badgeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    badgeId: {
      type: String,
      required: true,
      enum: Object.keys(BADGE_DEFINITIONS)
    },
    name: {
      type: String,
      required: true
    },
    icon: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    category: {
      type: String,
      enum: ['milestone', 'activity', 'engagement', 'loyalty', 'level', 'special'],
      required: true
    },
    tier: {
      type: String,
      enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
      default: 'common'
    },
    color: {
      type: String,
      default: '#4CAF50'
    },
    earnedAt: {
      type: Date,
      default: Date.now
    },
    progress: {
      current: { type: Number, default: 0 },
      target: { type: Number, default: 0 }
    }
  },
  {
    timestamps: true
  }
);

// ============================================
// INDEXES
// ============================================

badgeSchema.index({ userId: 1, badgeId: 1 }, { unique: true });
badgeSchema.index({ userId: 1, earnedAt: -1 });
badgeSchema.index({ category: 1 });

// ============================================
// STATIC METHODS
// ============================================

// Get badge definition by ID
badgeSchema.statics.getBadgeDefinition = function(badgeId) {
  return BADGE_DEFINITIONS[badgeId] || null;
};

// Get all badge definitions
badgeSchema.statics.getAllBadgeDefinitions = function() {
  return BADGE_DEFINITIONS;
};

// Get points configuration
badgeSchema.statics.getPointsConfig = function() {
  return POINTS_CONFIG;
};

// Get level configuration
badgeSchema.statics.getLevelConfig = function() {
  return LEVEL_CONFIG;
};

// Check if user has badge
badgeSchema.statics.userHasBadge = async function(userId, badgeId) {
  const badge = await this.findOne({ userId, badgeId });
  return !!badge;
};

// Award badge to user
badgeSchema.statics.awardBadge = async function(userId, badgeId) {
  const definition = BADGE_DEFINITIONS[badgeId];
  
  if (!definition) {
    throw new Error(`Badge ${badgeId} not found`);
  }
  
  // Check if already has badge
  const existing = await this.findOne({ userId, badgeId });
  if (existing) {
    return { alreadyHas: true, badge: existing };
  }
  
  // Create badge
  const badge = await this.create({
    userId,
    badgeId,
    name: definition.name,
    icon: definition.icon,
    description: definition.description,
    category: definition.category,
    tier: definition.tier,
    color: definition.color
  });
  
  return { alreadyHas: false, badge };
};

// Get user's badges
badgeSchema.statics.getUserBadges = async function(userId) {
  return await this.find({ userId }).sort({ earnedAt: -1 });
};

const Badge = mongoose.model('Badge', badgeSchema);

module.exports = { Badge, BADGE_DEFINITIONS, POINTS_CONFIG, LEVEL_CONFIG };