const mongoose = require('mongoose')

const MarketResponse = new mongoose.Schema({ //this sets the specific type of data each document has within the collection
  marketResearchResponse: {
    type:String,
    required:[true, 'must provide name'], //these are validators that control what the user can input
    trim:true, //removes extra spaces
  },
  userId: {
    type:String,
    required:[true, 'must provide rating']
  }
}, {collection: 'market-research-responses'});

module.exports = mongoose.model('MarketResponse', MarketResponse);