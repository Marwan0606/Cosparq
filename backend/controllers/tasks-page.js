const Task = require('../models/Task.js')


const getAllTasks = async (req, res)=>{
  try {
    const userId = req.user.userId
    const {ideaId} = req.params
    const tasks = await Task.find({userId, ideaId})
    res.status(200).json({tasks: tasks})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const createTask = async (req, res)=>{
  try {
    const userId = req.user.userId
    const task = await Task.create({userId, ...req.body})
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
    //const {id: taskID} = req.params
    const task = await Task.findOneAndUpdate({userId, _id:taskID}, req.body, {
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
    const tasks = await Task.find({userId, ...req.body})
  } catch (error) {
    console.log(error)
  }
}

const getAllPendingTasks = async (req, res)=>{
  try {
    const userId = req.user.userId
    const {ideaId} = req.params
    const tasks = await Task.find({userId, ideaId, status: 'pending'})
    res.status(200).json({tasks: tasks})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const deletePendingTask = async (req, res)=>{
  try {
    const userId = req.user.userId
    const {ideaId} = req.params
    const tasks = await Task.deleteMany({userId, ideaId, status: 'pending'})
    res.status(200).json({tasks: tasks})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}


module.exports = {
  getAllTasks, createTask, getTask, updateTask, deleteTask, correctCredentials, getAllPendingTasks, deletePendingTask
}