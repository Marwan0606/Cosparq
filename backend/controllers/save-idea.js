const Idea = require('../models/Idea-pitch-responses.js')
const { sanitizeString, maxLength, ensureString } = require('../middleware/sanitize');

const saveIdea = async (req,res)=>{
  try {
    const userId = req.user.userId
    const idea = sanitizeString(maxLength(ensureString(req.body.idea), 10000));
    const ideaName = sanitizeString(maxLength(ensureString(req.body.ideaName), 200));
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

    // String fields with their max lengths
    const stringFields = {
      idea: 10000,
      ideaName: 200,
      vision: 10000,
      coreProblem: 10000,
      targetAudience: 10000,
      revenueModel: 10000,
      competitiveLandscape: 10000,
      mvpScope: 10000,
      progressStage: 50,
      progressNotes: 10000,
    };

    const updateData = {};

    // Handle simple string fields
    for (const [field, limit] of Object.entries(stringFields)) {
      if (req.body[field] !== undefined) {
        updateData[field] = sanitizeString(maxLength(ensureString(req.body[field]), limit));
      }
    }

    // Handle boolean field
    if (req.body.archived !== undefined) {
      updateData.archived = !!req.body.archived;
    }

    // Handle brandIdentity (nested object)
    if (req.body.brandIdentity !== undefined) {
      const bi = req.body.brandIdentity;
      updateData.brandIdentity = {
        description: sanitizeString(maxLength(ensureString(bi.description || ''), 5000)),
        colors: Array.isArray(bi.colors) ? bi.colors.map(c => sanitizeString(ensureString(c))).slice(0, 20) : [],
        fonts: Array.isArray(bi.fonts) ? bi.fonts.map(f => sanitizeString(ensureString(f))).slice(0, 20) : [],
      };
    }

    // Handle techStack (nested object)
    if (req.body.techStack !== undefined) {
      const ts = req.body.techStack;
      updateData.techStack = {
        tags: Array.isArray(ts.tags) ? ts.tags.map(t => sanitizeString(ensureString(t))).slice(0, 50) : [],
        notes: sanitizeString(maxLength(ensureString(ts.notes || ''), 5000)),
      };
    }

    // Handle progressMilestones (array of objects)
    if (req.body.progressMilestones !== undefined) {
      const milestones = Array.isArray(req.body.progressMilestones) ? req.body.progressMilestones : [];
      updateData.progressMilestones = milestones.slice(0, 50).map(m => ({
        label: sanitizeString(maxLength(ensureString(m.label || ''), 500)),
        completed: !!m.completed,
      }));
    }

    // Handle progress percent
    if (req.body.progressPercent !== undefined) {
      updateData.progressPercent = Math.max(0, Math.min(100, Number(req.body.progressPercent) || 0));
    }
    if (req.body.progressPercentManual !== undefined) {
      updateData.progressPercentManual = !!req.body.progressPercentManual;
    }

    // Handle ideaHistory (array push — only if explicitly provided)
    if (req.body.ideaHistory !== undefined) {
      updateData.ideaHistory = req.body.ideaHistory;
    }

    // Handle lastSyncedAt
    if (req.body.lastSyncedAt !== undefined) {
      updateData.lastSyncedAt = req.body.lastSyncedAt;
    }

    const idea = await Idea.findOneAndUpdate({userId, _id: ideaId}, updateData, {
      new: true,
      runValidators: true,
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