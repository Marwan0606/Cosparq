const express = require('express');
const router = express.Router();

const { saveIdea, getIdea, getIdeas, updateIdea, archiveIdea, deleteIdea } = require('../controllers/save-idea.js');

router.post('/idea', saveIdea);

router.get('/idea/:ideaId', getIdea);

router.patch('/idea/:ideaId/archive', archiveIdea);

router.patch('/idea/:ideaId', updateIdea);

router.delete('/idea/:ideaId', deleteIdea);

router.get('/ideas', getIdeas);

module.exports = router;