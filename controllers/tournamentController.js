const Tournament = require('../models/Tournament');
const { deleteFile } = require('../config/cloudinary');

// @desc    Create tournament (Admin only)
// @route   POST /api/tournaments
// @access  Private (Admin only)
exports.createTournament = async (req, res, next) => {
  try {
    const {
      name,
      type,
      location,
      startDate,
      endDate,
      description,
      prizeMoney,
      stats,
      website,
      isFeatured,
    } = req.body;

    // Handle cover image upload
    let coverImage = {};
    if (req.file) {
      coverImage = {
        url: req.file.path,
        publicId: req.file.filename,
      };
    }

    // Create tournament
    const tournament = await Tournament.create({
      name,
      type,
      location: location ? JSON.parse(location) : undefined,
      startDate,
      endDate,
      description,
      prizeMoney: prizeMoney ? JSON.parse(prizeMoney) : undefined,
      stats: stats ? JSON.parse(stats) : undefined,
      website,
      coverImage,
      isFeatured: isFeatured === 'true',
    });

    res.status(201).json({
      success: true,
      message: 'Tournament created successfully',
      tournament,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all tournaments
// @route   GET /api/tournaments
// @access  Public
exports.getTournaments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    // Build query
    let query = {};

    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Filter by type
    if (req.query.type) {
      query.type = req.query.type;
    }

    // Filter by Nelly's participation
    if (req.query.participated === 'true') {
      query['performance.participated'] = true;
    }

    // Filter by year
    if (req.query.year) {
      const year = parseInt(req.query.year);
      query.startDate = {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1),
      };
    }

    // Get tournaments
    const tournaments = await Tournament.find(query)
      .sort({ isFeatured: -1, startDate: -1 })
      .skip(skip)
      .limit(limit)
      .select('-relatedPosts');

    const total = await Tournament.countDocuments(query);

    res.status(200).json({
      success: true,
      count: tournaments.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      tournaments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single tournament
// @route   GET /api/tournaments/:id
// @access  Public
exports.getTournament = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id).populate(
      'relatedPosts',
      'caption media likesCount commentsCount createdAt'
    );

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    res.status(200).json({
      success: true,
      tournament,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update tournament
// @route   PUT /api/tournaments/:id
// @access  Private (Admin only)
exports.updateTournament = async (req, res, next) => {
  try {
    let tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    const {
      name,
      type,
      location,
      startDate,
      endDate,
      status,
      description,
      prizeMoney,
      performance,
      stats,
      website,
      isFeatured,
    } = req.body;

    // Handle cover image update
    if (req.file) {
      // Delete old image
      if (tournament.coverImage.publicId) {
        await deleteFile(tournament.coverImage.publicId);
      }

      tournament.coverImage = {
        url: req.file.path,
        publicId: req.file.filename,
      };
    }

    // Update fields
    tournament = await Tournament.findByIdAndUpdate(
      req.params.id,
      {
        name: name || tournament.name,
        type: type || tournament.type,
        location: location ? JSON.parse(location) : tournament.location,
        startDate: startDate || tournament.startDate,
        endDate: endDate || tournament.endDate,
        status: status || tournament.status,
        description: description || tournament.description,
        prizeMoney: prizeMoney ? JSON.parse(prizeMoney) : tournament.prizeMoney,
        performance: performance ? JSON.parse(performance) : tournament.performance,
        stats: stats ? JSON.parse(stats) : tournament.stats,
        website: website || tournament.website,
        coverImage: tournament.coverImage,
        isFeatured: isFeatured !== undefined ? isFeatured === 'true' : tournament.isFeatured,
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Tournament updated successfully',
      tournament,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete tournament
// @route   DELETE /api/tournaments/:id
// @access  Private (Admin only)
exports.deleteTournament = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // Delete cover image from Cloudinary
    if (tournament.coverImage.publicId) {
      await deleteFile(tournament.coverImage.publicId);
    }

    // Delete gallery images
    if (tournament.gallery && tournament.gallery.length > 0) {
      for (const image of tournament.gallery) {
        if (image.publicId) {
          await deleteFile(image.publicId);
        }
      }
    }

    await tournament.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Tournament deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Nelly's performance in tournament
// @route   PUT /api/tournaments/:id/performance
// @access  Private (Admin only)
exports.updatePerformance = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    const { participated, position, score, earnings, highlights } = req.body;

    tournament.performance = {
      participated: participated !== undefined ? participated : tournament.performance.participated,
      position: position || tournament.performance.position,
      score: score ? JSON.parse(score) : tournament.performance.score,
      earnings: earnings || tournament.performance.earnings,
      highlights: highlights ? JSON.parse(highlights) : tournament.performance.highlights,
    };

    await tournament.save();

    res.status(200).json({
      success: true,
      message: 'Performance updated successfully',
      tournament,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add image to tournament gallery
// @route   POST /api/tournaments/:id/gallery
// @access  Private (Admin only)
exports.addToGallery = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image',
      });
    }

    const { caption } = req.body;

    tournament.gallery.push({
      url: req.file.path,
      publicId: req.file.filename,
      caption: caption || '',
    });

    await tournament.save();

    res.status(200).json({
      success: true,
      message: 'Image added to gallery',
      gallery: tournament.gallery,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove image from tournament gallery
// @route   DELETE /api/tournaments/:id/gallery/:imageId
// @access  Private (Admin only)
exports.removeFromGallery = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    const image = tournament.gallery.id(req.params.imageId);

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

    tournament.gallery.pull(req.params.imageId);
    await tournament.save();

    res.status(200).json({
      success: true,
      message: 'Image removed from gallery',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get upcoming tournaments
// @route   GET /api/tournaments/upcoming
// @access  Public
exports.getUpcomingTournaments = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const tournaments = await Tournament.find({
      status: 'upcoming',
      startDate: { $gte: new Date() },
    })
      .sort({ startDate: 1 })
      .limit(limit)
      .select('name location startDate endDate type coverImage');

    res.status(200).json({
      success: true,
      count: tournaments.length,
      tournaments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get tournament statistics
// @route   GET /api/tournaments/statistics
// @access  Public
exports.getTournamentStatistics = async (req, res, next) => {
  try {
    // If year is provided and valid, use it. Otherwise, get ALL TIME stats
    const year = req.query.year ? parseInt(req.query.year) : null;

    // Build base query - only tournaments where Nelly participated
    const baseQuery = { 'performance.participated': true };
    
    // If year is provided, filter by that year
    if (year) {
      baseQuery.startDate = {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1),
      };
    }

    // Count tournaments based on query
    const stats = {
      total: await Tournament.countDocuments(baseQuery),
      wins: await Tournament.countDocuments({
        ...baseQuery,
        'performance.position': 1,
      }),
      topTen: await Tournament.countDocuments({
        ...baseQuery,
        'performance.position': { $lte: 10 },
      }),
    };

    res.status(200).json({
      success: true,
      year: year || 'all',
      stats,
    });
  } catch (error) {
    next(error);
  }
};