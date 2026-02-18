const WaitlistEntry = require('../models/WaitlistEntry');

// ─── PUBLIC: Submit to waitlist (no auth — visitors use this) ──────────────────
const submitWaitlist = async (req, res) => {
  // Allow cross-origin requests (generated pages may be hosted elsewhere)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.sendStatus(200);

  const { userId, ideaId } = req.params;
  const { name, email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  try {
    await WaitlistEntry.create({
      userId,
      ideaId,
      subscriberName: (name || '').trim().slice(0, 200),
      subscriberEmail: email.trim().toLowerCase()
    });
    return res.json({ success: true, message: 'You\'re on the waitlist!' });
  } catch (err) {
    // Duplicate key = already signed up
    if (err.code === 11000) {
      return res.json({ success: true, message: 'You\'re already on the waitlist!' });
    }
    console.error('submitWaitlist error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};

// ─── PROTECTED: Get waitlist for an idea (auth required) ───────────────────────
const getWaitlist = async (req, res) => {
  const userId = req.user.userId;
  const { ideaId } = req.params;

  try {
    const entries = await WaitlistEntry.find({ userId, ideaId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ entries, count: entries.length });
  } catch (err) {
    console.error('getWaitlist error:', err);
    return res.status(500).json({ error: 'Failed to fetch waitlist' });
  }
};

// ─── PROTECTED: Export waitlist as CSV ─────────────────────────────────────────
const exportWaitlistCSV = async (req, res) => {
  const userId = req.user.userId;
  const { ideaId } = req.params;

  try {
    const entries = await WaitlistEntry.find({ userId, ideaId })
      .sort({ createdAt: -1 })
      .lean();

    const header = 'Name,Email,Signed Up\n';
    const rows = entries.map(e => {
      const name = (e.subscriberName || '').replace(/,/g, ' ');
      const email = e.subscriberEmail;
      const date = new Date(e.createdAt).toISOString().split('T')[0];
      return `${name},${email},${date}`;
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="waitlist-${ideaId}.csv"`);
    return res.send(header + rows);
  } catch (err) {
    console.error('exportWaitlistCSV error:', err);
    return res.status(500).json({ error: 'Export failed' });
  }
};

module.exports = { submitWaitlist, getWaitlist, exportWaitlistCSV };
