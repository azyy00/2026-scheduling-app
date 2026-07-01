const { getPool, handleDbError, logActivity } = require('./_db');
const { requireAdmin } = require('./_auth');

module.exports = async (req, res) => {
  const actor = requireAdmin(req, res);
  if (!actor) return;
  const pool = getPool();
  const id = req.query.id;

  try {
    if (req.method === 'GET') {
      const [rows] = await pool.query('SELECT * FROM classrooms ORDER BY room_code');
      return res.json(rows);
    }
    if (req.method === 'POST') {
      const { room_code, building, capacity } = req.body;
      if (!room_code?.trim()) return res.status(400).json({ message: 'Room code is required.' });
      const [r] = await pool.query('INSERT INTO classrooms (room_code, building, capacity) VALUES (?,?,?)', [room_code.trim(), building || null, capacity || null]);
      await logActivity(pool, { category: 'classroom', action: 'created', type: 'success', title: 'Room added', detail: room_code.trim(), actor_name: actor.name, actor_role: actor.role });
      return res.status(201).json({ id: r.insertId });
    }
    if (req.method === 'PUT' && id) {
      const { room_code, building, capacity } = req.body;
      if (!room_code?.trim()) return res.status(400).json({ message: 'Room code is required.' });
      await pool.query('UPDATE classrooms SET room_code=?, building=?, capacity=? WHERE id=?', [room_code.trim(), building || null, capacity || null, id]);
      await logActivity(pool, { category: 'classroom', action: 'updated', type: 'info', title: 'Room updated', detail: room_code.trim(), actor_name: actor.name, actor_role: actor.role });
      return res.json({ success: true });
    }
    if (req.method === 'DELETE' && id) {
      // Check if classroom is referenced by any schedule
      const [[usage]] = await pool.query('SELECT COUNT(*) as c FROM schedules WHERE classroom_id=?', [id]);
      if (usage.c > 0) return res.status(409).json({ message: `Cannot delete: this room is used in ${usage.c} schedule(s). Remove those schedules first.` });
      const [[old]] = await pool.query('SELECT room_code FROM classrooms WHERE id=?', [id]).catch(() => [[]]);
      await pool.query('DELETE FROM classrooms WHERE id=?', [id]);
      await logActivity(pool, { category: 'classroom', action: 'deleted', type: 'warning', title: 'Room deleted', detail: old?.room_code || `Room #${id}`, actor_name: actor.name, actor_role: actor.role });
      return res.json({ success: true });
    }
    res.status(405).end();
  } catch (err) {
    return handleDbError(err, res, 'Classrooms');
  }
};
