/**
 * Subscription Service
 * 
 * Handles subscription verification with Stripe as the source of truth.
 * Uses a hybrid approach:
 * - Local DB cache for fast access
 * - Stripe verification on login + periodic refresh
 * - Webhooks for real-time updates (when available)
 * 
 * This ensures subscriptions are always accurate, even when webhooks
 * can't reach the server (e.g., localhost development).
 */

const Stripe = require('stripe');
const User = require('../models/Users');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Plan to Stripe Price ID mapping
const PLAN_PRICES = {
  pro: process.env.STRIPE_PRICE_ID_PRO,
  business: process.env.STRIPE_PRICE_ID_BUSINESS,
};

// Price ID to Plan mapping (reverse lookup)
const PRICE_TO_PLAN = {};
Object.entries(PLAN_PRICES).forEach(([plan, priceId]) => {
  if (priceId) PRICE_TO_PLAN[priceId] = plan;
});

// Cache TTL in milliseconds (1 minute - keep short for responsiveness)
const SUBSCRIPTION_CACHE_TTL = 1 * 60 * 1000;

/**
 * Check if the cached subscription data is stale
 * @param {Object} user - User document from DB
 * @returns {boolean} - True if cache is stale and needs refresh
 */
function isSubscriptionCacheStale(user) {
  // If user has never subscribed, no need to check Stripe
  if (!user.stripeCustomerId) {
    return false;
  }

  // If no last checked timestamp, it's stale
  if (!user.subscriptionLastChecked) {
    return true;
  }

  const lastChecked = new Date(user.subscriptionLastChecked).getTime();
  const now = Date.now();
  
  return (now - lastChecked) > SUBSCRIPTION_CACHE_TTL;
}

/**
 * Fetch and sync subscription status from Stripe
 * This is the core function that verifies subscription with Stripe
 * 
 * @param {Object} user - User document from DB (with stripeCustomerId)
 * @param {boolean} forceRefresh - Force refresh even if cache is fresh
 * @returns {Object} - { plan, status, periodEnd, changed, error }
 */
async function syncSubscriptionFromStripe(user, forceRefresh = false) {
  try {
    // If user has no Stripe customer ID, they've never subscribed
    if (!user.stripeCustomerId) {
      return {
        plan: 'free',
        status: null,
        periodEnd: null,
        changed: false,
        source: 'no_customer',
      };
    }

    // Check if we need to refresh
    if (!forceRefresh && !isSubscriptionCacheStale(user)) {
      return {
        plan: user.subscriptionPlan || 'free',
        status: user.subscriptionStatus,
        periodEnd: user.subscriptionPeriodEnd,
        changed: false,
        source: 'cache',
      };
    }

    console.log(`🔄 Fetching subscription from Stripe for ${user.email}`);

    // Fetch subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'all',
      limit: 10,
    });

    // Plan hierarchy for determining highest value plan
    const PLAN_HIERARCHY = { 'free': 0, 'pro': 1, 'business': 2 };

    // Find all active subscriptions
    const activeSubscriptions = subscriptions.data.filter(
      sub => sub.status === 'active' || sub.status === 'trialing'
    );

    console.log(`📋 Found ${activeSubscriptions.length} active subscriptions`);

    // Find the highest value active subscription
    let activeSubscription = null;
    let highestPlanValue = -1;

    for (const sub of activeSubscriptions) {
      const priceId = sub.items.data[0]?.price?.id;
      const plan = PRICE_TO_PLAN[priceId] || 'free';
      const planValue = PLAN_HIERARCHY[plan] || 0;
      
      console.log(`  - Subscription ${sub.id}: ${plan} (value: ${planValue}), cancel_at_period_end: ${sub.cancel_at_period_end}`);
      
      // Prefer subscriptions that are NOT set to cancel
      // If both have same plan, prefer the one that's not canceling
      if (planValue > highestPlanValue || 
          (planValue === highestPlanValue && !sub.cancel_at_period_end && activeSubscription?.cancel_at_period_end)) {
        highestPlanValue = planValue;
        activeSubscription = sub;
      }
    }

    // If no active, get most recent for status tracking
    if (!activeSubscription && subscriptions.data.length > 0) {
      activeSubscription = subscriptions.data[0];
    }

    const previousPlan = user.subscriptionPlan || 'free';
    const previousStatus = user.subscriptionStatus;

    let newPlan = 'free';
    let newStatus = null;
    let periodEnd = null;

    if (activeSubscription) {
      const priceId = activeSubscription.items.data[0]?.price?.id;
      newPlan = PRICE_TO_PLAN[priceId] || 'free';
      newStatus = activeSubscription.status;
      periodEnd = new Date(activeSubscription.current_period_end * 1000);

      // If subscription is canceled or set to cancel, revert to free
      if (activeSubscription.status === 'canceled' || 
          activeSubscription.cancel_at_period_end) {
        // Check if we're still in the paid period
        if (activeSubscription.current_period_end * 1000 > Date.now()) {
          // Still in paid period, keep the plan but mark status
          newStatus = activeSubscription.cancel_at_period_end ? 'canceling' : activeSubscription.status;
        } else {
          // Period ended, revert to free
          newPlan = 'free';
          newStatus = 'canceled';
        }
      }

      // Handle non-active statuses
      if (!['active', 'trialing'].includes(activeSubscription.status)) {
        newPlan = 'free';
      }

      // Update user in DB
      user.stripeSubscriptionId = activeSubscription.id;
      user.subscriptionStatus = newStatus;
      user.subscriptionPlan = newPlan;
      user.subscriptionPeriodEnd = periodEnd;
    } else {
      // No subscription found
      user.subscriptionPlan = 'free';
      user.subscriptionStatus = null;
      user.stripeSubscriptionId = null;
      user.subscriptionPeriodEnd = null;
    }

    // Update last checked timestamp
    user.subscriptionLastChecked = new Date();

    const changed = previousPlan !== newPlan || previousStatus !== newStatus;

    // Log change if plan changed
    if (changed) {
      console.log(`📝 Subscription changed for ${user.email}: ${previousPlan} (${previousStatus}) → ${newPlan} (${newStatus})`);
      
      // Add to audit trail
      user.subscriptionHistory = user.subscriptionHistory || [];
      user.subscriptionHistory.push({
        timestamp: new Date(),
        action: 'stripe_sync',
        fromPlan: previousPlan,
        toPlan: newPlan,
        stripeSubscriptionId: activeSubscription?.id,
      });
    }

    await user.save();

    console.log(`✅ Subscription synced for ${user.email}: ${newPlan} (${newStatus})`);

    return {
      plan: newPlan,
      status: newStatus,
      periodEnd: periodEnd,
      changed: changed,
      source: 'stripe',
    };
  } catch (error) {
    console.error(`❌ Failed to sync subscription for ${user.email}:`, error.message);
    
    // On error, return cached data but log the issue
    return {
      plan: user.subscriptionPlan || 'free',
      status: user.subscriptionStatus,
      periodEnd: user.subscriptionPeriodEnd,
      changed: false,
      source: 'cache_fallback',
      error: error.message,
    };
  }
}

