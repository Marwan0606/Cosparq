const User = require('../models/Users.js')
const { get } = require('../routes/gpt-responses.js')
const { getUserApiStats } = require('../services/apiUsageTracker')
const { syncSubscriptionFromStripe } = require('../services/subscriptionService')
const bcrypt = require('bcrypt')

/*
const createUser = async (req, res) => {
  try {
    const user = await User.create(req.body);
    return res.status(201).json({ user });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.email) {
      return res.status(409).json({ msg: 'Email already exists' });
    }
    return res.status(500).json({ msg: error.message || 'Server error' });
  }
};
*/

/*
const login = async (req,res)=>{
  try {
    const {email, password} = req.body
    user = await User.findOne({email: email})

    if (!user) {
      return res.status(404).json({msg: "user not found"})
    }

    if (user.password !== password) {
      return res.status(404).json({msg: "Invalid credentials"})
    }

    res.status(200).json({user})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}
*/


const getUser = async (req, res) => {
  try {
    const id = req.params.id
    const userID = id
    const user = await User.findOne({_id: userID})

    if (!user) {
      return res.status(404).json({msg: `No task with id: ${userID}`})
    }
    
    res.status(200).json({user})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const getAllUsersEmail = async (req, res) => {
  try {
    const users = await User.find({}, 'email'); // only return email field
    const emails = users.map(user => user.email); // make it an array of emails
    res.status(200).json({ emails });
  } catch (error) {
    res.status(500).json({ msg: error.message || error });
  }
};

/**
 * Get API usage statistics for the current user
 */
const getApiUsage = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }
    
    const stats = await getUserApiStats(userId);
    
    if (!stats) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    res.status(200).json({ stats });
  } catch (error) {
    console.error('Error getting API usage:', error);
    res.status(500).json({ msg: error.message || error });
  }
};

/**
 * Get API usage summary (just totals) for the current user
 */
const getApiUsageSummary = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }
    
    const user = await User.findById(userId).select('totalApiRequests totalApiCost');
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    res.status(200).json({ 
      totalRequests: user.totalApiRequests || 0,
      totalCost: user.totalApiCost || 0
    });
  } catch (error) {
    console.error('Error getting API usage summary:', error);
    res.status(500).json({ msg: error.message || error });
  }
};

/**
 * Get current user's profile
 * Automatically syncs subscription from Stripe if cache is stale
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }
    
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Sync subscription from Stripe if cache is stale (hybrid approach)
    // This ensures subscription data is always accurate
    let subscriptionData = {
      plan: user.subscriptionPlan || 'free',
      status: user.subscriptionStatus,
    };

    if (user.stripeCustomerId) {
      try {
        const syncResult = await syncSubscriptionFromStripe(user);
        subscriptionData = {
          plan: syncResult.plan,
          status: syncResult.status,
          periodEnd: syncResult.periodEnd,
          source: syncResult.source,
        };
        
        if (syncResult.changed) {
          console.log(`📊 Profile load triggered subscription sync for ${user.email}`);
        }
      } catch (syncError) {
        console.error('Subscription sync error during profile load:', syncError);
        // Continue with cached data on error
      }
    }
    
    res.status(200).json({ 
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName || user.name,
        createdAt: user.createdAt,
        subscriptionPlan: subscriptionData.plan,
        subscriptionStatus: subscriptionData.status,
        subscriptionPeriodEnd: subscriptionData.periodEnd,
        apiUsage: {
          totalCost: user.totalApiCost || 0,
          totalRequests: user.totalApiRequests || 0
        },
        projectCount: user.projectCount || 0
      }
    });
  } catch (error) {
    console.error('Error getting profile:', error);
    res.status(500).json({ msg: error.message || error });
  }
};

/**
 * Update user profile
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { displayName } = req.body;
    
    if (!userId) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { displayName },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    res.status(200).json({ msg: 'Profile updated', user });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ msg: error.message || error });
  }
};

/**
 * Change user password
 */
const changePassword = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { currentPassword, newPassword } = req.body;
    
    if (!userId) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ msg: 'Current and new password required' });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ msg: 'Password must be at least 8 characters' });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Current password is incorrect' });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    user.password = hashedPassword;
    await user.save();
    
    res.status(200).json({ msg: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ msg: error.message || error });
  }
};

/**
 * Get subscription status
 */
const getSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }
    
    const user = await User.findById(userId).select(
      'subscriptionPlan subscriptionStatus subscriptionPeriodEnd stripeSubscriptionId'
    );
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    res.status(200).json({
      plan: user.subscriptionPlan || 'free',
      status: user.subscriptionStatus,
      periodEnd: user.subscriptionPeriodEnd,
      hasActiveSubscription: ['active', 'trialing'].includes(user.subscriptionStatus)
    });
  } catch (error) {
    console.error('Error getting subscription status:', error);
    res.status(500).json({ msg: error.message || error });
  }
};

/**
 * Export user data (GDPR compliance)
 */
