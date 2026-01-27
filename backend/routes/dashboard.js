const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const { getDashboardData, getDashboardAIInsights } = require('../controllers/dashboard');

// Get all dashboard data for an idea
router.get('/:ideaId', authenticateToken, getDashboardData);

// Get AI-generated greeting and insights
router.get('/:ideaId/insights', authenticateToken, getDashboardAIInsights);

module.exports = router;
