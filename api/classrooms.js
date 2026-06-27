const { getPool } = require('./_db');
const { verifyToken } = require('./_auth');

module.exports = async (req, res) => {
  try { verifyToken(req); } catch { return res.status(401).json({ message: 'Unauthorized' }); }
  const pool = getPool();
  const id = req.query.id;

  if (req.method === 'GET') {
    const [rows] = await pool.query('SELECT * FROM classrooms ORDER BY room_code');
    return res.json(rows);
  }
  if (req.method === 'POST') {
    const { room_code, building, capacity } = req.body;
    const [r] = await pool.query('INSERT INTO classrooms (room_code, building, capacity) VALUES (?,?,?)', [room_code, building, capacity]);
    return res.status(201).json({ id: r.insertId });
  }
  if (req.method === 'PUT' && id) {
    const { room_code, building, capacity } = req.body;
    await pool.query('UPDATE classrooms SET room_code=?, building=?, capacity=? WHERE id=?', [room_code, building, capacity, id]);
    return res.json({ success: true });
  }
  if (req.method === 'DELETE' && id) {
    await pool.query('DELETE FROM classrooms WHERE id=?', [id]);
    return res.json({ success: true });
  }
  res.status(405).end();
};