const exportData = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }
    
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    // Collect all user data from various collections
    const IdeaResponse = require('../models/Idea-pitch-responses');
    const ChatResponse = require('../models/Chat-response');
    const CodeResponse = require('../models/Code-response');
    const MarketResponse = require('../models/Market-responses');
    const ScoreboardResponse = require('../models/Scoreboard-responses');
    
    const [ideas, chats, code, market, scoreboard] = await Promise.all([
      IdeaResponse.find({ userId }).lean(),
      ChatResponse.find({ userId }).lean(),
      CodeResponse.find({ userId }).lean(),
      MarketResponse.find({ userId }).lean(),
      ScoreboardResponse.find({ userId }).lean()
    ]);
    
    const exportData = {
      user: user.toObject(),
      ideas,
      chats,
      code,
      market,
      scoreboard,
      exportedAt: new Date().toISOString()
    };
    
    res.status(200).json(exportData);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ msg: error.message || error });
  }
};

/**
 * Delete all user projects
 */
const deleteProjects = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }
    
    const IdeaResponse = require('../models/Idea-pitch-responses');
    const ChatResponse = require('../models/Chat-response');
    const CodeResponse = require('../models/Code-response');
    const MarketResponse = require('../models/Market-responses');
    const ScoreboardResponse = require('../models/Scoreboard-responses');
    const ActionResponse = require('../models/Action-response');
    
    await Promise.all([
      IdeaResponse.deleteMany({ userId }),
      ChatResponse.deleteMany({ userId }),
      CodeResponse.deleteMany({ userId }),
      MarketResponse.deleteMany({ userId }),
      ScoreboardResponse.deleteMany({ userId }),
      ActionResponse.deleteMany({ userId })
    ]);
    
    // Reset project count
    await User.findByIdAndUpdate(userId, { projectCount: 0 });
    
    res.status(200).json({ msg: 'All projects deleted' });
  } catch (error) {
    console.error('Error deleting projects:', error);
    res.status(500).json({ msg: error.message || error });
  }
};

/**
 * Delete user account
 */
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    // Cancel Stripe subscription if exists
    if (user.stripeSubscriptionId) {
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        await stripe.subscriptions.cancel(user.stripeSubscriptionId);
      } catch (stripeError) {
        console.error('Error canceling subscription:', stripeError);
        // Continue with deletion even if subscription cancel fails
      }
    }
    
    // Delete all user data
    const IdeaResponse = require('../models/Idea-pitch-responses');
    const ChatResponse = require('../models/Chat-response');
    const CodeResponse = require('../models/Code-response');
    const MarketResponse = require('../models/Market-responses');
    const ScoreboardResponse = require('../models/Scoreboard-responses');
    const ActionResponse = require('../models/Action-response');
    const RawChatResponse = require('../models/RawChat-responses');
    
    await Promise.all([
      IdeaResponse.deleteMany({ userId }),
      ChatResponse.deleteMany({ userId }),
      CodeResponse.deleteMany({ userId }),
      MarketResponse.deleteMany({ userId }),
      ScoreboardResponse.deleteMany({ userId }),
      ActionResponse.deleteMany({ userId }),
      RawChatResponse.deleteMany({ userId })
    ]);
    
    // Delete the user
    await User.findByIdAndDelete(userId);
    
    res.status(200).json({ msg: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ msg: error.message || error });
  }
};

/**
 * Logout from all devices (invalidate all refresh tokens)
 */
const logoutAll = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }
    
    // Delete all refresh tokens for this user
    const RefreshToken = require('../models/Refresh-Tokens');
    await RefreshToken.deleteMany({ userId });
    
    res.status(200).json({ msg: 'Logged out from all devices' });
  } catch (error) {
    console.error('Error logging out all devices:', error);
    res.status(500).json({ msg: error.message || error });
  }
};

/**
 * Get notification preferences
 */
const getNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }
    
    const user = await User.findById(userId).select('notificationPreferences');
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    // Return preferences with defaults if not set
    const preferences = {
      productUpdates: user.notificationPreferences?.productUpdates ?? true,
      usageAlerts: user.notificationPreferences?.usageAlerts ?? true,
      weeklySummary: user.notificationPreferences?.weeklySummary ?? false,
      marketing: user.notificationPreferences?.marketing ?? false,
    };
    
    res.status(200).json({ preferences });
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    res.status(500).json({ msg: error.message || error });
  }
};

/**
 * Update notification preferences
 */
const updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { productUpdates, usageAlerts, weeklySummary, marketing } = req.body;
    
    if (!userId) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    // Update notification preferences
    user.notificationPreferences = {
      productUpdates: productUpdates ?? user.notificationPreferences?.productUpdates ?? true,
      usageAlerts: usageAlerts ?? user.notificationPreferences?.usageAlerts ?? true,
      weeklySummary: weeklySummary ?? user.notificationPreferences?.weeklySummary ?? false,
      marketing: marketing ?? user.notificationPreferences?.marketing ?? false,
    };
    
    await user.save();
    
    res.status(200).json({ 
      msg: 'Notification preferences updated',
      preferences: user.notificationPreferences
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ msg: error.message || error });
  }
};

module.exports = {
  //createUser,
  //login,
  getUser,
  getAllUsersEmail,
  getApiUsage,
  getApiUsageSummary,
  getProfile,
  updateProfile,
  changePassword,
  getSubscriptionStatus,
  exportData,
  deleteProjects,
  deleteAccount,
  logoutAll,
  getNotificationPreferences,
  updateNotificationPreferences
}