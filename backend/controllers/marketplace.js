const MarketplaceListing = require('../models/MarketplaceListing');
const User = require('../models/Users');
const Idea = require('../models/Idea-pitch-responses');
const ScoreboardResponse = require('../models/Scoreboard-responses');
const OpenAI = require('openai');
const sharp = require('sharp');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Compress base64 image to create a thumbnail
async function createThumbnail(base64Image, width = 400, quality = 60) {
  try {
    // Extract the base64 data and mime type
    const matches = base64Image.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
    if (!matches) {
      console.log('[Thumbnail] Invalid base64 format, returning original');
      return base64Image;
    }
    
    const imageBuffer = Buffer.from(matches[2], 'base64');
    
    // Compress and resize using sharp
    const compressedBuffer = await sharp(imageBuffer)
      .resize(width, null, { 
        withoutEnlargement: true,
        fit: 'inside'
      })
      .jpeg({ quality, progressive: true })
      .toBuffer();
    
    // Convert back to base64
    const compressedBase64 = `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`;
    
    // Log compression ratio
    const originalSize = base64Image.length;
    const compressedSize = compressedBase64.length;
    const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
    console.log(`[Thumbnail] Compressed: ${(originalSize/1024).toFixed(1)}KB -> ${(compressedSize/1024).toFixed(1)}KB (${ratio}% reduction)`);
    
    return compressedBase64;
  } catch (error) {
    console.error('[Thumbnail] Error creating thumbnail:', error.message);
    return base64Image; // Return original if compression fails
  }
}

