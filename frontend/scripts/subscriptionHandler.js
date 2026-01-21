// frontend/scripts/subscriptionHandler.js
// Global handler for subscription-required responses (403 subscriptionRequired)
// This script should be included on pages that access premium features like CoBuilder

(function() {
  'use strict';

  // Create the subscription popup HTML structure
  const createSubscriptionPopup = () => {
    // Check if popup already exists
    if (document.getElementById('subscription-popup-overlay')) {
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'subscription-popup-overlay';
    overlay.innerHTML = `
      <div id="subscription-popup">
        <div class="subscription-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </div>
        <h2 class="subscription-title">Premium Feature</h2>
        <p class="subscription-message">
          CoBuilder is a premium feature available to Pro and Business subscribers.
          Upgrade your plan to unlock AI-powered landing page generation and more.
        </p>
        <div class="subscription-features">
          <div class="subscription-feature">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            <span>AI Landing Page Generator</span>
          </div>
          <div class="subscription-feature">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            <span>Unlimited AI Chat</span>
          </div>
          <div class="subscription-feature">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            <span>Priority AI Responses</span>
          </div>
        </div>
        <div class="subscription-buttons">
          <button id="subscription-upgrade-btn" class="subscription-btn primary">Upgrade to Pro</button>
          <button id="subscription-close-btn" class="subscription-btn secondary">Maybe Later</button>
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.id = 'subscription-popup-styles';
    style.textContent = `
      #subscription-popup-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        animation: subFadeIn 0.2s ease-out;
      }

      @keyframes subFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      #subscription-popup {
        background: #191a1d;
        border: 1px solid rgba(132, 0, 255, 0.3);
        border-radius: 16px;
        padding: 40px;
        max-width: 450px;
        width: 90%;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        animation: subSlideUp 0.3s ease-out;
      }

      @keyframes subSlideUp {
        from { 
          opacity: 0;
          transform: translateY(20px);
        }
        to { 
          opacity: 1;
          transform: translateY(0);
        }
      }

      .subscription-icon {
        margin-bottom: 20px;
        color: #a855f7;
      }

      .subscription-icon svg {
        filter: drop-shadow(0 0 12px rgba(168, 85, 247, 0.5));
      }

      .subscription-title {
        color: #a855f7;
        font-size: 24px;
        font-weight: 700;
        margin: 0 0 16px 0;
        font-family: 'Inter', system-ui, sans-serif;
      }

      .subscription-message {
        color: #a0a0a0;
        font-size: 15px;
        line-height: 1.6;
        margin: 0 0 24px 0;
        font-family: 'Inter', system-ui, sans-serif;
      }

      .subscription-features {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 30px;
        padding: 16px 20px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        text-align: left;
      }

      .subscription-feature {
        display: flex;
        align-items: center;
        gap: 10px;
        color: #e8e8ea;
        font-size: 14px;
        font-family: 'Inter', system-ui, sans-serif;
      }

      .subscription-feature svg {
        color: #a855f7;
        flex-shrink: 0;
      }

      .subscription-buttons {
        display: flex;
        gap: 12px;
        justify-content: center;
      }

      .subscription-btn {
        padding: 14px 28px;
        border-radius: 10px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.25s ease;
        font-family: 'Inter', system-ui, sans-serif;
        border: none;
      }

      .subscription-btn.primary {
        position: relative;
        background: #0f0f10;
        color: #e8e8ea;
        border: 3px solid transparent;
        background-image: linear-gradient(#0f0f10, #0f0f10), 
                          linear-gradient(90deg, #8400ff 0%, #f94016 40%, #f96d16 60%, #3b82f6 100%);
        background-origin: border-box;
        background-clip: padding-box, border-box;
        box-shadow: 0 0 20px rgba(132, 0, 255, 0.25), 
                    0 0 40px rgba(249, 64, 22, 0.15);
      }

      .subscription-btn.primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 0 25px rgba(132, 0, 255, 0.4), 
                    0 0 50px rgba(249, 64, 22, 0.25),
                    0 4px 20px rgba(0, 0, 0, 0.3);
      }

      .subscription-btn.secondary {
        background: transparent;
        color: #6b7280;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .subscription-btn.secondary:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #a0a0a0;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(overlay);

    // Close button handler
    document.getElementById('subscription-close-btn').addEventListener('click', () => {
      overlay.remove();
    });

    // Upgrade button handler
    document.getElementById('subscription-upgrade-btn').addEventListener('click', () => {
      window.location.href = '/pricing-page.html';
    });

    // Close on overlay click (outside popup)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    });
  };

  // Show the subscription required popup
  const showSubscriptionRequiredPopup = () => {
    createSubscriptionPopup();
  };

  // Set up axios interceptor if axios is available
  const setupAxiosInterceptor = () => {
    if (typeof axios === 'undefined') {
      console.warn('subscriptionHandler: axios not found, retrying in 100ms...');
      setTimeout(setupAxiosInterceptor, 100);
      return;
    }

    // Add response interceptor
    axios.interceptors.response.use(
      // Success handler - pass through
      (response) => response,
      
      // Error handler
      (error) => {
        // Check if this is a 403 (Forbidden) with subscriptionRequired flag
        if (error.response && error.response.status === 403) {
          const data = error.response.data;
          
          if (data && data.subscriptionRequired === true) {
            console.warn('Premium feature blocked - subscription required:', data);
            showSubscriptionRequiredPopup();
          }
        }
        
        // Always reject the promise so the calling code knows there was an error
        return Promise.reject(error);
      }
    );

    console.log('Subscription Handler initialized');
  };

  /**
   * Fetch subscription status and update sidebar UI
   */
  const updateSubscriptionUI = async () => {
    try {
      // Configure axios if needed
      if (!axios.defaults.baseURL) {
        axios.defaults.baseURL = 'http://localhost:5004';
      }
      axios.defaults.withCredentials = true;

      const token = localStorage.getItem('accessToken');
      if (!token) return; // Not logged in

      const response = await axios.get('/api/payments/subscription-status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        const subscription = response.data.subscription;
        const plan = subscription.plan;
        const isActive = ['active', 'trialing'].includes(subscription.status);

        console.log('Subscription status:', { plan, status: subscription.status, isActive });

        // Store in localStorage for quick access
        localStorage.setItem('subscriptionPlan', plan);
        localStorage.setItem('subscriptionStatus', subscription.status || 'none');

        updateSidebarUI(plan, isActive);
      }
    } catch (error) {
      console.error('Failed to load subscription status:', error);
      // Default to free if can't fetch status
      updateSidebarUI('free', false);
    }
  };

  /**
   * Update sidebar upgrade button and badge
   */
  const updateSidebarUI = (plan, isActive) => {
    const upgradeBtn = document.querySelector('.js-upgrade-btn');
    const subscriptionBadge = document.querySelector('.js-subscription-badge');

    if (!upgradeBtn || !subscriptionBadge) {
      // Sidebar might not be loaded yet, try again with increasing delays
      retryUpdateSidebar(plan, isActive, 0);
      return;
    }

    applySubscriptionUI(upgradeBtn, subscriptionBadge, plan, isActive);
  };

  /**
   * Retry updating sidebar UI with increasing delays
   */
  let retryCount = 0;
  const maxRetries = 10;
  const retryUpdateSidebar = (plan, isActive, attempt) => {
    if (attempt >= maxRetries) {
      console.warn('Subscription: Could not find sidebar elements after max retries');
      return;
    }

    const delay = 200 + (attempt * 200); // 200ms, 400ms, 600ms, etc.
    
    setTimeout(() => {
      const btn = document.querySelector('.js-upgrade-btn');
      const badge = document.querySelector('.js-subscription-badge');
      
      if (btn && badge) {
        applySubscriptionUI(btn, badge, plan, isActive);
        console.log(`Subscription UI updated on attempt ${attempt + 1}`);
      } else {
        retryUpdateSidebar(plan, isActive, attempt + 1);
      }
    }, delay);
  };

  /**
   * Apply subscription UI changes
   */
  const applySubscriptionUI = (upgradeBtn, subscriptionBadge, plan, isActive) => {
    const badgeText = subscriptionBadge.querySelector('.badge-text');

    if (isActive && (plan === 'pro' || plan === 'business')) {
      // Hide upgrade button, show badge
      upgradeBtn.classList.add('hidden');
      subscriptionBadge.classList.add('visible');
      
      // Set badge style and text based on plan
      subscriptionBadge.classList.remove('pro', 'business');
      subscriptionBadge.classList.add(plan);
      
      if (badgeText) {
        badgeText.textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
      }
    } else {
      // Show upgrade button, hide badge
      upgradeBtn.classList.remove('hidden');
      subscriptionBadge.classList.remove('visible', 'pro', 'business');
    }
  };

  /**
   * Check if user has paid subscription (for feature gating)
   */
  const hasPaidSubscription = () => {
    const plan = localStorage.getItem('subscriptionPlan');
    const status = localStorage.getItem('subscriptionStatus');
    const isActive = ['active', 'trialing'].includes(status);
    return isActive && (plan === 'pro' || plan === 'business');
  };

  /**
   * Get current subscription plan
   */
  const getSubscriptionPlan = () => {
    const plan = localStorage.getItem('subscriptionPlan');
    const status = localStorage.getItem('subscriptionStatus');
    const isActive = ['active', 'trialing'].includes(status);
    return isActive ? (plan || 'free') : 'free';
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupAxiosInterceptor();
      updateSubscriptionUI();
    });
  } else {
    setupAxiosInterceptor();
    updateSubscriptionUI();
  }

  // Expose functions globally
  window.showSubscriptionRequiredPopup = showSubscriptionRequiredPopup;
  window.SubscriptionHandler = {
    update: updateSubscriptionUI,
    hasPaid: hasPaidSubscription,
    getPlan: getSubscriptionPlan
  };

})();
