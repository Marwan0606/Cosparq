const express = require('express');
const router = express.Router();

const { saveIdea, getIdea, getIdeas } = require('../controllers/save-idea.js');

router.post('/idea', saveIdea);

router.get('/idea/:id', getIdea);

router.get('/idea/:id', getIdeas);

module.exports = router;