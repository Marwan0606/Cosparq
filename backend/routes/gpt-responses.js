const express = require('express');
const router = express.Router();

const { rateIdea } = require('../controllers/scoreboard');
const { marketResearch } = require('../controllers/marketResearch');
const { chat } = require('../controllers/chat')
const { renewIdea } = require('../controllers/renewIdea');
const { actionPlan } = require('../controllers/actionPlan');
const { tasksAi } = require('../controllers/tasksAi')
const { codePage } = require('../controllers/code')
const { codeEdit } = require('../controllers/codeEdit')

router.post('/idea', rateIdea);

router.post('/research', marketResearch);

router.post('/chat', chat);

router.post('/renewIdea', renewIdea);

router.post('/actionPlan', actionPlan);

router.post('/tasksAi', tasksAi);

router.post('/code', codePage);

router.post('/codeEdit', codeEdit);

module.exports = router;
