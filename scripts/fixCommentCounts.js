require('dotenv').config();
const mongoose = require('mongoose');
const Post = require('../models/Post');
const Comment = require('../models/Comment');

async function fixCommentCounts() {
  try {
    // Changed MONGO_URI to MONGODB_URI to match your .env file
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('🔄 Fixing comment counts...');
    
    // Get all posts
    const posts = await Post.find();
    
    for (const post of posts) {
      // Count ALL comments for this post (including replies)
      const totalComments = await Comment.countDocuments({
        post: post._id,
        status: 'active'
      });
      
      // Update the post
      await Post.findByIdAndUpdate(post._id, {
        commentsCount: totalComments
      });
      
      console.log(`✅ Post ${post._id}: ${totalComments} comments`);
    }
    
    // Fix reply counts for parent comments
    const parentComments = await Comment.find({ parentComment: null });
    
    for (const comment of parentComments) {
      const replyCount = await Comment.countDocuments({
        parentComment: comment._id,
        status: 'active'
      });
      
      await Comment.findByIdAndUpdate(comment._id, {
        repliesCount: replyCount
      });
      
      console.log(`✅ Comment ${comment._id}: ${replyCount} replies`);
    }
    
    console.log('✅ All comment counts fixed!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixCommentCounts();