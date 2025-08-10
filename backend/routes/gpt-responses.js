const express = require('express');
const router = express.Router();

const { rateIdea } = require('../controllers/scoreboard');
const { marketResearch } = require('../controllers/marketResearch');

router.post('/idea', rateIdea);

router.post('/research', marketResearch);

module.exports = router;
