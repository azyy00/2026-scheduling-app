const mysql = require('mysql2/promise');

let pool;

const getPool = () => {
  // Re-create pool if env vars weren't available on first init (Vercel cold start)
  if (!pool || !process.env.TIDB_HOST) {
    pool = mysql.createPool({
      host: process.env.TIDB_HOST,
      port: parseInt(process.env.TIDB_PORT) || 4000,
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      database: process.env.TIDB_DATABASE,
      ssl: { rejectUnauthorized: true },
      waitForConnections: true,
      connectionLimit: 5,
    });
  }
  return pool;
};

// Auto-migrations for the self-registration feature. Idempotent — safe to call on every request.
let _migrated = false;
const ensureRegistrationTables = async (pool) => {
  if (_migrated) return;
  // activation_requests: allow requests with no pre-existing instructor record
  await pool.query(`ALTER TABLE activation_requests ADD COLUMN IF NOT EXISTS full_name VARCHAR(255) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE activation_requests ADD COLUMN IF NOT EXISTS department VARCHAR(20) NULL`).catch(() => {});
  await pool.query(`ALTER TABLE activation_requests MODIFY instructor_id INT NULL`).catch(() => {});
  // student self-registration requests
  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});
  // year level + section chosen at registration time
  await pool.query(`ALTER TABLE student_requests ADD COLUMN IF NOT EXISTS year_level INT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE student_requests ADD COLUMN IF NOT EXISTS section_id INT NULL`).catch(() => {});
  _migrated = true;
};

// Auto-migrations + seed for the academic-year / active-term feature.
let _termMigrated = false;
const ensureTermTables = async (pool) => {
  if (_termMigrated) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS app_settings (
    id INT PRIMARY KEY,
    active_school_year VARCHAR(20),
    active_semester VARCHAR(20)
  )`).catch(() => {});
  await pool.query(`CREATE TABLE IF NOT EXISTS academic_years (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_year VARCHAR(20) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => {});
  await pool.query(`CREATE TABLE IF NOT EXISTS student_enrollment_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_pk INT,
    student_id VARCHAR(50),
    school_year VARCHAR(20),
    year_level INT,
    section_id INT,
    section_name VARCHAR(100),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => {});

  // Seed the single settings row if missing — derive default term from existing schedules.
  let rows = [];
  try { [rows] = await pool.query('SELECT id FROM app_settings WHERE id=1'); } catch {}
  if (!rows || rows.length === 0) {
    let defYear = null, defSem = '1st';
    try {
      const [r] = await pool.query('SELECT school_year, semester FROM schedules WHERE school_year IS NOT NULL GROUP BY school_year, semester ORDER BY COUNT(*) DESC LIMIT 1');
      if (r && r[0]) { defYear = r[0].school_year; defSem = r[0].semester || '1st'; }
    } catch {}
    if (!defYear) { const y = new Date().getFullYear(); defYear = `${y}-${y + 1}`; }
    await pool.query('INSERT INTO app_settings (id, active_school_year, active_semester) VALUES (1,?,?)', [defYear, defSem]).catch(() => {});
    await pool.query('INSERT IGNORE INTO academic_years (school_year) VALUES (?)', [defYear]).catch(() => {});
  }
  // Backfill known years from existing schedule data.
  await pool.query('INSERT IGNORE INTO academic_years (school_year) SELECT DISTINCT school_year FROM schedules WHERE school_year IS NOT NULL AND school_year <> ""').catch(() => {});
  _termMigrated = true;
};

const getActiveTerm = async (pool) => {
  await ensureTermTables(pool);
  const [rows] = await pool.query('SELECT active_school_year, active_semester FROM app_settings WHERE id=1');
  return rows[0] || { active_school_year: null, active_semester: null };
};

// Password reset support. Idempotent and safe to run during auth requests.
let _passwordResetMigrated = false;
const ensurePasswordResetTables = async (pool) => {
  if (_passwordResetMigrated) return;

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL`).catch(() => {});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_codes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      code_hash VARCHAR(128) NOT NULL,
      expires_at DATETIME NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      used_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `).catch(() => {});
  await pool.query(`CREATE INDEX idx_password_reset_user_active ON password_reset_codes (user_id, used_at, expires_at)`).catch(() => {});

  // Production convenience: keep the default admin's recovery email in sync
  // with Vercel/local env, without overwriting a manually saved address.
  if (process.env.ADMIN_EMAIL) {
    await pool.query(
      'UPDATE users SET email = ? WHERE role = "admin" AND username = "admin" AND (email IS NULL OR email = "")',
      [process.env.ADMIN_EMAIL.trim()]
    ).catch(() => {});
  }

  _passwordResetMigrated = true;
};

// ── Activity log (audit trail of everything that happens in the system) ──
let _activityMigrated = false;
const ensureActivityTable = async (pool) => {
  if (_activityMigrated) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(40),
    action VARCHAR(40),
    type VARCHAR(20) DEFAULT 'info',
    title VARCHAR(255),
    detail TEXT,
    actor_name VARCHAR(255),
    actor_role VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => {});
  _activityMigrated = true;
};

// Fire-and-forget logger — records an event and NEVER throws into the request flow.
const logActivity = async (pool, entry = {}) => {
  try {
    await ensureActivityTable(pool);
    await pool.query(
      'INSERT INTO activity_log (category, action, type, title, detail, actor_name, actor_role) VALUES (?,?,?,?,?,?,?)',
      [
        entry.category || 'system',
        entry.action || null,
        entry.type || 'info',
        (entry.title || '').slice(0, 255),
        entry.detail || null,
        entry.actor_name || 'System',
        entry.actor_role || null,
      ]
    );
  } catch { /* logging must never break the actual request */ }
};

// Central DB-error handler: maps known errors to friendly responses and never leaks
// raw SQL/internals to the client. Use in endpoint catch blocks: return handleDbError(err, res).
const handleDbError = (err, res, context = 'Request') => {
  const code = err && err.code;
  if (code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'That record already exists.' });
  }
  if (code === 'ER_ROW_IS_REFERENCED_2' || code === 'ER_ROW_IS_REFERENCED') {
    return res.status(409).json({ message: 'This item is still in use and cannot be removed.' });
  }
  if (code === 'ER_NO_REFERENCED_ROW_2' || code === 'ER_NO_REFERENCED_ROW') {
    return res.status(400).json({ message: 'A referenced record was not found.' });
  }
  if (code === 'ER_BAD_NULL_ERROR' || code === 'WARN_DATA_TRUNCATED' || code === 'ER_DATA_TOO_LONG') {
    return res.status(400).json({ message: 'Some fields are missing or invalid.' });
  }
  // Log full detail server-side only; return a generic message to the client.
  console.error(`${context} error:`, err && err.message ? err.message : err);
  return res.status(500).json({ message: 'Something went wrong. Please try again.' });
};

module.exports = { getPool, ensureRegistrationTables, ensureTermTables, getActiveTerm, ensurePasswordResetTables, handleDbError, ensureActivityTable, logActivity };
