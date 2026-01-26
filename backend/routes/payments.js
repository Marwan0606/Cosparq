/**
 * Payment Routes
 * 
 * Routes for Stripe payment integration.
 * 
 * SECURITY:
 * - User routes require JWT authentication
 * - Webhook route requires Stripe signature verification
 * - Rate limiting prevents brute-force attacks
 * - Session verification done server-to-server with Stripe
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const authenticateToken = require('../middleware/authenticateToken');
const { captureRawBody, verifyStripeSignature } = require('../middleware/stripeWebhook');
const {
  createCheckoutSession,
  createPortalSession,
  handleWebhook,
  getSubscriptionStatus,
  verifyCheckoutSession,
  syncSubscription,
  stripe,
} = require('../controllers/payments');

// Rate limiter for payment endpoints - reasonable limits
const paymentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per 15 minutes per IP
  message: {
    success: false,
    message: 'Too many payment requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for session verification
const verifySessionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 verification attempts per 5 minutes
  message: {
    success: false,
    message: 'Too many verification attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// AUTHENTICATED ROUTES (require JWT)
// ============================================

/**
 * @route   POST /api/payments/create-checkout-session
 * @desc    Create Stripe Checkout session for subscription upgrade
 * @access  Private
 * @body    { plan: 'pro' | 'business' }
 */
router.post('/create-checkout-session', paymentRateLimiter, authenticateToken, createCheckoutSession);

/**
 * @route   POST /api/payments/create-portal-session
 * @desc    Create Stripe Customer Portal session for billing management
 * @access  Private
 */
router.post('/create-portal-session', paymentRateLimiter, authenticateToken, createPortalSession);

/**
 * @route   GET /api/payments/subscription-status
 * @desc    Get current user's subscription status
 * @access  Private
 */
router.get('/subscription-status', authenticateToken, getSubscriptionStatus);

/**
 * @route   POST /api/payments/verify-session
 * @desc    Verify checkout session and activate subscription (fallback for webhooks)
 * @access  Private
 * @body    { sessionId: string }
 */
router.post('/verify-session', verifySessionLimiter, authenticateToken, verifyCheckoutSession);

/**
 * @route   POST /api/payments/sync-subscription
 * @desc    Sync subscription status from Stripe (fallback for webhooks on plan changes)
 * @access  Private
 */
router.post('/sync-subscription', verifySessionLimiter, authenticateToken, syncSubscription);

// ============================================
// WEBHOOK ROUTE - Registered in app.js BEFORE auth middleware
// ============================================
// The webhook route is now registered directly in app.js to:
// 1. Bypass JWT authentication (Stripe doesn't send JWT)
// 2. Use raw body parsing before express.json() is applied
// See app.js for the webhook route registration

module.exports = router;
