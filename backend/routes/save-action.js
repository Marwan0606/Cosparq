const express = require('express');
const router = express.Router();

const {saveActionResponse, getAction} = require('../controllers/save-action.js');

router.post('/saveAction', saveActionResponse);

router.get('/saveAction/:ideaId', getAction);

module.exports = router;