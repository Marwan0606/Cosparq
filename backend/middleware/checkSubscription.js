/**
 * Middleware to check if user has a paid subscription for premium features
 * Used to restrict CoBuilder and other premium features to Pro/Business users
 */

const User = require('../models/Users');

const checkPaidSubscription = async (req, res, next) => {
  try {
    // Get user ID from the authenticated request (set by authenticateToken middleware)
    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Fetch user from database to get subscription status
    const user = await User.findById(userId).select('subscriptionPlan');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user has a paid subscription (pro or business)
    const paidPlans = ['pro', 'business'];
    
    if (!paidPlans.includes(user.subscriptionPlan)) {
      return res.status(403).json({
        success: false,
        subscriptionRequired: true,
        currentPlan: user.subscriptionPlan || 'free',
        message: 'This feature requires a Pro or Business subscription. Please upgrade your plan to access CoBuilder.',
      });
    }

    // User has paid subscription, continue to next middleware/controller
    next();
  } catch (error) {
    console.error('Subscription check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking subscription status',
    });
  }
};

module.exports = { checkPaidSubscription };
