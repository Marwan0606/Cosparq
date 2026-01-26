const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const { syncIdeaWithAI } = require('../controllers/ideaHub');

// Sync idea with AI (analyzes conversations and updates)
router.post('/sync', authenticateToken, syncIdeaWithAI);

module.exports = router;
