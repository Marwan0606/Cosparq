const mongoose = require('mongoose')

const RawChatHistorySchema = new mongoose.Schema({ //this sets the specific type of data each document has within the collection
  userMessage: {
    type:String,
    required:[true, 'must provide userMessage'], //these are validators that control what the user can input
    trim:true, //removes extra spaces
  },
  AiResponse: {
    type:String,
    required:[true, 'must provide AiResponse']
  },
  ideaId: {
    type:String,
    required:[true, 'must provide ideaId']
  },
  userId: {
    type:String,
    required:[true, 'must provide userId']
  }
}, {collection: 'raw-chat-history', timestamps: true});

module.exports = mongoose.model('RawChatHistorySchema', RawChatHistorySchema);