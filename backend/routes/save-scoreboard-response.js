const express = require('express');
const router = express.Router();

const { saveScoreResponse, getScore, deleteScore } = require('../controllers/save-scoreboard-response.js');

router.post('/saveScoreResponse', saveScoreResponse);

router.get('/saveScoreResponse/:ideaId', getScore);

router.delete('/saveScoreResponse/:ideaId', deleteScore);

module.exports = router;