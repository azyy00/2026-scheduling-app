require('dotenv').config();
const { getPool } = require('../_db');
const { verifyToken } = require('../_auth');

module.exports = async (req, res) => {
  try { verifyToken(req); } catch { return res.status(401).json({ message: 'Unauthorized' }); }
  if (req.method !== 'POST') return res.status(405).end();

  const { rows } = req.body; // [{ student_id, name, year_level, section_name }]
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ message: 'No data provided.' });

  const pool = getPool();
  const [sections] = await pool.query('SELECT id, name FROM sections');
  const sectionMap = {};
  sections.forEach(s => { sectionMap[s.name.toLowerCase()] = s.id; });

  let inserted = 0, skipped = 0, errors = [];

  for (const row of rows) {
    const { student_id, name, year_level, section_name } = row;
    if (!student_id || !name) { skipped++; continue; }

    const section_id = sectionMap[section_name?.toLowerCase()] || null;
    try {
      await pool.query(
        'INSERT IGNORE INTO students (student_id, name, year_level, section_id) VALUES (?,?,?,?)',
        [String(student_id).trim(), String(name).trim(), parseInt(year_level) || 1, section_id]
      );
      inserted++;
    } catch (err) {
      errors.push(`${student_id}: ${err.message}`);
      skipped++;
    }
  }

  res.json({ inserted, skipped, errors });
};
