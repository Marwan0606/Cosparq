const express = require('express');
const router = express.Router();

const {saveMarketResponse, getMarket} = require('../controllers/save-market.js');

router.post('/saveMarket', saveMarketResponse);

router.get('/saveMarket/:userId/:ideaId', getMarket);

module.exports = router;