const express = require('express');
const router = express.Router();

const { rateIdea } = require('../controllers/scoreboard');
const { marketResearch } = require('../controllers/marketResearch');
const { chat } = require('../controllers/chat')

router.post('/idea', rateIdea);

router.post('/research', marketResearch);

router.post('/chat', chat);

module.exports = router;
