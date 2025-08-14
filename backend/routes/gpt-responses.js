const express = require('express');
const router = express.Router();

const { rateIdea } = require('../controllers/scoreboard');
const { marketResearch } = require('../controllers/marketResearch');
const { chat } = require('../controllers/chat')
const { renewIdea } = require('../controllers/renewIdea')

router.post('/idea', rateIdea);

router.post('/research', marketResearch);

router.post('/chat', chat);

router.post('/renewIdea', renewIdea);

module.exports = router;
