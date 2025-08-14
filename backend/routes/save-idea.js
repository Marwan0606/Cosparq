const express = require('express');
const router = express.Router();

const { saveIdea, getIdea, getIdeas, updateIdea } = require('../controllers/save-idea.js');

router.post('/idea', saveIdea);

router.get('/idea/:userId/:ideaId', getIdea);

router.patch('/idea/:userId/:ideaId', updateIdea);

router.get('/ideas/:id', getIdeas);

module.exports = router;