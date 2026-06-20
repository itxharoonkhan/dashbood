const crypto = require('crypto');

/**
 * Protects internal/scheduled endpoints with a static API key.
 * Caller must send:  x-api-key: <CRON_API_KEY from .env>
 * Uses timing-safe comparison to prevent key-guessing attacks.
 */
module.exports = function apiKeyMiddleware(req, res, next) {
  const provided = req.headers['x-api-key'];
  const expected = process.env.CRON_API_KEY;

  if (!provided || !expected) {
    console.error('❌ API key missing — request blocked:', req.path);
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }

  try {
    const providedBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(expected);

    // timingSafeEqual requires identical buffer lengths; length mismatch = reject
    if (providedBuf.length !== expectedBuf.length) {
      console.error('❌ API key length mismatch — request blocked:', req.path);
      return res.status(401).json({ error: 'Invalid or missing API key' });
    }

    if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      console.error('❌ API key mismatch — request blocked:', req.path);
      return res.status(401).json({ error: 'Invalid or missing API key' });
    }

    next();
  } catch (err) {
    console.error('❌ API key middleware error:', err);
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
};
