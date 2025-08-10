const scoreboardResponse = require('../models/Scoreboard-responses.js')

const saveScoreResponse = async (req,res)=>{
  try {
    const scoreResponse = await scoreboardResponse.create(req.body)
    res.status(200).json({scoreResponse})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const getScore = async (req,res)=>{
  try {
    userId = req.params.id
    const scoreResponse = await scoreboardResponse.findOne({userId: userId})
    res.status(200).json({scoreResponse})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

module.exports = {
  saveScoreResponse,
  getScore
}