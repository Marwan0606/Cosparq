/**
 * AI Co-Founder Routes
 * 
 * All routes require authentication (handled by middleware in app.js)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  startSession,
  sendMessage,
  endSession,
  getSessions,
  getSession,
  deleteSession,
  emailSummary,
  syncToIdea,
  textToSpeech,
  textToSpeechElevenLabs,
  transcribeAudio
} = require('../controllers/cofounder');

// Configure multer for audio file uploads (in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit for audio files
  }
});

// Start a new meeting session
// POST /api/cofounder/start
// Body: { ideaId: string }
router.post('/start', startSession);

// Send a message in the conversation
// POST /api/cofounder/message
// Body: { sessionId: string, message: string }
router.post('/message', sendMessage);

// End session and generate summary
// POST /api/cofounder/end
// Body: { sessionId: string }
router.post('/end', endSession);

// Get recent sessions for user
// GET /api/cofounder/sessions?ideaId=xxx&limit=10
router.get('/sessions', getSessions);

// Get a specific session with full details
// GET /api/cofounder/sessions/:sessionId
router.get('/sessions/:sessionId', getSession);

// Delete a session
// DELETE /api/cofounder/sessions/:sessionId
router.delete('/sessions/:sessionId', deleteSession);

// Email the summary to the user
// POST /api/cofounder/email-summary
// Body: { sessionId: string }
router.post('/email-summary', emailSummary);

// Sync meeting insights to IdeaHub
// POST /api/cofounder/sync-to-idea
// Body: { sessionId: string }
router.post('/sync-to-idea', syncToIdea);

// Text-to-Speech - Generate audio from text (OpenAI TTS - faster, cheaper)
// POST /api/cofounder/tts
// Body: { text: string }
router.post('/tts', textToSpeech);

// Text-to-Speech - Generate audio from text (ElevenLabs - higher quality, more expensive)
// POST /api/cofounder/tts-elevenlabs
// Body: { text: string, voiceId?: string }
router.post('/tts-elevenlabs', textToSpeechElevenLabs);

// Transcribe audio to text using Whisper
// POST /api/cofounder/transcribe
// Body: multipart/form-data with 'audio' file
router.post('/transcribe', upload.single('audio'), transcribeAudio);

module.exports = router;
