const mongoose = require('mongoose');

const VersionSchema = new mongoose.Schema({
  versionNumber: { type: Number, required: true },
  code: { type: String, required: true },
  description: { type: String, default: 'Initial generation' },
  createdAt: { type: Date, default: Date.now }
});

const Cobuilder2ResponseSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  ideaId: { type: String, required: true },
  status: { type: String, default: 'pending' }, // pending | success | error
  currentVersion: { type: Number, default: 1 },
  preferences: {
    colorScheme: { type: String, default: '' },
    style: { type: String, default: '' },
    additional: { type: String, default: '' }
  },
  versions: [VersionSchema]
}, { timestamps: true });

module.exports = mongoose.model('Cobuilder2Response', Cobuilder2ResponseSchema, 'cobuilder2-responses');
