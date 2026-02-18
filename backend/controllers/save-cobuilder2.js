const Cobuilder2Response = require('../models/Cobuilder2-response');
const { injectWaitlistEndpoint } = require('./cobuilder2');

const saveCobuilder2 = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { ideaId, code, preferences } = req.body;
    const doc = await Cobuilder2Response.create({
      userId,
      ideaId,
      status: 'success',
      currentVersion: 1,
      preferences: preferences || {},
      versions: [{ versionNumber: 1, code, description: 'Initial generation' }]
    });
    res.status(200).json({ cobuilder2: doc });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

const getCobuilder2 = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { ideaId } = req.params;
    const doc = await Cobuilder2Response.findOne({ userId, ideaId }).sort({ updatedAt: -1 });

    // Inject waitlist endpoint into each version's code on read
    if (doc && doc.versions && doc.versions.length > 0) {
      const plainDoc = doc.toObject();
      plainDoc.versions = plainDoc.versions.map(v => ({
        ...v,
        code: injectWaitlistEndpoint(v.code, userId, ideaId)
      }));
      return res.status(200).json({ cobuilder2: plainDoc });
    }

    res.status(200).json({ cobuilder2: doc });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

const updateCobuilder2 = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { ideaId } = req.params;
    const { code, description } = req.body;

    const doc = await Cobuilder2Response.findOne({ userId, ideaId });
    if (!doc) return res.status(404).json({ msg: 'Not found' });

    const nextVersion = (doc.versions.length || 0) + 1;
    doc.versions.push({
      versionNumber: nextVersion,
      code,
      description: description || `Version ${nextVersion}`,
      createdAt: new Date()
    });
    doc.currentVersion = nextVersion;
    doc.status = 'success';

    if (doc.versions.length > 30) {
      doc.versions.splice(1, doc.versions.length - 30);
    }

    await doc.save();
    res.status(200).json({ cobuilder2: doc });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

const restoreVersion = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { ideaId } = req.params;
    const { versionNumber } = req.body;

    const doc = await Cobuilder2Response.findOne({ userId, ideaId });
    if (!doc) return res.status(404).json({ msg: 'Not found' });

    const target = doc.versions.find(v => v.versionNumber === versionNumber);
    if (!target) return res.status(404).json({ msg: 'Version not found' });

    // Restore by creating a new version with the old code
    const nextVersion = (doc.versions.length || 0) + 1;
    doc.versions.push({
      versionNumber: nextVersion,
      code: target.code,
      description: `Restored from v${versionNumber}`,
      createdAt: new Date()
    });
    doc.currentVersion = nextVersion;

    if (doc.versions.length > 30) {
      doc.versions.splice(1, doc.versions.length - 30);
    }

    await doc.save();
    res.status(200).json({ cobuilder2: doc });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

module.exports = { saveCobuilder2, getCobuilder2, updateCobuilder2, restoreVersion };
