const { getPool } = require('../_db');
const { verifyToken } = require('../_auth');

module.exports = async (req, res) => {
  try { verifyToken(req); } catch { return res.status(401).json({ message: 'Unauthorized' }); }
  const pool = getPool();

  const [[sched]] = await pool.query('SELECT COUNT(*) as c FROM schedules');
  const [[rooms]] = await pool.query('SELECT COUNT(*) as c FROM classrooms');
  const [[inst]] = await pool.query('SELECT COUNT(*) as c FROM instructors');

  // Count schedules that have at least one conflict
  const [conflictRows] = await pool.query(`
    SELECT COUNT(DISTINCT s1.id) as c FROM schedules s1
    JOIN schedules s2 ON s2.id != s1.id
      AND s2.day_of_week = s1.day_of_week
      AND s2.semester = s1.semester
      AND s2.school_year = s1.school_year
      AND s2.time_start < s1.time_end
      AND s2.time_end > s1.time_start
      AND (s2.classroom_id = s1.classroom_id OR s2.instructor_id = s1.instructor_id)
  `);

  res.json({ schedules: sched.c, classrooms: rooms.c, instructors: inst.c, conflicts: conflictRows[0].c });
};
