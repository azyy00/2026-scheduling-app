const { getPool, handleDbError, logActivity } = require('./_db');
const { requireAdmin } = require('./_auth');
const bcrypt = require('bcryptjs');

const SELECT_FIELDS = `
  i.id, i.name, i.department, i.position, u.username,
  CASE WHEN i.user_id IS NULL THEN 'unactivated'
       WHEN ar.id IS NOT NULL THEN 'pending'
       ELSE 'active' END as status
`;
const JOINS = `
  FROM instructors i
  LEFT JOIN users u ON u.id = i.user_id
  LEFT JOIN activation_requests ar ON ar.instructor_id = i.id AND ar.status = 'pending'
`;

module.exports = async (req, res) => {
  const actor = requireAdmin(req, res);
  if (!actor) return;
  const pool = getPool();
  const id = req.query.id;

  try {
    // POST /api/instructors?action=import
    if (req.query.action === 'import') {
      if (req.method !== 'POST') return res.status(405).end();
      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ message: 'No data provided.' });
      let inserted = 0, skipped = 0, errors = [];
      for (const row of rows) {
        const { name, department, position } = row;
        if (!name) { skipped++; continue; }
        try {
          const [existing] = await pool.query('SELECT id FROM instructors WHERE LOWER(name)=?', [name.toLowerCase().trim()]);
          if (existing.length) { skipped++; continue; }
          await pool.query('INSERT INTO instructors (name, department, position, user_id) VALUES (?,?,?,NULL)', [name.trim(), department?.trim() || null, position?.trim() || null]);
          inserted++;
        } catch (err) { errors.push(`${name}: ${err.message}`); skipped++; }
      }
      await logActivity(pool, { category: 'instructor', action: 'imported', type: 'info', title: 'Instructors imported', detail: `${inserted} added, ${skipped} skipped`, actor_name: actor.name, actor_role: actor.role });
      return res.json({ inserted, skipped, errors });
    }

    if (req.method === 'GET') {
      if (id) {
        const [rows] = await pool.query(`SELECT ${SELECT_FIELDS} ${JOINS} WHERE i.id = ?`, [id]);
        if (!rows[0]) return res.status(404).json({ message: 'Not found' });
        return res.json(rows[0]);
      }
      const [rows] = await pool.query(`SELECT ${SELECT_FIELDS} ${JOINS} ORDER BY i.name`);
      return res.json(rows);
    }

    if (req.method === 'POST') {
      const { name, department, position, username, password } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: 'Instructor name is required.' });
      if (!username) {
        const [r] = await pool.query(
          'INSERT INTO instructors (name, department, position, user_id) VALUES (?,?,?,NULL)',
          [name.trim(), department || null, position || null]
        );
        await logActivity(pool, { category: 'instructor', action: 'created', type: 'success', title: 'Instructor added', detail: `${name.trim()}${department ? ` · ${department}` : ''}`, actor_name: actor.name, actor_role: actor.role });
        return res.status(201).json({ id: r.insertId });
      }
      if (!password || password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
      const hash = await bcrypt.hash(password, 12);
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [uRes] = await conn.query('INSERT INTO users (username, password_hash, role) VALUES (?,?,?)', [username, hash, 'instructor']);
        await conn.query('INSERT INTO instructors (user_id, name, department, position) VALUES (?,?,?,?)', [uRes.insertId, name.trim(), department || null, position || null]);
        await conn.commit();
        await logActivity(pool, { category: 'instructor', action: 'created', type: 'success', title: 'Instructor added', detail: `${name.trim()} (${username})`, actor_name: actor.name, actor_role: actor.role });
        return res.status(201).json({ success: true });
      } catch (err) {
        await conn.rollback();
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Username already exists.' });
        throw err;
      } finally { conn.release(); }
    }

    if (req.method === 'PUT' && id) {
      const { name, department, position, username, password } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: 'Instructor name is required.' });
      const [[inst]] = await pool.query('SELECT user_id FROM instructors WHERE id=?', [id]);
      if (!inst) return res.status(404).json({ message: 'Not found' });
      await pool.query('UPDATE instructors SET name=?, department=?, position=? WHERE id=?', [name.trim(), department || null, position || null, id]);
      if (inst.user_id) {
        if (username) await pool.query('UPDATE users SET username=? WHERE id=?', [username, inst.user_id]);
        if (password) {
          if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
          const hash = await bcrypt.hash(password, 12);
          await pool.query('UPDATE users SET password_hash=? WHERE id=?', [hash, inst.user_id]);
        }
      } else if (username && password) {
        if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
        const hash = await bcrypt.hash(password, 12);
        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();
          const [uRes] = await conn.query('INSERT INTO users (username, password_hash, role) VALUES (?,?,?)', [username, hash, 'instructor']);
          await conn.query('UPDATE instructors SET user_id=? WHERE id=?', [uRes.insertId, id]);
          await conn.commit();
        } catch (err) { await conn.rollback(); throw err; } finally { conn.release(); }
      }
      await logActivity(pool, { category: 'instructor', action: 'updated', type: 'info', title: 'Instructor updated', detail: name.trim(), actor_name: actor.name, actor_role: actor.role });
      return res.json({ success: true });
    }

    if (req.method === 'DELETE' && id) {
      const [[inst]] = await pool.query('SELECT user_id, name FROM instructors WHERE id=?', [id]);
      if (!inst) return res.status(404).json({ message: 'Not found' });
      const [[usage]] = await pool.query('SELECT COUNT(*) as c FROM schedules WHERE instructor_id=?', [id]);
      if (usage.c > 0) return res.status(409).json({ message: `Cannot delete: this instructor has ${usage.c} schedule(s). Remove those schedules first.` });
      await pool.query('DELETE FROM instructors WHERE id=?', [id]);
      if (inst.user_id) await pool.query('DELETE FROM users WHERE id=?', [inst.user_id]);
      await logActivity(pool, { category: 'instructor', action: 'deleted', type: 'warning', title: 'Instructor deleted', detail: inst.name || `Instructor #${id}`, actor_name: actor.name, actor_role: actor.role });
      return res.json({ success: true });
    }

    res.status(405).end();
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Username already exists.' });
    return handleDbError(err, res, 'Instructors');
  }
};
