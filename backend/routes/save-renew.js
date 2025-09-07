const express = require('express');
const router = express.Router();

const { getRenew, deleteRenew } = require('../controllers/save-renewIdea.js');

router.get('/saveRenewResponse/:ideaId', getRenew);

router.delete('/saveRenewResponse/:ideaId', deleteRenew);

module.exports = router;