/**
 * Stripe Webhook Middleware
 * 
 * CRITICAL SECURITY: This middleware handles raw body parsing and signature verification
 * for Stripe webhooks. Stripe requires the raw body (not parsed JSON) to verify signatures.
 * 
 * Security measures:
 * 1. Raw body preservation - Required for Stripe signature verification
 * 2. Cryptographic signature verification - Prevents spoofed webhook attacks
 * 3. Timestamp validation - Built into Stripe SDK, prevents replay attacks
 */

const express = require('express');

/**
 * Middleware to capture raw body for Stripe webhook signature verification
 * Must be applied BEFORE any JSON body parsers for the webhook route
 */
const captureRawBody = express.raw({
  type: 'application/json',
  limit: '10mb', // Reasonable limit for webhook payloads
});

/**
 * Verify Stripe webhook signature
 * This ensures the request actually came from Stripe and wasn't forged
 * 
 * @param {Object} stripe - Initialized Stripe instance
 * @param {string} webhookSecret - STRIPE_WEBHOOK_SECRET from environment
 */
const verifyStripeSignature = (stripe, webhookSecret) => {
  return (req, res, next) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      console.error('Stripe webhook error: No signature header');
      return res.status(400).json({
        success: false,
        message: 'Missing Stripe signature header',
      });
    }

    if (!webhookSecret) {
      console.error('Stripe webhook error: STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({
        success: false,
        message: 'Webhook secret not configured',
      });
    }

    try {
      // Verify the signature and construct the event
      // This will throw if:
      // - Signature doesn't match (forged request)
      // - Timestamp is too old (replay attack)
      // - Payload was tampered with
      const event = stripe.webhooks.constructEvent(
        req.body, // Raw body buffer
        signature,
        webhookSecret
      );

      // Attach the verified event to the request for the controller
      req.stripeEvent = event;
      next();
    } catch (err) {
      console.error('Stripe webhook signature verification failed:', err.message);
      return res.status(400).json({
        success: false,
        message: `Webhook signature verification failed: ${err.message}`,
      });
    }
  };
};

module.exports = {
  captureRawBody,
  verifyStripeSignature,
};
