const { getPool } = require('../_db');
const { signToken } = require('../_auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const { student_id } = req.body;
  if (!student_id) return res.status(400).json({ message: 'Student ID required' });

  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT s.id, s.student_id, s.name, s.year_level, s.section_id, sec.name as section_name FROM students s LEFT JOIN sections sec ON sec.id = s.section_id WHERE s.student_id = ?',
    [student_id]
  );
  const student = rows[0];
  if (!student) return res.status(401).json({ message: 'Student ID not found' });

  const token = signToken({ id: student.id, role: 'student', student_id: student.student_id, name: student.name, year_level: student.year_level, section_id: student.section_id, section_name: student.section_name });
  res.json({ token });
};
