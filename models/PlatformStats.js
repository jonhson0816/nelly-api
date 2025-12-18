const mongoose = require('mongoose');

const platformStatsSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },
    users: {
      total: { type: Number, default: 0 },
      active: { type: Number, default: 0 },
      newToday: { type: Number, default: 0 },
      newThisWeek: { type: Number, default: 0 },
      newThisMonth: { type: Number, default: 0 },
      admins: { type: Number, default: 0 },
      verified: { type: Number, default: 0 },
    },
    posts: {
      total: { type: Number, default: 0 },
      published: { type: Number, default: 0 },
      todayPosts: { type: Number, default: 0 },
      weekPosts: { type: Number, default: 0 },
      monthPosts: { type: Number, default: 0 },
      images: { type: Number, default: 0 },
      videos: { type: Number, default: 0 },
      galleries: { type: Number, default: 0 },
    },
    engagement: {
      totalLikes: { type: Number, default: 0 },
      totalComments: { type: Number, default: 0 },
      totalShares: { type: Number, default: 0 },
      totalViews: { type: Number, default: 0 },
      avgLikesPerPost: { type: Number, default: 0 },
      avgCommentsPerPost: { type: Number, default: 0 },
    },
    achievements: {
      total: { type: Number, default: 0 },
      published: { type: Number, default: 0 },
      majors: { type: Number, default: 0 },
      featured: { type: Number, default: 0 },
      totalViews: { type: Number, default: 0 },
    },
    tournaments: {
      total: { type: Number, default: 0 },
      upcoming: { type: Number, default: 0 },
      ongoing: { type: Number, default: 0 },
      completed: { type: Number, default: 0 },
      featured: { type: Number, default: 0 },
    },
    stories: {
      total: { type: Number, default: 0 },
      active: { type: Number, default: 0 },
      expired: { type: Number, default: 0 },
      totalViews: { type: Number, default: 0 },
    },
    messages: {
      total: { type: Number, default: 0 },
      todayMessages: { type: Number, default: 0 },
      conversations: { type: Number, default: 0 },
    },
    notifications: {
      total: { type: Number, default: 0 },
      unread: { type: Number, default: 0 },
      todayNotifications: { type: Number, default: 0 },
    },
    trending: {
      totalHashtags: { type: Number, default: 0 },
      activeHashtags: { type: Number, default: 0 },
      topHashtag: { type: String, default: '' },
      topHashtagCount: { type: Number, default: 0 },
    },
    gallery: {
      totalImages: { type: Number, default: 0 },
      totalAlbums: { type: Number, default: 0 },
      totalSize: { type: Number, default: 0 }, // in MB
    },
    system: {
      uptime: { type: Number, default: 0 }, // in hours
      lastCalculated: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast queries
platformStatsSchema.index({ date: -1 });
platformStatsSchema.index({ 'system.lastCalculated': -1 });

module.exports = mongoose.model('PlatformStats', platformStatsSchema);