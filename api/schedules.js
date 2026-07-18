const { getPool, getActiveTerm, handleDbError, logActivity } = require('./_db');
const { requireAdmin } = require('./_auth');

// Build a readable label for a schedule from its IDs (subject code + section)
const scheduleLabel = async (pool, { subject_id, section_id, day_of_week, time_start, time_end }) => {
  try {
    const [[sub]] = await pool.query('SELECT code FROM subjects WHERE id=?', [subject_id]);
    const [[sec]] = await pool.query('SELECT name FROM sections WHERE id=?', [section_id]);
    return `${sub?.code || 'Subject'} · ${sec?.name || 'Section'} · ${day_of_week} ${time_start}-${time_end}`;
  } catch { return `${day_of_week || ''} ${time_start || ''}-${time_end || ''}`.trim(); }
};

const listQuery = `
  SELECT s.id, s.subject_id, s.instructor_id, s.classroom_id, s.section_id,
    s.day_of_week, s.time_start, s.time_end, s.semester, s.school_year, s.created_at,
    sub.code as subject_code, sub.name as subject_name,
    i.name as instructor_name, c.room_code, sec.name as section_name
  FROM schedules s
  JOIN subjects sub ON sub.id = s.subject_id
  JOIN instructors i ON i.id = s.instructor_id
  JOIN classrooms c ON c.id = s.classroom_id
  JOIN sections sec ON sec.id = s.section_id
`;

// Single query: fetch all conflicts in one shot, then group by schedule id in JS
const allConflictsQuery = `
  SELECT s1.id as schedule_id,
    s2.id as other_schedule_id,
    s2.subject_id as other_subject_id,
    s2.instructor_id as other_instructor_id,
    s2.classroom_id as other_classroom_id,
    s2.section_id as other_section_id,
    s2.day_of_week as other_day_of_week,
    s2.time_start as other_time_start,
    s2.time_end as other_time_end,
    s2.semester as other_semester,
    s2.school_year as other_school_year,
    s2.created_at as other_created_at,
    sub2.code as other_subject_code,
    sub2.name as other_subject_name,
    i2.name as other_instructor_name,
    c2.room_code as other_room_code,
    sec2.name as other_section_name,
    IF(s2.classroom_id = s1.classroom_id, CONCAT('Room conflict: ', sub2.code, ' (', sec2.name, ')'), NULL) as room_c,
    IF(s2.instructor_id = s1.instructor_id, CONCAT('Instructor conflict: ', sub2.code, ' (', sec2.name, ')'), NULL) as inst_c,
    IF(s2.section_id = s1.section_id, CONCAT('Section conflict: ', sub2.code, ' (', sec2.name, ')'), NULL) as sect_c
  FROM schedules s1
  JOIN schedules s2 ON s2.id != s1.id
    AND s2.day_of_week = s1.day_of_week
    AND s2.semester = s1.semester
    AND s2.school_year = s1.school_year
    AND s2.time_start < s1.time_end
    AND s2.time_end > s1.time_start
    AND (s2.classroom_id = s1.classroom_id OR s2.instructor_id = s1.instructor_id OR s2.section_id = s1.section_id)
  JOIN subjects sub2 ON sub2.id = s2.subject_id
  JOIN instructors i2 ON i2.id = s2.instructor_id
  JOIN classrooms c2 ON c2.id = s2.classroom_id
  JOIN sections sec2 ON sec2.id = s2.section_id
`;

