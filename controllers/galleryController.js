const Post = require('../models/Post');
const Profile = require('../models/Profile');
const User = require('../models/User');

// @desc    Get all gallery media (photos + videos) from posts and profile
// @route   GET /api/gallery
// @access  Private
exports.getAllGalleryMedia = async (req, res, next) => {
  try {
    const { type, sort, limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get current user or specified user
    const userId = req.params.userId || req.user.id;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get all media from posts
    const posts = await Post.find({ 
      author: userId, 
      status: { $ne: 'deleted' } 
    })
      .select('media caption createdAt location')
      .sort({ createdAt: -1 })
      .lean();

    // Get profile gallery
    const profile = await Profile.findOne({ user: userId })
      .select('gallery')
      .lean();

    // Collect all media items
    let allMedia = [];

    // Add media from posts
    posts.forEach(post => {
      if (post.media && post.media.length > 0) {
        post.media.forEach((media, index) => {
          allMedia.push({
            _id: `${post._id}_${index}`,
            url: media.url,
            publicId: media.publicId,
            type: media.type, // 'image' or 'video'
            width: media.width,
            height: media.height,
            caption: post.caption,
            location: post.location,
            source: 'post',
            sourceId: post._id,
            createdAt: post.createdAt,
          });
        });
      }
    });

    // Add media from profile gallery
    if (profile && profile.gallery && profile.gallery.length > 0) {
      profile.gallery.forEach(media => {
        allMedia.push({
          _id: media._id,
          url: media.url,
          publicId: media.publicId,
          type: media.type, // 'image' or 'video'
          caption: media.caption,
          source: 'profile',
          sourceId: profile._id,
          createdAt: media.createdAt || new Date(),
        });
      });
    }

    // Filter by type if specified
    if (type && (type === 'image' || type === 'video')) {
      allMedia = allMedia.filter(media => media.type === type);
    }

    // Sort media
    if (sort === 'oldest') {
      allMedia.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else {
      // Default: newest first
      allMedia.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Pagination
    const total = allMedia.length;
    const paginatedMedia = allMedia.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      success: true,
      count: paginatedMedia.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      media: paginatedMedia,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error('Error fetching gallery media:', error);
    next(error);
  }
};

// @desc    Get photos only
// @route   GET /api/gallery/photos
// @access  Private
exports.getPhotos = async (req, res, next) => {
  try {
    req.query.type = 'image';
    exports.getAllGalleryMedia(req, res, next);
  } catch (error) {
    next(error);
  }
};

// @desc    Get videos only
// @route   GET /api/gallery/videos
// @access  Private
exports.getVideos = async (req, res, next) => {
  try {
    req.query.type = 'video';
    exports.getAllGalleryMedia(req, res, next);
  } catch (error) {
    next(error);
  }
};

// @desc    Get albums (grouped by month/year)
// @route   GET /api/gallery/albums
// @access  Private
exports.getAlbums = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user.id;

    // Get all posts with media
    const posts = await Post.find({ 
      author: userId, 
      status: { $ne: 'deleted' },
      media: { $exists: true, $not: { $size: 0 } }
    })
      .select('media createdAt')
      .sort({ createdAt: -1 })
      .lean();

    // Group by month/year
    const albums = {};

    posts.forEach(post => {
      const date = new Date(post.createdAt);
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      if (!albums[monthYear]) {
        albums[monthYear] = {
          id: monthYear,
          name: monthName,
          date: date,
          photos: 0,
          videos: 0,
          coverPhoto: null,
          items: [],
        };
      }

      post.media.forEach(media => {
        if (media.type === 'image') {
          albums[monthYear].photos++;
          if (!albums[monthYear].coverPhoto) {
            albums[monthYear].coverPhoto = media.url;
          }
        } else {
          albums[monthYear].videos++;
        }
        albums[monthYear].items.push(media);
      });
    });

    // Convert to array and sort by date
    const albumsArray = Object.values(albums).sort((a, b) => b.date - a.date);

    res.status(200).json({
      success: true,
      count: albumsArray.length,
      albums: albumsArray,
    });
  } catch (error) {
    console.error('Error fetching albums:', error);
    next(error);
  }
};

module.exports = exports;