const { getPool } = require('../_db');
const { verifyToken } = require('../_auth');

module.exports = async (req, res) => {
  let user;
  try { user = verifyToken(req); } catch { return res.status(401).json({ message: 'Unauthorized' }); }
  if (user.role !== 'student') return res.status(403).json({ message: 'Forbidden' });

  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT s.id, s.day_of_week, s.time_start, s.time_end, s.semester, s.school_year,
      sub.code as subject_code, sub.name as subject_name, sub.units,
      c.room_code, i.name as instructor_name, sec.name as section_name
    FROM schedules s
    JOIN subjects sub ON sub.id = s.subject_id
    JOIN classrooms c ON c.id = s.classroom_id
    JOIN instructors i ON i.id = s.instructor_id
    JOIN sections sec ON sec.id = s.section_id
    WHERE s.section_id = ?
    ORDER BY s.day_of_week, s.time_start`,
    [user.section_id]
  );

  res.json(rows);
};
