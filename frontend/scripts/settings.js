/**
 * Settings Page Controller
 * Handles all settings page functionality including:
 * - Tab navigation
 * - Profile management
 * - Password changes
 * - Subscription display
 * - Notifications preferences
 * - Account deletion
 */

(function() {
  'use strict';

  const API_BASE = 'http://localhost:5004/api';

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  function getToken() {
    return localStorage.getItem('accessToken');
  }

  function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-message">${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  async function apiRequest(endpoint, options = {}) {
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
      });

      if (response.status === 401) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/auth.html';
        return null;
      }

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.msg || data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  }

  // ============================================
  // TAB NAVIGATION
  // ============================================

  function initTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = tab.dataset.tab;

        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update active content
        contents.forEach(content => {
          content.classList.remove('active');
          if (content.id === `tab-${targetId}`) {
            content.classList.add('active');
          }
        });

        // Save preference
        localStorage.setItem('settingsTab', targetId);
      });
    });

    // Restore last tab
    const savedTab = localStorage.getItem('settingsTab');
    if (savedTab) {
      const targetTab = document.querySelector(`[data-tab="${savedTab}"]`);
      if (targetTab) targetTab.click();
    }
  }

  // ============================================
  // USER DATA
  // ============================================

  async function loadUserData() {
    try {
      const data = await apiRequest('/users/profile');
      if (!data) return;

      const user = data.user || data;

      // Profile info
      const displayNameInput = document.getElementById('displayName');
      const userEmailInput = document.getElementById('userEmail');
      const avatarInitials = document.getElementById('avatarInitials');

      if (displayNameInput) displayNameInput.value = user.displayName || user.name || '';
      if (userEmailInput) userEmailInput.value = user.email || '';
      
      if (avatarInitials) {
        const name = user.displayName || user.name || user.email || 'U';
        avatarInitials.textContent = name.charAt(0).toUpperCase();
      }

      // Member since
      const memberSince = document.getElementById('memberSince');
      if (memberSince && user.createdAt) {
        const date = new Date(user.createdAt);
        memberSince.textContent = date.toLocaleDateString('en-US', { 
          month: 'long', 
          year: 'numeric' 
        });
      }

      // Subscription info
      updateSubscriptionDisplay(user);

    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  function updateSubscriptionDisplay(user) {
    const plan = user.subscriptionPlan || 'free';
    const status = user.subscriptionStatus;

    const planBadge = document.getElementById('currentPlanBadge');
    const planName = document.getElementById('planName');
    const planDescription = document.getElementById('planDescription');
    const cobuilderFeature = document.getElementById('cobuilderFeature');
    const upgradePlanBtn = document.getElementById('upgradePlanBtn');
    const planFeatures = document.getElementById('planFeatures');

    const planData = {
      free: {
        name: 'Free Plan',
        description: 'Basic features to get started.',
        cobuilder: false,
        features: ['Access to core features', 'Idea validation tools', 'Market research basics']
      },
      pro: {
        name: 'Pro Plan',
        description: 'Enhanced features for serious builders.',
        cobuilder: true,
        features: ['Everything in Free', 'CoBuilder access', 'Priority processing', 'Advanced analytics']
      },
      business: {
        name: 'Business Plan',
        description: 'Full power for teams and enterprises.',
        cobuilder: true,
        features: ['Everything in Pro', 'Team collaboration', 'Custom integrations', 'Dedicated support']
      }
    };

    const data = planData[plan] || planData.free;

    if (planBadge) {
      planBadge.textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
      planBadge.className = `plan-badge ${plan}`;
    }

    if (planName) planName.textContent = data.name;
    if (planDescription) planDescription.textContent = data.description;

    // Update features list
    if (planFeatures) {
      planFeatures.innerHTML = data.features.map(feature => `
        <div class="feature-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>${feature}</span>
        </div>
      `).join('');

      // Add CoBuilder status
      if (!data.cobuilder) {
        planFeatures.innerHTML += `
          <div class="feature-item disabled">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            <span>CoBuilder access</span>
          </div>
        `;
      }
    }

    if (upgradePlanBtn) {
      if (plan === 'business') {
        upgradePlanBtn.style.display = 'none';
      } else if (plan === 'pro') {
        upgradePlanBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          Upgrade to Business
        `;
      }
    }
  }

  // ============================================
  // PROFILE ACTIONS
  // ============================================

  function initProfileActions() {
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
      saveProfileBtn.addEventListener('click', async () => {
        const displayName = document.getElementById('displayName')?.value?.trim();
        
        if (!displayName) {
          showToast('Please enter a display name', 'error');
          return;
        }

        try {
          saveProfileBtn.disabled = true;
          saveProfileBtn.textContent = 'Saving...';

          await apiRequest('/users/profile', {
            method: 'PUT',
            body: JSON.stringify({ displayName })
          });

          showToast('Profile updated successfully');
          
          // Update avatar initials
          const avatarInitials = document.getElementById('avatarInitials');
          if (avatarInitials) {
            avatarInitials.textContent = displayName.charAt(0).toUpperCase();
          }
        } catch (error) {
          showToast(error.message || 'Failed to update profile', 'error');
        } finally {
          saveProfileBtn.disabled = false;
          saveProfileBtn.textContent = 'Save Changes';
        }
      });
    }
  }

  // ============================================
  // PASSWORD MANAGEMENT
  // ============================================

  function initPasswordActions() {
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const newPasswordInput = document.getElementById('newPassword');

    // Password strength indicator
    if (newPasswordInput) {
      newPasswordInput.addEventListener('input', () => {
        const password = newPasswordInput.value;
        const strengthBar = document.querySelector('.strength-bar');
        const strengthText = document.querySelector('.strength-text');

        if (!strengthBar || !strengthText) return;

        let strength = 0;
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;

        strengthBar.className = 'strength-bar';
        if (password.length === 0) {
          strengthText.textContent = 'Password strength';
        } else if (strength <= 2) {
          strengthBar.classList.add('weak');
          strengthText.textContent = 'Weak password';
        } else if (strength === 3) {
          strengthBar.classList.add('medium');
          strengthText.textContent = 'Medium password';
        } else {
          strengthBar.classList.add('strong');
          strengthText.textContent = 'Strong password';
        }
      });
    }

    // Toggle password visibility
    document.querySelectorAll('.toggle-password').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        if (input) {
          const isPassword = input.type === 'password';
          input.type = isPassword ? 'text' : 'password';
          btn.querySelector('svg').innerHTML = isPassword
            ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
            : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
        }
      });
    });

    if (changePasswordBtn) {
      changePasswordBtn.addEventListener('click', async () => {
        const currentPassword = document.getElementById('currentPassword')?.value;
        const newPassword = document.getElementById('newPassword')?.value;
        const confirmPassword = document.getElementById('confirmPassword')?.value;

        if (!currentPassword || !newPassword || !confirmPassword) {
          showToast('Please fill in all password fields', 'error');
          return;
        }

        if (newPassword !== confirmPassword) {
          showToast('New passwords do not match', 'error');
          return;
        }

        if (newPassword.length < 8) {
          showToast('Password must be at least 8 characters', 'error');
          return;
        }

        try {
          changePasswordBtn.disabled = true;
          changePasswordBtn.textContent = 'Updating...';

          await apiRequest('/users/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword })
          });

          showToast('Password updated successfully');
          
          // Clear fields
          document.getElementById('currentPassword').value = '';
          document.getElementById('newPassword').value = '';
          document.getElementById('confirmPassword').value = '';
          document.querySelector('.strength-bar')?.classList.remove('weak', 'medium', 'strong');
          const strengthText = document.querySelector('.strength-text');
          if (strengthText) strengthText.textContent = 'Password strength';

        } catch (error) {
          showToast(error.message || 'Failed to update password', 'error');
        } finally {
          changePasswordBtn.disabled = false;
          changePasswordBtn.textContent = 'Update Password';
        }
      });
    }
  }

  // ============================================
  // NOTIFICATIONS
  // ============================================

  async function initNotifications() {
    const saveNotificationsBtn = document.getElementById('saveNotificationsBtn');
    
    const productUpdates = document.getElementById('notifyProductUpdates');
    const usageAlerts = document.getElementById('notifyUsageAlerts');
    const weeklySummary = document.getElementById('notifyWeeklySummary');
    const marketing = document.getElementById('notifyMarketing');

    // Load preferences from backend
    try {
      const data = await apiRequest('/users/notification-preferences');
      if (data && data.preferences) {
        const prefs = data.preferences;
        if (productUpdates) productUpdates.checked = prefs.productUpdates !== false;
        if (usageAlerts) usageAlerts.checked = prefs.usageAlerts !== false;
        if (weeklySummary) weeklySummary.checked = prefs.weeklySummary || false;
        if (marketing) marketing.checked = prefs.marketing || false;
      }
    } catch (error) {
      console.log('Could not load notification preferences:', error);
      // Fall back to localStorage
      const prefs = JSON.parse(localStorage.getItem('notificationPrefs') || '{}');
      if (productUpdates) productUpdates.checked = prefs.productUpdates !== false;
      if (usageAlerts) usageAlerts.checked = prefs.usageAlerts !== false;
      if (weeklySummary) weeklySummary.checked = prefs.weeklySummary || false;
      if (marketing) marketing.checked = prefs.marketing || false;
    }

    if (saveNotificationsBtn) {
      saveNotificationsBtn.addEventListener('click', async () => {
        const newPrefs = {
          productUpdates: productUpdates?.checked,
          usageAlerts: usageAlerts?.checked,
          weeklySummary: weeklySummary?.checked,
          marketing: marketing?.checked
        };

        saveNotificationsBtn.disabled = true;
        saveNotificationsBtn.textContent = 'Saving...';

        try {
          await apiRequest('/users/notification-preferences', {
            method: 'PUT',
            body: JSON.stringify(newPrefs)
          });
          
          // Also save to localStorage as backup
          localStorage.setItem('notificationPrefs', JSON.stringify(newPrefs));
          showToast('Notification preferences saved');
        } catch (error) {
          console.error('Failed to save notification preferences:', error);
          // Still save to localStorage
          localStorage.setItem('notificationPrefs', JSON.stringify(newPrefs));
          showToast('Preferences saved locally', 'warning');
        } finally {
          saveNotificationsBtn.disabled = false;
          saveNotificationsBtn.textContent = 'Save Preferences';
        }
      });
    }
  }

  // ============================================
  // PREFERENCES
  // ============================================

  function initPreferences() {
    const savePreferencesBtn = document.getElementById('savePreferencesBtn');
    
    // Load saved preferences
    const prefs = JSON.parse(localStorage.getItem('editorPrefs') || '{}');
    
    const autoSave = document.getElementById('prefAutoSave');
    const codeHighlight = document.getElementById('prefCodeHighlight');
    const lineNumbers = document.getElementById('prefLineNumbers');

    if (autoSave) autoSave.checked = prefs.autoSave !== false;
    if (codeHighlight) codeHighlight.checked = prefs.codeHighlight !== false;
    if (lineNumbers) lineNumbers.checked = prefs.lineNumbers !== false;

    if (savePreferencesBtn) {
      savePreferencesBtn.addEventListener('click', () => {
        const newPrefs = {
          autoSave: autoSave?.checked,
          codeHighlight: codeHighlight?.checked,
          lineNumbers: lineNumbers?.checked
        };

        localStorage.setItem('editorPrefs', JSON.stringify(newPrefs));
        showToast('Preferences saved');
      });
    }

    // Export data button
    const exportDataBtn = document.getElementById('exportDataBtn');
    if (exportDataBtn) {
      exportDataBtn.addEventListener('click', async () => {
        try {
          exportDataBtn.disabled = true;
          exportDataBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Exporting...
          `;

          const data = await apiRequest('/users/export-data');
          
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `cosparq-data-${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          showToast('Data exported successfully');
        } catch (error) {
          showToast('Failed to export data', 'error');
        } finally {
          exportDataBtn.disabled = false;
          exportDataBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export All Data
          `;
        }
      });
    }
  }

  // ============================================
  // BILLING
  // ============================================

  function initBilling() {
    const manageBillingBtn = document.getElementById('manageBillingBtn');
    
    if (manageBillingBtn) {
      manageBillingBtn.addEventListener('click', async () => {
        try {
          manageBillingBtn.disabled = true;
          manageBillingBtn.textContent = 'Loading...';

          const response = await apiRequest('/payments/create-portal-session', {
            method: 'POST'
          });

          if (response?.url) {
            window.location.href = response.url;
          } else {
            showToast('Unable to open billing portal', 'error');
          }
        } catch (error) {
          showToast(error.message || 'Failed to open billing portal', 'error');
        } finally {
          manageBillingBtn.disabled = false;
          manageBillingBtn.textContent = 'Manage Billing';
        }
      });
    }
  }

  // ============================================
  // LOGOUT & ACCOUNT DELETION
  // ============================================

  function initLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutAllBtn = document.getElementById('logoutAllBtn');

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/auth.html';
      });
    }

    if (logoutAllBtn) {
      logoutAllBtn.addEventListener('click', async () => {
        showConfirmModal(
          'Log Out All Devices',
          'This will log you out of all devices. You will need to log in again on each device.',
          async () => {
            try {
              await apiRequest('/users/logout-all', { method: 'POST' });
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              window.location.href = '/auth.html';
            } catch (error) {
              showToast('Failed to log out all devices', 'error');
            }
          }
        );
      });
    }
  }

  function initDangerZone() {
    const deleteProjectsBtn = document.getElementById('deleteProjectsBtn');
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');

    if (deleteProjectsBtn) {
      deleteProjectsBtn.addEventListener('click', () => {
        showConfirmModal(
          'Delete All Projects',
          'This will permanently delete all your projects and associated data. This action cannot be undone.',
          async () => {
            try {
              await apiRequest('/users/delete-projects', { method: 'DELETE' });
              showToast('All projects deleted');
              loadUserData();
            } catch (error) {
              showToast('Failed to delete projects', 'error');
            }
          },
          true,
          'DELETE'
        );
      });
    }

    if (deleteAccountBtn) {
      deleteAccountBtn.addEventListener('click', () => {
        showConfirmModal(
          'Delete Account',
          'This will permanently delete your account and all associated data. This action cannot be undone. Type DELETE to confirm.',
          async () => {
            try {
              await apiRequest('/users/delete-account', { method: 'DELETE' });
              localStorage.clear();
              window.location.href = '/auth.html';
            } catch (error) {
              showToast('Failed to delete account', 'error');
            }
          },
          true,
          'DELETE'
        );
      });
    }
  }

  // ============================================
  // MODAL
  // ============================================

  function showConfirmModal(title, message, onConfirm, requireInput = false, inputText = '') {
    const modal = document.getElementById('confirmModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalInputWrapper = document.getElementById('modalInputWrapper');
    const modalInput = document.getElementById('modalInput');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');
    const modalCancelBtn = document.getElementById('modalCancelBtn');
    const modalCloseBtn = document.getElementById('modalCloseBtn');

    if (!modal) return;

    modalTitle.textContent = title;
    modalMessage.textContent = message;

    if (requireInput) {
      modalInputWrapper.style.display = 'block';
      modalInput.value = '';
      modalInput.placeholder = `Type ${inputText} to confirm`;
      modalConfirmBtn.disabled = true;

      modalInput.oninput = () => {
        modalConfirmBtn.disabled = modalInput.value !== inputText;
      };
    } else {
      modalInputWrapper.style.display = 'none';
      modalConfirmBtn.disabled = false;
    }

    modal.classList.add('active');

    const closeModal = () => {
      modal.classList.remove('active');
      modalInput.oninput = null;
    };

    modalCancelBtn.onclick = closeModal;
    modalCloseBtn.onclick = closeModal;

    modalConfirmBtn.onclick = async () => {
      if (requireInput && modalInput.value !== inputText) return;
      closeModal();
      await onConfirm();
    };

    // Close on backdrop click
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };

    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  // ============================================
  // INITIALIZE
  // ============================================

  function init() {
    initTabs();
    loadUserData();
    initProfileActions();
    initPasswordActions();
    initNotifications();
    initPreferences();
    initBilling();
    initLogout();
    initDangerZone();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
