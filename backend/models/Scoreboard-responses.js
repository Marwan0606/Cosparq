const mongoose = require('mongoose')

const ScoreboardResponse = new mongoose.Schema({ //this sets the specific type of data each document has within the collection
  scoreboardResponse: {
    type:String,
    default:'',
    trim:true, //removes extra spaces
  },
  status: {
    type:String,
    default:'pending'
  },
  userId: {
    type:String,
    required:[true, 'must provide rating']
  },
  ideaId: {
    type:String,
    required:[true, 'must provide ideaId']
  },
  lastReEvaluatedAt: {
    type: Date,
    default: null
  }
}, {collection: 'scoreboard-responses', timestamps: true});

module.exports = mongoose.model('ScoreboardResponse', ScoreboardResponse);