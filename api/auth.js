const { getPool, ensureRegistrationTables, ensurePasswordResetTables, logActivity } = require('./_db');
const { signToken, verifyToken, requireAuth } = require('./_auth');
const { rateLimit, loginCheck, loginStrike, loginReset, MAX_LOGIN } = require('./_rateLimit');
const { hasEmailProvider, sendMail } = require('./_mailer');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Valid bcrypt hash for a dummy password — ensures timing is constant even for unknown usernames
const DUMMY_HASH = '$2a$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
const RESET_CODE_TTL_MINUTES = 10;
const RESET_CODE_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_SENT_MESSAGE = 'If the admin account has a recovery email, a reset code was sent.';

const isValidEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
const normalizeIdentifier = (value = '') => String(value).trim().slice(0, 255);
const hashResetCode = (code) => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not configured');
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(String(code))
    .digest('hex');
};

const safeEqual = (a, b) => {
  const left = Buffer.from(String(a || ''), 'hex');
  const right = Buffer.from(String(b || ''), 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const resetEmailHtml = (code) => `
  <div style="font-family:Arial,sans-serif;line-height:1.5;color:#172033">
    <h2 style="margin:0 0 12px;color:#7B1C1C">Goa Community College password reset</h2>
    <p>Your password reset code is:</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0;color:#111827">${code}</p>
    <p>This code expires in ${RESET_CODE_TTL_MINUTES} minutes. If you did not request this, ignore this email and keep your current password.</p>
  </div>
`;

module.exports = async (req, res) => {
  const action = req.query.action;
  const pool = getPool();

  // GET /api/auth?action=public-sections — unauthenticated list for the registration dropdown
  if (action === 'public-sections') {
    if (req.method !== 'GET') return res.status(405).end();
    try {
      const [rows] = await pool.query('SELECT id, name, year_level, program FROM sections ORDER BY year_level, name');
      return res.json(rows);
    } catch (err) {
      console.error('Public sections error:', err.message);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  // GET/PUT /api/auth?action=account — current user's account security details
  if (action === 'account') {
    const decoded = requireAuth(req, res);
    if (!decoded) return;

    try {
      await ensurePasswordResetTables(pool);

      if (req.method === 'GET') {
        const [[user]] = await pool.query('SELECT username, email, role FROM users WHERE id = ?', [decoded.id]);
        if (!user) return res.status(404).json({ message: 'User not found.' });
        return res.json({ username: user.username, email: user.email || '', role: user.role });
      }

      if (req.method === 'PUT') {
        if (decoded.role !== 'admin') return res.status(403).json({ message: 'Only administrators can manage recovery email.' });
        const email = String(req.body.email || '').trim().toLowerCase();
        if (!email) return res.status(400).json({ message: 'Recovery email is required.' });
        if (!isValidEmail(email) || email.length > 255) return res.status(400).json({ message: 'Enter a valid email address.' });
        await pool.query('UPDATE users SET email = ? WHERE id = ? AND role = "admin"', [email, decoded.id]);
        await logActivity(pool, { category: 'auth', action: 'email_updated', type: 'info', title: 'Recovery email updated', detail: email, actor_name: decoded.name, actor_role: decoded.role });
        return res.json({ message: 'Recovery email saved.', email });
      }

      return res.status(405).end();
    } catch (err) {
      console.error('Account security error:', err.message);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  if (req.method !== 'POST') return res.status(405).end();

  // POST /api/auth?action=login
  if (action === 'login') {
    const gate = await loginCheck(pool, req, 'login', MAX_LOGIN);
    if (gate.blocked) return res.status(429).json({ message: `Too many failed attempts. Try again in ${Math.ceil(gate.retryAfter / 60)} minute(s).` });

    const { username, password } = req.body;
    if (!username?.trim() || !password) return res.status(400).json({ message: 'Username and password are required.' });
    if (username.length > 100 || password.length > 200) return res.status(400).json({ message: 'Invalid input.' });

    try {
      const [rows] = await pool.query(
        `SELECT u.id, u.username, u.password_hash, u.role, i.name, i.id as instructor_id
         FROM users u LEFT JOIN instructors i ON i.user_id = u.id WHERE u.username = ?`,
        [username.trim()]
      );
      const user = rows[0];
      const hash = user?.password_hash || DUMMY_HASH;
      const valid = await bcrypt.compare(password, hash);
      if (!user || !valid) {
        const count = await loginStrike(pool, req, 'login');
        const left = Math.max(0, MAX_LOGIN - count);
        return res.status(401).json({ message: left > 0
          ? `Incorrect username or password. ${left} attempt${left === 1 ? '' : 's'} left.`
          : 'Too many failed attempts. Please try again in 15 minutes.' });
      }
      await loginReset(pool, req, 'login');
      const token = signToken({ id: user.id, role: user.role, name: user.name || user.username, instructor_id: user.instructor_id || null });
      await logActivity(pool, { category: 'auth', action: 'login', type: 'info', title: 'Signed in', detail: `${user.name || user.username} (${user.role})`, actor_name: user.name || user.username, actor_role: user.role });
      return res.json({ token });
    } catch (err) {
      console.error('Login error:', err.message);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  // POST /api/auth?action=student-login
  if (action === 'student-login') {
    const gate = await loginCheck(pool, req, 'student-login', MAX_LOGIN);
    if (gate.blocked) return res.status(429).json({ message: `Too many failed attempts. Try again in ${Math.ceil(gate.retryAfter / 60)} minute(s).` });

    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ message: 'Student ID required.' });
    if (String(student_id).length > 50) return res.status(400).json({ message: 'Invalid input.' });

    try {
      const [rows] = await pool.query(
        `SELECT s.id, s.student_id, s.name, s.year_level, s.section_id, sec.name as section_name
         FROM students s LEFT JOIN sections sec ON sec.id = s.section_id WHERE s.student_id = ?`,
        [String(student_id).trim()]
      );
      const student = rows[0];
      if (!student) {
        const count = await loginStrike(pool, req, 'student-login');
        const left = Math.max(0, MAX_LOGIN - count);
        return res.status(401).json({ message: left > 0
          ? `Student ID not found. ${left} attempt${left === 1 ? '' : 's'} left.`
          : 'Too many failed attempts. Please try again in 15 minutes.' });
      }
      await loginReset(pool, req, 'student-login');
      const token = signToken({ id: student.id, role: 'student', student_id: student.student_id, name: student.name, year_level: student.year_level, section_id: student.section_id, section_name: student.section_name });
      return res.json({ token });
    } catch (err) {
      console.error('Student login error:', err.message);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  // POST /api/auth?action=instructor-signup
  // Self-registration: the instructor record is created automatically on admin approval.
  if (action === 'instructor-signup') {
    const limit = rateLimit(req);
    if (limit.blocked) return res.status(429).json({ message: `Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minute(s).` });

    const { last_name, first_name, department, desired_username, password } = req.body;
    if (!last_name || !first_name || !desired_username || !password)
      return res.status(400).json({ message: 'All fields are required.' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    if (desired_username.length > 50 || /\s/.test(desired_username))
      return res.status(400).json({ message: 'Username must be one word, no spaces.' });

    try {
      await ensureRegistrationTables(pool);
      const fullName = `${first_name.trim()} ${last_name.trim()}`.replace(/\s+/g, ' ');

      // Username must be globally unique among existing accounts...
      const [userCheck] = await pool.query('SELECT id FROM users WHERE username = ?', [desired_username]);
      if (userCheck.length) return res.status(400).json({ message: 'Username already taken. Choose another.' });
      // ...and among pending requests.
      const [userReqCheck] = await pool.query('SELECT id FROM activation_requests WHERE desired_username = ? AND status = "pending"', [desired_username]);
      if (userReqCheck.length) return res.status(400).json({ message: 'Username already requested. Choose another.' });

      // If the admin already created a matching unactivated instructor, link to it; otherwise create on approval.
      const searchName = `%${first_name.trim().toLowerCase()}%${last_name.trim().toLowerCase()}%`;
      const searchName2 = `%${last_name.trim().toLowerCase()}%${first_name.trim().toLowerCase()}%`;
      const [instRows] = await pool.query(
        'SELECT id, user_id FROM instructors WHERE LOWER(name) LIKE ? OR LOWER(name) LIKE ?',
        [searchName, searchName2]
      );
      // Ambiguous match (multiple instructors with this name) — don't guess; ask admin to handle.
      if (instRows.length > 1) return res.status(409).json({ message: 'Multiple records match this name. Please contact your admin to activate your account.' });
      const existing = instRows[0];
      if (existing && existing.user_id) return res.status(400).json({ message: 'This name is already activated. Use Sign In.' });

      const instructorId = existing ? existing.id : null;
      if (instructorId) {
        const [reqCheck] = await pool.query('SELECT id FROM activation_requests WHERE instructor_id = ? AND status = "pending"', [instructorId]);
        if (reqCheck.length) return res.status(400).json({ message: 'You already have a pending activation request.' });
      } else {
        const [nameReqCheck] = await pool.query('SELECT id FROM activation_requests WHERE LOWER(full_name) = ? AND status = "pending"', [fullName.toLowerCase()]);
        if (nameReqCheck.length) return res.status(400).json({ message: 'A request with this name is already pending.' });
      }

      const hash = await bcrypt.hash(password, 12);
      await pool.query(
        'INSERT INTO activation_requests (instructor_id, full_name, department, desired_username, password_hash, status) VALUES (?,?,?,?,?,?)',
        [instructorId, fullName, department?.trim() || null, desired_username, hash, 'pending']
      );
      await logActivity(pool, { category: 'instructor', action: 'requested', type: 'warning', title: 'Instructor activation requested', detail: `${fullName} (${desired_username})`, actor_name: fullName, actor_role: 'instructor' });
      return res.json({ message: 'Registration sent! Your account will be created once the admin approves it.' });
    } catch (err) {
      console.error('Signup error:', err.message);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  // POST /api/auth?action=student-signup
  // Student self-registration: ID + name only. Admin assigns year/section on approval.
  if (action === 'student-signup') {
    const limit = rateLimit(req);
    if (limit.blocked) return res.status(429).json({ message: `Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minute(s).` });

    const { student_id, name, year_level, section_id } = req.body;
    if (!student_id?.trim() || !name?.trim()) return res.status(400).json({ message: 'Student ID and name are required.' });
    if (String(student_id).length > 50 || name.length > 200) return res.status(400).json({ message: 'Invalid input.' });

    try {
      await ensureRegistrationTables(pool);
      const sid = String(student_id).trim();
      const [exists] = await pool.query('SELECT id FROM students WHERE student_id = ?', [sid]);
      if (exists.length) return res.status(400).json({ message: 'This Student ID is already registered. Try signing in.' });
      const [pending] = await pool.query('SELECT id FROM student_requests WHERE student_id = ? AND status = "pending"', [sid]);
      if (pending.length) return res.status(400).json({ message: 'You already have a pending registration. Please wait for admin approval.' });
      await pool.query(
        'INSERT INTO student_requests (student_id, name, year_level, section_id, status) VALUES (?,?,?,?,?)',
        [sid, name.trim(), year_level ? parseInt(year_level) : null, section_id || null, 'pending']
      );
      await logActivity(pool, { category: 'student', action: 'requested', type: 'warning', title: 'Student registration submitted', detail: `${name.trim()} (${sid})`, actor_name: name.trim(), actor_role: 'student' });
      return res.json({ message: 'Registration sent! You can sign in once the admin approves your account.' });
    } catch (err) {
      console.error('Student signup error:', err.message);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  // POST /api/auth?action=request-password-reset
  // Admin-only password reset by email code. The response is intentionally
  // generic so attackers cannot enumerate accounts or recovery addresses.
  if (action === 'request-password-reset') {
    const limit = rateLimit(req);
    if (limit.blocked) return res.status(429).json({ message: `Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minute(s).` });
    if (!hasEmailProvider()) return res.status(503).json({ message: 'Password reset email is not configured yet.' });

    const identifier = normalizeIdentifier(req.body.identifier);
    if (!identifier) return res.status(400).json({ message: 'Username or email is required.' });

    try {
      await ensurePasswordResetTables(pool);
      const [rows] = await pool.query(
        'SELECT id, username, email, role FROM users WHERE role = "admin" AND (username = ? OR email = ?) LIMIT 1',
        [identifier, identifier.toLowerCase()]
      );
      const user = rows[0];

      if (user?.email && isValidEmail(user.email)) {
        const code = String(crypto.randomInt(100000, 1000000));
        const expires = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000);
        await pool.query('UPDATE password_reset_codes SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [user.id]);
        await pool.query(
          'INSERT INTO password_reset_codes (user_id, code_hash, expires_at) VALUES (?,?,?)',
          [user.id, hashResetCode(code), expires]
        );
        await sendMail({
          to: user.email,
          subject: 'Goa Community College password reset code',
          text: `Your Goa Community College password reset code is ${code}. It expires in ${RESET_CODE_TTL_MINUTES} minutes. If you did not request this, ignore this email.`,
          html: resetEmailHtml(code),
        });
        await logActivity(pool, { category: 'auth', action: 'reset_code_sent', type: 'warning', title: 'Password reset code sent', detail: user.username, actor_name: user.username, actor_role: user.role });
      }

      return res.json({ message: PASSWORD_RESET_SENT_MESSAGE });
    } catch (err) {
      console.error('Password reset request error:', err.message);
      return res.status(500).json({ message: 'Could not send the reset email. Please check email configuration.' });
    }
  }

  // POST /api/auth?action=reset-password
  if (action === 'reset-password') {
    const limit = rateLimit(req);
    if (limit.blocked) return res.status(429).json({ message: `Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minute(s).` });

    const identifier = normalizeIdentifier(req.body.identifier);
    const code = String(req.body.code || '').trim();
    const newPassword = String(req.body.new_password || '');
    if (!identifier || !code || !newPassword) return res.status(400).json({ message: 'Username/email, code, and new password are required.' });
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ message: 'Enter the 6-digit reset code.' });
    if (newPassword.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters.' });

    try {
      await ensurePasswordResetTables(pool);
      const [rows] = await pool.query(
        'SELECT id, username, role FROM users WHERE role = "admin" AND (username = ? OR email = ?) LIMIT 1',
        [identifier, identifier.toLowerCase()]
      );
      const user = rows[0];
      if (!user) return res.status(400).json({ message: 'Invalid or expired reset code.' });

      const [codeRows] = await pool.query(
        `SELECT id, code_hash, attempts
         FROM password_reset_codes
         WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [user.id]
      );
      const reset = codeRows[0];
      if (!reset || reset.attempts >= RESET_CODE_MAX_ATTEMPTS) {
        return res.status(400).json({ message: 'Invalid or expired reset code.' });
      }

      const valid = safeEqual(reset.code_hash, hashResetCode(code));
      if (!valid) {
        await pool.query('UPDATE password_reset_codes SET attempts = attempts + 1 WHERE id = ?', [reset.id]);
        return res.status(400).json({ message: 'Invalid or expired reset code.' });
      }

      const hash = await bcrypt.hash(newPassword, 12);
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
        await conn.query('UPDATE password_reset_codes SET used_at = NOW() WHERE id = ?', [reset.id]);
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      await logActivity(pool, { category: 'auth', action: 'password_reset', type: 'warning', title: 'Admin password reset', detail: user.username, actor_name: user.username, actor_role: user.role });
      return res.json({ message: 'Password reset successfully. You can sign in now.' });
    } catch (err) {
      console.error('Password reset error:', err.message);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  // POST /api/auth?action=change-password
  if (action === 'change-password') {
    let decoded;
    try { decoded = verifyToken(req); } catch { return res.status(401).json({ message: 'Unauthorized' }); }
    const limit = rateLimit(req);
    if (limit.blocked) return res.status(429).json({ message: `Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minute(s).` });
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ message: 'Both fields required.' });
    if (new_password.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    if (current_password === new_password) return res.status(400).json({ message: 'New password must differ from current.' });

    try {
      const [[user]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [decoded.id]);
      if (!user) return res.status(404).json({ message: 'User not found.' });
      const valid = await bcrypt.compare(current_password, user.password_hash);
      if (!valid) return res.status(401).json({ message: 'Current password is incorrect.' });
      const hash = await bcrypt.hash(new_password, 12);
      await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, decoded.id]);
      await logActivity(pool, { category: 'auth', action: 'password_changed', type: 'warning', title: 'Password changed', detail: `${decoded.name || 'A user'} updated their password`, actor_name: decoded.name, actor_role: decoded.role });
      return res.json({ message: 'Password changed successfully.' });
    } catch (err) {
      console.error('Change password error:', err.message);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  res.status(400).json({ message: 'Unknown action.' });
};
