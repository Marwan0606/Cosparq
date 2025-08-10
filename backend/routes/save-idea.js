const express = require('express');
const router = express.Router();

const { saveIdea } = require('../controllers/save-idea.js');

router.post('/idea', saveIdea);

module.exports = router;
