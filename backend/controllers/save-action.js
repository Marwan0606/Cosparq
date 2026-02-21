const actionResponses = require('../models/Action-response.js')
const { sanitizeString, maxLength, ensureString } = require('../middleware/sanitize');

const saveActionResponse = async (req,res)=>{
  try {
    const userId = req.user.userId
    const actionPlanResponse = ensureString(req.body.actionPlanResponse);
    const ideaId = ensureString(req.body.ideaId);
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
    // Only allow updating specific fields (prevent mass assignment)
    const allowedFields = ['actionPlanResponse', 'status'];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = typeof req.body[field] === 'string' 
          ? sanitizeString(req.body[field]) : req.body[field];
      }
    }
    const actionResponse = await actionResponses.findOneAndUpdate({userId, ideaId}, updateData, {
      new: true,
      runValidators: true,
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