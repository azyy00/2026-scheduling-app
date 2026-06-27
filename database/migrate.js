require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.TIDB_HOST, port: process.env.TIDB_PORT,
    user: process.env.TIDB_USER, password: process.env.TIDB_PASSWORD,
    database: process.env.TIDB_DATABASE, ssl: { rejectUnauthorized: true },
    multipleStatements: true,
  });

  await conn.query('ALTER TABLE instructors MODIFY COLUMN user_id INT NULL');
  console.log('✓ user_id nullable');

  await conn.query(`
    CREATE TABLE IF NOT EXISTS activation_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      instructor_id INT NOT NULL,
      desired_username VARCHAR(100) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      status ENUM('pending','approved','rejected') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE
    )
  `);
  console.log('✓ activation_requests table created');

  await conn.end();
  console.log('Migration complete.');
}

run().catch(e => console.error('Migration failed:', e.message));
