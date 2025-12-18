const mongoose = require('mongoose');

const TrendingSchema = new mongoose.Schema(
  {
    hashtag: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    displayTag: {
      type: String,
      required: true,
    },
    // Posts using this hashtag
    posts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
      },
    ],
    postsCount: {
      type: Number,
      default: 0,
      index: true,
    },
    // ✅ NEW: Comments using this hashtag
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment',
      },
    ],
    commentsCount: {
      type: Number,
      default: 0,
    },
    totalEngagement: {
      type: Number,
      default: 0,
    },
    trendingScore: {
      type: Number,
      default: 0,
      index: true,
    },
    lastCalculated: {
      type: Date,
      default: Date.now,
    },
    period: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'weekly',
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
TrendingSchema.index({ trendingScore: -1, postsCount: -1 });
TrendingSchema.index({ createdAt: -1 });

// ✅ UPDATED: Calculate trending score (includes comments)
TrendingSchema.statics.calculateTrendingScore = function (postsCount, commentsCount, totalEngagement, ageInDays) {
  // Posts are worth more than comments
  const postWeight = 10;      // Admin posts are most valuable
  const commentWeight = 3;    // User comments also contribute
  const engagementWeight = 5;
  const agePenalty = ageInDays * 2;

  const score = 
    (postsCount * postWeight) + 
    (commentsCount * commentWeight) + 
    (totalEngagement * engagementWeight) - 
    agePenalty;

  return Math.max(0, score); // Never negative
};

// Method to update trending data
TrendingSchema.methods.updateTrendingData = async function (posts, engagement) {
  this.postsCount = posts.length;
  this.posts = posts.map(p => p._id);
  this.totalEngagement = engagement;
  
  // Calculate age in days since first post with this hashtag
  const oldestPost = posts.sort((a, b) => a.createdAt - b.createdAt)[0];
  const ageInDays = oldestPost 
    ? Math.floor((Date.now() - oldestPost.createdAt) / (1000 * 60 * 60 * 24))
    : 0;

  this.trendingScore = this.constructor.calculateTrendingScore(
    this.postsCount,
    this.commentsCount || 0,
    this.totalEngagement,
    ageInDays
  );
  
  this.lastCalculated = Date.now();
  await this.save();
};

// Static method to get top trending hashtags
TrendingSchema.statics.getTopTrending = async function (limit = 10, period = 'weekly') {
  const daysMap = {
    daily: 1,
    weekly: 7,
    monthly: 30,
  };

  const days = daysMap[period] || 7;
  const dateThreshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return this.find({
    updatedAt: { $gte: dateThreshold },
    $or: [
      { postsCount: { $gt: 0 } },
      { commentsCount: { $gt: 0 } }
    ],
  })
    .sort({ trendingScore: -1, postsCount: -1 })
    .limit(limit)
    .select('hashtag displayTag postsCount commentsCount totalEngagement trendingScore');
};

// Clean up old trending data (run via cron)
TrendingSchema.statics.cleanupOldData = async function () {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const result = await this.deleteMany({
    updatedAt: { $lt: thirtyDaysAgo },
    postsCount: 0,
    commentsCount: 0,
  });

  return result.deletedCount;
};

module.exports = mongoose.model('Trending', TrendingSchema);