// Get all listings with filtering, sorting, and search
const getListings = async (req, res) => {
  console.log('[Marketplace] getListings called with query:', req.query);
  try {
    const { category, sort, search, page = 1, limit = 20 } = req.query;
    
    // Build query
    let query = { status: 'approved' };
    console.log('[Marketplace] Using query:', JSON.stringify(query));
    
    // Category filter
    if (category && category !== 'all') {
      query.category = category;
    }
    
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { tagline: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Handle trending and hall-of-fame differently
    if (sort === 'trending') {
      // Trending: posts with most upvotes in the last 7 days
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      // Aggregation pipeline for trending - only get thumbnail, not full images
      const pipeline = [
        { $match: query },
        {
          $addFields: {
            recentUpvotes: {
              $size: {
                $filter: {
                  input: { $ifNull: ['$upvoteHistory', []] },
                  as: 'upvote',
                  cond: { $gte: ['$$upvote.timestamp', oneWeekAgo] }
                }
              }
            }
          }
        },
        { $sort: { recentUpvotes: -1, upvotes: -1, createdAt: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) },
        {
          $project: {
            name: 1,
            tagline: 1,
            description: 1,
            category: 1,
            upvotes: 1,
            upvotedBy: 1,
            createdBy: 1,
            authorName: 1,
            createdAt: 1,
            status: 1,
            demoUrl: 1,
            views: 1,
            recentUpvotes: 1,
            thumbnail: { $ifNull: ['$thumbnail', { $arrayElemAt: ['$images', 0] }] }
          }
        }
      ];
      
      const listings = await MarketplaceListing.aggregate(pipeline);
      const total = await MarketplaceListing.countDocuments(query);
      
      return res.json({
        success: true,
        listings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    }
    
    // Build sort for other options
    let sortOption = {};
    switch (sort) {
      case 'hall-of-fame':
        // All-time highest upvotes
        sortOption = { upvotes: -1, createdAt: -1 };
        break;
      case 'latest':
      default:
        sortOption = { createdAt: -1 };
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    console.log('[Marketplace] Executing find query...');
    // Use aggregation to only get first image as thumbnail (reduces payload significantly)
    const listings = await MarketplaceListing.aggregate([
      { $match: query },
      { $sort: sortOption },
      { $skip: skip },
      { $limit: parseInt(limit) },
      {
        $project: {
          name: 1,
          tagline: 1,
          description: 1,
          category: 1,
          upvotes: 1,
          upvotedBy: 1,
          createdBy: 1,
          authorName: 1,
          createdAt: 1,
          status: 1,
          demoUrl: 1,
          views: 1,
          thumbnail: { $ifNull: ['$thumbnail', { $arrayElemAt: ['$images', 0] }] }
        }
      }
    ]);
    
    console.log('[Marketplace] Found', listings.length, 'listings');
    
    const total = await MarketplaceListing.countDocuments(query);
    console.log('[Marketplace] Total count:', total);
    
    res.json({
      success: true,
      listings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({ success: false, message: 'Error fetching listings' });
  }
};

// Get a single listing by ID
const getListing = async (req, res) => {
  try {
    const { id } = req.params;
    
    const listing = await MarketplaceListing.findById(id).lean();
    
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    
    // Increment view count
    await MarketplaceListing.findByIdAndUpdate(id, { $inc: { views: 1 } });
    
    res.json({ success: true, listing });
  } catch (error) {
    console.error('Error fetching listing:', error);
    res.status(500).json({ success: false, message: 'Error fetching listing' });
  }
};

// Create a new listing
const createListing = async (req, res) => {
  try {
    const { name, tagline, description, appUrl, images, category } = req.body;
    const userId = req.user.userId;
    
    // Validate at least one image
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one image is required' });
    }
    
    // Get user info for author name
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const authorName = user.name || user.email.split('@')[0];
    
    // Create compressed thumbnail from first image
    console.log('[Marketplace] Creating thumbnail for new listing...');
    const thumbnail = await createThumbnail(images[0]);
    
    const listing = new MarketplaceListing({
      name,
      tagline,
      description,
      appUrl,
      images,
      thumbnail,
      category,
      author: userId,
      authorName
    });
    
    await listing.save();
    
    res.status(201).json({ success: true, listing });
  } catch (error) {
    console.error('Error creating listing:', error);
    res.status(500).json({ success: false, message: 'Error creating listing' });
  }
};

// Update a listing (only by author)
const updateListing = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, tagline, description, appUrl, images, category } = req.body;
    const userId = req.user.userId;
    
    const listing = await MarketplaceListing.findById(id);
    
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    
    // Check if user is the author
    if (listing.author.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this listing' });
    }
    
    // Update fields
    if (name) listing.name = name;
    if (tagline) listing.tagline = tagline;
    if (description !== undefined) listing.description = description;
    if (appUrl) listing.appUrl = appUrl;
    if (images && Array.isArray(images) && images.length > 0) {
      listing.images = images;
      // Regenerate thumbnail when images are updated
      console.log('[Marketplace] Regenerating thumbnail for updated listing...');
      listing.thumbnail = await createThumbnail(images[0]);
    }
    if (category) listing.category = category;
    
    await listing.save();
    
    res.json({ success: true, listing });
  } catch (error) {
    console.error('Error updating listing:', error);
    res.status(500).json({ success: false, message: 'Error updating listing' });
  }
};

// Delete a listing (only by author)
const deleteListing = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const listing = await MarketplaceListing.findById(id);
    
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    
    // Check if user is the author
    if (listing.author.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this listing' });
    }
    
    await MarketplaceListing.findByIdAndDelete(id);
    
    res.json({ success: true, message: 'Listing deleted successfully' });
  } catch (error) {
    console.error('Error deleting listing:', error);
    res.status(500).json({ success: false, message: 'Error deleting listing' });
  }
};

// Upvote a listing
const upvoteListing = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const listing = await MarketplaceListing.findById(id);
    
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    
    // Check if user already upvoted
    const alreadyUpvoted = listing.upvotedBy.includes(userId);
    
    if (alreadyUpvoted) {
      // Remove upvote
      listing.upvotedBy = listing.upvotedBy.filter(id => id.toString() !== userId);
      listing.upvotes = Math.max(0, listing.upvotes - 1);
      // Remove from upvote history
      listing.upvoteHistory = listing.upvoteHistory.filter(h => h.userId.toString() !== userId);
    } else {
      // Add upvote
      listing.upvotedBy.push(userId);
      listing.upvotes += 1;
      // Add to upvote history for trending calculation
      listing.upvoteHistory.push({ userId, timestamp: new Date() });
    }
    
    await listing.save();
    
    res.json({ 
      success: true, 
      upvotes: listing.upvotes,
      upvoted: !alreadyUpvoted
    });
  } catch (error) {
    console.error('Error upvoting listing:', error);
    res.status(500).json({ success: false, message: 'Error upvoting listing' });
  }
};

