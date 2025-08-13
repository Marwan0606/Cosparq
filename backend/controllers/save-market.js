const marketResponses = require('../models/Market-responses.js')

const saveMarketResponse = async (req,res)=>{
  try {
    const marketResponse = await marketResponses.create(req.body)
    res.status(200).json({marketResponse})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const getMarket = async (req,res)=>{
  try {
    const {userId, ideaId} = req.params
    const marketResponse = await marketResponses.findOne({userId, _id: ideaId})
    res.status(200).json({marketResponse})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

module.exports = {
  saveMarketResponse,
  getMarket
}