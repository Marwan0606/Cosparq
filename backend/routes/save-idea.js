const express = require('express');
const router = express.Router();

const { saveIdea, getIdea, getIdeas, updateIdea } = require('../controllers/save-idea.js');

router.post('/idea', saveIdea);

router.get('/idea/:ideaId', getIdea);

router.patch('/idea/:ideaId', updateIdea);

router.get('/ideas', getIdeas);

module.exports = router;