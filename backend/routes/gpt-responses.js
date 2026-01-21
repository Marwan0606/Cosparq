const express = require('express');
const router = express.Router();

const { checkApiLimit } = require('../middleware/checkApiLimit');

const { rateIdea } = require('../controllers/scoreboard');
const { marketResearch } = require('../controllers/marketResearch');
const { chat } = require('../controllers/chat')
const { renewIdea } = require('../controllers/renewIdea');
const { actionPlan } = require('../controllers/actionPlan');
const { tasksAi } = require('../controllers/tasksAi')
const { codePage } = require('../controllers/code')
const { codeEdit } = require('../controllers/codeEdit')
const { codeEditCheap } = require('../controllers/codeCheap')

// Apply checkApiLimit middleware to ALL routes that make OpenAI calls
// This ensures no AI request can be made if user exceeds their cost limit

router.post('/idea', checkApiLimit, rateIdea);

router.post('/research', checkApiLimit, marketResearch);

router.post('/chat', checkApiLimit, chat);

router.post('/renewIdea', checkApiLimit, renewIdea);

router.post('/actionPlan', checkApiLimit, actionPlan);

router.post('/tasksAi', checkApiLimit, tasksAi);

router.post('/code', checkApiLimit, codePage);

router.post('/codeEdit', checkApiLimit, codeEdit);

router.post('/codeEditCheap', checkApiLimit, codeEditCheap);

module.exports = router;
