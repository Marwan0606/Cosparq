const express = require('express');
const router = express.Router();

const {saveCodeResponse, getCode} = require('../controllers/save-code.js');

router.post('/saveCode', saveCodeResponse);

router.get('/saveCode/:ideaId', getCode);

module.exports = router;