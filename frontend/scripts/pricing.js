/**
 * Pricing Page Handler
 * 
 * Handles Stripe checkout integration and subscription management.
 * All payment processing happens through Stripe's secure hosted checkout.
 */

(function() {
  'use strict';

  // Configure axios
  axios.defaults.baseURL = 'http://localhost:5004';
  axios.defaults.withCredentials = true;

  // Add auth token to requests
  axios.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // State
  let currentSubscription = null;

  /**
   * Initialize the pricing page
   */
  async function init() {
    // Check URL params for success/cancel
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('success') === 'true') {
      showSuccessMessage();
      // Clean up URL
      window.history.replaceState({}, '', '/pricing-page.html');
    } else if (urlParams.get('canceled') === 'true') {
      showCanceledMessage();
      window.history.replaceState({}, '', '/pricing-page.html');
    }

    // Load current subscription status
    await loadSubscriptionStatus();

    // Set up button handlers
    setupButtonHandlers();
  }

  /**
   * Load user's current subscription status
   */
  async function loadSubscriptionStatus() {
    try {
      const response = await axios.get('/api/payments/subscription-status');
      
      if (response.data.success) {
        currentSubscription = response.data.subscription;
        updateUIForSubscription();
      }
    } catch (error) {
      console.error('Failed to load subscription status:', error);
      // Default to free plan if we can't load status
      currentSubscription = { plan: 'free', status: null };
      updateUIForSubscription();
    }
  }

  /**
   * Update UI based on current subscription
   */
  function updateUIForSubscription() {
    const freeBadge = document.querySelector('.pricing-card.free .plan-badge');
    const freeBtn = document.querySelector('.pricing-card.free .plan-btn');
    const proBtn = document.querySelector('.js-upgrade-pro');
    const businessBtn = document.querySelector('.js-upgrade-business');

    // Reset all badges
    document.querySelectorAll('.plan-badge').forEach(el => el.remove());

    if (!currentSubscription) return;

    const plan = currentSubscription.plan;
    const isActive = ['active', 'trialing'].includes(currentSubscription.status);

    // Update based on current plan
    if (plan === 'free' || !isActive) {
      // Show "Current Plan" badge on free card
      const freeHeader = document.querySelector('.pricing-card.free .card-header');
      if (freeHeader && !freeHeader.querySelector('.plan-badge')) {
        const badge = document.createElement('span');
        badge.className = 'plan-badge';
        badge.textContent = 'Current Plan';
        freeHeader.insertBefore(badge, freeHeader.firstChild);
      }
      
      if (freeBtn) {
        freeBtn.textContent = 'Current Plan';
        freeBtn.disabled = true;
        freeBtn.classList.add('current');
        freeBtn.classList.remove('upgrade');
      }
      
      // Enable upgrade buttons
      if (proBtn) {
        proBtn.textContent = 'Upgrade to Pro';
        proBtn.disabled = false;
      }
      if (businessBtn) {
        businessBtn.textContent = 'Upgrade to Business';
        businessBtn.disabled = false;
      }
    } else if (plan === 'pro') {
      // Show badge on pro card
      const proHeader = document.querySelector('.pricing-card.pro .card-header');
      if (proHeader) {
        const badge = document.createElement('span');
        badge.className = 'plan-badge';
        badge.textContent = 'Current Plan';
        proHeader.insertBefore(badge, proHeader.firstChild);
      }
      
      if (proBtn) {
        proBtn.textContent = 'Current Plan';
        proBtn.disabled = true;
        proBtn.classList.add('current');
        proBtn.classList.remove('upgrade');
      }
      
      if (freeBtn) {
        freeBtn.textContent = 'Downgrade';
        freeBtn.disabled = false;
        freeBtn.classList.remove('current');
      }
      
      if (businessBtn) {
        businessBtn.textContent = 'Upgrade to Business';
        businessBtn.disabled = false;
      }
    } else if (plan === 'business') {
      // Show badge on business card
      const businessHeader = document.querySelector('.pricing-card.business .card-header');
      if (businessHeader) {
        const badge = document.createElement('span');
        badge.className = 'plan-badge';
        badge.textContent = 'Current Plan';
        businessHeader.insertBefore(badge, businessHeader.firstChild);
      }
      
      if (businessBtn) {
        businessBtn.textContent = 'Current Plan';
        businessBtn.disabled = true;
        businessBtn.classList.add('current');
        businessBtn.classList.remove('upgrade');
      }
      
      if (freeBtn) {
        freeBtn.textContent = 'Downgrade';
        freeBtn.disabled = false;
        freeBtn.classList.remove('current');
      }
      
      if (proBtn) {
        proBtn.textContent = 'Downgrade';
        proBtn.disabled = false;
        proBtn.classList.add('upgrade');
        proBtn.classList.remove('current');
      }
    }

    // Add manage subscription button if user has Stripe account
    if (currentSubscription.hasStripeAccount && isActive) {
      addManageSubscriptionButton();
    }
  }

  /**
   * Add "Manage Subscription" button for existing subscribers
   */
  function addManageSubscriptionButton() {
    // Check if already exists
    if (document.querySelector('.manage-subscription-btn')) return;

    const header = document.querySelector('.pricing-header');
    if (!header) return;

    const btn = document.createElement('button');
    btn.className = 'manage-subscription-btn';
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
      </svg>
      Manage Subscription
    `;
    btn.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 20px;
      padding: 12px 24px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: #a5a7ae;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(255, 255, 255, 0.08)';
      btn.style.color = '#e8e8ea';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(255, 255, 255, 0.05)';
      btn.style.color = '#a5a7ae';
    });
    btn.addEventListener('click', openBillingPortal);
    
    header.appendChild(btn);
  }

  /**
   * Set up button click handlers
   */
  function setupButtonHandlers() {
    const proBtn = document.querySelector('.js-upgrade-pro');
    const businessBtn = document.querySelector('.js-upgrade-business');

    if (proBtn) {
      proBtn.addEventListener('click', () => handleUpgrade('pro'));
    }

    if (businessBtn) {
      businessBtn.addEventListener('click', () => handleUpgrade('business'));
    }
  }

  /**
   * Handle upgrade button click
   */
  async function handleUpgrade(plan) {
    const btn = document.querySelector(plan === 'pro' ? '.js-upgrade-pro' : '.js-upgrade-business');
    
    if (btn.disabled) return;

    // Disable button and show loading
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Loading...';

    try {
      const response = await axios.post('/api/payments/create-checkout-session', { plan });

      if (response.data.success && response.data.url) {
        // Redirect to Stripe Checkout
        window.location.href = response.data.url;
      } else if (response.data.redirectToPortal) {
        // User already has subscription, open portal
        await openBillingPortal();
      } else {
        throw new Error(response.data.message || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      
      const message = error.response?.data?.message || 'Failed to start checkout. Please try again.';
      showErrorMessage(message);
      
      // Restore button
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  /**
   * Open Stripe Customer Portal for subscription management
   */
  async function openBillingPortal() {
    try {
      const response = await axios.post('/api/payments/create-portal-session');

      if (response.data.success && response.data.url) {
        window.location.href = response.data.url;
      } else {
        throw new Error(response.data.message || 'Failed to open billing portal');
      }
    } catch (error) {
      console.error('Portal error:', error);
      showErrorMessage('Failed to open billing portal. Please try again.');
    }
  }

  /**
   * Show success message after successful subscription
   */
  function showSuccessMessage() {
    showNotification(
      'Subscription Activated',
      'Welcome to CoSparq Pro! Your subscription is now active.',
      'success'
    );
  }

  /**
   * Show message when user cancels checkout
   */
  function showCanceledMessage() {
    showNotification(
      'Checkout Canceled',
      'No worries! You can upgrade anytime.',
      'info'
    );
  }

  /**
   * Show error message
   */
  function showErrorMessage(message) {
    showNotification('Error', message, 'error');
  }

  /**
   * Show notification popup
   */
  function showNotification(title, message, type) {
    // Remove existing notification
    const existing = document.querySelector('.pricing-notification');
    if (existing) existing.remove();

    const colors = {
      success: { bg: 'rgba(74, 222, 128, 0.1)', border: '#4ade80', icon: '#4ade80' },
      error: { bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', icon: '#ef4444' },
      info: { bg: 'rgba(59, 130, 246, 0.1)', border: '#3b82f6', icon: '#3b82f6' },
    };

    const color = colors[type] || colors.info;

    const notification = document.createElement('div');
    notification.className = 'pricing-notification';
    notification.innerHTML = `
      <div class="notification-content">
        <h3>${title}</h3>
        <p>${message}</p>
      </div>
      <button class="notification-close">&times;</button>
    `;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #191a1d;
      border: 1px solid ${color.border};
      border-radius: 12px;
      padding: 16px 20px;
      max-width: 400px;
      display: flex;
      align-items: flex-start;
      gap: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;

    const content = notification.querySelector('.notification-content');
    content.style.cssText = 'flex: 1;';

    const h3 = notification.querySelector('h3');
    h3.style.cssText = `margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: ${color.icon};`;

    const p = notification.querySelector('p');
    p.style.cssText = 'margin: 0; font-size: 14px; color: #a5a7ae; line-height: 1.4;';

    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: #6b7280;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    `;
    closeBtn.addEventListener('click', () => notification.remove());

    // Add animation keyframes
    if (!document.querySelector('#notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
      }
    }, 5000);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
