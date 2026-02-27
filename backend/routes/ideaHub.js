const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const { syncIdeaWithAI, generateDnaSummary, interviewChat, resyncWithAI } = require('../controllers/ideaHub');

// Sync idea with AI (analyzes conversations and updates)
router.post('/sync', authenticateToken, syncIdeaWithAI);

// Generate DNA summary from all sections
router.post('/generate-summary', authenticateToken, generateDnaSummary);

// AI co-founder interview for new ideas
router.post('/interview', authenticateToken, interviewChat);

// Resync DNA board from recent chats and meetings
router.post('/resync', authenticateToken, resyncWithAI);

module.exports = router;
