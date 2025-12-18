const Trending = require('../models/Trending');
const Post = require('../models/Post');
const Comment = require('../models/Comment');

// ============================================
// EXTRACT HASHTAGS FROM TEXT
// ============================================
const extractHashtags = (text) => {
  if (!text) return [];
  
  // Match hashtags: #word (alphanumeric + underscore)
  const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
  const matches = text.match(hashtagRegex);
  
  if (!matches) return [];
  
  // Remove duplicates and return lowercase
  return [...new Set(matches.map(tag => tag.toLowerCase()))];
};

// ============================================
// PROCESS POST HASHTAGS (when admin creates post)
// ============================================
const processPostHashtags = async (post) => {
  try {
    if (!post.caption) return;

    const hashtags = extractHashtags(post.caption);
    if (hashtags.length === 0) return;

    console.log(`📝 Processing ${hashtags.length} hashtags from post:`, hashtags);

    const engagement = (post.likesCount || 0) + (post.commentsCount || 0);

    for (const hashtag of hashtags) {
      let trending = await Trending.findOne({ hashtag });

      if (trending) {
        // Update existing trending record
        if (!trending.posts.includes(post._id)) {
          trending.posts.push(post._id);
          trending.postsCount += 1;
          trending.totalEngagement += engagement;

          // Recalculate trending score
          const oldestPost = await Post.findById(trending.posts[0]).select('createdAt');
          const ageInDays = oldestPost
            ? Math.floor((Date.now() - oldestPost.createdAt) / (1000 * 60 * 60 * 24))
            : 0;

          trending.trendingScore = Trending.calculateTrendingScore(
            trending.postsCount,
            trending.commentsCount || 0,
            trending.totalEngagement,
            ageInDays
          );

          trending.lastCalculated = Date.now();
          await trending.save();

          console.log(`✅ Updated trending for ${hashtag}: score=${trending.trendingScore}`);
        }
      } else {
        // Create new trending record
        trending = await Trending.create({
          hashtag,
          displayTag: hashtag,
          posts: [post._id],
          postsCount: 1,
          totalEngagement: engagement,
        });

        await trending.updateTrendingData([post], engagement);
        console.log(`✅ Created new trending for ${hashtag}`);
      }
    }

    console.log(`✅ Processed ${hashtags.length} hashtags for post ${post._id}`);
  } catch (error) {
    console.error('❌ Error processing post hashtags:', error);
  }
};

// ============================================
// PROCESS COMMENT HASHTAGS (when user comments)
// ============================================
const processCommentHashtags = async (comment, postId) => {
  try {
    if (!comment.content) return;

    const hashtags = extractHashtags(comment.content);
    if (hashtags.length === 0) return;

    console.log(`💬 Processing ${hashtags.length} hashtags from comment:`, hashtags);

    // Get the post to include its engagement
    const post = await Post.findById(postId).select('likesCount commentsCount');
    if (!post) return;

    for (const hashtag of hashtags) {
      let trending = await Trending.findOne({ hashtag });

      if (trending) {
        // Update existing trending record
        if (!trending.comments) trending.comments = [];
        
        if (!trending.comments.includes(comment._id)) {
          trending.comments.push(comment._id);
          trending.commentsCount = (trending.commentsCount || 0) + 1;
          trending.totalEngagement += 1; // Each comment adds engagement
        }

        // Recalculate trending score
        const oldestPost = trending.posts.length > 0 
          ? await Post.findById(trending.posts[0]).select('createdAt')
          : null;
        
        const ageInDays = oldestPost
          ? Math.floor((Date.now() - oldestPost.createdAt) / (1000 * 60 * 60 * 24))
          : 0;

        trending.trendingScore = Trending.calculateTrendingScore(
          trending.postsCount,
          trending.commentsCount || 0,
          trending.totalEngagement,
          ageInDays
        );

        trending.lastCalculated = Date.now();
        await trending.save();

        console.log(`✅ Updated trending for ${hashtag}: score=${trending.trendingScore}`);
      } else {
        // Create new trending record from comment
        trending = await Trending.create({
          hashtag,
          displayTag: hashtag,
          posts: [], // No posts yet, only comment
          comments: [comment._id],
          postsCount: 0,
          commentsCount: 1,
          totalEngagement: 1,
        });

        trending.trendingScore = Trending.calculateTrendingScore(0, 1, 1, 0);
        await trending.save();

        console.log(`✅ Created new trending for ${hashtag} from comment`);
      }
    }

    console.log(`✅ Processed ${hashtags.length} hashtags from comment ${comment._id}`);
  } catch (error) {
    console.error('❌ Error processing comment hashtags:', error);
  }
};

