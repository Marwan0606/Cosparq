const express = require('express')
const router = express.Router();

const {
  createUser, 
  login,
  getUser
} = require('../controllers/users')


router.post('/register', createUser)

router.post('/login', login)

router.get('/:id', getUser)

module.exports = router