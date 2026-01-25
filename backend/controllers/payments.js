/**
 * Payments Controller
 * 
 * Handles all Stripe payment operations with enterprise-grade security.
 * 
 * SECURITY ARCHITECTURE:
 * - All subscription changes happen ONLY through verified Stripe webhooks
 * - No user-facing endpoint can directly modify subscription status
 * - Idempotent webhook handling prevents duplicate processing
 * - Audit trail for all subscription changes
 * 
 * ENDPOINTS:
 * - createCheckoutSession: Creates Stripe Checkout session for upgrade
 * - createPortalSession: Creates Stripe Customer Portal session for billing management
 * - handleWebhook: Processes verified Stripe webhook events
 */

const Stripe = require('stripe');
const User = require('../models/Users');
const { 
  sendSubscriptionUpgradeEmail, 
  sendSubscriptionCanceledEmail 
} = require('../services/emailService');

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16', // Lock API version for consistency
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

// Set to track processed webhook event IDs (idempotency)
// In production, use Redis or database for persistence across restarts
const processedEvents = new Set();

/**
 * Create a Stripe Checkout Session
 * Redirects user to Stripe's hosted checkout page
 * 
 * @route POST /api/payments/create-checkout-session
 * @access Private (requires authentication)
 */
const createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { plan } = req.body; // 'pro' or 'business'

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Validate plan
    if (!plan || !PLAN_PRICES[plan]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan. Choose "pro" or "business".',
      });
    }

    // Get user from database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if already on this plan
    if (user.subscriptionPlan === plan && user.subscriptionStatus === 'active') {
      return res.status(400).json({
        success: false,
        message: `You are already subscribed to the ${plan} plan.`,
      });
    }

    // Create or retrieve Stripe customer
    let customerId = user.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: userId.toString(),
        },
      });
      customerId = customer.id;
      
      // Save Stripe customer ID to user
      user.stripeCustomerId = customerId;
      await user.save();
    }

    // Build checkout session configuration
    const sessionConfig = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: PLAN_PRICES[plan],
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/pricing-page.html?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing-page.html?canceled=true`,
      metadata: {
        userId: userId.toString(),
        plan: plan,
      },
      subscription_data: {
        metadata: {
          userId: userId.toString(),
          plan: plan,
        },
      },
      // Enable automatic tax if configured
      // automatic_tax: { enabled: true },
      
      // Allow promotion codes
      allow_promotion_codes: true,
      
      // Billing address collection
      billing_address_collection: 'required',
    };

    // If user already has a subscription, handle upgrade/downgrade
    if (user.stripeSubscriptionId && user.subscriptionStatus === 'active') {
      // For existing subscribers, use portal for plan changes
      return res.status(400).json({
        success: false,
        message: 'You already have an active subscription. Please use the billing portal to change plans.',
        redirectToPortal: true,
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionConfig);

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Create checkout session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Create a Stripe Customer Portal Session
 * Allows users to manage billing, update payment method, cancel subscription
 * 
 * @route POST /api/payments/create-portal-session
 * @access Private (requires authentication)
 */
const createPortalSession = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.stripeCustomerId) {
      return res.status(400).json({
        success: false,
        message: 'No billing account found. Please subscribe first.',
      });
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/pricing-page.html`,
    });

    res.json({
      success: true,
      url: session.url,
    });
  } catch (error) {
    console.error('Create portal session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create billing portal session',
    });
  }
};

/**
 * Handle Stripe Webhook Events
 * 
 * CRITICAL SECURITY:
 * - Only processes events that pass signature verification
 * - Idempotent - ignores duplicate events
 * - Maintains audit trail of all changes
 * 
 * @route POST /api/payments/webhook
 * @access Public (but signature verified)
 */
