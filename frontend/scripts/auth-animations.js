// Cache elements
const tabs      = document.querySelectorAll('.tab-btn');
const forms     = {
  login:  document.getElementById('login-form'),
  signup: document.getElementById('signup-form')
};
const switches = document.querySelectorAll('.switcher button');

// Show view
function show(view) {
  // Tabs
  tabs.forEach(t => t.classList.toggle('active', t.dataset.view === view));
  // Switch buttons
  switches.forEach(b => b.classList.toggle('active', b.dataset.target === view));
  // Forms
  forms.login.style.display  = view === 'login'  ? 'block' : 'none';
  forms.signup.style.display = view === 'signup' ? 'block' : 'none';
}

// Events
tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.view)));
switches.forEach(b => b.addEventListener('click', () => show(b.dataset.target)));

// Initialize
show('login');
