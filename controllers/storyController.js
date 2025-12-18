const Story = require('../models/Story');
const User = require('../models/User');

// @desc    Create new story (Admin only) - Supports multiple media & text
// @route   POST /api/stories
// @access  Private (Admin only)
exports.createStory = async (req, res, next) => {
  try {
    const {
      caption,
      storyType,
      textContent,
      stickers,
      backgroundColor,
      allowComments,
      allowLikes,
      allowSharing,
      isHighlight,
      highlightCategory,
      poll,
      music,
      link,
    } = req.body;

    // Parse JSON strings if they exist
    const parsedTextContent = textContent ? JSON.parse(textContent) : null;
    const parsedStickers = stickers ? JSON.parse(stickers) : [];
    const parsedPoll = poll ? JSON.parse(poll) : null;
    const parsedMusic = music ? JSON.parse(music) : null;
    const parsedLink = link ? JSON.parse(link) : null;

    // Handle multiple files
    const mediaItems = [];
    
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        mediaItems.push({
          mediaType: file.mimetype.startsWith('video') ? 'video' : 'image',
          mediaUrl: file.path,
          publicId: file.filename,
          thumbnail: file.path,
          duration: 5, // Default 5 seconds per slide
        });
      }
    }

    // Validate: Must have either media or text content
    if (mediaItems.length === 0 && !parsedTextContent) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either media files or text content',
      });
    }

    // Determine story type
    let finalStoryType = storyType;
    if (!finalStoryType) {
      if (mediaItems.length > 0 && parsedTextContent) {
        finalStoryType = 'mixed';
      } else if (mediaItems.length > 0) {
        finalStoryType = 'media';
      } else {
        finalStoryType = 'text';
      }
    }

    // Create story
    const story = await Story.create({
      author: req.user.id,
      storyType: finalStoryType,
      mediaItems,
      textContent: parsedTextContent,
      caption,
      stickers: parsedStickers,
      backgroundColor: backgroundColor || '#000000',
      allowComments: allowComments !== undefined ? allowComments : true,
      allowLikes: allowLikes !== undefined ? allowLikes : true,
      allowSharing: allowSharing !== undefined ? allowSharing : true,
      isHighlight: isHighlight || false,
      highlightCategory,
      poll: parsedPoll,
      music: parsedMusic,
      link: parsedLink,
    });

    // Populate author
    await story.populate('author', 'firstName lastName username avatar');

    res.status(201).json({
      success: true,
      message: 'Story created successfully',
      story,
    });
  } catch (error) {
    console.error('Create story error:', error);
    next(error);
  }
};

