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

const { authenticateToken } = require('../middleware/authenticateToken');
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
// WEBHOOK ROUTE (Stripe signature verified)
// ============================================

/**
 * @route   POST /api/payments/webhook
 * @desc    Handle Stripe webhook events
 * @access  Public (but cryptographically verified)
 * 
 * IMPORTANT: This route must use raw body parsing for signature verification.
 * The route is registered in app.js BEFORE the global JSON parser.
 */
router.post(
  '/webhook',
  captureRawBody,
  verifyStripeSignature(stripe, process.env.STRIPE_WEBHOOK_SECRET),
  handleWebhook
);

module.exports = router;
