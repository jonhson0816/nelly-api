const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'Please provide your first name'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Please provide your last name'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide your email'],
      unique: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email',
      ],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [/^[a-z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
    },
    avatar: {
      url: {
        type: String,
        default: 'https://res.cloudinary.com/demo/image/upload/avatar.png',
      },
      publicId: String,
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
      default: '',
    },
    location: {
      type: String,
      maxlength: [100, 'Location cannot exceed 100 characters'],
      default: '',
    },
    dateOfBirth: {
      type: Date,
      validate: {
        validator: function(value) {
          if (!value) return true; // Optional field
          const age = (Date.now() - value.getTime()) / (1000 * 60 * 60 * 24 * 365);
          return age >= 13 && value < Date.now();
        },
        message: 'You must be at least 13 years old',
      },
    },
    phoneNumber: {
      type: String,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'moderator'],
      default: 'user',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    stats: {
      totalPosts: { type: Number, default: 0 },
      totalComments: { type: Number, default: 0 },
      totalLikes: { type: Number, default: 0 },
      points: { type: Number, default: 0 },
    },
    badges: [
      {
        name: String,
        icon: String,
        description: String,
        earnedAt: { type: Date, default: Date.now },
      },
    ],
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    loginCount: {
      type: Number,
      default: 0,
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    verificationToken: String,
    verificationTokenExpire: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ============================================
// VIRTUAL FIELDS
// ============================================

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for isAdmin (for backward compatibility with your middleware)
userSchema.virtual('isAdmin').get(function() {
  return this.role === 'admin';
});

// Virtual for isModerator
userSchema.virtual('isModerator').get(function() {
  return this.role === 'moderator';
});

// ============================================
// INDEXES FOR PERFORMANCE
// ============================================

userSchema.index({ email: 1, isActive: 1 });
userSchema.index({ username: 1, isActive: 1 });
userSchema.index({ 'stats.points': -1 }); // For leaderboards

// ============================================
// MIDDLEWARE
// ============================================

// MIDDLEWARE 1: Generate username BEFORE validation (if not provided)
userSchema.pre('validate', function () {
  if (!this.username && this.email) {
    const emailPrefix = this.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    this.username = emailPrefix + Math.floor(Math.random() * 10000);
  }
});

// MIDDLEWARE 2: Hash password before saving
userSchema.pre('save', async function () {
  // Only hash if password is modified
  if (!this.isModified('password')) {
    return;
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// ============================================
// INSTANCE METHODS
// ============================================

// Compare entered password with hashed password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Record user login activity
userSchema.methods.recordLogin = async function () {
  return await this.model('User').findByIdAndUpdate(
    this._id,
    {
      $set: { lastLogin: Date.now() },
      $inc: { loginCount: 1 }
    },
    { new: true }
  );
};

// Award points to user
userSchema.methods.awardPoints = async function (points) {
  return await this.model('User').findByIdAndUpdate(
    this._id,
    { $inc: { 'stats.points': points } },
    { new: true }
  );
};

// Award badge to user
userSchema.methods.awardBadge = async function (badge) {
  return await this.model('User').findByIdAndUpdate(
    this._id,
    { $push: { badges: badge } },
    { new: true }
  );
};

// Check if user has specific role
userSchema.methods.hasRole = function (role) {
  return this.role === role;
};

// Check if user has admin or moderator privileges
userSchema.methods.hasModeratorAccess = function () {
  return this.role === 'admin' || this.role === 'moderator';
};

module.exports = mongoose.model('User', userSchema);