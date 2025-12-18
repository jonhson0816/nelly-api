const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  
  description: {
    type: String,
    required: [true, 'Event description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },

  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  coverPhoto: {
    url: String,
    publicId: String
  },

  category: {
    type: String,
    enum: ['tournament', 'workshop', 'meetup', 'charity', 'training', 'celebration', 'other'],
    default: 'other'
  },

  type: {
    type: String,
    enum: ['in_person', 'online', 'hybrid'],
    default: 'in_person'
  },

  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },

  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },

  location: {
    venue: String,
    address: String,
    city: String,
    state: String,
    country: String,
    zipCode: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },

  onlineLink: {
    type: String,
    trim: true
  },

  ticketInfo: {
    isFree: {
      type: Boolean,
      default: true
    },
    price: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'USD'
    },
    ticketLink: String
  },

  capacity: {
    type: Number,
    min: [0, 'Capacity cannot be negative']
  },

  privacy: {
    type: String,
    enum: ['public', 'private', 'friends'],
    default: 'public'
  },

  status: {
    type: String,
    enum: ['draft', 'published', 'cancelled', 'completed'],
    default: 'published'
  },

  attendees: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['going', 'interested', 'maybe', 'not_going'],
      default: 'going'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],

  coHosts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  tags: [String],

  discussion: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  photos: [{
    url: String,
    publicId: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  isFeatured: {
    type: Boolean,
    default: false
  },

  viewsCount: {
    type: Number,
    default: 0
  },

  shareCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for better performance
eventSchema.index({ startDate: 1, status: 1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ 'location.city': 1, 'location.country': 1 });

// Virtual for attendee count
eventSchema.virtual('attendeeCount').get(function() {
  return this.attendees.filter(a => a.status === 'going').length;
});

// Virtual for interested count
eventSchema.virtual('interestedCount').get(function() {
  return this.attendees.filter(a => a.status === 'interested').length;
});

// Method to check if event is upcoming
eventSchema.methods.isUpcoming = function() {
  return this.startDate > new Date();
};

// Method to check if event is ongoing
eventSchema.methods.isOngoing = function() {
  const now = new Date();
  return this.startDate <= now && this.endDate >= now;
};

// Method to check if event is past
eventSchema.methods.isPast = function() {
  return this.endDate < new Date();
};

// Static method to get upcoming events
eventSchema.statics.getUpcomingEvents = function(limit = 10) {
  return this.find({
    startDate: { $gte: new Date() },
    status: 'published'
  })
  .sort({ startDate: 1 })
  .limit(limit)
  .populate('organizer', 'firstName lastName avatar username');
};

module.exports = mongoose.model('Event', eventSchema);