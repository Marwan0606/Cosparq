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
    const includeArchived = req.query.includeArchived === 'true';
    const filter = { userId };
    if (!includeArchived) filter.archived = { $ne: true };
    const idea = await Idea.find(filter)
    res.status(200).json({idea})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const archiveIdea = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { ideaId } = req.params;
    const { archived } = req.body;
    const idea = await Idea.findOneAndUpdate(
      { userId, _id: ideaId },
      { archived: !!archived },
      { new: true }
    );
    if (!idea) return res.status(404).json({ msg: 'Idea not found' });
    res.status(200).json({ idea });
  } catch (error) {
    res.status(500).json({ msg: error });
  }
}

const deleteIdea = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { ideaId } = req.params;
    const idea = await Idea.findOneAndDelete({ userId, _id: ideaId });
    if (!idea) return res.status(404).json({ msg: 'Idea not found' });
    res.status(200).json({ msg: 'Idea permanently deleted' });
  } catch (error) {
    res.status(500).json({ msg: error });
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
  getIdeas,
  archiveIdea,
  deleteIdea
}