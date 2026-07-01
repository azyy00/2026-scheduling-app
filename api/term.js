const { getPool, ensureTermTables, logActivity } = require('./_db');
const { verifyToken } = require('./_auth');

// Compute the next academic year string, e.g. "2026-2027" -> "2027-2028"
const nextSchoolYear = (sy) => {
  const parts = String(sy || '').split('-').map(n => parseInt(n, 10));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return `${parts[0] + 1}-${parts[1] + 1}`;
  const y = new Date().getFullYear();
  return `${y}-${y + 1}`;
};

module.exports = async (req, res) => {
  let user;
  try { user = verifyToken(req); } catch { return res.status(401).json({ message: 'Unauthorized' }); }

  const pool = getPool();
  const action = req.query.action;

  try {
    await ensureTermTables(pool);

    // GET /api/term?action=get  — any authenticated user (drives the top-bar badge)
    if (action === 'get') {
      const [[s]] = await pool.query('SELECT active_school_year, active_semester FROM app_settings WHERE id=1');
      const [yrs] = await pool.query('SELECT school_year FROM academic_years ORDER BY school_year DESC');
      return res.json({
        active_school_year: s?.active_school_year || null,
        active_semester: s?.active_semester || null,
        years: yrs.map(y => y.school_year),
      });
    }

    // POST /api/term?action=set  (admin) — switch the active year/semester
    if (action === 'set') {
      if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      const { school_year, semester } = req.body;
      if (!school_year || !semester) return res.status(400).json({ message: 'School year and semester are required.' });
      await pool.query('INSERT IGNORE INTO academic_years (school_year) VALUES (?)', [school_year]);
      await pool.query('UPDATE app_settings SET active_school_year=?, active_semester=? WHERE id=1', [school_year, semester]);
      await logActivity(pool, { category: 'term', action: 'updated', type: 'info', title: 'Active term changed', detail: `${school_year} · ${semester} Sem`, actor_name: user.name, actor_role: user.role });
      return res.json({ message: `Active term set to ${school_year} · ${semester} Sem.` });
    }

    // POST /api/term?action=start-new-year  (admin) — snapshot, promote, advance the year
    if (action === 'start-new-year') {
      if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      const [[s]] = await pool.query('SELECT active_school_year, active_semester FROM app_settings WHERE id=1');
      const current = s?.active_school_year;
      if (!current) return res.status(400).json({ message: 'No active academic year is set.' });

      const [students] = await pool.query(
        `SELECT st.id, st.student_id, st.year_level, st.section_id, sec.name as section_name
         FROM students st LEFT JOIN sections sec ON sec.id = st.section_id`
      );

      // Snapshot the ending year (replace any prior snapshot for that year to stay idempotent).
      await pool.query('DELETE FROM student_enrollment_history WHERE school_year = ?', [current]);
      for (const st of students) {
        await pool.query(
          'INSERT INTO student_enrollment_history (student_pk, student_id, school_year, year_level, section_id, section_name) VALUES (?,?,?,?,?,?)',
          [st.id, st.student_id, current, st.year_level, st.section_id, st.section_name]
        );
      }

      // Promote everyone one year, remapping sections (e.g. BPED-1A -> BPED-2A) where possible.
      const [sections] = await pool.query('SELECT id, name, year_level FROM sections');
      const byName = {};
      sections.forEach(x => { byName[x.name.toLowerCase()] = x.id; });
      let promoted = 0, graduated = 0, remapped = 0;
      for (const st of students) {
        const cur = st.year_level || 1;
        if (cur >= 4) { graduated++; continue; }
        const ny = cur + 1;
        let nsid = st.section_id;
        if (st.section_name) {
          const m = st.section_name.match(/^(.*?)(\d)([A-Za-z]*)$/);
          if (m) {
            const t = `${m[1]}${ny}${m[3]}`.toLowerCase();
            if (byName[t]) { nsid = byName[t]; remapped++; }
          }
        }
        await pool.query('UPDATE students SET year_level=?, section_id=? WHERE id=?', [ny, nsid, st.id]);
        promoted++;
      }

      const next = nextSchoolYear(current);
      await pool.query('INSERT IGNORE INTO academic_years (school_year) VALUES (?)', [next]);
      await pool.query('UPDATE app_settings SET active_school_year=?, active_semester=? WHERE id=1', [next, '1st']);

      await logActivity(pool, { category: 'term', action: 'created', type: 'success', title: 'New academic year started', detail: `${current} → ${next} · promoted ${promoted} student(s)`, actor_name: user.name, actor_role: user.role });
      return res.json({
        message: `Started ${next}. Promoted ${promoted} student(s)${graduated ? `, ${graduated} at 4th year unchanged` : ''}.`,
        promoted, graduated, remapped, new_school_year: next,
      });
    }

    // GET /api/term?action=student-history&student_id=<students.id>  (admin)
    if (action === 'student-history') {
      if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      const sid = req.query.student_id;
      if (!sid) return res.status(400).json({ message: 'student_id required.' });
      const [rows] = await pool.query(
        'SELECT school_year, year_level, section_name FROM student_enrollment_history WHERE student_pk = ? ORDER BY school_year DESC',
        [sid]
      );
      return res.json(rows);
    }

    return res.status(400).json({ message: 'Unknown action.' });
  } catch (err) {
    console.error('Term error:', err.message);
    return res.status(500).json({ message: 'Server error.' });
  }
};
