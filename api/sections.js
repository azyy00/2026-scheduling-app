const { getPool, handleDbError, logActivity } = require('./_db');
const { requireAdmin } = require('./_auth');

module.exports = async (req, res) => {
  const actor = requireAdmin(req, res);
  if (!actor) return;
  const pool = getPool();
  const id = req.query.id;

  try {
    // Ensure `program` column exists (added after initial table creation)
    await pool.query(`ALTER TABLE sections ADD COLUMN IF NOT EXISTS program VARCHAR(20) NULL`).catch(() => {});

    if (req.method === 'GET') {
      const [rows] = await pool.query('SELECT * FROM sections ORDER BY year_level, name');
      return res.json(rows);
    }
    if (req.method === 'POST') {
      const { name, year_level, program } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: 'Section name is required.' });
      const [r] = await pool.query('INSERT INTO sections (name, year_level, program) VALUES (?,?,?)', [name.trim(), year_level || null, program || null]);
      await logActivity(pool, { category: 'section', action: 'created', type: 'success', title: 'Section added', detail: name.trim(), actor_name: actor.name, actor_role: actor.role });
      return res.status(201).json({ id: r.insertId });
    }
    if (req.method === 'PUT' && id) {
      const { name, year_level, program } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: 'Section name is required.' });
      await pool.query('UPDATE sections SET name=?, year_level=?, program=? WHERE id=?', [name.trim(), year_level || null, program || null, id]);
      await logActivity(pool, { category: 'section', action: 'updated', type: 'info', title: 'Section updated', detail: name.trim(), actor_name: actor.name, actor_role: actor.role });
      return res.json({ success: true });
    }
    if (req.method === 'DELETE' && id) {
      const [[schedUsage]] = await pool.query('SELECT COUNT(*) as c FROM schedules WHERE section_id=?', [id]);
      if (schedUsage.c > 0) return res.status(409).json({ message: `Cannot delete: this section has ${schedUsage.c} schedule(s). Remove those schedules first.` });
      const [[studUsage]] = await pool.query('SELECT COUNT(*) as c FROM students WHERE section_id=?', [id]);
      if (studUsage.c > 0) return res.status(409).json({ message: `Cannot delete: ${studUsage.c} student(s) are assigned to this section.` });
      const [[old]] = await pool.query('SELECT name FROM sections WHERE id=?', [id]).catch(() => [[]]);
      await pool.query('DELETE FROM sections WHERE id=?', [id]);
      await logActivity(pool, { category: 'section', action: 'deleted', type: 'warning', title: 'Section deleted', detail: old?.name || `Section #${id}`, actor_name: actor.name, actor_role: actor.role });
      return res.json({ success: true });
    }
    res.status(405).end();
  } catch (err) {
    return handleDbError(err, res, 'Sections');
  }
};
