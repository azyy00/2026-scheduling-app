const { getPool } = require('./_db');
const { verifyToken } = require('./_auth');

module.exports = async (req, res) => {
  try { verifyToken(req); } catch { return res.status(401).json({ message: 'Unauthorized' }); }
  const pool = getPool();
  const id = req.query.id;

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
