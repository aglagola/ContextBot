const db = require('../db/database');

const FREE_TIER_LIMIT = 10;

const rateLimit = (req, res, next) => {
  const user = req.user; // Set by auth middleware
  
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (user.tier === 'pro') {
    return next();
  }

  const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'

  try {
    // Upsert usage record for current month
    const upsertStmt = db.prepare(`
      INSERT INTO usage (user_id, month, count)
      VALUES (?, ?, 0)
      ON CONFLICT(user_id, month) DO NOTHING
    `);
    upsertStmt.run(user.id, currentMonth);

    // Get current count
    const getStmt = db.prepare('SELECT count FROM usage WHERE user_id = ? AND month = ?');
    const usage = getStmt.get(user.id, currentMonth);

    if (usage.count >= FREE_TIER_LIMIT) {
      return res.status(429).json({ 
        error: 'Free tier limit reached', 
        message: 'You have reached your 10 free analyses for the month. Upgrade to Pro for unlimited analyses.' 
      });
    }

    // Increment count
    const updateStmt = db.prepare('UPDATE usage SET count = count + 1 WHERE user_id = ? AND month = ?');
    updateStmt.run(user.id, currentMonth);

    next();
  } catch (error) {
    console.error('Rate limit error:', error);
    res.status(500).json({ error: 'Internal server error checking rate limit' });
  }
};

module.exports = { rateLimit };
