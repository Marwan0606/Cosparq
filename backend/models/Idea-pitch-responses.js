const mongoose = require('mongoose')

const UserIdeaSchema = new mongoose.Schema({ //this sets the specific type of data each document has within the collection
  idea: {
    type:String,
    required:[true, 'must provide name'], //these are validators that control what the user can input
    trim:true, //removes extra spaces
  },
  userId: {
    type:mongoose.Schema.Types.ObjectId,
    required:[true, 'must provide rating']
  }
}, {collection: 'user-ideas'});

module.exports = mongoose.model('Idea', UserIdeaSchema);