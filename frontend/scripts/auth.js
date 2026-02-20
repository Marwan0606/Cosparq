let user = ''
let userId = ''

// ===== OTP State =====
let confirmationResult = null;  // Firebase confirmation result
let recaptchaVerifier  = null;
let signupData         = {};    // cached form data during OTP step
let otpAttempts        = 0;
const MAX_OTP_ATTEMPTS = 5;

// DOM refs for OTP flow
const stepInfo    = document.querySelector('.signup-step--info');
const stepOtp     = document.querySelector('.signup-step--otp');
const otpDigits   = document.querySelectorAll('.otp-digit');
const otpError    = document.querySelector('.js-otp-error');
const otpPhoneEl  = document.querySelector('.js-otp-phone-display');

// ===== Initialize invisible reCAPTCHA =====
function initRecaptcha() {
  // Always clear and recreate to avoid stale tokens
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear(); } catch(e) {}
  }
  recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
    'size': 'invisible',
    'callback': () => { /* solved */ },
    'expired-callback': () => {
      try { recaptchaVerifier.clear(); } catch(e) {}
      recaptchaVerifier = null;
    }
  });
}

// ===== OTP Digit Inputs — auto-advance & paste support =====
otpDigits.forEach((input, i) => {
  input.addEventListener('input', (e) => {
    const val = e.target.value.replace(/\D/g, '');
    e.target.value = val.slice(0, 1);
    if (val && i < otpDigits.length - 1) otpDigits[i + 1].focus();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !input.value && i > 0) {
      otpDigits[i - 1].focus();
    }
  });
  // Handle paste of full code
  input.addEventListener('paste', (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    pasted.split('').forEach((ch, idx) => {
      if (otpDigits[idx]) otpDigits[idx].value = ch;
    });
    if (pasted.length > 0) otpDigits[Math.min(pasted.length, 5)].focus();
  });
});

function getOtpValue() {
  return Array.from(otpDigits).map(d => d.value).join('');
}

// ===== Show / Hide OTP Step =====
function showOtpStep(phone) {
  otpPhoneEl.textContent = phone;
  stepInfo.classList.remove('active');
  stepInfo.style.display = 'none';
  stepOtp.classList.add('active');
  stepOtp.style.display = 'block';
  otpDigits[0].focus();
}

function hideOtpStep() {
  stepOtp.classList.remove('active');
  stepOtp.style.display = 'none';
  stepInfo.classList.add('active');
  stepInfo.style.display = '';
  otpError.textContent = '';
  otpDigits.forEach(d => d.value = '');
}

// ===== Send OTP =====
async function sendOtp(phoneNumber) {
  initRecaptcha();
  try {
    // Render reCAPTCHA first, then send OTP
    await recaptchaVerifier.render();
    confirmationResult = await firebaseAuth.signInWithPhoneNumber(phoneNumber, recaptchaVerifier);
    otpAttempts = 0; // Reset attempts on new OTP
    showOtpStep(phoneNumber);
  } catch (err) {
    console.error('OTP send error:', err);
    // Fully reset recaptcha on failure
    try { recaptchaVerifier.clear(); } catch(e) {}
    recaptchaVerifier = null;
    let msg = 'Failed to send verification code. ';
    if (err.code === 'auth/invalid-phone-number') msg += 'Please enter a valid phone number with country code.';
    else if (err.code === 'auth/too-many-requests') msg += 'Too many attempts. Please try again later.';
    else if (err.code === 'auth/invalid-app-credential') msg += 'Verification system error. Please refresh the page and try again.';
    else msg += 'Please check the phone number and try again.';
    document.querySelector('.js-error-message').innerHTML = msg;
  }
}

