const Comment = require('../models/Comment');
const { createNotification } = require('./notificationController');
const { processCommentHashtags } = require('../utils/trendingUtils');
const Post = require('../models/Post');
const User = require('../models/User');

// @desc    Create comment on a post
// @route   POST /api/posts/:postId/comments
// @access  Private
exports.createComment = async (req, res, next) => {
  try {
    const { content, parentCommentId } = req.body;
    const { postId } = req.params;

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Check if comments are allowed on this post
    if (!post.allowComments) {
      return res.status(403).json({
        success: false,
        message: 'Comments are disabled for this post',
      });
    }

    // If it's a reply, check if parent comment exists
    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        return res.status(404).json({
          success: false,
          message: 'Parent comment not found',
        });
      }
      
      // Increment parent comment's reply count
      parentComment.repliesCount = (parentComment.repliesCount || 0) + 1;
      await parentComment.save();
    }

    // Create comment
    const comment = await Comment.create({
      post: postId,
      author: req.user.id,
      content,
      parentComment: parentCommentId || null,
    });

    
    // Process hashtags from comment
    await processCommentHashtags(comment, postId);

    await comment.populate('author', 'firstName lastName avatar username isAdmin role');

    // Update post comment count
    post.commentsCount = (post.commentsCount || 0) + 1;
    await post.save();

    // Award points to user
    if (req.user.awardPoints) {
      await req.user.awardPoints(3);
    }

    // Create notification
    if (parentCommentId) {
      // REPLY TO COMMENT - Notify the parent comment author
      const parentCommentDoc = await Comment.findById(parentCommentId);
      if (parentCommentDoc && parentCommentDoc.author.toString() !== req.user.id) {
        await createNotification({
          recipient: parentCommentDoc.author,
          sender: req.user.id,
          type: 'reply',
          post: postId,
          comment: comment._id,
          content: `${req.user.firstName} ${req.user.lastName} replied to your comment`,
          link: `/post/${postId}#comment-${comment._id}`,
        });
      }
    } else {
      // NEW COMMENT - Notify the post author
      if (post.author.toString() !== req.user.id) {
        await createNotification({
          recipient: post.author,
          sender: req.user.id,
          type: 'comment',
          post: postId,
          comment: comment._id,
          content: `${req.user.firstName} ${req.user.lastName} commented on your post`,
          link: `/post/${postId}#comment-${comment._id}`,
        });
      }
    }

    // Add isAdmin virtual field
    const commentObj = comment.toObject();
    commentObj.author.isAdmin = commentObj.author.role === 'admin';
    commentObj.isLikedByMe = false;

    res.status(201).json({
      success: true,
      message: 'Comment posted successfully',
      comment: commentObj,
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    next(error);
  }
};

// @desc    Get comments for a post (INCLUDING ALL REPLIES)
// @route   GET /api/posts/:postId/comments
// @access  Public
exports.getPostComments = async (req, res, next) => {
  try {
    const { postId } = req.params;

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // ADMIN RESTRICTION: Only admin can see comments
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admin can view comments',
        comments: []
      });
    }

    // Get ALL comments for this post (both parent and replies)
    // FIX: Don't filter by 'status' field - it might not exist on all comments
    const query = {
      post: postId,
      // Removed status filter - fetch all comments for this post
    };

    let comments = await Comment.find(query)
      .sort({ createdAt: -1 }) // Newest first
      .populate('author', 'firstName lastName avatar username isAdmin role')
      .lean();

    console.log(`Found ${comments.length} comments for post ${postId}`);

    // Add isLikedByMe and isAdmin fields for each comment
    comments = comments.map((comment) => {
      // Add isAdmin virtual field
      if (comment.author) {
        comment.author.isAdmin = comment.author.role === 'admin';
      }
      
      return {
        ...comment,
        isLikedByMe: req.user ? (comment.likes?.some(
          (like) => like.user.toString() === req.user.id
        ) || false) : false,
        likes: undefined, // Hide who liked (privacy)
      };
    });

    res.status(200).json({
      success: true,
      count: comments.length,
      comments,
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    next(error);
  }
};

