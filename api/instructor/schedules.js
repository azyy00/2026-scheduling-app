const { getPool } = require('../_db');
const { verifyToken } = require('../_auth');

module.exports = async (req, res) => {
  let user;
  try { user = verifyToken(req); } catch { return res.status(401).json({ message: 'Unauthorized' }); }
  if (user.role !== 'instructor') return res.status(403).json({ message: 'Forbidden' });

  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT s.id, s.day_of_week, s.time_start, s.time_end, s.semester, s.school_year,
      s.classroom_id, s.section_id, s.instructor_id,
      sub.code as subject_code, sub.name as subject_name,
      c.room_code, sec.name as section_name
    FROM schedules s
    JOIN subjects sub ON sub.id = s.subject_id
    JOIN classrooms c ON c.id = s.classroom_id
    JOIN sections sec ON sec.id = s.section_id
    WHERE s.instructor_id = ?
    ORDER BY s.day_of_week, s.time_start`,
    [user.instructor_id]
  );

  // Attach conflicts per schedule row
  for (const row of rows) {
    const [conflicts] = await pool.query(
      `SELECT
        IF(s2.classroom_id = s1.classroom_id, CONCAT('Room: ', sub2.code, ' (', sec2.name, ')'), NULL) as room_c,
        IF(s2.instructor_id = s1.instructor_id, CONCAT('Instructor: ', sub2.code, ' (', sec2.name, ')'), NULL) as inst_c
      FROM schedules s1
      JOIN schedules s2 ON s2.id != s1.id
        AND s2.day_of_week = s1.day_of_week
        AND s2.semester = s1.semester
        AND s2.school_year = s1.school_year
        AND s2.time_start < s1.time_end
        AND s2.time_end > s1.time_start
        AND (s2.classroom_id = s1.classroom_id OR s2.instructor_id = s1.instructor_id)
      JOIN subjects sub2 ON sub2.id = s2.subject_id
      JOIN sections sec2 ON sec2.id = s2.section_id
      WHERE s1.id = ?`,
      [row.id]
    );
    row.conflicts = conflicts.flatMap(c => [c.room_c, c.inst_c].filter(Boolean));
  }

  res.json(rows);
};
