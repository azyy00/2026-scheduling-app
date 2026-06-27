require('dotenv').config();
const { getPool } = require('../_db');
const { verifyToken } = require('../_auth');

module.exports = async (req, res) => {
  try { verifyToken(req); } catch { return res.status(401).json({ message: 'Unauthorized' }); }
  if (req.method !== 'POST') return res.status(405).end();

  const { rows } = req.body; // [{ name, department }]
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ message: 'No data provided.' });

  const pool = getPool();
  let inserted = 0, skipped = 0, errors = [];

  for (const row of rows) {
    const { name, department, position } = row;
    if (!name) { skipped++; continue; }
    try {
      const [existing] = await pool.query('SELECT id FROM instructors WHERE LOWER(name) = ?', [name.toLowerCase().trim()]);
      if (existing.length > 0) { skipped++; continue; }
      await pool.query('INSERT INTO instructors (name, department, position, user_id) VALUES (?,?,?,NULL)', [name.trim(), department?.trim() || null, position?.trim() || null]);
      inserted++;
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
      skipped++;
    }
  }

  res.json({ inserted, skipped, errors });
};
