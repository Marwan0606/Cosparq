const mongoose = require('mongoose')

const TaskSchema = new mongoose.Schema({ //this sets the specific type of data each document has within the collection
  title: {
    type:String,
    trim:true, //removes extra spaces
  },
  description: {
    type:String,
    defualt: ''
  },
  assignedToName: {
    type:String,
    defualt: ''
  },
  urgency: {
    type:String,
    defualt: ''
  },
  date: {
    type:String,
    defualt: ''
  },
  completed: {
    type:Boolean,
    default: false
  },
  order: {
    type:Number,
    default: false
  },
  status: {
    type:String,
    default:'pending'
  },
  userId: {
    type:String,
    defualt: ''
  },
  ideaId: {
    type:String,
    defualt: ''
  }
})

module.exports = mongoose.model('Task', TaskSchema);