// ============================================
// UPDATE ALL TRENDING DATA (manual or cron)
// ============================================
const updateTrendingData = async (period = 'weekly') => {
  try {
    const daysMap = {
      daily: 1,
      weekly: 7,
      monthly: 30,
    };

    const days = daysMap[period] || 7;
    const dateThreshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get all published posts from the specified period
    const posts = await Post.find({
      status: 'published',
      createdAt: { $gte: dateThreshold },
      caption: { $exists: true, $ne: '' },
    }).select('caption likesCount commentsCount createdAt');

    console.log(`📊 Processing ${posts.length} posts for trending analysis...`);

    // Extract all hashtags from posts
    const hashtagMap = new Map();

    posts.forEach((post) => {
      const hashtags = extractHashtags(post.caption);
      const engagement = (post.likesCount || 0) + (post.commentsCount || 0);

      hashtags.forEach((hashtag) => {
        if (!hashtagMap.has(hashtag)) {
          hashtagMap.set(hashtag, {
            posts: [],
            totalEngagement: 0,
          });
        }

        const data = hashtagMap.get(hashtag);
        data.posts.push(post);
        data.totalEngagement += engagement;
      });
    });

    console.log(`🏷️ Found ${hashtagMap.size} unique hashtags`);

    // Update or create trending records
    let updatedCount = 0;
    let createdCount = 0;

    for (const [hashtag, data] of hashtagMap.entries()) {
      let trending = await Trending.findOne({ hashtag });

      if (trending) {
        await trending.updateTrendingData(data.posts, data.totalEngagement);
        updatedCount++;
      } else {
        trending = await Trending.create({
          hashtag,
          displayTag: hashtag,
          period,
        });
        await trending.updateTrendingData(data.posts, data.totalEngagement);
        createdCount++;
      }
    }

    console.log(`✅ Trending data updated: ${updatedCount} updated, ${createdCount} created`);

    return {
      success: true,
      processed: hashtagMap.size,
      updated: updatedCount,
      created: createdCount,
    };
  } catch (error) {
    console.error('❌ Error updating trending data:', error);
    throw error;
  }
};

// ============================================
// GET TOP TRENDING HASHTAGS
// ============================================
const getTopTrending = async (limit = 10, period = 'weekly') => {
  try {
    const trending = await Trending.getTopTrending(limit, period);
    return trending;
  } catch (error) {
    console.error('❌ Error getting trending hashtags:', error);
    throw error;
  }
};

// ============================================
// SEARCH POSTS AND COMMENTS BY HASHTAG
// ============================================
const searchByHashtag = async (hashtag, page = 1, limit = 20) => {
  try {
    const skip = (page - 1) * limit;

    // Normalize hashtag (remove # if present, lowercase)
    const normalizedTag = hashtag.toLowerCase().replace(/^#/, '');
    
    // Create a case-insensitive regex pattern that matches the hashtag
    // This will match #golf, #Golf, #GOLF, etc.
    const regexPattern = new RegExp(`#${normalizedTag}`, 'i');

    console.log(`🔍 Searching for hashtag: #${normalizedTag}`);

    // Get posts with this hashtag
    const posts = await Post.find({
      status: 'published',
      caption: { $regex: regexPattern },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'firstName lastName avatar username role')
      .populate('tournament', 'name location')
      .lean();

    console.log(`📝 Found ${posts.length} posts with #${normalizedTag}`);

    // Get comments with this hashtag
    const comments = await Comment.find({
      content: { $regex: regexPattern },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'firstName lastName avatar username role')
      .populate({
        path: 'post',
        select: 'caption media author createdAt',
        populate: {
          path: 'author',
          select: 'firstName lastName avatar role'
        }
      })
      .lean();

    console.log(`💬 Found ${comments.length} comments with #${normalizedTag}`);

    const totalPosts = await Post.countDocuments({
      status: 'published',
      caption: { $regex: regexPattern },
    });

    const totalComments = await Comment.countDocuments({
      content: { $regex: regexPattern },
    });

    // Update trending data for this hashtag
    const trendingRecord = await Trending.findOne({ hashtag: `#${normalizedTag}` });
    if (trendingRecord) {
      trendingRecord.lastCalculated = Date.now();
      await trendingRecord.save();
    }

    console.log(`✅ Total results: ${totalPosts} posts + ${totalComments} comments = ${totalPosts + totalComments}`);

    return {
      success: true,
      hashtag: `#${normalizedTag}`,
      posts,
      comments,
      totalPosts,
      totalComments,
      total: totalPosts + totalComments,
      page,
      pages: Math.ceil((totalPosts + totalComments) / limit),
    };
  } catch (error) {
    console.error('❌ Error searching by hashtag:', error);
    throw error;
  }
};

// ============================================
// CLEANUP OLD TRENDING DATA
// ============================================
const cleanupOldTrendingData = async () => {
  try {
    const deletedCount = await Trending.cleanupOldData();
    console.log(`🧹 Cleaned up ${deletedCount} old trending records`);
    return deletedCount;
  } catch (error) {
    console.error('❌ Error cleaning up trending data:', error);
    throw error;
  }
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
  extractHashtags,
  processPostHashtags,
  processCommentHashtags,
  updateTrendingData,
  getTopTrending,
  searchByHashtag,
  cleanupOldTrendingData,
};