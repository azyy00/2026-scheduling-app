const mysql = require('mysql2/promise');

let pool;

const getPool = () => {
  // Re-create pool if env vars weren't available on first init (Vercel cold start)
  if (!pool || !process.env.TIDB_HOST) {
    pool = mysql.createPool({
      host: process.env.TIDB_HOST,
      port: parseInt(process.env.TIDB_PORT) || 4000,
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      database: process.env.TIDB_DATABASE,
      ssl: { rejectUnauthorized: true },
      waitForConnections: true,
      connectionLimit: 5,
    });
  }
  return pool;
};

module.exports = { getPool };
