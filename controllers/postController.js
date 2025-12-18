const Post = require('../models/Post');
const Comment = require('../models/Comment');
const MediaComment = require('../models/MediaComment');
const User = require('../models/User');
const { createNotification } = require('./notificationController');
const { processPostHashtags } = require('../utils/trendingUtils');
const { deleteFile } = require('../config/cloudinary');
const pointsService = require('../services/pointsService'); // ✅ ADDED

// @desc    Create new post (Admin/Nelly only)
// @route   POST /api/posts
// @access  Private (Admin only)
exports.createPost = async (req, res, next) => {
  try {
    // ONLY ADMIN CAN CREATE POSTS
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin can create posts',
      });
    }

    const {
      caption,
      type,
      tags,
      tournament,
      location,
      isExclusive,
      isPinned,
      allowComments,
      allowLikes,
      allowShares,
      scheduledFor,
    } = req.body;

    // Process uploaded media files
    const media = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        media.push({
          url: file.path,
          publicId: file.filename,
          type: file.mimetype.startsWith('image') ? 'image' : 'video',
          width: file.width,
          height: file.height,
        });
      });
    }

    // Create post
    const post = await Post.create({
      author: req.user.id,
      caption,
      type,
      media,
      tags: tags ? tags.split(',').map((tag) => tag.trim()) : [],
      tournament,
      location: location ? JSON.parse(location) : undefined,
      isExclusive: isExclusive === 'true',
      isPinned: isPinned === 'true',
      allowComments: allowComments !== 'false',
      allowLikes: allowLikes !== 'false',
      allowShares: allowShares !== 'false',
      scheduledFor,
      status: scheduledFor ? 'scheduled' : 'published',
    });

    await post.populate('author', 'firstName lastName avatar username');

    // ✅ ADDED: Award points for post creation
    await pointsService.awardPoints(req.user.id, 'CREATE_POST');
    if (media.length > 0) {
      await pointsService.awardPoints(req.user.id, 'POST_WITH_MEDIA');
    }
    await pointsService.checkAndAwardBadges(req.user.id);

    // Process hashtags from post
    await processPostHashtags(post);

    // Update user stats
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { 'stats.totalPosts': 1 },
    });

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all posts (Feed)
// @route   GET /api/posts
// @access  Public
exports.getPosts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // FIXED: Get ALL admin users (find all users with role: 'admin')
    const adminUsers = await User.find({ role: 'admin' }).select('_id');
    
    if (!adminUsers || adminUsers.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        total: 0,
        page,
        pages: 0,
        posts: [],
        message: 'No admin users found'
      });
    }

    // Extract admin user IDs
    const adminIds = adminUsers.map(admin => admin._id);

    // Build query - Show posts from ANY admin user
    let query = { 
      status: 'published',
      author: { $in: adminIds }  // FIXED: Match any admin user
    };

    // Filter by type
    if (req.query.type) {
      query.type = req.query.type;
    }

    // Filter by tournament
    if (req.query.tournament) {
      query.tournament = req.query.tournament;
    }

    // Filter by tags
    if (req.query.tag) {
      query.tags = req.query.tag;
    }

    // Exclude exclusive content for non-logged-in users
    if (!req.user) {
      query.isExclusive = false;
    }

    // Get posts
    let posts = await Post.find(query)
      .sort({ isPinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'firstName lastName avatar username role')
      .populate('tournament', 'name location startDate')
      .lean();

    // Add isLikedByMe field for each post
    posts = posts.map(post => {
      const isLiked = req.user 
        ? post.likes?.some(like => like.user.toString() === req.user.id)
        : false;

      // Remove private data (likes array, views array)
      const { likes, views, ...postData } = post;

      // Add isAdmin virtual field to author
      if (postData.author) {
        postData.author.isAdmin = postData.author.role === 'admin';
      }

      return {
        ...postData,
        isLikedByMe: isLiked
      };
    });

    const total = await Post.countDocuments(query);

    res.status(200).json({
      success: true,
      count: posts.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      posts,
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    next(error);
  }
};

// @desc    Get single post
// @route   GET /api/posts/:id
// @access  Public
exports.getPost = async (req, res, next) => {
  try {
    let post = await Post.findById(req.params.id)
      .populate('author', 'firstName lastName avatar username role')
      .populate('tournament', 'name location startDate endDate')
      .lean();

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Add isAdmin virtual to author
    if (post.author) {
      post.author.isAdmin = post.author.role === 'admin';
    }

    // Check exclusive content access
    if (post.isExclusive && !req.user) {
      return res.status(403).json({
        success: false,
        message: 'Please login to view exclusive content',
      });
    }

    // Add view (if user is logged in and not the author)
    if (req.user && req.user.id !== post.author._id.toString()) {
      await Post.findByIdAndUpdate(req.params.id, {
        $addToSet: { views: { user: req.user.id } }
      });
    }

    // Add isLikedByMe field
    const isLiked = req.user 
      ? post.likes?.some(like => like.user.toString() === req.user.id)
      : false;

    // If user is NOT admin, hide private engagement data
    if (!req.user || req.user.role !== 'admin') {
      const { likes, views, ...postData } = post;
      post = {
        ...postData,
        isLikedByMe: isLiked
      };
    } else {
      post.isLikedByMe = isLiked;
    }

    res.status(200).json({
      success: true,
      post,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update post
// @route   PUT /api/posts/:id
// @access  Private (Admin only)
exports.updatePost = async (req, res, next) => {
  try {
    let post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Update fields
    const {
      caption,
      tags,
      isPinned,
      status,
      allowComments,
      allowLikes,
      allowShares,
      location,
    } = req.body;

    post = await Post.findByIdAndUpdate(
      req.params.id,
      {
        caption,
        tags: tags ? tags.split(',').map((tag) => tag.trim()) : post.tags,
        isPinned: isPinned !== undefined ? isPinned : post.isPinned,
        status: status || post.status,
        allowComments: allowComments !== undefined ? allowComments : post.allowComments,
        allowLikes: allowLikes !== undefined ? allowLikes : post.allowLikes,
        allowShares: allowShares !== undefined ? allowShares : post.allowShares,
        location: location ? JSON.parse(location) : post.location,
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Post updated successfully',
      post,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete post
// @route   DELETE /api/posts/:id
// @access  Private (Admin only)
exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Delete media from Cloudinary
    if (post.media && post.media.length > 0) {
      for (const file of post.media) {
        await deleteFile(file.publicId);
      }
    }

    await post.deleteOne();

    // Update user stats
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { 'stats.totalPosts': -1 },
    });

    res.status(200).json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Like/Unlike post
// @route   PUT /api/posts/:id/like
// @access  Private
exports.toggleLike = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Check if likes are allowed
    if (!post.allowLikes) {
      return res.status(403).json({
        success: false,
        message: 'Likes are disabled for this post',
      });
    }

    // Check if already liked
    const likeIndex = post.likes.findIndex(
      (like) => like.user.toString() === req.user.id
    );

    let result;
    if (likeIndex === -1) {
      // Add like
      result = await post.addLike(req.user.id);
      
      // ✅ ADDED: Award points
      // Award points to user who liked
      await pointsService.awardPoints(req.user.id, 'RECEIVE_LIKE');
      
      // Award points to post author
      await pointsService.awardPoints(post.author.toString(), 'RECEIVE_LIKE');
      await pointsService.checkAndAwardBadges(post.author.toString());
    } else {
      // Remove like
      result = await post.removeLike(req.user.id);
    }

    res.status(200).json({
      success: true,
      liked: result.liked,
      likesCount: result.likesCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Share post (increment share count)
// @route   PUT /api/posts/:id/share
// @access  Private
exports.sharePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    if (!post.allowShares) {
      return res.status(403).json({
        success: false,
        message: 'Sharing is disabled for this post',
      });
    }

    await post.incrementShares();

    // Award points to user
    await req.user.awardPoints(10);

    res.status(200).json({
      success: true,
      message: 'Post shared successfully',
      sharesCount: post.sharesCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get post engagement stats (Admin only)
// @route   GET /api/posts/:id/stats
// @access  Private (Admin only)
exports.getPostStats = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('likes.user', 'firstName lastName avatar username')
      .populate('views.user', 'firstName lastName avatar username');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const stats = {
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      sharesCount: post.sharesCount,
      viewsCount: post.viewsCount,
      likes: post.likes,
      views: post.views,
    };

    res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Like post (alternative implementation)
// @route   PUT /api/posts/:id/like
// @access  Private
exports.likePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const userId = req.user.id;
    const isLiked = post.likes.includes(userId);

    if (isLiked) {
      // Unlike
      post.likes = post.likes.filter(
        (id) => id.toString() !== userId.toString()
      );
    } else {
      // Like
      post.likes.push(userId);

      // Create notification for post author (only if not liking own post)
      if (post.author.toString() !== userId) {
        await createNotification({
          recipient: post.author,
          sender: userId,
          type: 'like',
          post: post._id,
          content: `${req.user.firstName} ${req.user.lastName} liked your post`,
          link: `/post/${post._id}`,
        });
      }
    }

    await post.save();

    res.status(200).json({
      success: true,
      liked: !isLiked,
      likesCount: post.likes.length,
    });
  } catch (error) {
    console.error('Error liking post:', error);
    next(error);
  }
};

// @desc    React to post (like, love, haha, wow, sad, angry)
// @route   PUT /api/posts/:id/react
// @access  Private
exports.reactToPost = async (req, res, next) => {
  try {
    const { reaction } = req.body; // 'like', 'love', 'haha', 'wow', 'sad', 'angry'
    
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    if (!post.allowLikes) {
      return res.status(403).json({
        success: false,
        message: 'Reactions are disabled for this post',
      });
    }

    const result = await post.addReaction(req.user.id, reaction);

    // Create notification if user reacted (not unreacted)
    if (result.liked && post.author.toString() !== req.user.id) {
      await createNotification({
        recipient: post.author,
        sender: req.user.id,
        type: 'reaction',
        post: post._id,
        content: `reacted ${reaction} to your post`,
        link: `/post/${post._id}`,
      });
    }

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    React to specific media in post
// @route   PUT /api/posts/:id/media/:mediaIndex/react
// @access  Private
exports.reactToMedia = async (req, res, next) => {
  try {
    const { mediaIndex } = req.params;
    const { reaction } = req.body;

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const result = await post.addMediaReaction(parseInt(mediaIndex), req.user.id, reaction);

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get who reacted to post
// @route   GET /api/posts/:id/reactions
// @access  Private
exports.getPostReactions = async (req, res, next) => {
  try {
    const { reactionType } = req.query; // Optional filter: 'like', 'love', etc.

    const post = await Post.findById(req.params.id)
      .populate('likes.user', 'firstName lastName avatar username');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    let reactions = post.likes;

    // Filter by reaction type if specified
    if (reactionType) {
      reactions = reactions.filter(like => like.reaction === reactionType);
    }

    res.status(200).json({
      success: true,
      count: reactions.length,
      reactions,
      reactionCounts: post.reactionCounts
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get who reacted to specific media
// @route   GET /api/posts/:id/media/:mediaIndex/reactions
// @access  Private
exports.getMediaReactions = async (req, res, next) => {
  try {
    const { mediaIndex } = req.params;

    const post = await Post.findById(req.params.id)
      .populate('media.likes.user', 'firstName lastName avatar username');

    if (!post || !post.media[mediaIndex]) {
      return res.status(404).json({
        success: false,
        message: 'Media not found',
      });
    }

    const media = post.media[mediaIndex];

    res.status(200).json({
      success: true,
      count: media.likes.length,
      reactions: media.likes
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Comment on specific media
// @route   POST /api/posts/:id/media/:mediaIndex/comments
// @access  Private
exports.commentOnMedia = async (req, res, next) => {
  try {
    const { mediaIndex } = req.params;
    const { content, parentCommentId } = req.body;

    const post = await Post.findById(req.params.id);
    if (!post || !post.media[mediaIndex]) {
      return res.status(404).json({
        success: false,
        message: 'Media not found',
      });
    }

    // Create media comment
    const comment = await MediaComment.create({
      post: post._id,
      mediaIndex: parseInt(mediaIndex),
      author: req.user.id,
      content,
      parentComment: parentCommentId || null,
    });

    await comment.populate('author', 'firstName lastName avatar username');

    // Update media comments count
    post.media[mediaIndex].comments.push(comment._id);
    post.media[mediaIndex].commentsCount += 1;
    await post.save();

    // Update parent comment replies count if this is a reply
    if (parentCommentId) {
      await MediaComment.findByIdAndUpdate(parentCommentId, {
        $inc: { repliesCount: 1 }
      });
    }

    res.status(201).json({
      success: true,
      comment,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get comments on specific media
// @route   GET /api/posts/:id/media/:mediaIndex/comments
// @access  Private
exports.getMediaComments = async (req, res, next) => {
  try {
    const { mediaIndex } = req.params;
    const { sort } = req.query; // 'relevant', 'newest', 'all'

    // Only admin can see all comments
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin can view comments',
      });
    }

    const post = await Post.findById(req.params.id);
    if (!post || !post.media[mediaIndex]) {
      return res.status(404).json({
        success: false,
        message: 'Media not found',
      });
    }

    let query = {
      post: post._id,
      mediaIndex: parseInt(mediaIndex),
      parentComment: null
    };

    let sortOption = { createdAt: -1 }; // Default: newest first

    if (sort === 'relevant') {
      sortOption = { likesCount: -1, createdAt: -1 };
    }

    const comments = await MediaComment.find(query)
      .sort(sortOption)
      .populate('author', 'firstName lastName avatar username')
      .lean();

    // Get replies for each comment
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        const replies = await MediaComment.find({ parentComment: comment._id })
          .sort({ createdAt: 1 })
          .populate('author', 'firstName lastName avatar username')
          .lean();

        return {
          ...comment,
          replies,
          isLikedByMe: comment.likes?.some(
            like => like.user.toString() === req.user.id
          ) || false
        };
      })
    );

    res.status(200).json({
      success: true,
      count: commentsWithReplies.length,
      comments: commentsWithReplies,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Tag user in media
// @route   POST /api/posts/:id/media/:mediaIndex/tag
// @access  Private (Admin only)
exports.tagUserInMedia = async (req, res, next) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin can tag users',
      });
    }

    const { mediaIndex } = req.params;
    const { userId, position } = req.body; // position: { x: 50, y: 50 } (percentages)

    const post = await Post.findById(req.params.id);
    if (!post || !post.media[mediaIndex]) {
      return res.status(404).json({
        success: false,
        message: 'Media not found',
      });
    }

    await post.tagUserInMedia(parseInt(mediaIndex), userId, position);
    await post.populate('media.taggedUsers.user', 'firstName lastName username');

    // Create notification for tagged user
    await createNotification({
      recipient: userId,
      sender: req.user.id,
      type: 'tag',
      post: post._id,
      content: 'tagged you in a photo',
      link: `/post/${post._id}?media=${mediaIndex}`,
    });

    res.status(200).json({
      success: true,
      message: 'User tagged successfully',
      media: post.media[mediaIndex],
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove tag from media
// @route   DELETE /api/posts/:id/media/:mediaIndex/tag/:userId
// @access  Private (Admin or tagged user)
exports.removeTagFromMedia = async (req, res, next) => {
  try {
    const { mediaIndex, userId } = req.params;

    // Only admin or the tagged user can remove tag
    if (!req.user.isAdmin && req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to remove this tag',
      });
    }

    const post = await Post.findById(req.params.id);
    if (!post || !post.media[mediaIndex]) {
      return res.status(404).json({
        success: false,
        message: 'Media not found',
      });
    }

    await post.removeTagFromMedia(parseInt(mediaIndex), userId);

    res.status(200).json({
      success: true,
      message: 'Tag removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Like media comment
// @route   PUT /api/posts/media-comments/:commentId/like
// @access  Private
exports.likeMediaComment = async (req, res, next) => {
  try {
    const comment = await MediaComment.findById(req.params.commentId);
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    const result = await comment.addLike(req.user.id);

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Edit comment (post or media comment)
// @route   PUT /api/posts/comments/:commentId
// @access  Private
exports.editComment = async (req, res, next) => {
  try {
    const { content } = req.body;
    const { commentType } = req.query; // 'post' or 'media'

    const Model = commentType === 'media' ? MediaComment : Comment;
    const comment = await Model.findById(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    // Only comment author or admin can edit
    if (comment.author.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to edit this comment',
      });
    }

    await comment.updateContent(content);
    await comment.populate('author', 'firstName lastName avatar username');

    res.status(200).json({
      success: true,
      comment,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete comment (post or media comment)
// @route   DELETE /api/posts/comments/:commentId
// @access  Private
exports.deleteComment = async (req, res, next) => {
  try {
    const { commentType } = req.query; // 'post' or 'media'

    const Model = commentType === 'media' ? MediaComment : Comment;
    const comment = await Model.findById(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    // Only comment author or admin can delete
    if (comment.author.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this comment',
      });
    }

    // Delete all replies if this is a parent comment
    if (!comment.parentComment) {
      await Model.deleteMany({ parentComment: comment._id });
    } else {
      // Decrement parent's reply count
      await Model.findByIdAndUpdate(comment.parentComment, {
        $inc: { repliesCount: -1 }
      });
    }

    await comment.deleteOne();

    // Update post/media comments count
    if (commentType === 'media') {
      await Post.findOneAndUpdate(
        { 
          _id: comment.post,
          'media.comments': comment._id
        },
        {
          $pull: { 'media.$.comments': comment._id },
          $inc: { 'media.$.commentsCount': -1 }
        }
      );
    } else {
      await Post.findByIdAndUpdate(comment.post, {
        $pull: { comments: comment._id },
        $inc: { commentsCount: -1 }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = exports;