const scheduleSummary = (s, prefix = '') => ({
  id: s[`${prefix}id`] ?? s.id,
  subject_id: s[`${prefix}subject_id`] ?? s.subject_id,
  instructor_id: s[`${prefix}instructor_id`] ?? s.instructor_id,
  classroom_id: s[`${prefix}classroom_id`] ?? s.classroom_id,
  section_id: s[`${prefix}section_id`] ?? s.section_id,
  subject_code: s[`${prefix}subject_code`] ?? s.subject_code,
  subject_name: s[`${prefix}subject_name`] ?? s.subject_name,
  instructor_name: s[`${prefix}instructor_name`] ?? s.instructor_name,
  room_code: s[`${prefix}room_code`] ?? s.room_code,
  section_name: s[`${prefix}section_name`] ?? s.section_name,
  day_of_week: s[`${prefix}day_of_week`] ?? s.day_of_week,
  time_start: s[`${prefix}time_start`] ?? s.time_start,
  time_end: s[`${prefix}time_end`] ?? s.time_end,
  semester: s[`${prefix}semester`] ?? s.semester,
  school_year: s[`${prefix}school_year`] ?? s.school_year,
  created_at: s[`${prefix}created_at`] ?? s.created_at,
});

const createdSortKey = (schedule) => {
  const ts = schedule.created_at ? new Date(schedule.created_at).getTime() : Number.NaN;
  return {
    time: Number.isNaN(ts) ? Number.MAX_SAFE_INTEGER : ts,
    id: Number(schedule.id) || Number.MAX_SAFE_INTEGER,
  };
};

const orderByCreation = (a, b) => {
  const ak = createdSortKey(a);
  const bk = createdSortKey(b);
  if (ak.time !== bk.time) return ak.time < bk.time ? [a, b] : [b, a];
  return ak.id <= bk.id ? [a, b] : [b, a];
};

function attachConflicts(rows, conflictRows) {
  const map = {};
  const detailMap = {};
  const rowById = Object.fromEntries(rows.map(row => [row.id, row]));

  for (const c of conflictRows) {
    if (!map[c.schedule_id]) map[c.schedule_id] = [];
    if (!detailMap[c.schedule_id]) detailMap[c.schedule_id] = [];

    if (c.room_c) map[c.schedule_id].push(c.room_c);
    if (c.inst_c) map[c.schedule_id].push(c.inst_c);
    if (c.sect_c) map[c.schedule_id].push(c.sect_c);

    const currentRow = rowById[c.schedule_id];
    if (!currentRow) continue;

    const conflictTypes = [];
    if (c.room_c) conflictTypes.push('Room');
    if (c.inst_c) conflictTypes.push('Instructor');
    if (c.sect_c) conflictTypes.push('Section');

    const current = scheduleSummary(currentRow);
    const other = {
      id: c.other_schedule_id,
      subject_id: c.other_subject_id,
      instructor_id: c.other_instructor_id,
      classroom_id: c.other_classroom_id,
      section_id: c.other_section_id,
      subject_code: c.other_subject_code,
      subject_name: c.other_subject_name,
      instructor_name: c.other_instructor_name,
      room_code: c.other_room_code,
      section_name: c.other_section_name,
      day_of_week: c.other_day_of_week,
      time_start: c.other_time_start,
      time_end: c.other_time_end,
      semester: c.other_semester,
      school_year: c.other_school_year,
      created_at: c.other_created_at,
    };
    const [first_created, later_created] = orderByCreation(current, other);

    detailMap[c.schedule_id].push({
      other_schedule_id: c.other_schedule_id,
      types: conflictTypes,
      labels: [c.room_c, c.inst_c, c.sect_c].filter(Boolean),
      current,
      other,
      first_created,
      later_created,
    });
  }

  for (const row of rows) {
    row.conflicts = map[row.id] || [];
    row.conflict_details = detailMap[row.id] || [];
  }
}

