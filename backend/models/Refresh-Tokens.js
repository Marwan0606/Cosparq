const mongoose = require('mongoose')

const RefreshTokens = new mongoose.Schema({ //this sets the specific type of data each document has within the collection
  refreshToken: {
    type:String,
    required:[true, 'must provide name'], //these are validators that control what the user can input
  },
  userId: {
    type:String,
    required:[true, 'must provide rating']
  }
})

module.exports = mongoose.model('RefreshTokens', RefreshTokens);