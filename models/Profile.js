const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema(
  {
    // Link to User
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    // Profile Visibility
    isPublic: {
      type: Boolean,
      default: true,
    },

    // Social Links
    socialLinks: {
      twitter: { type: String, default: '' },
      instagram: { type: String, default: '' },
      facebook: { type: String, default: '' },
      youtube: { type: String, default: '' },
      website: { type: String, default: '' },
    },

    // Cover Photo
    coverPhoto: {
      url: {
        type: String,
        default: '',
      },
      publicId: String,
    },

    // Biography (Extended)
    about: {
      type: String,
      maxlength: [1000, 'About section cannot exceed 1000 characters'],
      default: '',
    },

    // Interests & Hobbies
    interests: [
      {
        type: String,
        maxlength: 50,
      },
    ],

    // Favorite Quotes
    favoriteQuotes: [
      {
        text: String,
        author: String,
      },
    ],

    // Career Highlights
    careerHighlights: [
      {
        title: String,
        description: String,
        year: Number,
        icon: String,
      },
    ],

    // Achievements & Stats
    achievements: {
      totalWins: { type: Number, default: 0 },
      majorTitles: { type: Number, default: 0 },
      tournamentParticipations: { type: Number, default: 0 },
      worldRanking: { type: Number, default: 0 },
      careerEarnings: { type: Number, default: 0 },
    },

    // Profile Statistics
    profileStats: {
      totalViews: { type: Number, default: 0 },
      totalFollowers: { type: Number, default: 0 },
      profileClicks: { type: Number, default: 0 },
      lastViewedAt: Date,
    },

    // Profile Viewers
    recentViewers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Featured Content
    featuredPosts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
      },
    ],

    featuredStories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Story',
      },
    ],

    // Gallery (Photos/Videos)
    gallery: [
      {
        url: String,
        publicId: String,
        type: {
          type: String,
          enum: ['image', 'video'],
          default: 'image',
        },
        caption: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Privacy Settings
    privacySettings: {
      showEmail: { type: Boolean, default: false },
      showPhone: { type: Boolean, default: false },
      showLocation: { type: Boolean, default: true },
      showBio: { type: Boolean, default: true },
      allowMessages: { type: Boolean, default: true },
    },

    // Verification Badge
    isVerified: {
      type: Boolean,
      default: false,
    },

    // Profile Completion %
    completionPercentage: {
      type: Number,
      default: 0,
    },

    // Last Updated
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// ============================================
// METHODS
// ============================================

// Add Profile Viewer
profileSchema.methods.addViewer = async function (userId) {
  if (this.user.toString() === userId.toString()) return;

  const existingView = this.recentViewers.find(
    (viewer) =>
      viewer.user.toString() === userId.toString() &&
      Date.now() - viewer.viewedAt < 24 * 60 * 60 * 1000
  );

  if (!existingView) {
    this.recentViewers.unshift({
      user: userId,
      viewedAt: Date.now(),
    });

    if (this.recentViewers.length > 50) {
      this.recentViewers = this.recentViewers.slice(0, 50);
    }

    this.profileStats.totalViews += 1;
    this.profileStats.lastViewedAt = Date.now();

    await this.save();
  }
};

// Calculate Profile Completion
profileSchema.methods.calculateCompletion = function () {
  let completion = 0;

  if (this.coverPhoto.url) completion += 15;
  if (this.about && this.about.length > 20) completion += 15;
  if (this.interests.length > 0) completion += 15;
  if (this.socialLinks.instagram || this.socialLinks.twitter) completion += 15;
  if (this.gallery.length > 0) completion += 10;
  if (this.favoriteQuotes.length > 0) completion += 10;
  if (this.featuredPosts.length > 0) completion += 10;
  if (this.careerHighlights.length > 0) completion += 10;

  this.completionPercentage = Math.min(completion, 100);
  return this.completionPercentage;
};

// ============================================
// REMOVED: Pre-save hook completely
// ============================================
// The hook was causing issues, so we'll calculate completion manually in the controller

// ============================================
// INDEXES
// ============================================
profileSchema.index({ user: 1 });
profileSchema.index({ isPublic: 1 });
profileSchema.index({ 'profileStats.totalViews': -1 });

module.exports = mongoose.model('Profile', profileSchema);