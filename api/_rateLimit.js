// Simple in-memory rate limiter per IP
// Works per serverless instance; sufficient for a small college system
const store = new Map();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;           // max login attempts per window

function getIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function rateLimit(req) {
  const ip = getIp(req);
  const now = Date.now();
  const entry = store.get(ip) || { count: 0, resetAt: now + WINDOW_MS };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + WINDOW_MS;
  }

  entry.count++;
  store.set(ip, entry);

  if (entry.count > MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { blocked: true, retryAfter };
  }
  return { blocked: false };
}

// Clean up stale entries every hour to avoid memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(ip);
  }
}, 60 * 60 * 1000);

module.exports = { rateLimit };
