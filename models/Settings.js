const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  // PRIVACY SETTINGS
  privacy: {
    profileVisibility: {
      type: String,
      enum: ['public', 'friends', 'private'],
      default: 'public'
    },
    whoCanSeeMyPosts: {
      type: String,
      enum: ['public', 'friends', 'only_me'],
      default: 'public'
    },
    whoCanSendMeMessages: {
      type: String,
      enum: ['everyone', 'friends', 'no_one'],
      default: 'friends'
    },
    whoCanSeeMyFriends: {
      type: String,
      enum: ['public', 'friends', 'only_me'],
      default: 'public'
    },
    whoCanTagMe: {
      type: String,
      enum: ['everyone', 'friends', 'no_one'],
      default: 'friends'
    },
    showOnlineStatus: {
      type: Boolean,
      default: true
    },
    showReadReceipts: {
      type: Boolean,
      default: true
    },
    showEmail: {
      type: Boolean,
      default: false
    },
    showPhoneNumber: {
      type: Boolean,
      default: false
    },
    showLocation: {
      type: Boolean,
      default: true
    },
    showBirthday: {
      type: Boolean,
      default: true
    }
  },

  // NOTIFICATION SETTINGS
  notifications: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    pushNotifications: {
      type: Boolean,
      default: true
    },
    smsNotifications: {
      type: Boolean,
      default: false
    },
    likesAndReactions: {
      type: Boolean,
      default: true
    },
    comments: {
      type: Boolean,
      default: true
    },
    newFollowers: {
      type: Boolean,
      default: true
    },
    messages: {
      type: Boolean,
      default: true
    },
    tags: {
      type: Boolean,
      default: true
    },
    eventReminders: {
      type: Boolean,
      default: true
    },
    tournamentUpdates: {
      type: Boolean,
      default: true
    },
    weeklyDigest: {
      type: Boolean,
      default: false
    }
  },

  // SECURITY SETTINGS
  security: {
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    loginAlerts: {
      type: Boolean,
      default: true
    },
    loginApprovals: {
      type: Boolean,
      default: false
    },
    trustedDevices: [{
      deviceName: String,
      deviceType: String,
      lastUsed: Date,
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    activeSessions: [{
      deviceName: String,
      location: String,
      ipAddress: String,
      loginTime: Date
    }]
  },

  // ACCOUNT SETTINGS
  account: {
    language: {
      type: String,
      default: 'en'
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    dateFormat: {
      type: String,
      enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
      default: 'MM/DD/YYYY'
    },
    autoplayVideos: {
      type: Boolean,
      default: true
    },
    dataUsage: {
      type: String,
      enum: ['automatic', 'wifi_only', 'never'],
      default: 'automatic'
    }
  },

  // BLOCKED USERS
  blockedUsers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    blockedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // MUTED USERS
  mutedUsers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    mutedUntil: Date,
    mutedAt: {
      type: Date,
      default: Date.now
    }
  }],

  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Update lastUpdated on save
settingsSchema.pre('save', function() {
  this.lastUpdated = Date.now();
});

module.exports = mongoose.model('Settings', settingsSchema);