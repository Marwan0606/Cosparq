const express = require('express');
const router = express.Router();

const {saveActionResponse, getAction, updateStatus, deleteResponse} = require('../controllers/save-action.js');

router.post('/saveAction', saveActionResponse);

router.get('/saveAction/:ideaId', getAction);

router.put('/saveAction/:ideaId', updateStatus);

router.delete('/saveAction/:ideaId', deleteResponse);

module.exports = router;