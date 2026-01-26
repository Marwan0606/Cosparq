const mongoose = require('mongoose')

// Schema for storing idea history versions
const IdeaHistorySchema = new mongoose.Schema({
  idea: {
    type: String,
    required: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  updateSource: {
    type: String,
    enum: ['manual', 'ai_sync', 'initial'],
    default: 'manual',
  },
  updateSummary: {
    type: String,
    default: '',
  }
}, { _id: true });

const UserIdeaSchema = new mongoose.Schema({ //this sets the specific type of data each document has within the collection
  idea: {
    type:String,
    required:[true, 'must provide name'], //these are validators that control what the user can input
    trim:true, //removes extra spaces
  },
  userId: {
    type:mongoose.Schema.Types.ObjectId,
    required:[true, 'must provide name'],
  },
  ideaName: {
    type:String,
    required:[true, 'must provide name']
  },
  ideaHistory: {
    type: [IdeaHistorySchema],
    default: [],
  },
  lastSyncedAt: {
    type: Date,
    default: null,
  }
}, {collection: 'user-ideas', timestamps: true});

module.exports = mongoose.model('Idea', UserIdeaSchema);