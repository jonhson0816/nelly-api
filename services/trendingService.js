const Trending = require('../models/Trending');
const Post = require('../models/Post');

// Extract hashtags from text
const extractHashtags = (text) => {
  if (!text) return [];
  
  // Match hashtags: #word (alphanumeric + underscore)
  const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
  const matches = text.match(hashtagRegex);
  
  if (!matches) return [];
  
  // Remove duplicates and return
  return [...new Set(matches.map(tag => tag.toLowerCase()))];
};

// Process all posts and update trending data
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
      const displayTag = hashtag; // Keep original case for display

      let trending = await Trending.findOne({ hashtag });

      if (trending) {
        await trending.updateTrendingData(data.posts, data.totalEngagement);
        updatedCount++;
      } else {
        trending = await Trending.create({
          hashtag,
          displayTag,
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

// Get top trending hashtags
const getTopTrending = async (limit = 10, period = 'weekly') => {
  try {
    const trending = await Trending.getTopTrending(limit, period);
    return trending;
  } catch (error) {
    console.error('❌ Error getting trending hashtags:', error);
    throw error;
  }
};

// Search posts by hashtag
const searchByHashtag = async (hashtag, page = 1, limit = 20) => {
  try {
    const skip = (page - 1) * limit;

    // Normalize hashtag (remove # if present, lowercase)
    const normalizedTag = hashtag.toLowerCase().replace(/^#/, '');
    const searchPattern = `#${normalizedTag}`;

    const posts = await Post.find({
      status: 'published',
      caption: { $regex: searchPattern, $options: 'i' },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'firstName lastName avatar username role')
      .populate('tournament', 'name location')
      .lean();

    const total = await Post.countDocuments({
      status: 'published',
      caption: { $regex: searchPattern, $options: 'i' },
    });

    // Update trending data for this hashtag
    const trendingRecord = await Trending.findOne({ hashtag: `#${normalizedTag}` });
    if (trendingRecord) {
      trendingRecord.lastCalculated = Date.now();
      await trendingRecord.save();
    }

    return {
      success: true,
      hashtag: `#${normalizedTag}`,
      posts,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error('❌ Error searching by hashtag:', error);
    throw error;
  }
};

// Process a single post's hashtags (called when post is created)
const processPostHashtags = async (post) => {
  try {
    if (!post.caption) return;

    const hashtags = extractHashtags(post.caption);
    if (hashtags.length === 0) return;

    const engagement = (post.likesCount || 0) + (post.commentsCount || 0);

    for (const hashtag of hashtags) {
      let trending = await Trending.findOne({ hashtag });

      if (trending) {
        // Add this post to existing trending record
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
            trending.totalEngagement,
            ageInDays
          );

          trending.lastCalculated = Date.now();
          await trending.save();
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
      }
    }

    console.log(`✅ Processed ${hashtags.length} hashtags for post ${post._id}`);
  } catch (error) {
    console.error('❌ Error processing post hashtags:', error);
  }
};

// Clean up old trending data
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

module.exports = {
  extractHashtags,
  updateTrendingData,
  getTopTrending,
  searchByHashtag,
  processPostHashtags,
  cleanupOldTrendingData,
};