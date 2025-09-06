const actionResponses = require('../models/Action-response.js')

const saveActionResponse = async (req,res)=>{
  try {
    const userId = req.user.userId
    const {actionPlanResponse, ideaId} = req.body
    const actionResponse = await actionResponses.create({actionPlanResponse, userId, ideaId})
    res.status(200).json({actionResponse})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const getAction = async (req,res)=>{
  try {
    const userId = req.user.userId
    const {ideaId} = req.params
    const actionResponse = await actionResponses.findOne({userId, ideaId})
    res.status(200).json({actionResponse})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const updateStatus = async (req, res)=>{
  try {
    const userId = req.user.userId
    const {ideaId} = req.params
    const actionResponse = await actionResponses.findOneAndUpdate({userId, ideaId}, req.body, {
      new: true,
      runValidators: true, //WE NEED TO SET THIS OBJECT FOR ALL UPDATE OPERATION AS IT TELLS THE COMPUTER TO SHOW THE NEW UPDATED TASK
    })
    res.status(200).json({actionResponse})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const deleteResponse = async (req, res)=>{
  try {
    const userId = req.user.userId
    const {ideaId} = req.params
    const actionResponse = await actionResponses.findOneAndDelete({userId, ideaId})
    res.status(200).json({actionResponse})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

module.exports = {
  saveActionResponse,
  getAction,
  updateStatus,
  deleteResponse
}