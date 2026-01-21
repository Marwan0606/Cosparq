/**
 * Payment Routes
 * 
 * Routes for Stripe payment integration.
 * 
 * SECURITY:
 * - User routes require JWT authentication
 * - Webhook route requires Stripe signature verification
 * - No route directly modifies subscription (only webhook does)
 */

const express = require('express');
const router = express.Router();

const authenticateToken = require('../middleware/authenticateToken');
const { captureRawBody, verifyStripeSignature } = require('../middleware/stripeWebhook');
const {
  createCheckoutSession,
  createPortalSession,
  handleWebhook,
  getSubscriptionStatus,
  stripe,
} = require('../controllers/payments');

// ============================================
// AUTHENTICATED ROUTES (require JWT)
// ============================================

/**
 * @route   POST /api/payments/create-checkout-session
 * @desc    Create Stripe Checkout session for subscription upgrade
 * @access  Private
 * @body    { plan: 'pro' | 'business' }
 */
router.post('/create-checkout-session', authenticateToken, createCheckoutSession);

/**
 * @route   POST /api/payments/create-portal-session
 * @desc    Create Stripe Customer Portal session for billing management
 * @access  Private
 */
router.post('/create-portal-session', authenticateToken, createPortalSession);

/**
 * @route   GET /api/payments/subscription-status
 * @desc    Get current user's subscription status
 * @access  Private
 */
router.get('/subscription-status', authenticateToken, getSubscriptionStatus);

// ============================================
// WEBHOOK ROUTE - Registered in app.js BEFORE auth middleware
// ============================================
// The webhook route is now registered directly in app.js to:
// 1. Bypass JWT authentication (Stripe doesn't send JWT)
// 2. Use raw body parsing before express.json() is applied
// See app.js for the webhook route registration

module.exports = router;
