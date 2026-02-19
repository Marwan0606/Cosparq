// Auth sliding-panel controller
const wrapper    = document.querySelector('.auth-wrapper');
const loginPanel = document.querySelector('.form-panel--login');
const signupPanel = document.querySelector('.form-panel--signup');
const switchLinks = document.querySelectorAll('.switch-link');

// Password-show toggles
document.querySelectorAll('.toggle-pw').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.previousElementSibling;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
  });
});

function show(view) {
  if (view === 'signup') {
    wrapper.classList.add('signup-mode');
    loginPanel.classList.remove('active');
    signupPanel.classList.add('active');
  } else {
    wrapper.classList.remove('signup-mode');
    signupPanel.classList.remove('active');
    loginPanel.classList.add('active');
  }
}

// Overlay toggle tabs
const overlayTabs = document.querySelectorAll('.overlay-tab');

// Wire up all switch links (inside forms and overlay)
switchLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    show(link.dataset.target);
  });
});

// Wire up overlay toggle tabs
overlayTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    show(tab.dataset.target);
  });
});

// Initialize — login view
show('login');
