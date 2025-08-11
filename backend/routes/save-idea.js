const express = require('express');
const router = express.Router();

const { saveIdea, getIdea, getIdeas } = require('../controllers/save-idea.js');

router.post('/idea', saveIdea);

router.get('/idea/:userId/:ideaId', getIdea);

router.get('/ideas/:id', getIdeas);

module.exports = router;