// frontend/scripts/apiLimitHandler.js
// Global handler for API limit exceeded responses
// This script should be included on all pages that make API calls

(function() {
  'use strict';

  // Create the popup HTML structure
  const createLimitPopup = () => {
    // Check if popup already exists
    if (document.getElementById('api-limit-popup-overlay')) {
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'api-limit-popup-overlay';
    overlay.innerHTML = `
      <div id="api-limit-popup">
        <div class="api-limit-icon">⚠️</div>
        <h2 class="api-limit-title">Token Limit Reached</h2>
        <p class="api-limit-message">
          You have reached your usage limit. To continue using AI features, please upgrade your plan.
        </p>
        <div class="api-limit-details">
          <span class="api-limit-current"></span>
          <span class="api-limit-max"></span>
        </div>
        <div class="api-limit-buttons">
          <button id="api-limit-upgrade-btn" class="api-limit-btn primary">Upgrade Plan</button>
          <button id="api-limit-close-btn" class="api-limit-btn secondary">Close</button>
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      #api-limit-popup-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease-out;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      #api-limit-popup {
        background: linear-gradient(145deg, #1a1a2e, #16213e);
        border: 1px solid #e94560;
        border-radius: 16px;
        padding: 40px;
        max-width: 450px;
        width: 90%;
        text-align: center;
        box-shadow: 0 20px 60px rgba(233, 69, 96, 0.3);
        animation: slideUp 0.3s ease-out;
      }

      @keyframes slideUp {
        from { 
          opacity: 0;
          transform: translateY(20px);
        }
        to { 
          opacity: 1;
          transform: translateY(0);
        }
      }

      .api-limit-icon {
        font-size: 64px;
        margin-bottom: 20px;
      }

      .api-limit-title {
        color: #e94560;
        font-size: 24px;
        font-weight: 700;
        margin: 0 0 16px 0;
        font-family: 'Inter', system-ui, sans-serif;
      }

      .api-limit-message {
        color: #a0a0a0;
        font-size: 16px;
        line-height: 1.6;
        margin: 0 0 24px 0;
        font-family: 'Inter', system-ui, sans-serif;
      }

      .api-limit-details {
        display: flex;
        justify-content: center;
        gap: 20px;
        margin-bottom: 30px;
        padding: 16px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
      }

      .api-limit-details span {
        color: #ffffff;
        font-size: 14px;
        font-family: 'Inter', system-ui, sans-serif;
      }

      .api-limit-current {
        color: #e94560 !important;
        font-weight: 600;
      }

      .api-limit-max {
        color: #4ade80 !important;
      }

      .api-limit-buttons {
        display: flex;
        gap: 12px;
        justify-content: center;
      }

      .api-limit-btn {
        padding: 14px 28px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: 'Inter', system-ui, sans-serif;
        border: none;
      }

      .api-limit-btn.primary {
        background: linear-gradient(90deg, #8400ff, #e94560);
        color: white;
      }

      .api-limit-btn.primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(233, 69, 96, 0.4);
      }

      .api-limit-btn.secondary {
        background: transparent;
        color: #a0a0a0;
        border: 1px solid #333;
      }

      .api-limit-btn.secondary:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #ffffff;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(overlay);

    // Close button handler
    document.getElementById('api-limit-close-btn').addEventListener('click', () => {
      overlay.remove();
    });

    // Upgrade button handler - you can customize this URL
    document.getElementById('api-limit-upgrade-btn').addEventListener('click', () => {
      // TODO: Replace with your actual upgrade page URL
      window.location.href = '/settings-page.html?upgrade=true';
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

  // Show the popup with specific details
  const showLimitExceededPopup = (currentCost, limit) => {
    createLimitPopup();
    
    const currentEl = document.querySelector('.api-limit-current');
    const maxEl = document.querySelector('.api-limit-max');
    
    if (currentEl && maxEl) {
      currentEl.textContent = `Used: $${currentCost?.toFixed(4) || '0.50'}`;
      maxEl.textContent = `Limit: $${limit?.toFixed(2) || '0.50'}`;
    }
  };

  // Set up axios interceptor if axios is available
  const setupAxiosInterceptor = () => {
    if (typeof axios === 'undefined') {
      console.warn('apiLimitHandler: axios not found, retrying in 100ms...');
      setTimeout(setupAxiosInterceptor, 100);
      return;
    }

    // Add response interceptor
    axios.interceptors.response.use(
      // Success handler - pass through
      (response) => response,
      
      // Error handler
      (error) => {
        // Check if this is a 429 (Too Many Requests) with our specific error
        if (error.response && error.response.status === 429) {
          const data = error.response.data;
          
          if (data && data.limitExceeded === true) {
            console.error('🚫 API Limit Exceeded:', data);
            showLimitExceededPopup(data.currentCost, data.limit);
          }
        }
        
        // Always reject the promise so the calling code knows there was an error
        return Promise.reject(error);
      }
    );

    console.log('✅ API Limit Handler initialized');
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAxiosInterceptor);
  } else {
    setupAxiosInterceptor();
  }

  // Expose function globally for manual triggering if needed
  window.showApiLimitPopup = showLimitExceededPopup;

})();
