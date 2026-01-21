const express = require('express')
const router = express.Router();

const {
  //createUser, 
  //login,
  getUser,
  getAllUsersEmail,
  getApiUsage,
  getApiUsageSummary
} = require('../controllers/users')


//router.post('/register', createUser)

//router.post('/login', login)

// API usage tracking endpoints
router.get('/api-usage', getApiUsage)
router.get('/api-usage/summary', getApiUsageSummary)

router.get('/:id', getUser)

router.get('/', getAllUsersEmail)

module.exports = router