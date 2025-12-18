const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema(
  {
    // Tournament basic info
    name: {
      type: String,
      required: [true, 'Tournament name is required'],
      trim: true,
      maxlength: [200, 'Name cannot exceed 200 characters'],
    },

    // Tournament type
    type: {
      type: String,
      enum: ['Major', 'LPGA Tour', 'International', 'Exhibition', 'Other'],
      default: 'LPGA Tour',
    },

    // Location
    location: {
      venue: {
        type: String,
        required: [true, 'Venue is required'],
      },
      city: String,
      state: String,
      country: {
        type: String,
        required: [true, 'Country is required'],
      },
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },

    // Tournament dates
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },

    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },

    // Tournament status
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
      default: 'upcoming',
    },

    // Prize money
    prizeMoney: {
      total: {
        type: Number,
        default: 0,
      },
      currency: {
        type: String,
        default: 'USD',
      },
    },

    // Nelly's performance (if she participated)
    performance: {
      participated: {
        type: Boolean,
        default: false,
      },
      position: Number,
      score: {
        rounds: [
          {
            round: Number,
            score: Number,
            par: Number,
          },
        ],
        total: Number,
        toPar: String, // e.g., "-15", "+2", "E"
      },
      earnings: Number,
      highlights: [String],
    },

    // Media
    coverImage: {
      url: String,
      publicId: String,
    },

    gallery: [
      {
        url: String,
        publicId: String,
        caption: String,
      },
    ],

    // Additional info
    description: {
      type: String,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },

    website: String,

    // Tournament stats
    stats: {
      totalPlayers: Number,
      rounds: Number,
      par: Number,
    },

    // Related posts
    relatedPosts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
      },
    ],

    // Featured/Important tournament
    isFeatured: {
      type: Boolean,
      default: false,
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
tournamentSchema.index({ startDate: -1 });
tournamentSchema.index({ status: 1 });
tournamentSchema.index({ type: 1 });
tournamentSchema.index({ 'performance.participated': 1 });

// ============================================
// VIRTUALS
// ============================================

// Check if tournament is currently active
tournamentSchema.virtual('isActive').get(function () {
  const now = new Date();
  return now >= this.startDate && now <= this.endDate;
});

// Days until tournament starts
tournamentSchema.virtual('daysUntilStart').get(function () {
  const now = new Date();
  const diffTime = this.startDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
});

// ============================================
// METHODS
// ============================================

// Update tournament status based on dates
tournamentSchema.methods.updateStatus = function () {
  const now = new Date();

  if (this.status === 'cancelled') {
    return;
  }

  if (now < this.startDate) {
    this.status = 'upcoming';
  } else if (now >= this.startDate && now <= this.endDate) {
    this.status = 'ongoing';
  } else {
    this.status = 'completed';
  }
};

// ============================================
// MIDDLEWARE
// ============================================

// Auto-update status before saving
tournamentSchema.pre('save', function () {
  this.updateStatus();
});

module.exports = mongoose.model('Tournament', tournamentSchema);