// Get user's own listings
const getMyListings = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const listings = await MarketplaceListing.find({ author: userId })
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({ success: true, listings });
  } catch (error) {
    console.error('Error fetching user listings:', error);
    res.status(500).json({ success: false, message: 'Error fetching your listings' });
  }
};

// AI Autofill for marketplace submission (one-time use per idea)
const autofillListing = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { ideaId } = req.body;
    
    if (!ideaId) {
      return res.status(400).json({ success: false, message: 'Idea ID is required' });
    }
    
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Initialize marketplaceAutofills array if not exists
    if (!user.marketplaceAutofills) {
      user.marketplaceAutofills = [];
    }
    
    // Check if this specific idea already has an autofill generated
    const existingAutofill = user.marketplaceAutofills.find(
      af => af.ideaId && af.ideaId.toString() === ideaId
    );
    
    if (existingAutofill) {
      // Return the existing autofill data for this idea
      return res.json({
        success: true,
        autofill: existingAutofill.data,
        cached: true,
        message: 'Using your previously generated autofill for this idea'
      });
    }
    
    // Get user's idea
    const idea = await Idea.findOne({ 
      _id: ideaId, 
      userId: userId 
    });
    
    if (!idea) {
      return res.status(404).json({ success: false, message: 'Idea not found' });
    }
    
    // Get scoreboard response for more context (if exists)
    const scoreboard = await ScoreboardResponse.findOne({
      ideaId: ideaId,
      userId: userId
    });
    
    // Build context for AI
    let context = `Idea Name: ${idea.ideaName}\n`;
    context += `Idea Description: ${idea.idea}\n`;
    
    if (scoreboard && scoreboard.scoreboardResponse) {
      // Only include first 2000 chars of scoreboard to keep it cheap
      const scoreboardSnippet = scoreboard.scoreboardResponse.substring(0, 2000);
      context += `Additional Analysis: ${scoreboardSnippet}\n`;
    }
    
    // Call OpenAI with a cheap model
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'system',
          content: `You are helping a startup founder fill out a marketplace listing form. Based on the provided idea information, generate appropriate values for the form fields. Be concise and compelling.

Return a JSON object with these fields:
- name: App name (short, catchy, max 30 chars)
- tagline: One-line description (max 100 chars)
- description: A paragraph describing the app (max 500 chars)
- category: One of: productivity, dev-tools, marketing, finance, design, ai-ml, e-commerce, education, other

If you don't have enough information for a field, set it to an empty string.
Only return valid JSON, no markdown or explanation.`
        },
        {
          role: 'user',
          content: context
        }
      ],
      response_format: { type: 'json_object' }
    });
    
    // Parse the response
    let autofillData;
    try {
      const responseText = (completion.choices[0].message.content || '').trim();
      // Remove potential markdown code blocks
      const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
      console.log('AI autofill raw response:', cleanedResponse);
      autofillData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      return res.status(500).json({ success: false, message: 'Error parsing AI response' });
    }
    
    // Validate and clean the data
    const validCategories = ['productivity', 'dev-tools', 'marketing', 'finance', 'design', 'ai-ml', 'e-commerce', 'education', 'other'];
    
    const cleanedData = {
      name: (autofillData.name || '').substring(0, 50),
      tagline: (autofillData.tagline || '').substring(0, 150),
      description: (autofillData.description || '').substring(0, 1000),
      category: validCategories.includes(autofillData.category) ? autofillData.category : ''
    };
    
    // Save autofill and track API usage in one update (skip full validation)
    const promptTokens = completion.usage?.prompt_tokens || 0;
    const completionTokens = completion.usage?.completion_tokens || 0;
    const cost = (promptTokens * 0.00000005) + (completionTokens * 0.0000004); // gpt-5-nano pricing
    
    await User.findByIdAndUpdate(userId, {
      $push: {
        marketplaceAutofills: {
          ideaId: ideaId,
          data: cleanedData,
          generatedAt: new Date()
        },
        apiUsageHistory: {
          endpoint: 'marketplace-autofill',
          model: 'gpt-5-nano',
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          cost
        }
      },
      $inc: {
        totalApiRequests: 1,
        totalApiCost: cost
      }
    });
    
    res.json({
      success: true,
      autofill: cleanedData,
      cached: false,
      message: 'Autofill generated successfully'
    });
    
  } catch (error) {
    console.error('Error generating autofill:', error);
    res.status(500).json({ success: false, message: 'Error generating autofill' });
  }
};

