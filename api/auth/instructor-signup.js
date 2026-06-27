require('dotenv').config();
const { getPool } = require('../_db');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const { last_name, first_name, desired_username, password } = req.body;

  if (!last_name || !first_name || !desired_username || !password)
    return res.status(400).json({ message: 'All fields are required.' });

  const pool = getPool();

  // Find instructor by name (case-insensitive match on full name)
  const fullName = `${first_name} ${last_name}`.toLowerCase();
  const altName  = `${last_name}, ${first_name}`.toLowerCase();
  const [rows] = await pool.query(
    `SELECT id, name, user_id FROM instructors
     WHERE LOWER(name) LIKE ? OR LOWER(name) LIKE ? OR LOWER(name) LIKE ?`,
    [`%${fullName}%`, `%${altName}%`, `%${last_name.toLowerCase()}%`]
  );

  // Filter to ones whose last name matches
  const match = rows.find(r =>
    r.name.toLowerCase().includes(last_name.toLowerCase()) &&
    r.name.toLowerCase().includes(first_name.toLowerCase())
  );

  if (!match)
    return res.status(404).json({ message: 'No instructor found with that name. Ask your admin to add you first.' });

  if (match.user_id)
    return res.status(409).json({ message: 'This instructor account is already activated. Use Sign In instead.' });

  // Check if username is taken
  const [uRows] = await pool.query('SELECT id FROM users WHERE username = ?', [desired_username]);
  if (uRows.length > 0)
    return res.status(409).json({ message: 'Username already taken. Choose another.' });

  // Check if there's already a pending request
  const [existing] = await pool.query(
    'SELECT id FROM activation_requests WHERE instructor_id = ? AND status = ?',
    [match.id, 'pending']
  );
  if (existing.length > 0)
    return res.status(409).json({ message: 'You already have a pending activation request. Please wait for admin approval.' });

  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    'INSERT INTO activation_requests (instructor_id, desired_username, password_hash) VALUES (?,?,?)',
    [match.id, desired_username, hash]
  );

  res.json({ message: 'Request sent! Please wait for the admin to activate your account.' });
};
