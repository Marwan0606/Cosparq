const marketResponses = require('../models/Market-responses.js')

const saveMarketResponse = async (req,res)=>{
  try {
    const userId = req.user.userId
    const {marketResearchResponse, ideaId} = req.body
    const marketResponse = await marketResponses.create({marketResearchResponse, userId, ideaId})
    res.status(200).json({marketResponse})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const getMarket = async (req,res)=>{
  try {
    const userId = req.user.userId
    const {ideaId} = req.params
    const marketResponse = await marketResponses.findOne({userId, ideaId})
    res.status(200).json({marketResponse})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

module.exports = {
  saveMarketResponse,
  getMarket
}