// @desc    Get replies for a comment
// @route   GET /api/comments/:commentId/replies
// @access  Public
exports.getCommentReplies = async (req, res, next) => {
  try {
    const { commentId } = req.params;

    // Check if parent comment exists
    const parentComment = await Comment.findById(commentId);
    if (!parentComment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    let replies = await Comment.find({
      parentComment: commentId,
      status: 'active',
    })
      .sort({ createdAt: 1 })
      .populate('author', 'firstName lastName avatar username isAdmin role')
      .lean();

    // Check if current user liked each reply
    if (req.user) {
      replies = replies.map((reply) => {
        if (reply.author) {
          reply.author.isAdmin = reply.author.role === 'admin';
        }
        
        return {
          ...reply,
          isLikedByMe: reply.likes?.some(
            (like) => like.user.toString() === req.user.id
          ) || false,
          likes: undefined,
        };
      });
    } else {
      replies = replies.map((reply) => {
        if (reply.author) {
          reply.author.isAdmin = reply.author.role === 'admin';
        }
        
        return {
          ...reply,
          likes: undefined,
        };
      });
    }

    res.status(200).json({
      success: true,
      count: replies.length,
      replies,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update comment
// @route   PUT /api/comments/:id
// @access  Private (Owner or Admin)
exports.updateComment = async (req, res, next) => {
  try {
    let comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    // Check ownership (only author or admin can update)
    if (
      comment.author.toString() !== req.user.id &&
      !req.user.isAdmin
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this comment',
      });
    }

    const { content } = req.body;

    comment.content = content;
    comment.isEdited = true;
    await comment.save();
    
    await comment.populate('author', 'firstName lastName avatar username role');

    res.status(200).json({
      success: true,
      message: 'Comment updated successfully',
      comment,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete comment
// @route   DELETE /api/comments/:id
// @access  Private (Owner or Admin)
exports.deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    // Check ownership
    if (
      comment.author.toString() !== req.user.id &&
      !req.user.isAdmin
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this comment',
      });
    }

    // Delete all replies if this is a parent comment
    if (!comment.parentComment) {
      const repliesCount = await Comment.countDocuments({ parentComment: comment._id });
      await Comment.deleteMany({ parentComment: comment._id });
      
      // Update post comment count (parent + all replies)
      await Post.findByIdAndUpdate(comment.post, {
        $inc: { commentsCount: -(repliesCount + 1) }
      });
    } else {
      // Decrement parent's reply count
      await Comment.findByIdAndUpdate(comment.parentComment, {
        $inc: { repliesCount: -1 }
      });
      
      // Update post comment count
      await Post.findByIdAndUpdate(comment.post, {
        $inc: { commentsCount: -1 }
      });
    }

    await comment.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Like/Unlike comment
// @route   PUT /api/comments/:id/like
// @access  Private
exports.toggleCommentLike = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    // Check if already liked
    const alreadyLiked = comment.likes?.some(
      (like) => like.user.toString() === req.user.id
    );

    let result;
    if (alreadyLiked) {
      // FIXED: Use addReaction instead of removeLike
      result = await comment.addReaction(req.user.id, 'like'); // Will toggle off
    } else {
      // FIXED: Use addReaction instead of addLike
      result = await comment.addReaction(req.user.id, 'like');
      
      // Award points
      if (req.user.awardPoints) {
        await req.user.awardPoints(2);
      }
      
      // Create notification for comment author (only if not liking own comment)
      if (comment.author.toString() !== req.user.id) {
        await createNotification({
          recipient: comment.author,
          sender: req.user.id,
          type: 'like',
          comment: comment._id,
          post: comment.post,
          content: `${req.user.firstName} ${req.user.lastName} liked your comment`,
          link: `/post/${comment.post}#comment-${comment._id}`,
        });
      }
    }

    res.status(200).json({
      success: true,
      liked: result.liked,
      likesCount: result.likesCount,
    });
  } catch (error) {
    console.error('Error toggling comment like:', error);
    next(error);
  }
};

// @desc    Pin/Unpin comment (Admin only)
// @route   PUT /api/comments/:id/pin
// @access  Private (Admin only)
exports.togglePinComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    comment.isPinned = !comment.isPinned;
    await comment.save();

    res.status(200).json({
      success: true,
      message: comment.isPinned ? 'Comment pinned' : 'Comment unpinned',
      isPinned: comment.isPinned,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Report comment
// @route   PUT /api/comments/:id/report
// @access  Private
exports.reportComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    comment.isReported = true;
    comment.reportCount = (comment.reportCount || 0) + 1;
    await comment.save();

    res.status(200).json({
      success: true,
      message: 'Comment reported successfully. Admin will review it.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get comment engagement stats (Admin only)
// @route   GET /api/comments/:id/stats
// @access  Private (Admin only)
exports.getCommentStats = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id)
      .populate('likes.user', 'firstName lastName avatar username')
      .populate('author', 'firstName lastName avatar username');

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    const stats = {
      likesCount: comment.likesCount || 0,
      repliesCount: comment.repliesCount || 0,
      likes: comment.likes || [],
      isReported: comment.isReported || false,
      reportCount: comment.reportCount || 0,
    };

    res.status(200).json({
      success: true,
      comment,
      stats,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = exports;