const { getPool } = require('./_db');
const { verifyToken } = require('./_auth');

const conflictQuery = `
  SELECT s2.id,
    CASE WHEN s2.classroom_id = s1.classroom_id THEN CONCAT('Room conflict with ', s2.subject_code, ' (', s2.section_name, ')') END as room_conflict,
    CASE WHEN s2.instructor_id = s1.instructor_id THEN CONCAT('Instructor conflict with ', s2.subject_code, ' (', s2.section_name, ')') END as inst_conflict
  FROM schedules_view s1
  JOIN schedules_view s2 ON s2.id != s1.id
    AND s2.day_of_week = s1.day_of_week
    AND s2.semester = s1.semester
    AND s2.school_year = s1.school_year
    AND s2.time_start < s1.time_end
    AND s2.time_end > s1.time_start
    AND (s2.classroom_id = s1.classroom_id OR s2.instructor_id = s1.instructor_id)
  WHERE s1.id = ?
`;

const listQuery = `
  SELECT s.id, s.subject_id, s.instructor_id, s.classroom_id, s.section_id,
    s.day_of_week, s.time_start, s.time_end, s.semester, s.school_year,
    sub.code as subject_code, sub.name as subject_name,
    i.name as instructor_name, c.room_code, sec.name as section_name
  FROM schedules s
  JOIN subjects sub ON sub.id = s.subject_id
  JOIN instructors i ON i.id = s.instructor_id
  JOIN classrooms c ON c.id = s.classroom_id
  JOIN sections sec ON sec.id = s.section_id
  ORDER BY s.day_of_week, s.time_start
`;

module.exports = async (req, res) => {
  try {
    verifyToken(req);
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const pool = getPool();
  const { method } = req;
  const id = req.query.id;
  const instructorId = req.query.instructor_id;

  if (method === 'GET') {
    let query = listQuery;
    const params = [];
    if (instructorId) {
      query = query.replace('ORDER BY', 'WHERE s.instructor_id = ? ORDER BY');
      params.push(instructorId);
    }
    const [rows] = await pool.query(query, params);

    const baseQuery = listQuery.replace('ORDER BY s.day_of_week, s.time_start', '');
    for (const row of rows) {
      const [conflicts] = await pool.query(
        `SELECT s2.id,
          IF(s2.classroom_id = s1.classroom_id, CONCAT('Room conflict: ', s2.subject_code, ' (', s2.section_name, ')'), NULL) as room_c,
          IF(s2.instructor_id = s1.instructor_id, CONCAT('Instructor conflict: ', s2.subject_code, ' (', s2.section_name, ')'), NULL) as inst_c
        FROM schedules s1
        JOIN (${baseQuery}) s2
          ON s2.id != s1.id
          AND s2.day_of_week = s1.day_of_week
          AND s2.semester = s1.semester
          AND s2.school_year = s1.school_year
          AND s2.time_start < s1.time_end
          AND s2.time_end > s1.time_start
          AND (s2.classroom_id = s1.classroom_id OR s2.instructor_id = s1.instructor_id)
        WHERE s1.id = ?`,
        [row.id]
      );
      row.conflicts = conflicts.flatMap(c => [c.room_c, c.inst_c].filter(Boolean));
    }
    return res.json(rows);
  }

  if (method === 'POST') {
    const { subject_id, instructor_id, classroom_id, section_id, day_of_week, time_start, time_end, semester, school_year } = req.body;
    const [result] = await pool.query(
      'INSERT INTO schedules (subject_id, instructor_id, classroom_id, section_id, day_of_week, time_start, time_end, semester, school_year) VALUES (?,?,?,?,?,?,?,?,?)',
      [subject_id, instructor_id, classroom_id, section_id, day_of_week, time_start, time_end, semester, school_year]
    );
    return res.status(201).json({ id: result.insertId });
  }

  if (method === 'PUT' && id) {
    const { subject_id, instructor_id, classroom_id, section_id, day_of_week, time_start, time_end, semester, school_year } = req.body;
    await pool.query(
      'UPDATE schedules SET subject_id=?, instructor_id=?, classroom_id=?, section_id=?, day_of_week=?, time_start=?, time_end=?, semester=?, school_year=? WHERE id=?',
      [subject_id, instructor_id, classroom_id, section_id, day_of_week, time_start, time_end, semester, school_year, id]
    );
    return res.json({ success: true });
  }

  if (method === 'DELETE' && id) {
    await pool.query('DELETE FROM schedules WHERE id=?', [id]);
    return res.json({ success: true });
  }

  res.status(405).end();
};
