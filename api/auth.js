const { getPool } = require('./_db');
const { signToken, verifyToken } = require('./_auth');
const { rateLimit } = require('./_rateLimit');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  const action = req.query.action; // login | student-login | instructor-signup | change-password

  // POST /api/auth?action=login
  if (action === 'login') {
    if (req.method !== 'POST') return res.status(405).end();
    const limit = rateLimit(req);
    if (limit.blocked) return res.status(429).json({ message: `Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minute(s).` });

    const { username, password } = req.body;
    if (!username?.trim() || !password) return res.status(400).json({ message: 'Username and password are required.' });

    try {
      const pool = getPool();
      const [rows] = await pool.query(
        `SELECT u.id, u.username, u.password_hash, u.role, i.name, i.id as instructor_id
         FROM users u LEFT JOIN instructors i ON i.user_id = u.id WHERE u.username = ?`,
        [username.trim()]
      );
      const user = rows[0];
      const hash = user?.password_hash || '$2a$10$invalidhashpaddingtomakeitrealistic';
      const valid = await bcrypt.compare(password, hash);
      if (!user || !valid) return res.status(401).json({ message: 'Incorrect username or password.' });
      const token = signToken({ id: user.id, role: user.role, name: user.name || user.username, instructor_id: user.instructor_id || null });
      return res.json({ token });
    } catch (err) {
      console.error('Login error:', err.message);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  // POST /api/auth?action=student-login
  if (action === 'student-login') {
    if (req.method !== 'POST') return res.status(405).end();
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ message: 'Student ID required' });
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT s.id, s.student_id, s.name, s.year_level, s.section_id, sec.name as section_name FROM students s LEFT JOIN sections sec ON sec.id = s.section_id WHERE s.student_id = ?',
      [student_id]
    );
    const student = rows[0];
    if (!student) return res.status(401).json({ message: 'Student ID not found' });
    const token = signToken({ id: student.id, role: 'student', student_id: student.student_id, name: student.name, year_level: student.year_level, section_id: student.section_id, section_name: student.section_name });
    return res.json({ token });
  }

  // POST /api/auth?action=instructor-signup
  if (action === 'instructor-signup') {
    if (req.method !== 'POST') return res.status(405).end();
    const { last_name, first_name, desired_username, password } = req.body;
    if (!last_name || !first_name || !desired_username || !password)
      return res.status(400).json({ message: 'All fields are required.' });
    const pool = getPool();
    const searchName = `${first_name.trim()} ${last_name.trim()}`.toLowerCase();
    const [instRows] = await pool.query('SELECT id, user_id FROM instructors WHERE LOWER(name) LIKE ?', [`%${searchName}%`]);
    if (!instRows[0]) return res.status(404).json({ message: 'Instructor record not found. Ask your admin to add you first.' });
    const instructor = instRows[0];
    if (instructor.user_id) return res.status(400).json({ message: 'This instructor is already activated. Use Sign In.' });
    const [userCheck] = await pool.query('SELECT id FROM users WHERE username = ?', [desired_username]);
    if (userCheck.length) return res.status(400).json({ message: 'Username already taken. Choose another.' });
    const [reqCheck] = await pool.query('SELECT id FROM activation_requests WHERE instructor_id = ? AND status = "pending"', [instructor.id]);
    if (reqCheck.length) return res.status(400).json({ message: 'You already have a pending activation request.' });
    const hash = await bcrypt.hash(password, 12);
    await pool.query('INSERT INTO activation_requests (instructor_id, desired_username, password_hash, status) VALUES (?,?,?,?)', [instructor.id, desired_username, hash, 'pending']);
    return res.json({ message: 'Activation request sent! Wait for admin approval before signing in.' });
  }

  // POST /api/auth?action=change-password
  if (action === 'change-password') {
    if (req.method !== 'POST') return res.status(405).end();
    let decoded;
    try { decoded = verifyToken(req); } catch { return res.status(401).json({ message: 'Unauthorized' }); }
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ message: 'Both fields required.' });
    if (new_password.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    if (current_password === new_password) return res.status(400).json({ message: 'New password must differ from current.' });
    const pool = getPool();
    const [[user]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [decoded.id]);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Current password is incorrect.' });
    const hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, decoded.id]);
    return res.json({ message: 'Password changed successfully.' });
  }

  res.status(400).json({ message: 'Unknown action.' });
};
