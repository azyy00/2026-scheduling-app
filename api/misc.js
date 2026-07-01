const { getPool, ensureRegistrationTables, getActiveTerm, handleDbError, ensureActivityTable, logActivity } = require('./_db');
const { requireAuth } = require('./_auth');
const bcrypt = require('bcryptjs');

const CONFLICT_JOIN = `
  JOIN schedules s2 ON s2.id != s1.id
    AND s2.day_of_week = s1.day_of_week
    AND s2.semester = s1.semester
    AND s2.school_year = s1.school_year
    AND s2.time_start < s1.time_end
    AND s2.time_end > s1.time_start
    AND (s2.classroom_id = s1.classroom_id OR s2.instructor_id = s1.instructor_id OR s2.section_id = s1.section_id)
`;

// Attach conflicts from a flat conflict result set onto rows, grouping by schedule_id
function attachConflicts(rows, conflictRows) {
  const map = {};
  for (const c of conflictRows) {
    if (!map[c.schedule_id]) map[c.schedule_id] = [];
    if (c.room_c) map[c.schedule_id].push(c.room_c);
    if (c.inst_c) map[c.schedule_id].push(c.inst_c);
    if (c.sect_c) map[c.schedule_id].push(c.sect_c);
  }
  for (const row of rows) {
    row.conflicts = map[row.id] || [];
  }
}

