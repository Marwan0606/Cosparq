const Idea = require('../models/Idea-pitch-responses.js')

const saveIdea = async (req,res)=>{
  try {
    const userId = req.user.userId
    const {idea, ideaName} = req.body
    const ideaRes = await Idea.create({idea, userId, ideaName})
    res.status(200).json({ideaRes})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const getIdea = async (req,res)=>{
  try {
    const userId = req.user.userId
    const {ideaId} = req.params
    const idea = await Idea.findOne({userId, _id: ideaId})
    res.status(200).json({idea})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const updateIdea = async (req, res)=>{
  try {
    const userId = req.user.userId
    const {ideaId} = req.params
    const idea = await Idea.findOneAndUpdate({userId, _id: ideaId}, req.body, {
      new: true,
      runValidators: true, //WE NEED TO SET THIS OBJECT FOR ALL UPDATE OPERATION AS IT TELLS THE COMPUTER TO SHOW THE NEW UPDATED TASK
    })
    res.status(200).json({idea})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}


const getIdeas = async (req,res)=>{
  try {
    const userId = req.user.userId
    console.log(userId)
    const idea = await Idea.find({userId})
    res.status(200).json({idea})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

/*
const getIdeaIdByName = async (req,res)=>{
  try {
    name = req.params.id
    const idea = await Idea.find({ideaName = })
    res.status(200).json({idea})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}
*/

module.exports = {
  saveIdea,
  getIdea,
  updateIdea,
  getIdeas
}