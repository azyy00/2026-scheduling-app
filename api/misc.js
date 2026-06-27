const { getPool } = require('./_db');
const { verifyToken } = require('./_auth');
const bcrypt = require('bcryptjs');

const CONFLICT_JOIN = `
  JOIN schedules s2 ON s2.id != s1.id
    AND s2.day_of_week = s1.day_of_week
    AND s2.semester = s1.semester
    AND s2.school_year = s1.school_year
    AND s2.time_start < s1.time_end
    AND s2.time_end > s1.time_start
    AND (s2.classroom_id = s1.classroom_id OR s2.instructor_id = s1.instructor_id)
`;

module.exports = async (req, res) => {
  let user;
  try { user = verifyToken(req); } catch { return res.status(401).json({ message: 'Unauthorized' }); }

  const action = req.query.action;
  const pool = getPool();

  // GET /api/misc?action=dashboard-stats
  if (action === 'dashboard-stats') {
    const [[sched]] = await pool.query('SELECT COUNT(*) as c FROM schedules');
    const [[rooms]] = await pool.query('SELECT COUNT(*) as c FROM classrooms');
    const [[inst]]  = await pool.query('SELECT COUNT(*) as c FROM instructors');
    const [conf]    = await pool.query(`SELECT COUNT(DISTINCT s1.id) as c FROM schedules s1 ${CONFLICT_JOIN}`);
    return res.json({ schedules: sched.c, classrooms: rooms.c, instructors: inst.c, conflicts: conf[0].c });
  }

  // GET /api/misc?action=instructor-schedules
  if (action === 'instructor-schedules') {
    if (user.role !== 'instructor') return res.status(403).json({ message: 'Forbidden' });
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
    for (const row of rows) {
      const [conflicts] = await pool.query(
        `SELECT IF(s2.classroom_id=s1.classroom_id,CONCAT('Room: ',sub2.code,' (',sec2.name,')'),NULL) as room_c,
                IF(s2.instructor_id=s1.instructor_id,CONCAT('Instructor: ',sub2.code,' (',sec2.name,')'),NULL) as inst_c
         FROM schedules s1
         JOIN schedules s2 ON s2.id!=s1.id AND s2.day_of_week=s1.day_of_week AND s2.semester=s1.semester
           AND s2.school_year=s1.school_year AND s2.time_start<s1.time_end AND s2.time_end>s1.time_start
           AND (s2.classroom_id=s1.classroom_id OR s2.instructor_id=s1.instructor_id)
         JOIN subjects sub2 ON sub2.id=s2.subject_id
         JOIN sections sec2 ON sec2.id=s2.section_id
         WHERE s1.id=?`, [row.id]
      );
      row.conflicts = conflicts.flatMap(c => [c.room_c, c.inst_c].filter(Boolean));
    }
    return res.json(rows);
  }

  // GET /api/misc?action=student-schedules
  if (action === 'student-schedules') {
    if (user.role !== 'student') return res.status(403).json({ message: 'Forbidden' });
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
    return res.json(rows);
  }

  // GET /api/misc?action=activation-requests  (admin only)
  if (action === 'activation-requests') {
    if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    if (req.method === 'GET') {
      const [rows] = await pool.query(
        `SELECT ar.id, ar.instructor_id, ar.desired_username, ar.status, ar.created_at,
                i.name as instructor_name, i.department
         FROM activation_requests ar JOIN instructors i ON i.id = ar.instructor_id
         ORDER BY ar.created_at DESC`
      );
      return res.json(rows);
    }
    if (req.method === 'POST') {
      const id = req.query.id;
      const act = req.query.act; // approve | reject
      if (act === 'approve') {
        const [[row]] = await pool.query('SELECT * FROM activation_requests WHERE id=? AND status="pending"', [id]);
        if (!row) return res.status(404).json({ message: 'Not found or already processed.' });
        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();
          const [uRes] = await conn.query('INSERT INTO users (username, password_hash, role) VALUES (?,?,?)', [row.desired_username, row.password_hash, 'instructor']);
          await conn.query('UPDATE instructors SET user_id=? WHERE id=?', [uRes.insertId, row.instructor_id]);
          await conn.query('UPDATE activation_requests SET status="approved" WHERE id=?', [id]);
          await conn.commit();
          return res.json({ message: 'Account activated.' });
        } catch (err) {
          await conn.rollback();
          if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Username taken.' });
          throw err;
        } finally { conn.release(); }
      }
      if (act === 'reject') {
        await pool.query('UPDATE activation_requests SET status="rejected" WHERE id=?', [id]);
        return res.json({ message: 'Request rejected.' });
      }
    }
  }

  res.status(400).json({ message: 'Unknown action.' });
};
