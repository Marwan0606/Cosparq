const mongoose = require('mongoose')

const ActionResponse = new mongoose.Schema({ //this sets the specific type of data each document has within the collection
  actionPlanResponse: {
    type:String,
    //required:[true, 'must provide name'], //these are validators that control what the user can input
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
  }
}, {collection: 'action-plan-responses'});

module.exports = mongoose.model('ActionResponse', ActionResponse);