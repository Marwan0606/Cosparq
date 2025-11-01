const express = require('express')
const router = express.Router();

const {
  getAllTasks, createTask, getTask, updateTask, deleteTask, correctCredentials, getAllPendingTasks, deletePendingTask
} = require('../controllers/tasks-page.js')

router.get('/team/:ideaId', getAllTasks)

router.post('/', createTask)

router.get('/:taskId', getTask)

router.patch('/:taskId', updateTask)

router.delete('/:id', deleteTask)

router.get('/', correctCredentials)

router.get('/pending/:ideaId', getAllPendingTasks)

router.delete('/pending/:ideaId', deletePendingTask)

module.exports = router