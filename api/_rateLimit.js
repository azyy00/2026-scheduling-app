// Rate limiting.
//  • rateLimit(): in-memory, best-effort (signup / change-password / reset).
//  • loginCheck/loginStrike/loginReset(): DB-backed so failed-login limits hold
//    reliably across serverless instances (which don't share memory).
const store = new Map();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_GENERAL = 10;
const MAX_LOGIN = 3;

function getIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

const keyOf = (req, scope) => `${getIp(req)}:${scope}`;

// ── In-memory (best effort) ──
function rateLimit(req, scope = 'general', max = MAX_GENERAL) {
  const k = keyOf(req, scope);
  const now = Date.now();
  let entry = store.get(k);
  if (!entry || now > entry.resetAt) entry = { count: 0, resetAt: now + WINDOW_MS };
  entry.count++;
  store.set(k, entry);
  if (entry.count > max) return { blocked: true, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  return { blocked: false };
}

let cleanupScheduled = false;
(function scheduleCleanup() {
  if (cleanupScheduled) return;
  cleanupScheduled = true;
  setInterval(() => {
    const now = Date.now();
    for (const [k, entry] of store.entries()) if (now > entry.resetAt) store.delete(k);
  }, 60 * 60 * 1000);
})();

// ── DB-backed login limiter ──
let _tableReady = false;
async function ensureTable(pool) {
  if (_tableReady) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS login_attempts (
    k VARCHAR(160) PRIMARY KEY,
    count INT NOT NULL DEFAULT 0,
    reset_at BIGINT NOT NULL
  )`).catch(() => {});
  _tableReady = true;
}

// Read-only — does NOT count. Use before validating credentials.
async function loginCheck(pool, req, scope, max = MAX_LOGIN) {
  try {
    await ensureTable(pool);
    const now = Date.now();
    const [[row]] = await pool.query('SELECT count, reset_at FROM login_attempts WHERE k=?', [keyOf(req, scope)]);
    if (!row || now > Number(row.reset_at)) return { blocked: false, remaining: max };
    if (row.count >= max) return { blocked: true, retryAfter: Math.ceil((Number(row.reset_at) - now) / 1000) };
    return { blocked: false, remaining: max - row.count };
  } catch { return { blocked: false, remaining: max }; }
}

// Record one failed attempt; returns the new count.
async function loginStrike(pool, req, scope) {
  try {
    await ensureTable(pool);
    const k = keyOf(req, scope);
    const now = Date.now();
    const [[row]] = await pool.query('SELECT count, reset_at FROM login_attempts WHERE k=?', [k]);
    if (!row || now > Number(row.reset_at)) {
      const resetAt = now + WINDOW_MS;
      await pool.query(
        'INSERT INTO login_attempts (k, count, reset_at) VALUES (?,1,?) ON DUPLICATE KEY UPDATE count=1, reset_at=?',
        [k, resetAt, resetAt]
      );
      return 1;
    }
    const c = row.count + 1;
    await pool.query('UPDATE login_attempts SET count=? WHERE k=?', [c, k]);
    return c;
  } catch { return 0; }
}

// Clear on a successful login.
async function loginReset(pool, req, scope) {
  try { await pool.query('DELETE FROM login_attempts WHERE k=?', [keyOf(req, scope)]); } catch {}
}

module.exports = { rateLimit, loginCheck, loginStrike, loginReset, MAX_LOGIN };
