const express = require('express');
const router = express.Router();

const {saveCodeResponse, getCode, updateCode} = require('../controllers/save-code.js');

router.post('/saveCode', saveCodeResponse);

router.get('/saveCode/:ideaId', getCode);

router.put('/saveCode/:ideaId', updateCode);

module.exports = router;