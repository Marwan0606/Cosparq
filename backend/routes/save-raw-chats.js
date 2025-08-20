const express = require('express');
const router = express.Router();

const { saveChat, getChat, getAllChats } = require('../controllers/save-rawChats');

router.post('/chatRaw', saveChat);

router.get('/getChatRaw/:ideaId', getChat);

router.get('/getAllChatsRaw/:ideaId', getAllChats);

module.exports = router;