const express = require('express');
const publicRouter = express.Router();
const protectedRouter = express.Router();
const { submitWaitlist, getWaitlist, exportWaitlistCSV } = require('../controllers/waitlist');

// PUBLIC — no auth (visitors on the generated landing page hit this)
publicRouter.options('/submit/:userId/:ideaId', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});
publicRouter.post('/submit/:userId/:ideaId', submitWaitlist);

// PROTECTED — auth required (CoSparq user views their waitlist)
protectedRouter.get('/:ideaId', getWaitlist);
protectedRouter.get('/:ideaId/csv', exportWaitlistCSV);

module.exports = { publicRouter, protectedRouter };
