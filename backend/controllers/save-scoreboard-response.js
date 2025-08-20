const scoreboardResponseModel = require('../models/Scoreboard-responses.js')

const saveScoreResponse = async (req,res)=>{
  try {
    const userId = req.user.userId
    const {scoreboardResponse, ideaId} = req.body
    
    const scoreResponse = await scoreboardResponseModel.create({scoreboardResponse, userId, ideaId})
    res.status(200).json({scoreResponse})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const getScore = async (req,res)=>{
  try {
    const userId = req.user.userId
    const {ideaId} = req.params
    const scoreResponse = await scoreboardResponseModel.findOne({userId, ideaId})
    res.status(200).json({scoreResponse})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const deleteScore = async (req,res)=>{
  try {
    const userId = req.user.userId
    const {ideaId} = req.params
    const scoreResponse = await scoreboardResponseModel.findOneAndDelete({userId, ideaId})
    res.status(200).json({scoreResponse})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

module.exports = {
  saveScoreResponse,
  getScore,
  deleteScore
}