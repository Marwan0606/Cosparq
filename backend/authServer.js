require('dotenv').config()

const express = require('express')
const app = express()

const jwt = require('jsonwebtoken')
const crypto = require('crypto')

const bcrypt = require('bcrypt');

const database = require('./db/connect.js')


const User   = require('./models/Users.js');

const RefreshTokenModel = require('./models/Refresh-Tokens.js')

// Email Service
const { sendWelcomeEmail, sendPasswordResetEmail } = require('./services/emailService')

app.use(express.json())

const cors = require('cors')
const cookieParser = require('cookie-parser');

app
.use(cors({
  origin: 'http://localhost:5004',
  credentials: true
  }))
.use(cookieParser());



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



app.post('/register', async (req, res) => {
  try {
    const email = req.body.email
    const name = req.body.name
    const hashedPassword = await bcrypt.hash(req.body.password, 10)
    //console.log(salt)
    //console.log(hashedPassword)
    const user = await User.create({email, name, password: hashedPassword});
    
    // Send welcome email (non-blocking)
    sendWelcomeEmail(email, name).catch(err => {
      console.error('Failed to send welcome email:', err);
    });
    
    res.status(201).json(user)
  } catch (error) {
    console.log(error)
    res.status(500).json('Email already linked to an existing account')
  }
})



app.post('/login', async (req, res)=>{
  try {
    const {email, password} = req.body
    const user1 = await User.findOne({email: email})

    if (!user1) {
      return res.status(400).json({msg: 'Cannot find user'})
    }

    const match = await bcrypt.compare(password, user1.password);
    if (!match) {
      return res.status(403).json({ msg: 'Incorrect Password' });
    }


    const user = {userId: user1._id}
    const accessToken = generateAccessToken(user)
    const refreshToken = jwt.sign(user, process.env.REFRESH_TOKEN_SECRET)

    const deleteOldToken = await RefreshTokenModel.findOneAndDelete({userId: user1._id})
    await RefreshTokenModel.create({refreshToken, userId: user1._id})

    res
      .cookie('token', accessToken, {           
        httpOnly: true,
        sameSite: 'lax',
        secure:   false,           // set to true in prod + HTTPS 
        maxAge:   15*60*1000
      })
      .cookie('jid', refreshToken, {          
        httpOnly: true,
        sameSite: 'lax',
        secure:   false,
        maxAge:   7*24*60*60*1000
      })
      .json({ ok: true });

  } catch (error) {
    console.log(error)
  }
})




function generateAccessToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '15m'})
}


/**
 * Forgot Password - Request a password reset email
 */
app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ msg: 'Email is required' });
    }
    
    const user = await User.findOne({ email: email.toLowerCase() });
    
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
app.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ msg: 'Token and password are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ msg: 'Password must be at least 6 characters' });
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