const User = require('../models/Users.js')
const { get } = require('../routes/gpt-responses.js')

const createUser = async (req, res) => {
  try {
    const user = await User.create(req.body);
    return res.status(201).json({ user });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.email) {
      return res.status(409).json({ msg: 'Email already exists' });
    }
    return res.status(500).json({ msg: error.message || 'Server error' });
  }
};


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
      return res.status(404).json({msg: `No task with id: ${userID}`})
    }
    
    res.status(200).json({user})
  } catch (error) {
    res.status(500).json({msg: error})
  }
}

const getAllUsersEmail = async (req, res) => {
  try {
    const users = await User.find({}, 'email'); // only return email field
    const emails = users.map(user => user.email); // make it an array of emails
    res.status(200).json({ emails });
  } catch (error) {
    res.status(500).json({ msg: error.message || error });
  }
};

module.exports = {
  createUser,
  login,
  getUser,
  getAllUsersEmail
}