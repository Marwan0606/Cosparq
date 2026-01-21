const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema({ //this sets the specific type of data each document has within the collection
  email: {
    type:String,
    required:[true, 'must provide name'], //these are validators that control what the user can input
    trim:true, //removes extra spaces
    unique:true,
    lowercase:true
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
  // API Usage Tracking
  totalApiRequests: {
    type: Number,
    default: 0,
  },
  totalApiCost: {
    type: Number, // Cost in USD
    default: 0,
  },
  apiUsageHistory: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    endpoint: String, // Which controller/feature made the call
    model: String, // Which OpenAI model was used
    promptTokens: Number,
    completionTokens: Number,
    totalTokens: Number,
    cost: Number // Cost of this specific request in USD
  }]
})

module.exports = mongoose.model('Users', UserSchema);