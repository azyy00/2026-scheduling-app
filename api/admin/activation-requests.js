require('dotenv').config();
const { getPool } = require('../_db');
const { verifyToken } = require('../_auth');

module.exports = async (req, res) => {
  let user;
  try { user = verifyToken(req); } catch { return res.status(401).json({ message: 'Unauthorized' }); }
  if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });

  const pool = getPool();
  const id = req.query.id;
  const action = req.query.action; // 'approve' or 'reject'

  if (req.method === 'GET') {
    const [rows] = await pool.query(`
      SELECT ar.id, ar.instructor_id, ar.desired_username, ar.status, ar.created_at,
             i.name as instructor_name, i.department
      FROM activation_requests ar
      JOIN instructors i ON i.id = ar.instructor_id
      ORDER BY ar.created_at DESC
    `);
    return res.json(rows);
  }

  if (req.method === 'POST' && id && action === 'approve') {
    const [[req_row]] = await pool.query(
      'SELECT * FROM activation_requests WHERE id = ? AND status = ?', [id, 'pending']
    );
    if (!req_row) return res.status(404).json({ message: 'Request not found or already processed.' });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [uRes] = await conn.query(
        'INSERT INTO users (username, password_hash, role) VALUES (?,?,?)',
        [req_row.desired_username, req_row.password_hash, 'instructor']
      );
      await conn.query('UPDATE instructors SET user_id = ? WHERE id = ?', [uRes.insertId, req_row.instructor_id]);
      await conn.query('UPDATE activation_requests SET status = ? WHERE id = ?', ['approved', id]);
      await conn.commit();
      return res.json({ message: 'Account activated.' });
    } catch (err) {
      await conn.rollback();
      if (err.code === 'ER_DUP_ENTRY')
        return res.status(409).json({ message: 'Username already taken.' });
      throw err;
    } finally { conn.release(); }
  }

  if (req.method === 'POST' && id && action === 'reject') {
    await pool.query('UPDATE activation_requests SET status = ? WHERE id = ?', ['rejected', id]);
    return res.json({ message: 'Request rejected.' });
  }

  res.status(405).end();
};
