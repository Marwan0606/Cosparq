// backend/middleware/checkApiLimit.js
// Middleware to check if user has exceeded their API cost limit before allowing AI requests

const User = require('../models/Users');

// Cost limits in USD based on subscription tier
const API_COST_LIMITS = {
  free: 0.50,      // Free tier: $0.50
  pro: 10.00,      // Pro tier: $10.00
  business: 35.00  // Business tier: $35.00
};

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

    // Fetch the user's current total cost and subscription info
    const user = await User.findById(userId).select('totalApiCost email subscriptionStatus subscriptionPlan');

    if (!user) {
      console.error('❌ checkApiLimit: User not found:', userId);
      return res.status(404).json({ 
        error: 'User not found',
        limitExceeded: false 
      });
    }

    // Determine user's plan and corresponding limit
    const isActiveSubscription = ['active', 'trialing'].includes(user.subscriptionStatus);
    const plan = isActiveSubscription ? (user.subscriptionPlan || 'free') : 'free';
    const costLimit = API_COST_LIMITS[plan] || API_COST_LIMITS.free;
    
    const currentCost = user.totalApiCost || 0;

    // Check if user has exceeded the limit
    if (currentCost >= costLimit) {
      console.warn(`🚫 API LIMIT EXCEEDED for user ${user.email} (${plan} plan): $${currentCost.toFixed(4)} >= $${costLimit}`);
      
      return res.status(429).json({
        error: 'API_LIMIT_EXCEEDED',
        limitExceeded: true,
        message: plan === 'free' 
          ? 'You have reached your free tier limit. Please upgrade to continue using AI features.'
          : `You have reached your ${plan} plan limit ($${costLimit}). Please upgrade your plan or wait for the next billing cycle.`,
        currentCost: currentCost,
        limit: costLimit,
        plan: plan
      });
    }

    // User is within limit, allow the request to proceed
    console.log(`✅ API limit check passed for user ${user.email} (${plan} plan): $${currentCost.toFixed(4)} / $${costLimit}`);
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

// Export both the middleware and the limits for use elsewhere
module.exports = {
  checkApiLimit,
  API_COST_LIMITS
};
