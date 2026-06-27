const { getPool } = require('./_db');
const { verifyToken } = require('./_auth');

module.exports = async (req, res) => {
  try { verifyToken(req); } catch { return res.status(401).json({ message: 'Unauthorized' }); }
  const pool = getPool();
  const id = req.query.id;

  // POST /api/students?action=import
  if (req.query.action === 'import') {
    if (req.method !== 'POST') return res.status(405).end();
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ message: 'No data provided.' });
    const [sections] = await pool.query('SELECT id, name FROM sections');
    const sectionMap = {};
    sections.forEach(s => { sectionMap[s.name.toLowerCase()] = s.id; });
    let inserted = 0, skipped = 0, errors = [];
    for (const row of rows) {
      const { student_id, name, year_level, section_name } = row;
      if (!student_id || !name) { skipped++; continue; }
      try {
        const [r] = await pool.query(
          'INSERT IGNORE INTO students (student_id, name, year_level, section_id) VALUES (?,?,?,?)',
          [String(student_id).trim(), String(name).trim(), parseInt(year_level) || 1, sectionMap[section_name?.toLowerCase()] || null]
        );
        r.affectedRows ? inserted++ : skipped++;
      } catch (err) { errors.push(`${student_id}: ${err.message}`); skipped++; }
    }
    return res.json({ inserted, skipped, errors });
  }

  if (req.method === 'GET') {
    const [rows] = await pool.query('SELECT s.*, sec.name as section_name FROM students s LEFT JOIN sections sec ON sec.id = s.section_id ORDER BY s.student_id');
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
