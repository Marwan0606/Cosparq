// backend/middleware/checkApiLimit.js
// Middleware to check if user has exceeded their API cost limit before allowing AI requests

const User = require('../models/Users');

// Cost limit in USD - users cannot exceed this amount
const API_COST_LIMIT = 0.50; // $0.50

const checkApiLimit = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      console.error('❌ checkApiLimit: No userId found in request');
      return res.status(401).json({ 
        error: 'Unauthorized',
        limitExceeded: false 
      });
    }

    // Fetch the user's current total cost
    const user = await User.findById(userId).select('totalApiCost email');

    if (!user) {
      console.error('❌ checkApiLimit: User not found:', userId);
      return res.status(404).json({ 
        error: 'User not found',
        limitExceeded: false 
      });
    }

    const currentCost = user.totalApiCost || 0;

    // Check if user has exceeded the limit
    if (currentCost >= API_COST_LIMIT) {
      console.warn(`🚫 API LIMIT EXCEEDED for user ${user.email}: $${currentCost.toFixed(4)} >= $${API_COST_LIMIT}`);
      
      return res.status(429).json({
        error: 'API_LIMIT_EXCEEDED',
        limitExceeded: true,
        message: 'You have reached your token limit. Please upgrade to continue using AI features.',
        currentCost: currentCost,
        limit: API_COST_LIMIT
      });
    }

    // User is within limit, allow the request to proceed
    console.log(`✅ API limit check passed for user ${user.email}: $${currentCost.toFixed(4)} / $${API_COST_LIMIT}`);
    next();

  } catch (error) {
    console.error('❌ Error in checkApiLimit middleware:', error);
    // In case of error, block the request to be safe (fail closed)
    return res.status(500).json({ 
      error: 'Failed to verify API limit',
      limitExceeded: false 
    });
  }
};

// Export both the middleware and the limit constant for use elsewhere
module.exports = {
  checkApiLimit,
  API_COST_LIMIT
};
