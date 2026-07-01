const { getPool, handleDbError, logActivity } = require('./_db');
const { requireAdmin } = require('./_auth');

module.exports = async (req, res) => {
  const actor = requireAdmin(req, res);
  if (!actor) return;
  const pool = getPool();
  const id = req.query.id;

  try {
    // POST /api/subjects?action=import
    if (req.query.action === 'import') {
      if (req.method !== 'POST') return res.status(405).end();
      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ message: 'No data provided.' });
      let inserted = 0, skipped = 0, errors = [];
      for (const row of rows) {
        const { code, name, units } = row;
        if (!code && !name) { skipped++; continue; }
        try {
          const [existing] = await pool.query('SELECT id FROM subjects WHERE code = ? OR LOWER(name) = ?', [code?.trim() || '', (name || '').toLowerCase().trim()]);
          if (existing.length) { skipped++; continue; }
          await pool.query('INSERT INTO subjects (code, name, units) VALUES (?,?,?)', [code?.trim() || null, name?.trim() || null, parseInt(units) || null]);
          inserted++;
        } catch (err) { errors.push(`${code || name}: ${err.message}`); skipped++; }
      }
      await logActivity(pool, { category: 'subject', action: 'imported', type: 'info', title: 'Subjects imported', detail: `${inserted} added, ${skipped} skipped`, actor_name: actor.name, actor_role: actor.role });
      return res.json({ inserted, skipped, errors });
    }

    if (req.method === 'GET') {
      const [rows] = await pool.query('SELECT * FROM subjects ORDER BY code');
      return res.json(rows);
    }
    if (req.method === 'POST') {
      const { code, name, units } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: 'Subject name is required.' });
      const [r] = await pool.query('INSERT INTO subjects (code, name, units) VALUES (?,?,?)', [code?.trim() || null, name.trim(), units || null]);
      await logActivity(pool, { category: 'subject', action: 'created', type: 'success', title: 'Subject added', detail: `${name.trim()}${code ? ` (${code.trim()})` : ''}`, actor_name: actor.name, actor_role: actor.role });
      return res.status(201).json({ id: r.insertId });
    }
    if (req.method === 'PUT' && id) {
      const { code, name, units } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: 'Subject name is required.' });
      await pool.query('UPDATE subjects SET code=?, name=?, units=? WHERE id=?', [code?.trim() || null, name.trim(), units || null, id]);
      await logActivity(pool, { category: 'subject', action: 'updated', type: 'info', title: 'Subject updated', detail: `${name.trim()}${code ? ` (${code.trim()})` : ''}`, actor_name: actor.name, actor_role: actor.role });
      return res.json({ success: true });
    }
    if (req.method === 'DELETE' && id) {
      const [[usage]] = await pool.query('SELECT COUNT(*) as c FROM schedules WHERE subject_id=?', [id]);
      if (usage.c > 0) return res.status(409).json({ message: `Cannot delete: this subject is used in ${usage.c} schedule(s). Remove those schedules first.` });
      const [[old]] = await pool.query('SELECT code, name FROM subjects WHERE id=?', [id]).catch(() => [[]]);
      await pool.query('DELETE FROM subjects WHERE id=?', [id]);
      await logActivity(pool, { category: 'subject', action: 'deleted', type: 'warning', title: 'Subject deleted', detail: old ? `${old.name}${old.code ? ` (${old.code})` : ''}` : `Subject #${id}`, actor_name: actor.name, actor_role: actor.role });
      return res.json({ success: true });
    }
    res.status(405).end();
  } catch (err) {
    return handleDbError(err, res, 'Subjects');
  }
};
