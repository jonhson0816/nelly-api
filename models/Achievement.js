const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema(
  {
    // Achievement Title
    title: {
      type: String,
      required: [true, 'Achievement title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },

    // Achievement Description
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },

    // Achievement Type/Category
    category: {
      type: String,
      enum: [
        'tournament_win',
        'major_championship',
        'ranking',
        'record',
        'award',
        'milestone',
        'endorsement',
        'charity',
        'other',
      ],
      required: true,
    },

    // Year achieved
    year: {
      type: Number,
      required: [true, 'Year is required'],
      min: [2000, 'Year must be after 2000'],
      max: [new Date().getFullYear() + 1, 'Year cannot be in the future'],
    },

    // Date achieved
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },

    // Related Tournament (if applicable)
    tournament: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
    },

    // Achievement Icon/Badge
    icon: {
      type: String,
      default: '🏆',
    },

    // Cover Image
    coverImage: {
      url: String,
      publicId: String,
    },

    // Gallery Images
    gallery: [
      {
        url: String,
        publicId: String,
        caption: String,
      },
    ],

    // Achievement Stats/Details
    stats: {
      position: Number, // e.g., 1st place
      score: String, // e.g., "-18"
      prize: Number, // Prize money
      points: Number, // World ranking points
      opponents: Number, // Number of competitors
    },

    // Highlights/Key Moments
    highlights: [
      {
        title: String,
        description: String,
        timestamp: String, // e.g., "Round 3, Hole 18"
      },
    ],

    // Video Highlights
    videoHighlights: [
      {
        title: String,
        url: String,
        publicId: String,
        thumbnail: String,
        duration: Number,
      },
    ],

    // Tags
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],

    // Featured Achievement
    isFeatured: {
      type: Boolean,
      default: false,
    },

    // Major Achievement (World Cup, Olympics, etc.)
    isMajor: {
      type: Boolean,
      default: false,
    },

    // Visibility
    isPublished: {
      type: Boolean,
      default: true,
    },

    // Related Posts
    relatedPosts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
      },
    ],

    // Engagement Stats
    views: {
      type: Number,
      default: 0,
    },

    likes: {
      type: Number,
      default: 0,
    },

    shares: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ============================================
// INDEXES
// ============================================
achievementSchema.index({ year: -1, date: -1 });
achievementSchema.index({ category: 1 });
achievementSchema.index({ isFeatured: -1, date: -1 });
achievementSchema.index({ isMajor: -1, date: -1 });

// ============================================
// VIRTUALS
// ============================================

// Get year from date
achievementSchema.virtual('achievementYear').get(function () {
  return this.date.getFullYear();
});

// Get formatted date
achievementSchema.virtual('formattedDate').get(function () {
  return this.date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
});

// ============================================
// METHODS
// ============================================

// Increment views
achievementSchema.methods.incrementViews = async function () {
  this.views += 1;
  await this.save();
};

// Increment likes
achievementSchema.methods.incrementLikes = async function () {
  this.likes += 1;
  await this.save();
};

// Increment shares
achievementSchema.methods.incrementShares = async function () {
  this.shares += 1;
  await this.save();
};

module.exports = mongoose.model('Achievement', achievementSchema);