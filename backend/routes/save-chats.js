const express = require('express');
const router = express.Router();

const { saveChat, getChat, getAllChats } = require('../controllers/save-chats');

router.post('/chat', saveChat);

router.get('/getChat/:ideaId', getChat);

router.get('/getAllChats/:ideaId', getAllChats);

module.exports = router;