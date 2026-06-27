const { getPool } = require('../_db');
const { verifyToken } = require('../_auth');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  let decoded;
  try { decoded = verifyToken(req); }
  catch { return res.status(401).json({ message: 'Unauthorized' }); }

  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ message: 'Both current and new password are required.' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters.' });
  }
  if (current_password === new_password) {
    return res.status(400).json({ message: 'New password must be different from current.' });
  }

  try {
    const pool = getPool();
    const [[user]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [decoded.id]);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Current password is incorrect.' });

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, decoded.id]);

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
};
