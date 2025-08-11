const Idea = require('../models/Idea-pitch-responses.js')

const saveIdea = async (req,res)=>{
  try {
    const idea = await Idea.create(req.body)
    res.status(200).json({idea})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const getIdea = async (req,res)=>{
  try {
    const {userId, ideaId} = req.params
    const idea = await Idea.findOne({userId, _id: ideaId})
    res.status(200).json({idea})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const getIdeas = async (req,res)=>{
  try {
    userId = req.params.id
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
  getIdeas
}