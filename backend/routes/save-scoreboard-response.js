const express = require('express');
const router = express.Router();

const { saveScoreResponse, getScore } = require('../controllers/save-scoreboard-response.js');

router.post('/saveScoreResponse', saveScoreResponse);

router.get('/saveScoreResponse/:id', getScore);

module.exports = router;