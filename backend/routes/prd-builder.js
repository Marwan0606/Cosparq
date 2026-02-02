const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const { generatePRD, generatePrompt, getPlatforms, getHistory } = require('../controllers/prdBuilder');

// Get available platforms and prompt types
router.get('/platforms', authenticateToken, getPlatforms);

// Get PRD and prompt history for an idea
router.get('/history/:ideaId', authenticateToken, getHistory);

// Generate PRD
router.post('/generate-prd', authenticateToken, generatePRD);

// Generate AI coding prompt
router.post('/generate-prompt', authenticateToken, generatePrompt);

module.exports = router;
