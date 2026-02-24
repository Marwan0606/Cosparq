const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const { syncIdeaWithAI, generateDnaSummary } = require('../controllers/ideaHub');

// Sync idea with AI (analyzes conversations and updates)
router.post('/sync', authenticateToken, syncIdeaWithAI);

// Generate DNA summary from all sections
router.post('/generate-summary', authenticateToken, generateDnaSummary);

module.exports = router;
