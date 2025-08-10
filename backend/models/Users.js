const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema({ //this sets the specific type of data each document has within the collection
  email: {
    type:String,
    required:[true, 'must provide name'], //these are validators that control what the user can input
    trim:true, //removes extra spaces
  },
  password: {
    type:String,
    required:[true, 'must provide rating']
  },
  name: {
    type:String,
    required:[true, 'must provide name']
  },
  numberPrompts: {
    type:String,
    default: 0,
  },
})

module.exports = mongoose.model('Users', UserSchema);