const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const {
  generateSuggestions,
  organizeIdeas,
  categorizeIdea,
  saveSession,
  getSession,
  getSessionByProject,
  getUserSessions,
  deleteSession
} = require('../controllers/brainstorm');

// AI Suggestions - Protected route
router.post('/suggest', authenticateToken, generateSuggestions);

// AI Organization - Protected route
router.post('/organize', authenticateToken, organizeIdeas);

// AI Categorization for single idea - Protected route
router.post('/categorize', authenticateToken, categorizeIdea);

// Session Management - All protected
router.post('/session', authenticateToken, saveSession);
router.get('/session/:id', authenticateToken, getSession);
router.get('/session/project/:projectId', authenticateToken, getSessionByProject);
router.get('/sessions', authenticateToken, getUserSessions);
router.delete('/session/:id', authenticateToken, deleteSession);

module.exports = router;