// ===== Verify OTP & Register =====
async function verifyOtpAndRegister() {
  const code = getOtpValue();
  if (code.length !== 6) {
    otpError.textContent = 'Please enter the full 6-digit code.';
    return;
  }

  // Rate limit: block after MAX_OTP_ATTEMPTS failed tries
  if (otpAttempts >= MAX_OTP_ATTEMPTS) {
    otpError.textContent = `Too many failed attempts. Please request a new code.`;
    return;
  }

  const verifyBtn = document.querySelector('.js-verify-otp');
  verifyBtn.disabled = true;
  verifyBtn.textContent = 'Verifying...';

  try {
    // Verify the OTP with Firebase
    await confirmationResult.confirm(code);

    // OTP verified — now register with our backend
    const { name, email, password, phoneNumber } = signupData;
    try {
      await axios.post('http://localhost:4004/register', { name, email, password, phoneNumber });
    } catch (error) {
      let errorMessage = 'Email is already linked to an existing account';
      if (error.response && error.response.data && error.response.data.msg) {
        errorMessage = error.response.data.msg;
      }
      otpError.textContent = errorMessage;
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Verify & Create Account';
      return;
    }

    // Sign out of Firebase Auth (we only used it for phone verification)
    await firebaseAuth.signOut();

    // Redirect to login
    window.location.href = 'auth.html';
    
  } catch (error) {
    console.error('OTP verify error:', error);
    otpAttempts++;
    const remaining = MAX_OTP_ATTEMPTS - otpAttempts;

    if (error.code === 'auth/invalid-verification-code') {
      if (remaining <= 0) {
        otpError.textContent = 'Too many failed attempts. Please request a new code.';
        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Locked';
        return;
      }
      otpError.textContent = `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`;
    } else if (error.code === 'auth/code-expired') {
      otpError.textContent = 'Code expired. Please request a new one.';
    } else {
      otpError.textContent = 'Verification failed. Please try again.';
    }
    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Verify & Create Account';
  }
}

// ===== Create User (Step 1 → Send OTP) =====
const createUser = async () => {
  const name     = document.querySelector('.js-signup-name').value.trim();
  const email    = document.querySelector('.js-signup-email').value.trim();
  const password = document.querySelector('.js-signup-password').value;
  const phone    = document.querySelector('.js-signup-phone').value.trim();

  // Basic validation
  if (!phone) {
    document.querySelector('.js-error-message').innerHTML = 'Phone number is required.';
    return;
  }

  // Normalize: ensure it starts with +
  let phoneNumber = phone.replace(/[\s\-\(\)]/g, '');
  if (!phoneNumber.startsWith('+')) {
    document.querySelector('.js-error-message').innerHTML = 'Please include your country code (e.g. +1 for US).';
    return;
  }

  // Cache signup data for after OTP verification
  signupData = { name, email, password, phoneNumber };
  document.querySelector('.js-error-message').innerHTML = '';

  // Send OTP
  await sendOtp(phoneNumber);
};

// ===== Login (unchanged) =====
const login = async () => {
  try {
    const email    = document.querySelector('.js-login-email').value;
    const password = document.querySelector('.js-login-password').value;

    let user = await axios.post('http://localhost:4004/login', { email, password }, { withCredentials: true });

    const { accessToken, refreshToken } = user.data;

    localStorage.setItem('accessToken',  accessToken);
    localStorage.setItem('refreshToken', refreshToken);

    window.location.href = 'dashboard.html';
    
  } catch (error) {
    const problem = error.response.data.msg;
    document.querySelector('.js-problem').innerHTML = problem;
  }
};

// ===== Event Listeners =====
document.querySelector('#signup-form').addEventListener('submit', (e) => {
  e.preventDefault();
  createUser();
});

document.querySelector('#login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  login();
});

// Verify OTP button
document.querySelector('.js-verify-otp').addEventListener('click', () => {
  verifyOtpAndRegister();
});

// Resend OTP
document.querySelector('.js-resend-otp').addEventListener('click', (e) => {
  e.preventDefault();
  otpError.textContent = '';
  recaptchaVerifier = null; // reset so a new one is created
  sendOtp(signupData.phoneNumber);
});

// Back from OTP step
document.querySelector('.js-otp-back').addEventListener('click', (e) => {
  e.preventDefault();
  hideOtpStep();
});