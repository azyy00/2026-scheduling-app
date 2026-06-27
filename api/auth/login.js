const { getPool } = require('../_db');
const { signToken } = require('../_auth');
const { rateLimit } = require('../_rateLimit');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  // Rate limit
  const limit = rateLimit(req);
  if (limit.blocked) {
    return res.status(429).json({ message: `Too many login attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minute(s).` });
  }

  const { username, password } = req.body;
  if (!username?.trim() || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.password_hash, u.role,
              i.name, i.id as instructor_id, i.position, i.department
       FROM users u
       LEFT JOIN instructors i ON i.user_id = u.id
       WHERE u.username = ?`,
      [username.trim()]
    );
    const user = rows[0];

    // Always run bcrypt to prevent timing attacks
    const hash = user?.password_hash || '$2a$10$invalidhashpaddingtomakeitrealistic';
    const valid = await bcrypt.compare(password, hash);

    if (!user || !valid) {
      return res.status(401).json({ message: 'Incorrect username or password.' });
    }

    const token = signToken({
      id: user.id,
      role: user.role,
      name: user.name || user.username,
      instructor_id: user.instructor_id || null,
    });

    res.json({ token });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};
