require('dotenv').config();
const mysql = require('mysql2/promise');

let pool;

const getPool = () => {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.TIDB_HOST,
      port: process.env.TIDB_PORT || 4000,
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      database: process.env.TIDB_DATABASE,
      ssl: { rejectUnauthorized: true },
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
};

module.exports = { getPool };
