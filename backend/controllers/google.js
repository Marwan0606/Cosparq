const { google } = require('googleapis');
const Users = require('../models/Users');

// Google OAuth2 Configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5004/api/google/callback'
);

// Scopes for Gmail, Calendar, Slides, Forms, Sheets, and Drive access
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
];

// Generate auth URL for OAuth flow
const getAuthUrl = (req, res) => {
  try {
    // Store user ID in state for callback
    const state = Buffer.from(JSON.stringify({ 
      userId: req.user.userId 
    })).toString('base64');
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state,
      prompt: 'consent', // Force consent to get refresh token
    });
    
    // Redirect to Google OAuth
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).send('Failed to initiate Google authentication');
  }
};

// Handle OAuth callback
const handleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.send(`
        <script>
          window.opener.postMessage({ type: 'google-auth-error', error: 'No code received' }, '*');
          window.close();
        </script>
      `);
    }
    
    // Decode state to get user ID
    let userId;
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      userId = stateData.userId;
    } catch (e) {
      return res.send(`
        <script>
          window.opener.postMessage({ type: 'google-auth-error', error: 'Invalid state' }, '*');
          window.close();
        </script>
      `);
    }
    
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Get user email from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const googleEmail = userInfo.data.email;
    
    // Save tokens to user
    await Users.findByIdAndUpdate(userId, {
      googleTokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expiry_date),
        scope: tokens.scope,
        connectedAt: new Date(),
        email: googleEmail,
      }
    });
    
    // Close popup and notify parent window
    res.send(`
      <html>
        <body>
          <h2>Google Account Connected!</h2>
          <p>You can close this window.</p>
          <script>
            window.opener.postMessage({ type: 'google-auth-success' }, '*');
            setTimeout(() => window.close(), 1000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.send(`
      <script>
        window.opener.postMessage({ type: 'google-auth-error', error: '${error.message}' }, '*');
        window.close();
      </script>
    `);
  }
};

// Check if user has Google connected
const getStatus = async (req, res) => {
  try {
    const user = await Users.findById(req.user.userId).select('googleTokens');
    
    const connected = !!(
      user?.googleTokens?.refreshToken && 
      user?.googleTokens?.accessToken
    );
    
    res.json({
      connected,
      email: connected ? user.googleTokens.email : null,
      connectedAt: connected ? user.googleTokens.connectedAt : null,
    });
  } catch (error) {
    console.error('Error checking Google status:', error);
    res.status(500).json({ message: 'Failed to check connection status' });
  }
};

// Disconnect Google account
const disconnect = async (req, res) => {
  try {
    await Users.findByIdAndUpdate(req.user.userId, {
      googleTokens: {
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        scope: null,
        connectedAt: null,
        email: null,
      }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Google:', error);
    res.status(500).json({ message: 'Failed to disconnect Google account' });
  }
};

// Helper function to get authenticated client for a user
const getAuthenticatedClient = async (userId) => {
  const user = await Users.findById(userId).select('googleTokens');
  
  if (!user?.googleTokens?.refreshToken) {
    throw new Error('Google account not connected');
  }
  
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5004/api/google/callback'
  );
  
  client.setCredentials({
    access_token: user.googleTokens.accessToken,
    refresh_token: user.googleTokens.refreshToken,
    expiry_date: user.googleTokens.expiresAt?.getTime(),
  });
  
  // Check if token needs refresh
  if (user.googleTokens.expiresAt && new Date() >= user.googleTokens.expiresAt) {
    try {
      const { credentials } = await client.refreshAccessToken();
      
      // Update tokens in database
      await Users.findByIdAndUpdate(userId, {
        'googleTokens.accessToken': credentials.access_token,
        'googleTokens.expiresAt': new Date(credentials.expiry_date),
      });
      
      client.setCredentials(credentials);
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw new Error('Failed to refresh Google token. Please reconnect your account.');
    }
  }
  
  return client;
};

module.exports = {
  getAuthUrl,
  handleCallback,
  getStatus,
  disconnect,
  getAuthenticatedClient,
};
