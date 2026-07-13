const { getPool, handleDbError, logActivity } = require('./_db');
const { requireAuth, signToken } = require('./_auth');

module.exports = async (req, res) => {
  const authUser = requireAuth(req, res);
  if (!authUser) return;
  const pool = getPool();
  const id = req.query.id;

  try {
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
      await logActivity(pool, { category: 'student', action: 'imported', type: 'info', title: 'Students imported', detail: `${inserted} added, ${skipped} skipped`, actor_name: authUser.name, actor_role: authUser.role });
      return res.json({ inserted, skipped, errors });
    }

    if (req.method === 'GET') {
      const [rows] = await pool.query('SELECT s.*, sec.name as section_name FROM students s LEFT JOIN sections sec ON sec.id = s.section_id ORDER BY s.student_id');
      return res.json(rows);
    }
    if (req.method === 'POST') {
      const { student_id, name, year_level, section_id } = req.body;
      if (!student_id?.trim() || !name?.trim()) return res.status(400).json({ message: 'Student ID and name are required.' });
      const [r] = await pool.query('INSERT INTO students (student_id, name, year_level, section_id) VALUES (?,?,?,?)', [student_id.trim(), name.trim(), year_level || 1, section_id || null]);
      await logActivity(pool, { category: 'student', action: 'created', type: 'success', title: 'Student added', detail: `${name.trim()} (${student_id.trim()})`, actor_name: authUser.name, actor_role: authUser.role });
      return res.status(201).json({ id: r.insertId });
    }
    if (req.method === 'PUT' && id) {
      const { student_id, name, year_level, section_id } = req.body;
      await pool.query('UPDATE students SET student_id=?, name=?, year_level=?, section_id=? WHERE id=?', [student_id, name, year_level, section_id, id]);
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
