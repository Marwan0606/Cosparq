const express = require('express')
const router = express.Router();

const {
  //createUser, 
  //login,
  getUser,
  getAllUsersEmail
} = require('../controllers/users')


//router.post('/register', createUser)

//router.post('/login', login)

router.get('/:id', getUser)

router.get('/', getAllUsersEmail)

module.exports = router