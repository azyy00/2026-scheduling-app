const { getPool, getActiveTerm, handleDbError, logActivity } = require('./_db');
const { requireAuth, signToken } = require('./_auth');

// Enrollment status — Regular / Irregular / Returnee. Accepts common aliases
// (e.g. "IRR" → Irregular) and defaults to Regular.
const normalizeStatus = (v) => {
  const s = String(v || '').trim().toLowerCase();
  if (s === 'irr' || s === 'ir' || s.startsWith('irreg')) return 'Irregular';
  if (s.startsWith('return')) return 'Returnee';
  return 'Regular';
};

module.exports = async (req, res) => {
  const authUser = requireAuth(req, res);
  if (!authUser) return;
  const pool = getPool();
  const id = req.query.id;

  try {
    // Ensure the `status` column exists (added after initial table creation).
    await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'Regular'`).catch(() => {});
    // Custom picks table for irregular students (a student ↔ schedule mapping).
    await pool.query(`CREATE TABLE IF NOT EXISTS student_schedules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      schedule_id INT NOT NULL,
      UNIQUE KEY uniq_student_schedule (student_id, schedule_id)
    )`).catch(() => {});

    // GET /api/students?action=me — the signed-in student's own record (incl. status)
    if (req.query.action === 'me') {
      if (authUser.role !== 'student') return res.status(403).json({ message: 'Forbidden' });
      const [[s]] = await pool.query(
        `SELECT s.id, s.student_id, s.name, s.year_level, s.section_id, s.status, sec.name as section_name
         FROM students s LEFT JOIN sections sec ON sec.id = s.section_id WHERE s.id = ?`,
        [authUser.id]
      );
      if (!s) return res.status(404).json({ message: 'Student not found.' });
      return res.json(s);
    }

    // POST /api/students?action=enroll-class — irregular student adds a class to their custom schedule
    // POST /api/students?action=drop-class   — remove a class from it
    if (req.query.action === 'enroll-class' || req.query.action === 'drop-class') {
      if (req.method !== 'POST') return res.status(405).end();
      if (authUser.role !== 'student') return res.status(403).json({ message: 'Forbidden' });
      const [[me]] = await pool.query('SELECT status FROM students WHERE id=?', [authUser.id]);
      if (!me || normalizeStatus(me.status) !== 'Irregular') {
        return res.status(403).json({ message: 'Only irregular students can customize their schedule. Ask the admin to set your status to Irregular.' });
      }
      const scheduleId = parseInt(req.body?.schedule_id);
      if (!scheduleId) return res.status(400).json({ message: 'A class is required.' });

      if (req.query.action === 'drop-class') {
        await pool.query('DELETE FROM student_schedules WHERE student_id=? AND schedule_id=?', [authUser.id, scheduleId]);
        return res.json({ success: true });
      }
      // enroll: the class must exist in the active term; block time clashes with existing picks.
      const term = await getActiveTerm(pool);
      const [[cls]] = await pool.query(
        'SELECT id, day_of_week, time_start, time_end FROM schedules WHERE id=? AND school_year=? AND semester=?',
        [scheduleId, term.active_school_year, term.active_semester]
      );
      if (!cls) return res.status(404).json({ message: 'That class is not available in the current term.' });
      const [clash] = await pool.query(
        `SELECT sub.code FROM student_schedules ss
         JOIN schedules s ON s.id = ss.schedule_id
         JOIN subjects sub ON sub.id = s.subject_id
         WHERE ss.student_id=? AND s.day_of_week=? AND s.time_start < ? AND s.time_end > ?`,
        [authUser.id, cls.day_of_week, cls.time_end, cls.time_start]
      );
      if (clash.length) return res.status(409).json({ message: `Time clash with ${clash[0].code} on ${cls.day_of_week}. Drop it first or pick another slot.` });
      await pool.query('INSERT IGNORE INTO student_schedules (student_id, schedule_id) VALUES (?,?)', [authUser.id, scheduleId]);
      return res.json({ success: true });
    }

    // POST /api/students?action=update-self — student updates their own year level + section
    if (req.query.action === 'update-self') {
      if (req.method !== 'POST') return res.status(405).end();
      if (authUser.role !== 'student') return res.status(403).json({ message: 'Forbidden' });
      const { year_level, section_id } = req.body;
      if (!year_level || !section_id) return res.status(400).json({ message: 'Year level and section are required.' });
      await pool.query('UPDATE students SET year_level=?, section_id=? WHERE id=?', [parseInt(year_level), section_id, authUser.id]);
      // Re-issue a token so the schedule reflects the new section immediately.
      const [[s]] = await pool.query(
        `SELECT s.id, s.student_id, s.name, s.year_level, s.section_id, sec.name as section_name
         FROM students s LEFT JOIN sections sec ON sec.id = s.section_id WHERE s.id = ?`,
        [authUser.id]
      );
      const token = signToken({ id: s.id, role: 'student', student_id: s.student_id, name: s.name, year_level: s.year_level, section_id: s.section_id, section_name: s.section_name });
      await logActivity(pool, { category: 'student', action: 'updated', type: 'info', title: 'Student updated their year/section', detail: `${s.name} → Year ${s.year_level} · ${s.section_name || '—'}`, actor_name: s.name, actor_role: 'student' });
      return res.json({ token, message: 'Your year level and section were updated.' });
    }

    // POST /api/students?action=promote — admin bulk-advances students to the next year level
    if (req.query.action === 'promote') {
      if (req.method !== 'POST') return res.status(405).end();
      if (authUser.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'No students selected.' });

      const [sections] = await pool.query('SELECT id, name, year_level FROM sections');
      const sectionByName = {};
      sections.forEach(sec => { sectionByName[sec.name.toLowerCase()] = sec.id; });

      const placeholders = ids.map(() => '?').join(',');
      const [students] = await pool.query(
        `SELECT s.id, s.year_level, s.section_id, sec.name as section_name
         FROM students s LEFT JOIN sections sec ON sec.id = s.section_id
         WHERE s.id IN (${placeholders})`,
        ids
      );

      let promoted = 0, skipped = 0, remapped = 0;
      for (const st of students) {
        const cur = st.year_level || 1;
        if (cur >= 4) { skipped++; continue; }
        const newYear = cur + 1;
        // Try to remap the section name's year digit, e.g. BPED-1A -> BPED-2A
        let newSectionId = st.section_id;
        if (st.section_name) {
          const m = st.section_name.match(/^(.*?)(\d)([A-Za-z]*)$/);
          if (m) {
            const targetName = `${m[1]}${newYear}${m[3]}`.toLowerCase();
            if (sectionByName[targetName]) { newSectionId = sectionByName[targetName]; remapped++; }
          }
        }
        await pool.query('UPDATE students SET year_level=?, section_id=? WHERE id=?', [newYear, newSectionId, st.id]);
        promoted++;
      }
      await logActivity(pool, { category: 'student', action: 'promoted', type: 'success', title: 'Students promoted', detail: `${promoted} promoted${skipped ? `, ${skipped} at 4th year` : ''}`, actor_name: authUser.name, actor_role: authUser.role });
      return res.json({ promoted, skipped, remapped, message: `Promoted ${promoted} student(s).${skipped ? ` ${skipped} already at 4th year.` : ''}` });
    }

    // Everything below manages student records — admin only.
    if (authUser.role !== 'admin') return res.status(403).json({ message: 'Forbidden. You do not have access to this resource.' });

    // POST /api/students?action=delete-bulk — delete a selected set of students
    if (req.query.action === 'delete-bulk') {
      if (req.method !== 'POST') return res.status(405).end();
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'No students selected.' });
      const placeholders = ids.map(() => '?').join(',');
      const [r] = await pool.query(`DELETE FROM students WHERE id IN (${placeholders})`, ids);
      await logActivity(pool, { category: 'student', action: 'deleted', type: 'warning', title: 'Students deleted', detail: `${r.affectedRows} student(s) deleted`, actor_name: authUser.name, actor_role: authUser.role });
      return res.json({ deleted: r.affectedRows, message: `Deleted ${r.affectedRows} student(s).` });
    }

    // POST /api/students?action=delete-all — delete every student record
    if (req.query.action === 'delete-all') {
      if (req.method !== 'POST') return res.status(405).end();
      const [r] = await pool.query('DELETE FROM students');
      await logActivity(pool, { category: 'student', action: 'deleted', type: 'warning', title: 'All students deleted', detail: `${r.affectedRows} student(s) deleted`, actor_name: authUser.name, actor_role: authUser.role });
      return res.json({ deleted: r.affectedRows, message: `Deleted all ${r.affectedRows} student(s).` });
    }

    // POST /api/students?action=import
    if (req.query.action === 'import') {
      if (req.method !== 'POST') return res.status(405).end();
      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ message: 'No data provided.' });

      const [sections] = await pool.query('SELECT id, name, year_level, program FROM sections');
      // Normalize away case, spaces and separators so "BPED-2A" == "bped 2a" == "bped2a".
      const norm = (v) => String(v || '').trim().toLowerCase().replace(/[\s._-]+/g, '');
      const byName = new Map();
      sections.forEach(s => byName.set(norm(s.name), s.id));
      const sectionsAvailable = sections.map(s => s.name);

      // Resolve a CSV row to a section id, being generous about naming so a CSV
      // that says section "1A"/"A" with program "BPED" still finds "BPED-1A",
      // whether or not the section's own program/year columns were filled in.
      const resolveSection = (row) => {
        const raw = String(row.section_name || row.section || '').trim();
        if (!raw) return { id: null };
        const token = norm(raw);                          // "1a"
        const prog = norm(row.program);                   // "bped"
        const yr = parseInt(row.year_level) || null;
        const letter = token.replace(/[^a-z]/g, '');      // "a"
        const yrStr = yr ? String(yr) : (token.match(/\d+/) || [''])[0];

        // 1) exact (normalized) full name — "BPED-1A" or literally "1A"
        if (byName.has(token)) return { id: byName.get(token) };
        // 2) composed exact names, e.g. program+token or program+year+letter
        for (const b of [prog + token, prog + yrStr + letter, prog + letter, prog + letter + yrStr]) {
          if (b && byName.has(b)) return { id: byName.get(b) };
        }
        // 3) fuzzy suffix search, then narrow by program / year when that helps
        let cands = sections.filter(s => {
          const n = norm(s.name);
          if (n === token || n.endsWith(token)) return true;
          if (letter && yrStr && (n.endsWith(yrStr + letter) || n.endsWith(letter + yrStr))) return true;
          if (letter && n.endsWith(letter)) return true;
          return false;
        });
        if (prog) {
          const p = cands.filter(s => norm(s.name).startsWith(prog) || norm(s.program) === prog);
          if (p.length) cands = p;
        }
        if (yr) {
          const y = cands.filter(s => s.year_level === yr || norm(s.name).includes(String(yr)));
          if (y.length) cands = y;
        }
        const uniq = [...new Map(cands.map(s => [s.id, s])).values()];
        if (uniq.length === 1) return { id: uniq[0].id };
        if (uniq.length > 1) return { id: null, reason: `"${raw}" matches multiple sections (${uniq.map(c => c.name).join(', ')})` };
        return { id: null, reason: `section "${raw}" not found` };
      };

      let inserted = 0, updated = 0, skipped = 0, noSection = 0;
      const errors = [], sectionWarnings = [];
      for (const row of rows) {
        const { student_id, name, year_level } = row;
        if (!student_id || !name) { skipped++; continue; }
        const sec = resolveSection(row);
        try {
          // Upsert: re-importing an existing student updates their name/year and
          // fills in the section. A null (unmatched) section never wipes an
          // existing one — it keeps whatever the student already had.
          // Only set status when the CSV actually provides one, so a file
          // without a status column never resets everyone to Regular.
          const statusRaw = String(row.status || '').trim() ? normalizeStatus(row.status) : null;
          const [r] = await pool.query(
            `INSERT INTO students (student_id, name, year_level, section_id, status) VALUES (?,?,?,?, COALESCE(?, 'Regular'))
             ON DUPLICATE KEY UPDATE
               name = VALUES(name),
               year_level = VALUES(year_level),
               section_id = IF(VALUES(section_id) IS NULL, section_id, VALUES(section_id)),
               status = IF(? IS NULL, status, ?)`,
            [String(student_id).trim(), String(name).trim(), parseInt(year_level) || 1, sec.id, statusRaw, statusRaw, statusRaw]
          );
          // affectedRows: 1 = inserted, 2 = updated, 0 = duplicate with no change.
          if (r.affectedRows === 1) inserted++;
          else if (r.affectedRows === 2) updated++;
          else skipped++;
          if (r.affectedRows !== 0 && !sec.id) {
            noSection++;
            if (sec.reason && sectionWarnings.length < 8) sectionWarnings.push(`${String(student_id).trim()}: ${sec.reason}`);
          }
        } catch (err) { errors.push(`${student_id}: ${err.message}`); skipped++; }
      }
      await logActivity(pool, { category: 'student', action: 'imported', type: 'info', title: 'Students imported', detail: `${inserted} added, ${updated} updated, ${skipped} skipped${noSection ? `, ${noSection} without a section` : ''}`, actor_name: authUser.name, actor_role: authUser.role });
      return res.json({ inserted, updated, skipped, noSection, errors, sectionWarnings, sectionsAvailable });
    }

    if (req.method === 'GET') {
      const [rows] = await pool.query('SELECT s.*, sec.name as section_name FROM students s LEFT JOIN sections sec ON sec.id = s.section_id ORDER BY s.student_id');
      return res.json(rows);
    }
    if (req.method === 'POST') {
      const { student_id, name, year_level, section_id, status } = req.body;
      if (!student_id?.trim() || !name?.trim()) return res.status(400).json({ message: 'Student ID and name are required.' });
      const [r] = await pool.query('INSERT INTO students (student_id, name, year_level, section_id, status) VALUES (?,?,?,?,?)', [student_id.trim(), name.trim(), year_level || 1, section_id || null, normalizeStatus(status)]);
      await logActivity(pool, { category: 'student', action: 'created', type: 'success', title: 'Student added', detail: `${name.trim()} (${student_id.trim()})`, actor_name: authUser.name, actor_role: authUser.role });
      return res.status(201).json({ id: r.insertId });
    }
    if (req.method === 'PUT' && id) {
      const { student_id, name, year_level, section_id, status } = req.body;
      await pool.query('UPDATE students SET student_id=?, name=?, year_level=?, section_id=?, status=? WHERE id=?', [student_id, name, year_level, section_id, normalizeStatus(status), id]);
      await logActivity(pool, { category: 'student', action: 'updated', type: 'info', title: 'Student updated', detail: `${name} (${student_id})`, actor_name: authUser.name, actor_role: authUser.role });
      return res.json({ success: true });
    }
    if (req.method === 'DELETE' && id) {
      const [[old]] = await pool.query('SELECT student_id, name FROM students WHERE id=?', [id]).catch(() => [[]]);
      await pool.query('DELETE FROM students WHERE id=?', [id]);
      await logActivity(pool, { category: 'student', action: 'deleted', type: 'warning', title: 'Student deleted', detail: old ? `${old.name} (${old.student_id})` : `Student #${id}`, actor_name: authUser.name, actor_role: authUser.role });
      return res.json({ success: true });
    }
    res.status(405).end();
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Student ID already exists.' });
    return handleDbError(err, res, 'Students');
  }
};
