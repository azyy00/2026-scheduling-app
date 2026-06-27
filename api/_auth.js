const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'classsched_secret';

const signToken = (payload) => jwt.sign(payload, SECRET, { expiresIn: '8h' });

const verifyToken = (req) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) throw new Error('No token');
  return jwt.verify(auth.slice(7), SECRET);
};

module.exports = { signToken, verifyToken };