// Get existing autofill data for a specific idea
const getAutofill = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { ideaId } = req.query;
    
    const user = await User.findById(userId).select('marketplaceAutofills');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // If ideaId provided, check for specific autofill
    if (ideaId && user.marketplaceAutofills) {
      const existingAutofill = user.marketplaceAutofills.find(
        af => af.ideaId && af.ideaId.toString() === ideaId
      );
      
      if (existingAutofill) {
        return res.json({
          success: true,
          hasAutofill: true,
          autofill: existingAutofill.data
        });
      }
    }
    
    // No autofill for this idea
    res.json({
      success: true,
      hasAutofill: false,
      autofill: null
    });
    
  } catch (error) {
    console.error('Error getting autofill:', error);
    res.status(500).json({ success: false, message: 'Error getting autofill' });
  }
};

// Add a review to a listing
const addReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.userId;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const listing = await MarketplaceListing.findById(id);
    
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    // Check if user already reviewed
    const existingReview = listing.reviews.find(r => r.userId.toString() === userId);
    if (existingReview) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this app' });
    }

    // Prevent author from reviewing their own app
    if (listing.author.toString() === userId) {
      return res.status(400).json({ success: false, message: 'You cannot review your own app' });
    }

    // Get user info for reviewer name
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userName = user.name || user.email.split('@')[0];

    // Add the review
    const newReview = {
      userId,
      userName,
      rating: parseInt(rating),
      comment: comment ? comment.trim() : '',
      createdAt: new Date(),
      helpful: 0,
      helpfulBy: []
    };

    listing.reviews.push(newReview);

    // Update average rating and count
    const totalRatings = listing.reviews.reduce((sum, r) => sum + r.rating, 0);
    listing.averageRating = Math.round((totalRatings / listing.reviews.length) * 10) / 10;
    listing.reviewCount = listing.reviews.length;

    await listing.save();

    res.json({ 
      success: true, 
      review: newReview,
      averageRating: listing.averageRating,
      reviewCount: listing.reviewCount
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({ success: false, message: 'Error adding review' });
  }
};

// Get reviews for a listing
const getReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, sort = 'recent' } = req.query;

    const listing = await MarketplaceListing.findById(id).select('reviews averageRating reviewCount');
    
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    let reviews = [...listing.reviews];

    // Sort reviews
    switch (sort) {
      case 'helpful':
        reviews.sort((a, b) => b.helpful - a.helpful);
        break;
      case 'highest':
        reviews.sort((a, b) => b.rating - a.rating);
        break;
      case 'lowest':
        reviews.sort((a, b) => a.rating - b.rating);
        break;
      case 'recent':
      default:
        reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedReviews = reviews.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      reviews: paginatedReviews,
      averageRating: listing.averageRating,
      reviewCount: listing.reviewCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: reviews.length,
        pages: Math.ceil(reviews.length / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ success: false, message: 'Error fetching reviews' });
  }
};

// Update a review
const updateReview = async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.userId;

    const listing = await MarketplaceListing.findById(id);
    
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    const review = listing.reviews.id(reviewId);
    
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    // Check if user is the reviewer
    if (review.userId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this review' });
    }

    // Update review
    if (rating) review.rating = parseInt(rating);
    if (comment !== undefined) review.comment = comment.trim();

    // Recalculate average rating
    const totalRatings = listing.reviews.reduce((sum, r) => sum + r.rating, 0);
    listing.averageRating = Math.round((totalRatings / listing.reviews.length) * 10) / 10;

    await listing.save();

    res.json({ 
      success: true, 
      review,
      averageRating: listing.averageRating
    });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ success: false, message: 'Error updating review' });
  }
};

