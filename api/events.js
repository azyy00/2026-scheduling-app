const { getPool, handleDbError, logActivity } = require('./_db');
const { requireAuth } = require('./_auth');

// Auto-create table if not exists
const ensureTable = async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      event_date DATE NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

module.exports = async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const pool = getPool();
  const id = req.query.id;

  try {
    await ensureTable(pool);

    if (req.method === 'GET') {
      const upcoming = req.query.upcoming === '1';
      let query = 'SELECT * FROM events';
      const params = [];
      if (upcoming) {
        query += ' WHERE event_date >= CURDATE() AND event_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)';
      }
      query += ' ORDER BY event_date ASC';
      const [rows] = await pool.query(query, params);
      return res.json(rows);
    }

    // Only admin can create/update/delete
    if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });

    if (req.method === 'POST') {
      const { title, event_date, description } = req.body;
      if (!title?.trim() || !event_date) return res.status(400).json({ message: 'Title and date are required.' });
      const [r] = await pool.query(
        'INSERT INTO events (title, event_date, description) VALUES (?,?,?)',
        [title.trim(), event_date, description?.trim() || null]
      );
      await logActivity(pool, { category: 'event', action: 'created', type: 'success', title: 'Event added', detail: `${title.trim()} · ${event_date}`, actor_name: user.name, actor_role: user.role });
      return res.status(201).json({ id: r.insertId });
    }

    if (req.method === 'PUT' && id) {
      const { title, event_date, description } = req.body;
      if (!title?.trim() || !event_date) return res.status(400).json({ message: 'Title and date are required.' });
      await pool.query(
        'UPDATE events SET title=?, event_date=?, description=? WHERE id=?',
        [title.trim(), event_date, description?.trim() || null, id]
      );
      await logActivity(pool, { category: 'event', action: 'updated', type: 'info', title: 'Event updated', detail: `${title.trim()} · ${event_date}`, actor_name: user.name, actor_role: user.role });
      return res.json({ success: true });
    }

    if (req.method === 'DELETE' && id) {
      const [[old]] = await pool.query('SELECT title FROM events WHERE id=?', [id]).catch(() => [[]]);
      await pool.query('DELETE FROM events WHERE id=?', [id]);
      await logActivity(pool, { category: 'event', action: 'deleted', type: 'warning', title: 'Event deleted', detail: old?.title || `Event #${id}`, actor_name: user.name, actor_role: user.role });
      return res.json({ success: true });
    }

    res.status(405).end();
  } catch (err) {
    return handleDbError(err, res, 'Events');
  }
};
