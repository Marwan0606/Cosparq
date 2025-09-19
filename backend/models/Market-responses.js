const mongoose = require('mongoose')

const MarketResponse = new mongoose.Schema({ //this sets the specific type of data each document has within the collection
  marketResearchResponse: {
    type:String,
    trim:true, //removes extra spaces
  },
  userId: {
    type:String,
    required:[true, 'must provide userId']
  },
  status: {
    type:String,
    default:'pending'
  },
  ideaId: {
    type:String,
    required:[true, 'must provide ideaId']
  }
}, {collection: 'market-research-responses'});

module.exports = mongoose.model('MarketResponse', MarketResponse);