// Delete a review
const deleteReview = async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    const userId = req.user.userId;

    const listing = await MarketplaceListing.findById(id);
    
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    const review = listing.reviews.id(reviewId);
    
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    // Check if user is the reviewer or the app author (can delete inappropriate reviews)
    if (review.userId.toString() !== userId && listing.author.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this review' });
    }

    listing.reviews.pull(reviewId);

    // Recalculate average rating
    if (listing.reviews.length > 0) {
      const totalRatings = listing.reviews.reduce((sum, r) => sum + r.rating, 0);
      listing.averageRating = Math.round((totalRatings / listing.reviews.length) * 10) / 10;
    } else {
      listing.averageRating = 0;
    }
    listing.reviewCount = listing.reviews.length;

    await listing.save();

    res.json({ 
      success: true, 
      message: 'Review deleted',
      averageRating: listing.averageRating,
      reviewCount: listing.reviewCount
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ success: false, message: 'Error deleting review' });
  }
};

// Mark a review as helpful
const markReviewHelpful = async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    const userId = req.user.userId;

    const listing = await MarketplaceListing.findById(id);
    
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    const review = listing.reviews.id(reviewId);
    
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    // Check if user already marked as helpful
    const alreadyHelpful = review.helpfulBy.some(uid => uid.toString() === userId);
    
    if (alreadyHelpful) {
      // Remove helpful
      review.helpfulBy = review.helpfulBy.filter(uid => uid.toString() !== userId);
      review.helpful = review.helpfulBy.length;
    } else {
      // Add helpful
      review.helpfulBy.push(userId);
      review.helpful = review.helpfulBy.length;
    }

    await listing.save();

    res.json({ 
      success: true, 
      helpful: review.helpful,
      isHelpful: !alreadyHelpful
    });
  } catch (error) {
    console.error('Error marking review helpful:', error);
    res.status(500).json({ success: false, message: 'Error marking review helpful' });
  }
};

// Migration: Generate thumbnails for existing listings that don't have them
const migrateThumbnails = async (req, res) => {
  try {
    console.log('[Migration] Starting thumbnail migration...');
    
    // Find listings without thumbnails
    const listings = await MarketplaceListing.find({ 
      $or: [
        { thumbnail: { $exists: false } },
        { thumbnail: null },
        { thumbnail: '' }
      ],
      images: { $exists: true, $ne: [] }
    });
    
    console.log(`[Migration] Found ${listings.length} listings without thumbnails`);
    
    let processed = 0;
    let failed = 0;
    
    for (const listing of listings) {
      try {
        if (listing.images && listing.images.length > 0) {
          const thumbnail = await createThumbnail(listing.images[0]);
          await MarketplaceListing.findByIdAndUpdate(listing._id, { thumbnail });
          processed++;
          console.log(`[Migration] Processed ${processed}/${listings.length}: ${listing.name}`);
        }
      } catch (err) {
        failed++;
        console.error(`[Migration] Failed for listing ${listing._id}:`, err.message);
      }
    }
    
    console.log(`[Migration] Complete! Processed: ${processed}, Failed: ${failed}`);
    
    res.json({ 
      success: true, 
      message: `Migration complete. Processed: ${processed}, Failed: ${failed}`,
      processed,
      failed,
      total: listings.length
    });
  } catch (error) {
    console.error('Error during thumbnail migration:', error);
    res.status(500).json({ success: false, message: 'Error during migration' });
  }
};

module.exports = {
  getListings,
  getListing,
  createListing,
  updateListing,
  deleteListing,
  upvoteListing,
  getMyListings,
  autofillListing,
  getAutofill,
  addReview,
  getReviews,
  updateReview,
  deleteReview,
  markReviewHelpful,
  migrateThumbnails
};
