/**
 * Trend Map Routes
 * API endpoints for the AI Market Trend Map feature
 */

const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const {
  getMapData,
  getCategoryDetail,
  getTopPainPoints,
  getTrendingTopics,
  getStartupSuggestions,
  searchTrends,
  getTrendStats,
  triggerPipeline,
  chatAboutTrends,
  exportRawData
} = require('../controllers/trends');

// Public routes (for sharing/embedding)
// Most routes require authentication for full data

// Get full map data
router.get('/map', authenticateToken, getMapData);

// Get details for a specific category
router.get('/category/:category', authenticateToken, getCategoryDetail);

// Get top pain points (problems to solve)
router.get('/pain-points', authenticateToken, getTopPainPoints);

// Get trending topics
router.get('/topics', authenticateToken, getTrendingTopics);

// Get AI-powered startup suggestions
router.get('/suggestions', authenticateToken, getStartupSuggestions);

// Search within trends
router.get('/search', authenticateToken, searchTrends);

// Get overall stats
router.get('/stats', authenticateToken, getTrendStats);

// Admin: manually trigger pipeline
router.post('/run', authenticateToken, triggerPipeline);

// Chat about trends
router.post('/chat', authenticateToken, chatAboutTrends);

// Export raw data
router.get('/export', authenticateToken, exportRawData);

module.exports = router;
