const express = require('express');
const router = express.Router();

const { saveScoreResponse, getScore, deleteScore } = require('../controllers/save-scoreboard-response.js');

router.post('/saveScoreResponse', saveScoreResponse);

router.get('/saveScoreResponse/:userId/:ideaId', getScore);

router.delete('/saveScoreResponse/:userId/:ideaId', deleteScore);

module.exports = router;