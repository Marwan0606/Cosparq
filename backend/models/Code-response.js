const mongoose = require('mongoose')

const CodeResponse = new mongoose.Schema({ //this sets the specific type of data each document has within the collection
  codeFileResponse: {
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
}, {collection: 'code-file-responses'});

module.exports = mongoose.model('CodeResponse', CodeResponse);