module.exports = async (req, res) => {
  const actor = requireAdmin(req, res);
  if (!actor) return;

  const pool = getPool();
  const { method } = req;
  const id = req.query.id;

  try {
    if (method === 'GET') {
      // Scope to a term. Explicit ?school_year / ?semester override; otherwise default to the
      // active term so the dashboard and lists show the current year. ?school_year=all shows everything.
      let schoolYear = req.query.school_year;
      let semester = req.query.semester;
      if (schoolYear === undefined) {
        const term = await getActiveTerm(pool);
        schoolYear = term.active_school_year || 'all';
        // Also scope to the active SEMESTER when the caller didn't specify one, so switching
        // to a new semester shows a blank calendar until it has its own schedules.
        if (semester === undefined) semester = term.active_semester || 'all';
      }

      const conditions = [];
      const params = [];
      if (req.query.instructor_id) { conditions.push('s.instructor_id = ?'); params.push(req.query.instructor_id); }
      if (schoolYear && schoolYear !== 'all') { conditions.push('s.school_year = ?'); params.push(schoolYear); }
      if (semester && semester !== 'all') { conditions.push('s.semester = ?'); params.push(semester); }

      let query = listQuery;
      if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
      query += ' ORDER BY s.day_of_week, s.time_start';

      const [rows] = await pool.query(query, params);

      // Single conflict query for all rows at once
      let conflictRows = [];
      if (rows.length > 0) {
        let cQuery = allConflictsQuery;
        const cParams = [];
        if (req.query.instructor_id) {
          cQuery += ' WHERE s1.instructor_id = ?';
          cParams.push(req.query.instructor_id);
        }
        [conflictRows] = await pool.query(cQuery, cParams);
      }
      attachConflicts(rows, conflictRows);
      return res.json(rows);
    }

    if (method === 'POST') {
      const { subject_id, instructor_id, classroom_id, section_id, day_of_week, time_start, time_end, semester, school_year } = req.body;
      if (!subject_id || !instructor_id || !classroom_id || !section_id || !day_of_week || !time_start || !time_end)
        return res.status(400).json({ message: 'All fields are required.' });
      if (time_start >= time_end)
        return res.status(400).json({ message: 'Start time must be before end time.' });
      const [result] = await pool.query(
        'INSERT INTO schedules (subject_id, instructor_id, classroom_id, section_id, day_of_week, time_start, time_end, semester, school_year) VALUES (?,?,?,?,?,?,?,?,?)',
        [subject_id, instructor_id, classroom_id, section_id, day_of_week, time_start, time_end, semester, school_year]
      );
      await logActivity(pool, { category: 'schedule', action: 'created', type: 'success', title: 'Schedule added', detail: await scheduleLabel(pool, req.body), actor_name: actor.name, actor_role: actor.role });
      return res.status(201).json({ id: result.insertId });
    }

    if (method === 'PUT' && id) {
      const { subject_id, instructor_id, classroom_id, section_id, day_of_week, time_start, time_end, semester, school_year } = req.body;
      if (time_start && time_end && time_start >= time_end)
        return res.status(400).json({ message: 'Start time must be before end time.' });
      await pool.query(
        'UPDATE schedules SET subject_id=?, instructor_id=?, classroom_id=?, section_id=?, day_of_week=?, time_start=?, time_end=?, semester=?, school_year=? WHERE id=?',
        [subject_id, instructor_id, classroom_id, section_id, day_of_week, time_start, time_end, semester, school_year, id]
      );
      await logActivity(pool, { category: 'schedule', action: 'updated', type: 'info', title: 'Schedule updated', detail: await scheduleLabel(pool, req.body), actor_name: actor.name, actor_role: actor.role });
      return res.json({ success: true });
    }

    if (method === 'DELETE' && id) {
      const [[old]] = await pool.query(
        `SELECT sub.code as code, sec.name as section, s.day_of_week, s.time_start, s.time_end
         FROM schedules s JOIN subjects sub ON sub.id=s.subject_id JOIN sections sec ON sec.id=s.section_id WHERE s.id=?`, [id]).catch(() => [[]]);
      await pool.query('DELETE FROM schedules WHERE id=?', [id]);
      await logActivity(pool, { category: 'schedule', action: 'deleted', type: 'warning', title: 'Schedule deleted', detail: old ? `${old.code} · ${old.section} · ${old.day_of_week} ${old.time_start}-${old.time_end}` : `Schedule #${id}`, actor_name: actor.name, actor_role: actor.role });
      return res.json({ success: true });
    }

    res.status(405).end();
  } catch (err) {
    return handleDbError(err, res, 'Schedules');
  }
};
