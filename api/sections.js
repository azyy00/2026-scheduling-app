const { getPool } = require('./_db');
const { verifyToken } = require('./_auth');

module.exports = async (req, res) => {
  try { verifyToken(req); } catch { return res.status(401).json({ message: 'Unauthorized' }); }
  const pool = getPool();
  const id = req.query.id;

  if (req.method === 'GET') {
    const [rows] = await pool.query('SELECT * FROM sections ORDER BY year_level, name');
    return res.json(rows);
  }
  if (req.method === 'POST') {
    const { name, year_level } = req.body;
    const [r] = await pool.query('INSERT INTO sections (name, year_level) VALUES (?,?)', [name, year_level]);
    return res.status(201).json({ id: r.insertId });
  }
  if (req.method === 'PUT' && id) {
    const { name, year_level } = req.body;
    await pool.query('UPDATE sections SET name=?, year_level=? WHERE id=?', [name, year_level, id]);
    return res.json({ success: true });
  }
  if (req.method === 'DELETE' && id) {
    await pool.query('DELETE FROM sections WHERE id=?', [id]);
    return res.json({ success: true });
  }
  res.status(405).end();
};