const handleWebhook = async (req, res) => {
  try {
    // Event is already verified by middleware
    const event = req.stripeEvent;

    if (!event) {
      return res.status(400).json({
        success: false,
        message: 'No verified event found',
      });
    }

    // Idempotency check - skip if already processed
    if (processedEvents.has(event.id)) {
      console.log(`Webhook event ${event.id} already processed, skipping`);
      return res.status(200).json({ received: true, duplicate: true });
    }

    console.log(`Processing webhook event: ${event.type} (${event.id})`);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Mark event as processed
    processedEvents.add(event.id);

    // Cleanup old events from memory (keep last 10000)
    if (processedEvents.size > 10000) {
      const iterator = processedEvents.values();
      for (let i = 0; i < 1000; i++) {
        processedEvents.delete(iterator.next().value);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Return 200 anyway to prevent Stripe from retrying
    // Log the error for investigation
    res.status(200).json({ received: true, error: 'Processing error logged' });
  }
};

/**
 * Handle checkout.session.completed event
 * User has successfully completed checkout - THIS IS THE PRIMARY HANDLER
 */
async function handleCheckoutCompleted(event) {
  const session = event.data.object;
  
  console.log('=== CHECKOUT SESSION COMPLETED ===');
  console.log('Session ID:', session.id);
  console.log('Session metadata:', JSON.stringify(session.metadata));
  console.log('Customer:', session.customer);
  console.log('Subscription:', session.subscription);
  
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan;

  if (!userId) {
    console.error('❌ No userId in checkout session metadata');
    return;
  }

  const user = await User.findById(userId);
  if (!user) {
    console.error(`❌ User not found: ${userId}`);
    return;
  }

  console.log('✅ User found:', user.email);

  // Update Stripe customer ID
  if (session.customer) {
    user.stripeCustomerId = session.customer;
  }

  // If there's a subscription, fetch it and update the user
  if (session.subscription) {
    try {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      console.log('Subscription retrieved:', subscription.id, 'Status:', subscription.status);
      
      user.stripeSubscriptionId = subscription.id;
      user.subscriptionStatus = subscription.status;
      user.subscriptionPeriodEnd = new Date(subscription.current_period_end * 1000);
      
      // Use the plan from session metadata (more reliable than price ID lookup)
      if (plan && ['active', 'trialing'].includes(subscription.status)) {
        const previousPlan = user.subscriptionPlan;
        user.subscriptionPlan = plan;
        
        // Add to audit trail
        user.subscriptionHistory.push({
          timestamp: new Date(),
          action: 'checkout_completed',
          fromPlan: previousPlan,
          toPlan: plan,
          stripeEventId: event.id,
        });
        
        console.log(`✅ User ${user.email} upgraded: ${previousPlan} -> ${plan}`);
        
        // Send upgrade confirmation email (non-blocking)
        const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
        sendSubscriptionUpgradeEmail(user.email, user.name, planName).catch(err => {
          console.error('Failed to send upgrade email:', err);
        });
      }
    } catch (err) {
      console.error('Error retrieving subscription:', err.message);
    }
  }

  await user.save();
  console.log(`✅ Checkout completed and user saved for ${userId}`);
}

/**
 * Handle customer.subscription.created event
 * New subscription created
 */
async function handleSubscriptionCreated(event) {
  const subscription = event.data.object;
  await updateUserSubscription(subscription, event.id, 'created');
}

/**
 * Handle customer.subscription.updated event
 * Subscription status, plan, or billing changed
 */
async function handleSubscriptionUpdated(event) {
  const subscription = event.data.object;
  await updateUserSubscription(subscription, event.id, 'updated');
}

/**
 * Handle customer.subscription.deleted event
 * Subscription has been canceled/expired
 */
async function handleSubscriptionDeleted(event) {
  const subscription = event.data.object;
  await updateUserSubscription(subscription, event.id, 'canceled');
}

/**
 * Handle invoice.payment_succeeded event
 * Subscription renewed successfully
 */
async function handlePaymentSucceeded(event) {
  const invoice = event.data.object;
  
  if (invoice.subscription) {
    // Fetch the subscription to get latest status
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    await updateUserSubscription(subscription, event.id, 'renewed');
  }
}

/**
 * Handle invoice.payment_failed event
 * Payment failed - subscription may be at risk
 */
async function handlePaymentFailed(event) {
  const invoice = event.data.object;
  const customerId = invoice.customer;

  const user = await User.findOne({ stripeCustomerId: customerId });
  if (!user) {
    console.error(`User not found for customer: ${customerId}`);
    return;
  }

  // Update subscription status
  user.subscriptionStatus = 'past_due';
  
  // Add to history
  user.subscriptionHistory.push({
    timestamp: new Date(),
    action: 'payment_failed',
    fromPlan: user.subscriptionPlan,
    toPlan: user.subscriptionPlan,
    stripeEventId: event.id,
  });

  await user.save();

  console.log(`Payment failed for user ${user._id}`);
  // TODO: Send email notification about failed payment
}

/**
 * Core function to update user subscription from Stripe subscription object
 * 
 * @param {Object} subscription - Stripe subscription object
 * @param {string} eventId - Stripe event ID for idempotency
 * @param {string} action - Action type for audit trail
 */
async function updateUserSubscription(subscription, eventId, action) {
  console.log('=== UPDATE USER SUBSCRIPTION ===');
  console.log('Subscription ID:', subscription.id);
  console.log('Customer ID:', subscription.customer);
  console.log('Subscription metadata:', JSON.stringify(subscription.metadata));
  console.log('Action:', action);
  
  // Find user by Stripe customer ID or metadata
  const userId = subscription.metadata?.userId;
  let user;

  console.log('Looking for user with ID from metadata:', userId);
  
  if (userId) {
    user = await User.findById(userId);
    console.log('User found by metadata userId:', !!user);
  }
  
  if (!user) {
    console.log('Looking for user with stripeCustomerId:', subscription.customer);
    user = await User.findOne({ stripeCustomerId: subscription.customer });
    console.log('User found by stripeCustomerId:', !!user);
  }

  if (!user) {
    console.error(`❌ User not found for subscription: ${subscription.id}`);
    console.error('  - Tried metadata userId:', userId);
    console.error('  - Tried stripeCustomerId:', subscription.customer);
    return;
  }

  console.log('✅ User found:', user.email, 'ID:', user._id);

  const previousPlan = user.subscriptionPlan;

  // Determine plan from price ID
  const priceId = subscription.items?.data?.[0]?.price?.id;
  console.log('Price ID from subscription:', priceId);
  console.log('PRICE_TO_PLAN mapping:', JSON.stringify(PRICE_TO_PLAN));
  
  const newPlan = PRICE_TO_PLAN[priceId] || 'free';
  console.log('Determined new plan:', newPlan);

  // Update user subscription data
  user.stripeSubscriptionId = subscription.id;
  user.subscriptionStatus = subscription.status;
  user.subscriptionPeriodEnd = new Date(subscription.current_period_end * 1000);

  console.log('Subscription status:', subscription.status);

  // Only update plan if subscription is active or trialing
  if (['active', 'trialing'].includes(subscription.status)) {
    user.subscriptionPlan = newPlan;
    console.log('Setting plan to:', newPlan);
  } else if (subscription.status === 'canceled' || action === 'canceled') {
    // On cancellation, downgrade to free
    user.subscriptionPlan = 'free';
    console.log('Setting plan to free (canceled)');
    
    // Send cancellation email (non-blocking)
    const endDate = new Date(subscription.current_period_end * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    sendSubscriptionCanceledEmail(user.email, user.name, endDate).catch(err => {
      console.error('Failed to send cancellation email:', err);
    });
  }

  // Add to subscription history for audit trail
  user.subscriptionHistory.push({
    timestamp: new Date(),
    action: action,
    fromPlan: previousPlan,
    toPlan: user.subscriptionPlan,
    stripeEventId: eventId,
  });

  // Keep history manageable (last 100 entries)
  if (user.subscriptionHistory.length > 100) {
    user.subscriptionHistory = user.subscriptionHistory.slice(-100);
  }

  await user.save();

  console.log(`User ${user._id} subscription ${action}: ${previousPlan} -> ${user.subscriptionPlan} (status: ${subscription.status})`);
}

/**
 * Get current subscription status
 * 
 * @route GET /api/payments/subscription-status
 * @access Private (requires authentication)
 */
const getSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const user = await User.findById(userId).select(
      'subscriptionPlan subscriptionStatus subscriptionPeriodEnd stripeCustomerId'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      subscription: {
        plan: user.subscriptionPlan,
        status: user.subscriptionStatus,
        periodEnd: user.subscriptionPeriodEnd,
        hasStripeAccount: !!user.stripeCustomerId,
      },
    });
  } catch (error) {
    console.error('Get subscription status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscription status',
    });
  }
};

module.exports = {
  createCheckoutSession,
  createPortalSession,
  handleWebhook,
  getSubscriptionStatus,
  stripe, // Export stripe instance for route middleware
};
