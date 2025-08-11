const mongoose = require('mongoose')

const ScoreboardResponse = new mongoose.Schema({ //this sets the specific type of data each document has within the collection
  scoreboardResponse: {
    type:String,
    required:[true, 'must provide name'], //these are validators that control what the user can input
    trim:true, //removes extra spaces
  },
  userId: {
    type:String,
    required:[true, 'must provide rating']
  },
  ideaId: {
    type:String,
    required:[true, 'must provide ideaId']
  }
}, {collection: 'scoreboard-responses'});

module.exports = mongoose.model('ScoreboardResponse', ScoreboardResponse);