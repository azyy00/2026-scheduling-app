const { getPool } = require('./_db');
const { verifyToken } = require('./_auth');

module.exports = async (req, res) => {
  try { verifyToken(req); } catch { return res.status(401).json({ message: 'Unauthorized' }); }
  const pool = getPool();
  const id = req.query.id;

  // POST /api/subjects?action=import
  if (req.query.action === 'import') {
    if (req.method !== 'POST') return res.status(405).end();
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ message: 'No data provided.' });
    let inserted = 0, skipped = 0, errors = [];
    for (const row of rows) {
      const { code, name, units } = row;
      if (!code && !name) { skipped++; continue; }
      try {
        const [existing] = await pool.query('SELECT id FROM subjects WHERE code = ? OR LOWER(name) = ?', [code?.trim() || '', (name || '').toLowerCase().trim()]);
        if (existing.length) { skipped++; continue; }
        await pool.query('INSERT INTO subjects (code, name, units) VALUES (?,?,?)', [code?.trim() || null, name?.trim() || null, parseInt(units) || null]);
        inserted++;
      } catch (err) { errors.push(`${code || name}: ${err.message}`); skipped++; }
    }
    return res.json({ inserted, skipped, errors });
  }

  if (req.method === 'GET') {
    const [rows] = await pool.query('SELECT * FROM subjects ORDER BY code');
    return res.json(rows);
  }
  if (req.method === 'POST') {
    const { code, name, units } = req.body;
    const [r] = await pool.query('INSERT INTO subjects (code, name, units) VALUES (?,?,?)', [code, name, units]);
    return res.status(201).json({ id: r.insertId });
  }
  if (req.method === 'PUT' && id) {
    const { code, name, units } = req.body;
    await pool.query('UPDATE subjects SET code=?, name=?, units=? WHERE id=?', [code, name, units, id]);
    return res.json({ success: true });
  }
  if (req.method === 'DELETE' && id) {
    await pool.query('DELETE FROM subjects WHERE id=?', [id]);
    return res.json({ success: true });
  }
  res.status(405).end();
};
