const Task = require('../models/Task.js')
const { sanitizeString, maxLength, ensureString, isOneOf, pickFields } = require('../middleware/sanitize');

const TASK_ALLOWED_FIELDS = ['title', 'description', 'status', 'completed', 'date', 'urgency', 'ideaId', 'order', 'assignedToName'];

const getAllTasks = async (req, res)=>{
  try {
    const userId = req.user.userId
    const {ideaId} = req.params
    const tasks = await Task.find({userId, ideaId, status: { $ne: 'ai-placeholder' }})
    res.status(200).json({tasks: tasks})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const createTask = async (req, res)=>{
  try {
    const userId = req.user.userId
    // Only pick allowed fields (prevent mass assignment)
    const taskData = pickFields(req.body, TASK_ALLOWED_FIELDS);
    if (taskData.title) taskData.title = sanitizeString(maxLength(ensureString(taskData.title), 500));
    if (taskData.description) taskData.description = sanitizeString(maxLength(ensureString(taskData.description), 5000));
    if (taskData.urgency) taskData.urgency = isOneOf(taskData.urgency, ['low', 'medium', 'high'], 'medium');
    if (taskData.assignedToName) taskData.assignedToName = sanitizeString(maxLength(ensureString(taskData.assignedToName), 100));
    const task = await Task.create({userId, ...taskData})
    res.status(201).json({ task })
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const getTask = async (req, res)=>{
  try {
    const userId = req.user.userId
    const {taskId} = req.params
    
    const task = await Task.findOne({userId, _id:taskId})

    if (!task) {
      return res.status(404).json({msg: `No task with id: ${taskID}`})
    }

    res.status(200).json({task})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const deleteTask = async (req, res)=>{
  try {
    const userId = req.user.userId
    const {id: taskID} = req.params
    const task = await Task.findOneAndDelete({userId, _id:taskID})
    if (!task) {
      return res.status(404).json({msg: `No task with id: ${taskID}`})
    }
    res.status(200).json({task})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}


const updateTask = async (req, res)=>{
  try {
    const userId = req.user.userId
    const taskID = req.params.taskId
    // Only pick allowed fields (prevent mass assignment)
    const updateData = pickFields(req.body, TASK_ALLOWED_FIELDS);
    if (updateData.title) updateData.title = sanitizeString(maxLength(ensureString(updateData.title), 500));
    if (updateData.description) updateData.description = sanitizeString(maxLength(ensureString(updateData.description), 5000));
    if (updateData.urgency) updateData.urgency = isOneOf(updateData.urgency, ['low', 'medium', 'high'], 'medium');
    if (updateData.assignedToName) updateData.assignedToName = sanitizeString(maxLength(ensureString(updateData.assignedToName), 100));
    const task = await Task.findOneAndUpdate({userId, _id:taskID}, updateData, {
      new: true,
      runValidators: true,
    })
    if (!task) {
      return res.status(404).json({msg: `No task with id: ${taskID}`})
    }
    res.status(200).json({task})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const correctCredentials = async (req,res)=>{
  try {
    const userId = req.user.userId
    // Only allow querying by safe fields
    const safeQuery = pickFields(req.body, ['status', 'completed', 'ideaId']);
    const tasks = await Task.find({userId, ...safeQuery})
  } catch (error) {
    console.log(error)
  }
}

const getAllPendingTasks = async (req, res)=>{
  try {
    const userId = req.user.userId
    const {ideaId} = req.params
    const tasks = await Task.find({userId, ideaId, status: 'ai-placeholder'})
    res.status(200).json({tasks: tasks})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const deletePendingTask = async (req, res)=>{
  try {
    const userId = req.user.userId
    const {ideaId} = req.params
    const tasks = await Task.deleteMany({userId, ideaId, status: 'ai-placeholder'})
    res.status(200).json({tasks: tasks})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}


module.exports = {
  getAllTasks, createTask, getTask, updateTask, deleteTask, correctCredentials, getAllPendingTasks, deletePendingTask
}