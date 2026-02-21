require('dotenv').config()

const express = require('express')
const app = express()

const jwt = require('jsonwebtoken')
const crypto = require('crypto')

const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const database = require('./db/connect.js')
const { ensureString, isValidEmail, isStrongPassword, isValidPhone, sanitizeString, maxLength, escapeHtml } = require('./middleware/sanitize');

const User   = require('./models/Users.js');

const RefreshTokenModel = require('./models/Refresh-Tokens.js')

// Email Service
const { sendWelcomeEmail, sendPasswordResetEmail } = require('./services/emailService')

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '100kb' }));

const cors = require('cors')
const cookieParser = require('cookie-parser');

app
.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5004',
  credentials: true
  }))
.use(cookieParser());

// Rate limiters for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,                   // 15 attempts per window
  message: { msg: 'Too many attempts, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                    // 5 attempts per hour
  message: { msg: 'Too many reset attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});



app.post('/token', async (req, res)=>{
  const refreshToken = req.cookies.jid;
  if (refreshToken === null) return res.sendStatus(401)

  const exists = await findRefreshToken(refreshToken)
  if (!exists) return res.status(403).json('Please Log In Again');

  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user)=>{
    if (err) return res.sendStatus(403)
    const accessToken = generateAccessToken({userId: user.userId})
    // Reset the HTTP-only “token” cookie
    res
      .cookie('token', accessToken, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge:   15 * 60 * 1000
      })
      .json({ ok: true });
  });
});

async function findRefreshToken(refreshToken) {
  const doc = await RefreshTokenModel.findOne({refreshToken})
  return !!doc
}


app.delete('/logout', async (req, res)=>{
  const refreshToken = req.cookies.jid;
  if (refreshToken) {
    await RefreshTokenModel.findOneAndDelete({ refreshToken });
  }
  res
    .clearCookie('jid',   { path: '/token' })
    .clearCookie('token')
    .sendStatus(204);
})



app.post('/register', authLimiter, async (req, res) => {
  try {
    const email = ensureString(req.body.email, '').toLowerCase().trim();
    const name = sanitizeString(maxLength(ensureString(req.body.name), 100));
    const password = ensureString(req.body.password);
    const phoneNumber = ensureString(req.body.phoneNumber);

    // Validate email
    if (!isValidEmail(email)) {
      return res.status(400).json({ msg: 'Please provide a valid email address' });
    }

    // Validate name
    if (!name || name.length < 1) {
      return res.status(400).json({ msg: 'Name is required' });
    }

    // Validate password strength
    if (!isStrongPassword(password)) {
      return res.status(400).json({ msg: 'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number' });
    }

    // Validate phone number is provided
    if (!phoneNumber) {
      return res.status(400).json({ msg: 'Phone number is required' })
    }

    // Validate phone number format
    if (!isValidPhone(phoneNumber)) {
      return res.status(400).json({ msg: 'Please provide a valid phone number' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Normalize phone number (strip spaces, dashes, parens)
    const normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '')

    // Check if phone number is already in use
    const existingPhone = await User.findOne({ phoneNumber: normalizedPhone })
    if (existingPhone) {
      return res.status(409).json({ msg: 'Phone number is already linked to an existing account' })
    }

    const user = await User.create({email, name, password: hashedPassword, phoneNumber: normalizedPhone});
    
    // Send welcome email (non-blocking)
    sendWelcomeEmail(email, name).catch(err => {
      console.error('Failed to send welcome email:', err);
    });
    
    res.status(201).json(user)
  } catch (error) {
    console.log(error)
    if (error.code === 11000) {
      // Duplicate key error — figure out which field
      const field = Object.keys(error.keyPattern)[0]
      if (field === 'phoneNumber') {
        return res.status(409).json({ msg: 'Phone number is already linked to an existing account' })
      }
      return res.status(409).json({ msg: 'Email already linked to an existing account' })
    }
    res.status(500).json({ msg: 'Server error during registration' })
  }
})



app.post('/login', authLimiter, async (req, res)=>{
  try {
    const email = ensureString(req.body.email, '').toLowerCase().trim();
    const password = ensureString(req.body.password);

    if (!email || !password) {
      return res.status(400).json({ msg: 'Email and password are required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ msg: 'Invalid email format' });
    }

    const user1 = await User.findOne({ email: email })

    if (!user1) {
      return res.status(400).json({msg: 'Invalid email or password'})
    }

    const match = await bcrypt.compare(password, user1.password);
    if (!match) {
      return res.status(403).json({ msg: 'Invalid email or password' });
    }


    const user = {userId: user1._id}
    const accessToken = generateAccessToken(user)
    const refreshToken = jwt.sign(user, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' })

    const deleteOldToken = await RefreshTokenModel.findOneAndDelete({userId: user1._id})
    await RefreshTokenModel.create({refreshToken, userId: user1._id})

    res
      .cookie('token', accessToken, {           
        httpOnly: true,
        sameSite: 'strict',
        secure:   process.env.NODE_ENV === 'production',
        maxAge:   15*60*1000
      })
      .cookie('jid', refreshToken, {          
        httpOnly: true,
        sameSite: 'strict',
        secure:   process.env.NODE_ENV === 'production',
        maxAge:   7*24*60*60*1000
      })
      .json({ ok: true });

  } catch (error) {
    console.log(error)
    res.status(500).json({ msg: 'Server error' });
  }
})




function generateAccessToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '15m'})
}


/**
 * Forgot Password - Request a password reset email
 */
app.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const email = ensureString(req.body.email, '').toLowerCase().trim();
    
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ msg: 'Please provide a valid email address' });
    }
    
    const user = await User.findOne({ email });
    
    // Always return success to prevent email enumeration attacks
    if (!user) {
      return res.status(200).json({ msg: 'If an account exists, a reset email has been sent.' });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // Save token to user (expires in 1 hour)
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();
    
    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${resetToken}`;
    
    // Send email
    await sendPasswordResetEmail(user.email, user.name, resetUrl);
    
    res.status(200).json({ msg: 'If an account exists, a reset email has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ msg: 'Error processing request' });
  }
});


/**
 * Reset Password - Set new password using reset token
 */
app.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const token = ensureString(req.body.token);
    const password = ensureString(req.body.password);
    
    if (!token || !password) {
      return res.status(400).json({ msg: 'Token and password are required' });
    }
    
    if (!isStrongPassword(password)) {
      return res.status(400).json({ msg: 'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number' });
    }
    
    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    // Find user with valid token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ msg: 'Invalid or expired reset token' });
    }
    
    // Update password
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();
    
    // Invalidate all refresh tokens for this user (security)
    await RefreshTokenModel.deleteMany({ userId: user._id });
    
    res.status(200).json({ msg: 'Password reset successful. Please log in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ msg: 'Error resetting password' });
  }
});


const port = process.env.PORT || 4004

const start = async ()=>{
  try {
    await database(process.env.MONGO_URI)
    app.listen(port, console.log(`server is listening on port ${port}...`))
  } catch (error) {
    console.log(error)
  }
}

start();



//TO CREATE SECRET ACCESS TOKEN JUST OPEN A NEW TERMINAL AND TYPE NODE AND ENTER THEN TYPE: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"