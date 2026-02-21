const Chat = require('../models/Chat-response')
const { sanitizeString, maxLength, ensureString } = require('../middleware/sanitize');

const saveChat = async (req,res)=>{
  try {
    const userId = req.user.userId
    const userMessage = sanitizeString(maxLength(ensureString(req.body.userMessage), 10000));
    const AiResponse = maxLength(ensureString(req.body.AiResponse), 50000);
    const ideaId = ensureString(req.body.ideaId);
    const savedChat = await Chat.create({userMessage, AiResponse, ideaId, userId})
    res.status(200).json({savedChat})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const getChat = async (req,res)=>{
  try {
    const userId = req.user.userId
    const {ideaId} = req.params
    const savedChat = await Chat.findOne({userId, ideaId}).sort({createdAt: -1}).limit(1);
    res.status(200).json({savedChat})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const getAllChats = async (req,res)=>{
  try {
    const userId = req.user.userId
    const {ideaId} = req.params
    const savedChat = await Chat.find({userId, ideaId})
    res.status(200).json({savedChat})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

module.exports = {
  saveChat,
  getChat,
  getAllChats
}