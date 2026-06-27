const { getPool } = require('./_db');
const { verifyToken } = require('./_auth');

module.exports = async (req, res) => {
  try { verifyToken(req); } catch { return res.status(401).json({ message: 'Unauthorized' }); }
  const pool = getPool();
  const id = req.query.id;

  if (req.method === 'GET') {
    const [rows] = await pool.query(
      'SELECT s.*, sec.name as section_name FROM students s LEFT JOIN sections sec ON sec.id = s.section_id ORDER BY s.student_id'
    );
    return res.json(rows);
  }
  if (req.method === 'POST') {
    const { student_id, name, year_level, section_id } = req.body;
    try {
      const [r] = await pool.query('INSERT INTO students (student_id, name, year_level, section_id) VALUES (?,?,?,?)', [student_id, name, year_level, section_id]);
      return res.status(201).json({ id: r.insertId });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Student ID already exists' });
      throw err;
    }
  }
  if (req.method === 'PUT' && id) {
    const { student_id, name, year_level, section_id } = req.body;
    await pool.query('UPDATE students SET student_id=?, name=?, year_level=?, section_id=? WHERE id=?', [student_id, name, year_level, section_id, id]);
    return res.json({ success: true });
  }
  if (req.method === 'DELETE' && id) {
    await pool.query('DELETE FROM students WHERE id=?', [id]);
    return res.json({ success: true });
  }
  res.status(405).end();
};
