const express = require('express');
const router = express.Router();

const { checkApiLimit } = require('../middleware/checkApiLimit');
const { checkPaidSubscription } = require('../middleware/checkSubscription');

const { rateIdea, reEvaluateIdea } = require('../controllers/scoreboard');
const { marketResearch } = require('../controllers/marketResearch');
const { chat } = require('../controllers/chat')
const { chatWithActions } = require('../controllers/chatWithActions')
const { renewIdea } = require('../controllers/renewIdea');
const { actionPlan } = require('../controllers/actionPlan');
const { tasksAi } = require('../controllers/tasksAi')
const { codePage } = require('../controllers/code')
const { codeEdit } = require('../controllers/codeEdit')
const { codeEditCheap } = require('../controllers/codeCheap')

// Apply checkApiLimit middleware to ALL routes that make OpenAI calls
// This ensures no AI request can be made if user exceeds their cost limit

router.post('/idea', checkApiLimit, rateIdea);
router.post('/idea/reevaluate', checkApiLimit, reEvaluateIdea);

router.post('/research', checkApiLimit, marketResearch);

router.post('/chat', checkApiLimit, chat);

// Chat with Actions - enables action execution from chat (email, calendar, slides, forms, sheets)
router.post('/chatWithActions', checkApiLimit, chatWithActions);

router.post('/renewIdea', checkApiLimit, renewIdea);

router.post('/actionPlan', checkApiLimit, actionPlan);

router.post('/tasksAi', checkApiLimit, tasksAi);

// CoBuilder routes require paid subscription (Pro or Business)
router.post('/code', checkPaidSubscription, checkApiLimit, codePage);

router.post('/codeEdit', checkPaidSubscription, checkApiLimit, codeEdit);

router.post('/codeEditCheap', checkPaidSubscription, checkApiLimit, codeEditCheap);

module.exports = router;
