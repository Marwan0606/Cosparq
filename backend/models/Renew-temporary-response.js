const mongoose = require('mongoose')

const RenewResponses = new mongoose.Schema({
  renewIdeaResponse: {
    type:String,
    default:'',
    trim:true,
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
  }
}, {collection: 'renewIdea-plan-responses'});

module.exports = mongoose.model('RenewResponses', RenewResponses);