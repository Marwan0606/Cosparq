const express = require('express')
const router = express.Router();

const {
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
  logoutAll
} = require('../controllers/users')


//router.post('/register', createUser)

//router.post('/login', login)

// Profile endpoints
router.get('/profile', getProfile)
router.put('/profile', updateProfile)

// Password management
router.post('/change-password', changePassword)

// Subscription status
router.get('/subscription-status', getSubscriptionStatus)

// Data export (GDPR)
router.get('/export-data', exportData)

// Danger zone actions
router.delete('/delete-projects', deleteProjects)
router.delete('/delete-account', deleteAccount)

// Session management
router.post('/logout-all', logoutAll)

// API usage tracking endpoints
router.get('/api-usage', getApiUsage)
router.get('/api-usage/summary', getApiUsageSummary)

router.get('/:id', getUser)

router.get('/', getAllUsersEmail)

module.exports = router