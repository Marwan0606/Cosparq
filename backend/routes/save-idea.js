const express = require('express');
const router = express.Router();

const { saveIdea, getIdea } = require('../controllers/save-idea.js');

router.post('/idea', saveIdea);

router.get('/idea/:id', getIdea);

module.exports = router;