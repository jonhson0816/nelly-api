const Profile = require('../models/Profile');
const User = require('../models/User');
const Post = require('../models/Post');
const { deleteFile } = require('../config/cloudinary');

// @desc    Get or Create user profile
// @route   GET /api/profiles/me
// @access  Private
exports.getMyProfile = async (req, res, next) => {
  try {
    let profile = await Profile.findOne({ user: req.user.id })
      .populate('user', 'firstName lastName email username avatar bio location dateOfBirth stats badges isAdmin')
      .populate('featuredPosts', 'caption media likesCount commentsCount createdAt')
      .populate('featuredStories', 'caption mediaUrl createdAt');
    
    // If profile doesn't exist, create one
    if (!profile) {
      profile = await Profile.create({
        user: req.user.id,
      });
      profile = await Profile.findById(profile._id)
        .populate('user', 'firstName lastName email username avatar bio location dateOfBirth stats badges isAdmin')
        .populate('featuredPosts')
        .populate('featuredStories');
    }
    
    // Fetch user's posts - FIXED QUERY WITH COMMENT COUNTS
    const Post = require('../models/Post');
    
    let userPosts = [];
    
    try {
      // First attempt: Direct match
      userPosts = await Post.find({ 
        author: req.user.id,
        status: { $ne: 'deleted' }
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('author', 'firstName lastName username avatar isAdmin')
        .lean();
      
      // If no posts found, try alternative query
      if (userPosts.length === 0) {
        userPosts = await Post.find({ 
          author: req.user._id,
          status: { $ne: 'deleted' }
        })
          .sort({ createdAt: -1 })
          .limit(50)
          .populate('author', 'firstName lastName username avatar isAdmin')
          .lean();
      }
      
      console.log(`Found ${userPosts.length} posts for user ${req.user.id}`);
      
      // Add isLikedByMe to each post and ensure commentsCount is included
      const postsWithLikes = userPosts.map(post => {
        const isLiked = post.likes?.some(like => 
          like.user?.toString() === req.user.id || 
          like.toString() === req.user.id
        );
        
        const { likes, views, ...postData } = post;
        
        return {
          ...postData,
          isLikedByMe: isLiked,
          likesCount: likes?.length || 0,
          commentsCount: post.commentsCount || 0
        };
      });
      
      userPosts = postsWithLikes;
      
    } catch (postError) {
      console.error('Error fetching posts:', postError);
      userPosts = [];
    }
    
    // Calculate completion
    profile.calculateCompletion();
    
    // Convert to plain object and add posts
    const profileData = profile.toObject();
    profileData.userPosts = userPosts;
    
    res.status(200).json({
      success: true,
      profile: profileData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get any user profile by username or ID
// @route   GET /api/profiles/:identifier
// @access  Private (Admin only)
exports.getProfile = async (req, res, next) => {
  try {
    // Check if user is admin
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
      });
    }

    // Rest of your existing code...
    const { identifier } = req.params;
    let query;
    
    // ... (keep everything else the same)
  } catch (error) {
    next(error);
  }
};

// @desc    Update profile
// @route   PUT /api/profiles/me
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    let profile = await Profile.findOne({ user: req.user.id });

    if (!profile) {
      profile = await Profile.create({ user: req.user.id });
    }

    const {
      about,
      interests,
      socialLinks,
      favoriteQuotes,
      careerHighlights,
      achievements,
      privacySettings,
      isPublic,
    } = req.body;

    // Update fields
    if (about !== undefined) profile.about = about;
    if (isPublic !== undefined) profile.isPublic = isPublic;

    if (interests) {
      profile.interests = Array.isArray(interests)
        ? interests
        : interests.split(',').map((i) => i.trim());
    }

    if (socialLinks) {
      profile.socialLinks = {
        ...profile.socialLinks,
        ...(typeof socialLinks === 'string' ? JSON.parse(socialLinks) : socialLinks),
      };
    }

    if (favoriteQuotes) {
      profile.favoriteQuotes = typeof favoriteQuotes === 'string'
        ? JSON.parse(favoriteQuotes)
        : favoriteQuotes;
    }

    if (careerHighlights && req.user.isAdmin) {
      profile.careerHighlights = typeof careerHighlights === 'string'
        ? JSON.parse(careerHighlights)
        : careerHighlights;
    }

    if (achievements && req.user.isAdmin) {
      profile.achievements = {
        ...profile.achievements,
        ...(typeof achievements === 'string' ? JSON.parse(achievements) : achievements),
      };
    }

    if (privacySettings) {
      profile.privacySettings = {
        ...profile.privacySettings,
        ...(typeof privacySettings === 'string' ? JSON.parse(privacySettings) : privacySettings),
      };
    }

    // Calculate completion before saving
    profile.calculateCompletion();

    await profile.save();

    profile = await Profile.findById(profile._id)
      .populate('user', 'firstName lastName username avatar bio location stats badges isAdmin')
      .populate('featuredPosts')
      .populate('featuredStories');

    // Fetch user's posts
    const userPosts = await Post.find({ author: req.user.id, status: 'active' })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('author', 'firstName lastName username avatar isAdmin')
      .lean();

    const profileData = profile.toObject();
    profileData.userPosts = userPosts;

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      profile: profileData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update cover photo
// @route   PUT /api/profiles/me/cover
// @access  Private
exports.updateCoverPhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a cover photo',
      });
    }

    let profile = await Profile.findOne({ user: req.user.id });

    if (!profile) {
      profile = await Profile.create({ user: req.user.id });
    }

    // Delete old cover photo
    if (profile.coverPhoto.publicId) {
      await deleteFile(profile.coverPhoto.publicId);
    }

    profile.coverPhoto = {
      url: req.file.path,
      publicId: req.file.filename,
    };

    // Calculate completion before saving
    profile.calculateCompletion();

    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Cover photo updated successfully',
      coverPhoto: profile.coverPhoto,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update avatar photo
