const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
// Fail closed: never fall back to a hardcoded secret. If JWT_SECRET is missing,
// the app must refuse to issue or verify tokens rather than run insecurely.
if (!SECRET) {
  console.error('FATAL: JWT_SECRET env var is not set. Authentication is disabled.');
}

const signToken = (payload) => {
  if (!SECRET) throw new Error('JWT_SECRET not configured');
  return jwt.sign(payload, SECRET, { expiresIn: '8h' });
};

// Low-level verify — returns the decoded payload or throws.
const verifyToken = (req) => {
  if (!SECRET) throw new Error('JWT_SECRET not configured');
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) throw new Error('No token');
  return jwt.verify(auth.slice(7), SECRET);
};

// requireAuth: returns the decoded user, or sends 401 and returns null.
const requireAuth = (req, res) => {
  try {
    return verifyToken(req);
  } catch {
    res.status(401).json({ message: 'Unauthorized. Please sign in again.' });
    return null;
  }
};

// requireRole: authenticate, then ensure the user holds one of the allowed roles.
// Returns the user, or sends 401/403 and returns null.
const requireRole = (req, res, roles) => {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (!roles.includes(user.role)) {
    res.status(403).json({ message: 'Forbidden. You do not have access to this resource.' });
    return null;
  }
  return user;
};

const requireAdmin = (req, res) => requireRole(req, res, ['admin']);

module.exports = { signToken, verifyToken, requireAuth, requireRole, requireAdmin };
