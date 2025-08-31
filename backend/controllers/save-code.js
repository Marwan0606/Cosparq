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

const updateCode = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { ideaId } = req.params;
    const { codeFileResponse } = req.body;

    const codeResponse = await CodeResponses.findOneAndUpdate(
      { userId, ideaId },                 // query
      { $set: { codeFileResponse } },     // update only the field we care about
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(200).json({ codeResponse });
  } catch (error) {
    console.error('updateCode error:', error);
    return res.status(500).json({ msg: 'Server error' });
  }
};


module.exports = {
  saveCodeResponse,
  getCode,
  updateCode
}