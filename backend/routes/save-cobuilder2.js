const express = require('express');
const router = express.Router();

const { saveCobuilder2, getCobuilder2, updateCobuilder2, restoreVersion } = require('../controllers/save-cobuilder2');

router.post('/saveCobuilder2', saveCobuilder2);

router.get('/saveCobuilder2/:ideaId', getCobuilder2);

router.put('/saveCobuilder2/:ideaId', updateCobuilder2);

router.post('/saveCobuilder2/:ideaId/restore', restoreVersion);

module.exports = router;
