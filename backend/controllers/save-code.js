const CodeResponses = require('../models/Code-response.js')

const saveCodeResponse = async (req,res)=>{
  try {
    const userId = req.user.userId
    const {codeFileResponse, ideaId} = req.body
    const codeResponse = await CodeResponses.create({codeFileResponse, userId, ideaId})
    res.status(200).json({codeResponse})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const getCode = async (req,res)=>{
  try {
    const userId = req.user.userId
    const {ideaId} = req.params
    const codeResponse = await CodeResponses.findOne({userId, ideaId})
    res.status(200).json({codeResponse})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

module.exports = {
  saveCodeResponse,
  getCode
}