/**
 * Get subscription status for a user
 * Automatically syncs with Stripe if cache is stale
 * 
 * @param {string} userId - User ID
 * @param {boolean} forceRefresh - Force refresh from Stripe
 * @returns {Object} - Subscription info
 */
async function getSubscriptionStatus(userId, forceRefresh = false) {
  const user = await User.findById(userId);
  
  if (!user) {
    return {
      plan: 'free',
      status: null,
      periodEnd: null,
      error: 'User not found',
    };
  }

  return syncSubscriptionFromStripe(user, forceRefresh);
}

/**
 * Middleware to ensure fresh subscription data
 * Attaches subscription info to req.subscription
 */
async function ensureFreshSubscription(req, res, next) {
  try {
    const userId = req.user?.id || req.user?.userId;
    
    if (!userId) {
      return next();
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return next();
    }

    // Sync subscription if stale
    const subscription = await syncSubscriptionFromStripe(user);
    
    // Attach to request for use in route handlers
    req.subscription = subscription;
    
    // Also update req.user with fresh data
    req.user.subscriptionPlan = subscription.plan;
    req.user.subscriptionStatus = subscription.status;
    
    next();
  } catch (error) {
    console.error('Error in ensureFreshSubscription middleware:', error);
    // Don't block the request, just continue with cached data
    next();
  }
}

/**
 * Check if user has access to a specific feature based on plan
 * @param {Object} user - User object with subscriptionPlan
 * @param {string} feature - Feature to check ('cobuilder', 'marketplace', etc.)
 * @returns {boolean}
 */
function hasFeatureAccess(user, feature) {
  const plan = user?.subscriptionPlan || 'free';
  
  const featureAccess = {
    cobuilder: ['pro', 'business'],
    marketplace: ['free', 'pro', 'business'],
    advancedAnalytics: ['pro', 'business'],
    prioritySupport: ['business'],
    teamFeatures: ['business'],
  };

  const allowedPlans = featureAccess[feature] || ['free', 'pro', 'business'];
  return allowedPlans.includes(plan);
}

module.exports = {
  syncSubscriptionFromStripe,
  getSubscriptionStatus,
  ensureFreshSubscription,
  hasFeatureAccess,
  isSubscriptionCacheStale,
  SUBSCRIPTION_CACHE_TTL,
  PRICE_TO_PLAN,
};