module.exports = async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const action = req.query.action;
  const pool = getPool();

  try {
    // GET /api/misc?action=dashboard-stats  (admin)
    if (action === 'dashboard-stats') {
      if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      const [[sched]] = await pool.query('SELECT COUNT(*) as c FROM schedules');
      const [[rooms]] = await pool.query('SELECT COUNT(*) as c FROM classrooms');
      const [[inst]]  = await pool.query('SELECT COUNT(*) as c FROM instructors');
      const [conf]    = await pool.query(`SELECT COUNT(DISTINCT s1.id) as c FROM schedules s1 ${CONFLICT_JOIN}`);
      return res.json({ schedules: sched.c, classrooms: rooms.c, instructors: inst.c, conflicts: conf[0].c });
    }

    // /api/misc?action=activity-log  (admin) — paginated audit trail
    if (action === 'activity-log') {
      if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      await ensureActivityTable(pool);
      if (req.method === 'DELETE') {
        await pool.query('DELETE FROM activity_log');
        await logActivity(pool, { category: 'system', action: 'cleared', type: 'warning', title: 'Activity history cleared', actor_name: user.name, actor_role: user.role });
        return res.json({ success: true });
      }
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = parseInt(req.query.offset) || 0;
      const [[{ c }]] = await pool.query('SELECT COUNT(*) as c FROM activity_log');
      const [rows] = await pool.query(
        'SELECT id, category, action, type, title, detail, actor_name, actor_role, created_at FROM activity_log ORDER BY id DESC LIMIT ? OFFSET ?',
        [limit, offset]
      );
      return res.json({ items: rows, total: c, limit, offset });
    }

    // GET /api/misc?action=analytics  (admin) — instructor teaching load for the active term
    if (action === 'analytics') {
      if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      const term = await getActiveTerm(pool);
      const sy = term.active_school_year;
      const sem = term.active_semester;

      const [instructors] = await pool.query(
        `SELECT i.name,
            ROUND(SUM(TIME_TO_SEC(s.time_end) - TIME_TO_SEC(s.time_start)) / 3600, 1) as hours,
            COUNT(*) as classes
         FROM schedules s JOIN instructors i ON i.id = s.instructor_id
         WHERE (? IS NULL OR s.school_year = ?) AND (? IS NULL OR s.semester = ?)
         GROUP BY i.id, i.name ORDER BY hours DESC`,
        [sy, sy, sem, sem]
      );

      return res.json({ term: { school_year: sy, semester: sem }, instructors });
    }

    // GET /api/misc?action=instructor-schedules
    if (action === 'instructor-schedules') {
      if (user.role !== 'instructor') return res.status(403).json({ message: 'Forbidden' });
      const term = await getActiveTerm(pool);
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
          AND (? IS NULL OR s.school_year = ?)
          AND (? IS NULL OR s.semester = ?)
        ORDER BY s.day_of_week, s.time_start`,
        [user.instructor_id, term.active_school_year, term.active_school_year, term.active_semester, term.active_semester]
      );
      if (rows.length > 0) {
        const [conflictRows] = await pool.query(
          `SELECT s1.id as schedule_id,
            IF(s2.classroom_id=s1.classroom_id, CONCAT('Room: ', sub2.code, ' (', sec2.name, ')'), NULL) as room_c,
            IF(s2.instructor_id=s1.instructor_id, CONCAT('Instructor: ', sub2.code, ' (', sec2.name, ')'), NULL) as inst_c,
            IF(s2.section_id=s1.section_id, CONCAT('Section: ', sub2.code, ' (', sec2.name, ')'), NULL) as sect_c
           FROM schedules s1
           JOIN schedules s2 ON s2.id!=s1.id AND s2.day_of_week=s1.day_of_week AND s2.semester=s1.semester
             AND s2.school_year=s1.school_year AND s2.time_start<s1.time_end AND s2.time_end>s1.time_start
             AND (s2.classroom_id=s1.classroom_id OR s2.instructor_id=s1.instructor_id OR s2.section_id=s1.section_id)
           JOIN subjects sub2 ON sub2.id=s2.subject_id
           JOIN sections sec2 ON sec2.id=s2.section_id
           WHERE s1.instructor_id=?`,
          [user.instructor_id]
        );
        attachConflicts(rows, conflictRows);
      } else {
        rows.forEach(r => { r.conflicts = []; });
      }
      return res.json(rows);
    }

    // GET /api/misc?action=student-schedules
    if (action === 'student-schedules') {
      if (user.role !== 'student') return res.status(403).json({ message: 'Forbidden' });
      const term = await getActiveTerm(pool);
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
          AND (? IS NULL OR s.school_year = ?)
          AND (? IS NULL OR s.semester = ?)
        ORDER BY s.day_of_week, s.time_start`,
        [user.section_id, term.active_school_year, term.active_school_year, term.active_semester, term.active_semester]
      );
      return res.json(rows);
    }

    // /api/misc?action=activation-requests  (admin only)
    if (action === 'activation-requests') {
      if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      await ensureRegistrationTables(pool);
      if (req.method === 'GET') {
        const [rows] = await pool.query(
          `SELECT ar.id, ar.instructor_id, ar.desired_username, ar.status, ar.created_at,
                  COALESCE(i.name, ar.full_name) as instructor_name,
                  COALESCE(i.department, ar.department) as department
           FROM activation_requests ar
           LEFT JOIN instructors i ON i.id = ar.instructor_id
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
            if (row.instructor_id) {
              // Admin had pre-created the instructor — just link the new account.
              await conn.query('UPDATE instructors SET user_id=? WHERE id=?', [uRes.insertId, row.instructor_id]);
            } else {
              // Self-registered — create the instructor record automatically.
              await conn.query('INSERT INTO instructors (user_id, name, department) VALUES (?,?,?)', [uRes.insertId, row.full_name, row.department || null]);
            }
            await conn.query('UPDATE activation_requests SET status="approved" WHERE id=?', [id]);
            await conn.commit();
            await logActivity(pool, { category: 'instructor', action: 'approved', type: 'success', title: 'Instructor account activated', detail: `${row.full_name || row.desired_username} (${row.desired_username})`, actor_name: user.name, actor_role: user.role });
            return res.json({ message: 'Account activated.' });
          } catch (err) {
            await conn.rollback();
            if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Username taken.' });
            throw err;
          } finally { conn.release(); }
        }
        if (act === 'reject') {
          const [[row]] = await pool.query('SELECT * FROM activation_requests WHERE id=?', [id]);
          await pool.query('UPDATE activation_requests SET status="rejected" WHERE id=?', [id]);
          await logActivity(pool, { category: 'instructor', action: 'rejected', type: 'warning', title: 'Instructor request rejected', detail: row ? `${row.full_name || row.desired_username} (${row.desired_username})` : `Request #${id}`, actor_name: user.name, actor_role: user.role });
          return res.json({ message: 'Request rejected.' });
        }
      }
    }

    // /api/misc?action=student-requests  (admin only)
    if (action === 'student-requests') {
      if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      await ensureRegistrationTables(pool);
      if (req.method === 'GET') {
        const [rows] = await pool.query(
          `SELECT sr.id, sr.student_id, sr.name, sr.year_level, sr.section_id, sr.status, sr.created_at,
                  sec.name as section_name
           FROM student_requests sr
           LEFT JOIN sections sec ON sec.id = sr.section_id
           ORDER BY sr.created_at DESC`
        );
        return res.json(rows);
      }
      if (req.method === 'POST') {
        const id = req.query.id;
        const act = req.query.act; // approve | reject
        if (act === 'approve') {
          const [[row]] = await pool.query('SELECT * FROM student_requests WHERE id=? AND status="pending"', [id]);
          if (!row) return res.status(404).json({ message: 'Not found or already processed.' });
          const [exists] = await pool.query('SELECT id FROM students WHERE student_id=?', [row.student_id]);
          if (exists.length) {
            await pool.query('UPDATE student_requests SET status="approved" WHERE id=?', [id]);
            return res.status(409).json({ message: 'A student with this ID already exists.' });
          }
          const conn = await pool.getConnection();
          try {
            await conn.beginTransaction();
            // Use the year level and section the student chose at registration.
            await conn.query('INSERT INTO students (student_id, name, year_level, section_id) VALUES (?,?,?,?)', [row.student_id, row.name, row.year_level || 1, row.section_id || null]);
            await conn.query('UPDATE student_requests SET status="approved" WHERE id=?', [id]);
            await conn.commit();
            await logActivity(pool, { category: 'student', action: 'approved', type: 'success', title: 'Student registration approved', detail: `${row.name} (${row.student_id})`, actor_name: user.name, actor_role: user.role });
            return res.json({ message: 'Student account approved.' });
          } catch (err) {
            await conn.rollback();
            if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Student ID already exists.' });
            throw err;
          } finally { conn.release(); }
        }
        if (act === 'reject') {
          const [[row]] = await pool.query('SELECT * FROM student_requests WHERE id=?', [id]);
          await pool.query('UPDATE student_requests SET status="rejected" WHERE id=?', [id]);
          await logActivity(pool, { category: 'student', action: 'rejected', type: 'warning', title: 'Student registration rejected', detail: row ? `${row.name} (${row.student_id})` : `Request #${id}`, actor_name: user.name, actor_role: user.role });
          return res.json({ message: 'Request rejected.' });
        }
      }
    }

    res.status(400).json({ message: 'Unknown action.' });
  } catch (err) {
    return handleDbError(err, res, 'Misc');
  }
};
