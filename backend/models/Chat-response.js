const mongoose = require('mongoose')

const ChatHistorySchema = new mongoose.Schema({ //this sets the specific type of data each document has within the collection
  userMessage: {
    type:String,
    trim:true, //removes extra spaces
  },
  AiResponse: {
    type:String,
  },
  status: {
    type:String,
    default:'pending'
  },
  ideaId: {
    type:String,
    required:[true, 'must provide ideaId']
  },
  userId: {
    type:String,
    required:[true, 'must provide userId']
  }
}, {collection: 'chat-history', timestamps: true});

module.exports = mongoose.model('ChatHistorySchema', ChatHistorySchema);