// @route   PUT /api/profiles/me/avatar
// @access  Private
exports.updateAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an avatar photo',
      });
    }

    // Find the user and update avatar directly
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Delete old avatar from cloudinary if it exists
    if (user.avatar && user.avatar.publicId) {
      await deleteFile(user.avatar.publicId);
    }

    user.avatar = {
      url: req.file.path,
      publicId: req.file.filename,
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Avatar updated successfully',
      avatar: user.avatar,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add image to gallery
// @route   POST /api/profiles/me/gallery
// @access  Private
exports.addToGallery = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image or video',
      });
    }

    let profile = await Profile.findOne({ user: req.user.id });

    if (!profile) {
      profile = await Profile.create({ user: req.user.id });
    }

    const { caption } = req.body;

    profile.gallery.push({
      url: req.file.path,
      publicId: req.file.filename,
      type: req.file.mimetype.startsWith('video') ? 'video' : 'image',
      caption: caption || '',
    });

    // Calculate completion before saving
    profile.calculateCompletion();

    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Media added to gallery',
      gallery: profile.gallery,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove image from gallery
// @route   DELETE /api/profiles/me/gallery/:imageId
// @access  Private
exports.removeFromGallery = async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ user: req.user.id });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found',
      });
    }

    const media = profile.gallery.id(req.params.imageId);

    if (!media) {
      return res.status(404).json({
        success: false,
        message: 'Media not found in gallery',
      });
    }

    // Delete from Cloudinary
    if (media.publicId) {
      await deleteFile(media.publicId);
    }

    profile.gallery.pull(req.params.imageId);
    
    // Calculate completion before saving
    profile.calculateCompletion();
    
    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Media removed from gallery',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add featured post
// @route   POST /api/profiles/me/featured-posts/:postId
// @access  Private (Admin only)
exports.addFeaturedPost = async (req, res, next) => {
  try {
    let profile = await Profile.findOne({ user: req.user.id });

    if (!profile) {
      profile = await Profile.create({ user: req.user.id });
    }

    const { postId } = req.params;

    // Check if already featured
    if (profile.featuredPosts.includes(postId)) {
      return res.status(400).json({
        success: false,
        message: 'Post already featured',
      });
    }

    profile.featuredPosts.push(postId);
    
    // Calculate completion before saving
    profile.calculateCompletion();
    
    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Post added to featured',
      featuredPosts: profile.featuredPosts,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove featured post
// @route   DELETE /api/profiles/me/featured-posts/:postId
// @access  Private (Admin only)
exports.removeFeaturedPost = async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ user: req.user.id });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found',
      });
    }

    profile.featuredPosts.pull(req.params.postId);
    
    // Calculate completion before saving
    profile.calculateCompletion();
    
    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Post removed from featured',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get profile analytics (Admin only)
// @route   GET /api/profiles/:identifier/analytics
// @access  Private (Admin only)
exports.getProfileAnalytics = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    let query;

    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      query = { user: identifier };
    } else {
      const user = await User.findOne({ username: identifier });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }
      query = { user: user._id };
    }

    const profile = await Profile.findOne(query)
      .populate('user', 'firstName lastName username avatar stats badges')
      .populate('recentViewers.user', 'firstName lastName username avatar');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found',
      });
    }

    // Calculate completion
    profile.calculateCompletion();

    const analytics = {
      profileInfo: {
        userId: profile.user._id,
        username: profile.user.username,
        fullName: `${profile.user.firstName} ${profile.user.lastName}`,
      },
      stats: profile.profileStats,
      completionPercentage: profile.completionPercentage,
      recentViewers: profile.recentViewers.slice(0, 20),
      galleryCount: profile.gallery.length,
      featuredPostsCount: profile.featuredPosts.length,
      lastUpdated: profile.lastUpdated,
    };

    res.status(200).json({
      success: true,
      analytics,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search profiles
// @route   GET /api/profiles/search
// @access  Public
exports.searchProfiles = async (req, res, next) => {
  try {
    const { query, limit = 20 } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    // Search users by name or username
    const users = await User.find({
      $or: [
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } },
      ],
      isActive: true,
    })
      .limit(parseInt(limit))
      .select('_id firstName lastName username avatar bio isAdmin isVerified');

    const userIds = users.map((u) => u._id);

    const profiles = await Profile.find({
      user: { $in: userIds },
      isPublic: true,
    }).populate('user', 'firstName lastName username avatar bio isAdmin isVerified');

    res.status(200).json({
      success: true,
      count: profiles.length,
      profiles,
    });
  } catch (error) {
    next(error);
  }
};