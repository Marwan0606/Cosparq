const User = require('../models/Users.js')
const { get } = require('../routes/gpt-responses.js')

const createUser = async (req,res)=>{
  try {
    const user = await User.create(req.body)
    res.status(200).json({user})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const login = async (req,res)=>{
  try {
    const {email, password} = req.body
    user = await User.findOne({email: email})

    if (!user) {
      return res.status(404).json({msg: "user not found"})
    }

    if (user.password !== password) {
      return res.status(404).json({msg: "Invalid credentials"})
    }

    res.status(200).json({user})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}


const getUser = async (req, res) => {
  try {
    const id = req.params.id
    const userID = id
    const user = await User.findOne({_id: userID})

    if (!user) {
      return res.status(404).json({msg: `No task with id: ${taskID}`})
    }
    
    res.status(200).json({user})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

module.exports = {
  createUser,
  login,
  getUser
}