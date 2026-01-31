const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const { checkApiLimit } = require('../middleware/checkApiLimit');

const {
  getAuthUrl,
  handleCallback,
  getStatus,
  disconnect,
} = require('../controllers/google');

const {
  generateEmail,
  sendEmail,
  suggestEvents,
  createEvent,
  generateContent,
  getHistory,
  logAction,
  aiComposeEmail,
  aiComposeEvent,
  aiOrganizeCalendar,
  createMultipleEvents,
  aiGenerateSlides,
  createGoogleSlides,
  aiGenerateForm,
  createGoogleForm,
  aiGenerateSheet,
  createGoogleSheet,
} = require('../controllers/actions');

// ============== GOOGLE OAUTH ROUTES ==============

// Start OAuth flow (requires auth to get user ID)
router.get('/google/auth', authenticateToken, getAuthUrl);

// OAuth callback (no auth - called by Google)
router.get('/google/callback', handleCallback);

// Check Google connection status
router.get('/google/status', authenticateToken, getStatus);

// Disconnect Google account
router.post('/google/disconnect', authenticateToken, disconnect);

// ============== ACTION ROUTES ==============

// Email actions
router.post('/actions/generate-email', authenticateToken, checkApiLimit, generateEmail);
router.post('/actions/send-email', authenticateToken, sendEmail);
router.post('/actions/ai-compose-email', authenticateToken, checkApiLimit, aiComposeEmail);

// Calendar actions  
router.post('/actions/suggest-events', authenticateToken, checkApiLimit, suggestEvents);
router.post('/actions/create-event', authenticateToken, createEvent);
router.post('/actions/ai-compose-event', authenticateToken, checkApiLimit, aiComposeEvent);
router.post('/actions/ai-organize-calendar', authenticateToken, checkApiLimit, aiOrganizeCalendar);
router.post('/actions/create-multiple-events', authenticateToken, createMultipleEvents);

// Google Slides actions
router.post('/actions/ai-generate-slides', authenticateToken, checkApiLimit, aiGenerateSlides);
router.post('/actions/create-google-slides', authenticateToken, createGoogleSlides);

// Google Forms actions
router.post('/actions/ai-generate-form', authenticateToken, checkApiLimit, aiGenerateForm);
router.post('/actions/create-google-form', authenticateToken, createGoogleForm);

// Google Sheets actions
router.post('/actions/ai-generate-sheet', authenticateToken, checkApiLimit, aiGenerateSheet);
router.post('/actions/create-google-sheet', authenticateToken, createGoogleSheet);

// Content generation
router.post('/actions/generate-content', authenticateToken, checkApiLimit, generateContent);

// Action history
router.get('/actions/history/:ideaId', authenticateToken, getHistory);
router.post('/actions/log', authenticateToken, logAction);

module.exports = router;
