const { getPool } = require('../_db');
const { verifyToken } = require('../_auth');

module.exports = async (req, res) => {
  try { verifyToken(req); } catch { return res.status(401).json({ message: 'Unauthorized' }); }
  if (req.method !== 'POST') return res.status(405).end();

  const { rows } = req.body; // [{ code, name, units }]
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ message: 'No data provided.' });

  const pool = getPool();
  let inserted = 0, skipped = 0, errors = [];

  for (const row of rows) {
    const { code, name, units } = row;
    if (!code && !name) { skipped++; continue; }
    try {
      const [existing] = await pool.query(
        'SELECT id FROM subjects WHERE code = ? OR LOWER(name) = ?',
        [code?.trim() || '', (name || '').toLowerCase().trim()]
      );
      if (existing.length > 0) { skipped++; continue; }
      await pool.query(
        'INSERT INTO subjects (code, name, units) VALUES (?,?,?)',
        [code?.trim() || null, name?.trim() || null, parseInt(units) || null]
      );
      inserted++;
    } catch (err) {
      errors.push(`${code || name}: ${err.message}`);
      skipped++;
    }
  }

  res.json({ inserted, skipped, errors });
};
