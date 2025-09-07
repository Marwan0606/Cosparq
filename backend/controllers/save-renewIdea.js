const renewIdeaResponseModel = require('../models/Renew-temporary-response')

const getRenew = async (req,res)=>{
  try {
    const userId = req.user.userId
    const {ideaId} = req.params
    const renewResponse = await renewIdeaResponseModel.findOne({userId, ideaId})
    res.status(200).json({renewResponse})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const deleteRenew = async (req,res)=>{
  try {
    const userId = req.user.userId
    const {ideaId} = req.params
    const renewResponse = await renewIdeaResponseModel.findOneAndDelete({userId, ideaId})
    res.status(200).json({renewResponse})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

module.exports = {
  getRenew,
  deleteRenew
}