const mongoose = require('mongoose')

const CodeResponse = new mongoose.Schema({ //this sets the specific type of data each document has within the collection
  codeFileResponse: {
    type:String,
    trim:true, //removes extra spaces
  },
  status: {
    type:String,
    default:'pending'
  },
  userId: {
    type:String,
    required:[true, 'must provide userId']
  },
  ideaId: {
    type:String,
    required:[true, 'must provide ideaId']
  }
}, {collection: 'code-file-responses'});

module.exports = mongoose.model('CodeResponse', CodeResponse);