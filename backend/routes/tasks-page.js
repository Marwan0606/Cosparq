const express = require('express')
const router = express.Router();

const {
  getAllTasks, createTask, getTask, updateTask, deleteTask, correctCredentials
} = require('../controllers/tasks-page.js')

router.get('/team/:ideaId', getAllTasks)

router.post('/', createTask)

router.get('/:taskId', getTask)

router.patch('/:taskId', updateTask)

router.delete('/:id', deleteTask)

router.get('/', correctCredentials)

module.exports = router