// @desc    Get all active stories (for users)
// @route   GET /api/stories
// @access  Private
exports.getAllStories = async (req, res, next) => {
  try {
    const stories = await Story.find({
      isActive: true,
      $or: [
        { expiresAt: { $gt: new Date() } },
        { isHighlight: true },
      ],
    })
      .populate('author', 'firstName lastName username avatar')
      .sort({ createdAt: -1 });

    // For regular users, hide sensitive data
    const sanitizedStories = stories.map((story) => {
      const storyObj = story.toObject();
      
      // Only admin can see detailed stats
      if (!req.user.isAdmin) {
        delete storyObj.viewers;
        delete storyObj.likes;
        delete storyObj.comments;
        delete storyObj.reports;
        
        // Show only if current user has viewed/liked
        storyObj.hasViewed = story.hasUserViewed(req.user.id);
        storyObj.hasLiked = story.hasUserLiked(req.user.id);
      }

      return storyObj;
    });

    res.status(200).json({
      success: true,
      count: sanitizedStories.length,
      stories: sanitizedStories,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single story by ID
// @route   GET /api/stories/:id
// @access  Private
exports.getStoryById = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id)
      .populate('author', 'firstName lastName username avatar');

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found',
      });
    }

    // Auto-record view
    await story.addViewer(req.user.id, 0, false);

    // Sanitize data for regular users
    const storyObj = story.toObject();
    if (!req.user.isAdmin) {
      delete storyObj.viewers;
      delete storyObj.likes;
      delete storyObj.comments;
      delete storyObj.reports;
      
      storyObj.hasViewed = story.hasUserViewed(req.user.id);
      storyObj.hasLiked = story.hasUserLiked(req.user.id);
    }

    res.status(200).json({
      success: true,
      story: storyObj,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Record story view
// @route   POST /api/stories/:id/view
// @access  Private
exports.recordView = async (req, res, next) => {
  try {
    const { viewDuration, completed } = req.body;

    const story = await Story.findById(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found',
      });
    }

    await story.addViewer(req.user.id, viewDuration || 0, completed || false);

    res.status(200).json({
      success: true,
      message: 'View recorded',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Like a story
// @route   POST /api/stories/:id/like
// @access  Private
exports.likeStory = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found',
      });
    }

    if (!story.allowLikes) {
      return res.status(403).json({
        success: false,
        message: 'Likes are disabled for this story',
      });
    }

    await story.addLike(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Story liked',
      totalLikes: story.stats.totalLikes,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unlike a story
// @route   DELETE /api/stories/:id/like
// @access  Private
exports.unlikeStory = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found',
      });
    }

    await story.removeLike(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Story unliked',
      totalLikes: story.stats.totalLikes,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Comment on a story
// @route   POST /api/stories/:id/comment
// @access  Private
exports.commentOnStory = async (req, res, next) => {
  try {
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required',
      });
    }

    const story = await Story.findById(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found',
      });
    }

    if (!story.allowComments) {
      return res.status(403).json({
        success: false,
        message: 'Comments are disabled for this story',
      });
    }

    await story.addComment(req.user.id, text);

    res.status(201).json({
      success: true,
      message: 'Comment added',
      totalComments: story.stats.totalComments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a comment (Admin only or comment owner)
// @route   DELETE /api/stories/:id/comment/:commentId
// @access  Private
exports.deleteComment = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found',
      });
    }

    const comment = story.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    // Only admin or comment owner can delete
    if (!req.user.isAdmin && comment.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this comment',
      });
    }

    await story.deleteComment(req.params.commentId);

    res.status(200).json({
      success: true,
      message: 'Comment deleted',
      totalComments: story.stats.totalComments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Share/Repost story
// @route   POST /api/stories/:id/share
// @access  Private
exports.shareStory = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found',
      });
    }

    if (!story.allowSharing) {
      return res.status(403).json({
        success: false,
        message: 'Sharing is disabled for this story',
      });
    }

    await story.incrementShares();

    res.status(200).json({
      success: true,
      message: 'Story shared',
      totalShares: story.stats.totalShares,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Vote on story poll
// @route   POST /api/stories/:id/poll/vote
// @access  Private
exports.votePoll = async (req, res, next) => {
  try {
    const { optionIndex } = req.body;

    if (optionIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Option index is required',
      });
    }

    const story = await Story.findById(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found',
      });
    }

    if (!story.poll) {
      return res.status(400).json({
        success: false,
        message: 'This story does not have a poll',
      });
    }

    await story.votePoll(req.user.id, optionIndex);

    res.status(200).json({
      success: true,
      message: 'Vote recorded',
    });
  } catch (error) {
    if (error.message === 'User has already voted') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

// @desc    Get story analytics (Admin only)
// @route   GET /api/stories/:id/analytics
// @access  Private (Admin only)
exports.getStoryAnalytics = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id)
      .populate('viewers.user', 'firstName lastName username avatar')
      .populate('likes.user', 'firstName lastName username avatar')
      .populate('comments.user', 'firstName lastName username avatar');

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found',
      });
    }

    const analytics = {
      storyId: story._id,
      caption: story.caption,
      createdAt: story.createdAt,
      expiresAt: story.expiresAt,
      isExpired: story.isExpired,
      timeRemaining: story.timeRemaining,
      
      stats: story.stats,
      
      viewers: story.viewers.map((v) => ({
        user: v.user,
        viewedAt: v.viewedAt,
        viewDuration: v.viewDuration,
        completed: v.completed,
      })),
      
      likes: story.likes.map((l) => ({
        user: l.user,
        likedAt: l.likedAt,
      })),
      
      comments: story.comments.map((c) => ({
        id: c._id,
        user: c.user,
        text: c.text,
        createdAt: c.createdAt,
      })),
      
      poll: story.poll,
    };

    res.status(200).json({
      success: true,
      analytics,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete story (Admin only)
// @route   DELETE /api/stories/:id
// @access  Private (Admin only)
exports.deleteStory = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found',
      });
    }

    // Delete media from Cloudinary
    if (story.publicId) {
      const { deleteFile } = require('../config/cloudinary');
      await deleteFile(story.publicId);
    }

    await story.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Story deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Save story as highlight (Admin only)
// @route   PUT /api/stories/:id/highlight
// @access  Private (Admin only)
exports.saveAsHighlight = async (req, res, next) => {
  try {
    const { highlightCategory } = req.body;

    const story = await Story.findByIdAndUpdate(
      req.params.id,
      {
        isHighlight: true,
        highlightCategory: highlightCategory || 'other',
      },
      { new: true }
    ).populate('author', 'firstName lastName username avatar');

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Story saved as highlight',
      story,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all highlights
// @route   GET /api/stories/highlights
// @access  Public
exports.getHighlights = async (req, res, next) => {
  try {
    const { category } = req.query;

    const query = { isHighlight: true, isActive: true };
    if (category) {
      query.highlightCategory = category;
    }

    const highlights = await Story.find(query)
      .populate('author', 'firstName lastName username avatar')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: highlights.length,
      highlights,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Report story
// @route   POST /api/stories/:id/report
// @access  Private
exports.reportStory = async (req, res, next) => {
  try {
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Report reason is required',
      });
    }

    const story = await Story.findById(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found',
      });
    }

    story.reports.push({
      user: req.user.id,
      reason,
      reportedAt: Date.now(),
    });

    await story.save();

    res.status(200).json({
      success: true,
      message: 'Story reported successfully',
    });
  } catch (error) {
    next(error);
  }
};