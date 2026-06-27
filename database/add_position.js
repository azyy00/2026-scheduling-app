require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.TIDB_HOST, port: process.env.TIDB_PORT,
    user: process.env.TIDB_USER, password: process.env.TIDB_PASSWORD,
    database: process.env.TIDB_DATABASE, ssl: { rejectUnauthorized: true },
  });
  await conn.query("ALTER TABLE instructors ADD COLUMN IF NOT EXISTS position VARCHAR(100) DEFAULT NULL AFTER department");
  console.log('✓ position column added to instructors');
  await conn.end();
}
run().catch(e => console.error(e.message));
