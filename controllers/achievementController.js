const Achievement = require('../models/Achievement');
const { deleteFile } = require('../config/cloudinary');

// @desc    Create new achievement (Admin only)
// @route   POST /api/achievements
// @access  Private (Admin only)
exports.createAchievement = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      year,
      date,
      tournament,
      icon,
      stats,
      highlights,
      tags,
      isFeatured,
      isMajor,
    } = req.body;

    // Handle cover image upload
    let coverImage = {};
    if (req.file) {
      coverImage = {
        url: req.file.path,
        publicId: req.file.filename,
      };
    }

    // Create achievement
    const achievement = await Achievement.create({
      title,
      description,
      category,
      year,
      date,
      tournament,
      icon: icon || '🏆',
      coverImage,
      stats: stats ? JSON.parse(stats) : undefined,
      highlights: highlights ? JSON.parse(highlights) : undefined,
      tags: tags ? tags.split(',').map((tag) => tag.trim()) : [],
      isFeatured: isFeatured === 'true',
      isMajor: isMajor === 'true',
    });

    res.status(201).json({
      success: true,
      message: 'Achievement created successfully',
      achievement,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all achievements
// @route   GET /api/achievements
// @access  Public
exports.getAchievements = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build query
    let query = { isPublished: true };

    // Filter by category
    if (req.query.category) {
      query.category = req.query.category;
    }

    // Filter by year
    if (req.query.year) {
      query.year = parseInt(req.query.year);
    }

    // Filter by major achievements
    if (req.query.major === 'true') {
      query.isMajor = true;
    }

    // Filter by featured
    if (req.query.featured === 'true') {
      query.isFeatured = true;
    }

    // Get achievements
    const achievements = await Achievement.find(query)
      .sort({ isFeatured: -1, isMajor: -1, date: -1 })
      .skip(skip)
      .limit(limit)
      .populate('tournament', 'name location startDate')
      .populate('relatedPosts', 'caption media likesCount commentsCount');

    const total = await Achievement.countDocuments(query);

    res.status(200).json({
      success: true,
      count: achievements.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      achievements,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single achievement
// @route   GET /api/achievements/:id
// @access  Public
exports.getAchievement = async (req, res, next) => {
  try {
    const achievement = await Achievement.findById(req.params.id)
      .populate('tournament', 'name location startDate endDate type')
      .populate('relatedPosts', 'caption media likesCount commentsCount createdAt');

    if (!achievement) {
      return res.status(404).json({
        success: false,
        message: 'Achievement not found',
      });
    }

    // Increment views
    await achievement.incrementViews();

    res.status(200).json({
      success: true,
      achievement,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update achievement
// @route   PUT /api/achievements/:id
// @access  Private (Admin only)
exports.updateAchievement = async (req, res, next) => {
  try {
    let achievement = await Achievement.findById(req.params.id);

    if (!achievement) {
      return res.status(404).json({
        success: false,
        message: 'Achievement not found',
      });
    }

    const {
      title,
      description,
      category,
      year,
      date,
      stats,
      highlights,
      tags,
      isFeatured,
      isMajor,
      isPublished,
    } = req.body;

    // Handle cover image update
    if (req.file) {
      // Delete old image
      if (achievement.coverImage.publicId) {
        await deleteFile(achievement.coverImage.publicId);
      }

      achievement.coverImage = {
        url: req.file.path,
        publicId: req.file.filename,
      };
    }

    // Update fields
    achievement = await Achievement.findByIdAndUpdate(
      req.params.id,
      {
        title: title || achievement.title,
        description: description || achievement.description,
        category: category || achievement.category,
        year: year || achievement.year,
        date: date || achievement.date,
        stats: stats ? JSON.parse(stats) : achievement.stats,
        highlights: highlights ? JSON.parse(highlights) : achievement.highlights,
        tags: tags ? tags.split(',').map((tag) => tag.trim()) : achievement.tags,
        isFeatured: isFeatured !== undefined ? isFeatured === 'true' : achievement.isFeatured,
        isMajor: isMajor !== undefined ? isMajor === 'true' : achievement.isMajor,
        isPublished: isPublished !== undefined ? isPublished === 'true' : achievement.isPublished,
        coverImage: achievement.coverImage,
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Achievement updated successfully',
      achievement,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete achievement
// @route   DELETE /api/achievements/:id
// @access  Private (Admin only)
exports.deleteAchievement = async (req, res, next) => {
  try {
    const achievement = await Achievement.findById(req.params.id);

    if (!achievement) {
      return res.status(404).json({
        success: false,
        message: 'Achievement not found',
      });
    }

    // Delete cover image from Cloudinary
    if (achievement.coverImage.publicId) {
      await deleteFile(achievement.coverImage.publicId);
    }

    // Delete gallery images
    if (achievement.gallery && achievement.gallery.length > 0) {
      for (const image of achievement.gallery) {
        if (image.publicId) {
          await deleteFile(image.publicId);
        }
      }
    }

    await achievement.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Achievement deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add image to achievement gallery
// @route   POST /api/achievements/:id/gallery
// @access  Private (Admin only)
exports.addToGallery = async (req, res, next) => {
  try {
    const achievement = await Achievement.findById(req.params.id);

    if (!achievement) {
      return res.status(404).json({
        success: false,
        message: 'Achievement not found',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image',
      });
    }

    const { caption } = req.body;

    achievement.gallery.push({
      url: req.file.path,
      publicId: req.file.filename,
      caption: caption || '',
    });

    await achievement.save();

    res.status(200).json({
      success: true,
      message: 'Image added to gallery',
      gallery: achievement.gallery,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove image from achievement gallery
// @route   DELETE /api/achievements/:id/gallery/:imageId
// @access  Private (Admin only)
exports.removeFromGallery = async (req, res, next) => {
  try {
    const achievement = await Achievement.findById(req.params.id);

    if (!achievement) {
      return res.status(404).json({
        success: false,
        message: 'Achievement not found',
      });
    }

    const image = achievement.gallery.id(req.params.imageId);

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found in gallery',
      });
    }

    // Delete from Cloudinary
    if (image.publicId) {
      await deleteFile(image.publicId);
    }

    achievement.gallery.pull(req.params.imageId);
    await achievement.save();

    res.status(200).json({
      success: true,
      message: 'Image removed from gallery',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get featured achievements
// @route   GET /api/achievements/featured
// @access  Public
exports.getFeaturedAchievements = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 6;

    const achievements = await Achievement.find({
      isFeatured: true,
      isPublished: true,
    })
      .sort({ date: -1 })
      .limit(limit)
      .select('title description category year date coverImage icon isMajor');

    res.status(200).json({
      success: true,
      count: achievements.length,
      achievements,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get achievements by year
// @route   GET /api/achievements/year/:year
// @access  Public
exports.getAchievementsByYear = async (req, res, next) => {
  try {
    const year = parseInt(req.params.year);

    const achievements = await Achievement.find({
      year,
      isPublished: true,
    })
      .sort({ date: -1 })
      .populate('tournament', 'name location');

    res.status(200).json({
      success: true,
      year,
      count: achievements.length,
      achievements,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get achievement statistics
// @route   GET /api/achievements/stats/overview
// @access  Public
exports.getAchievementStats = async (req, res, next) => {
  try {
    const stats = {
      total: await Achievement.countDocuments({ isPublished: true }),
      majors: await Achievement.countDocuments({ isMajor: true, isPublished: true }),
      tournaments: await Achievement.countDocuments({
        category: 'tournament_win',
        isPublished: true,
      }),
      awards: await Achievement.countDocuments({ category: 'award', isPublished: true }),
      byYear: await Achievement.aggregate([
        { $match: { isPublished: true } },
        {
          $group: {
            _id: '$year',
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
      ]),
      byCategory: await Achievement.aggregate([
        { $match: { isPublished: true } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
    };

    res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    next(error);
  }
};