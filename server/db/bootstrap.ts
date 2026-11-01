import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { pool } from './pool.js';

try {
  if (!config.MANAGEMENT_BOOTSTRAP_NAME || !config.MANAGEMENT_BOOTSTRAP_EMAIL || !config.MANAGEMENT_BOOTSTRAP_PASSWORD) {
    throw new Error('Set all MANAGEMENT_BOOTSTRAP_* variables in the private environment before bootstrapping.');
  }
  const passwordHash = await bcrypt.hash(config.MANAGEMENT_BOOTSTRAP_PASSWORD, 12);
  await pool.query(
    `INSERT INTO management_users (email, full_name, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET
       full_name = EXCLUDED.full_name,
       password_hash = EXCLUDED.password_hash,
       updated_at = now()`,
    [config.MANAGEMENT_BOOTSTRAP_EMAIL.toLowerCase(), config.MANAGEMENT_BOOTSTRAP_NAME, passwordHash],
  );
  console.log('Management bootstrap user saved. No student accounts were created.');
} finally {
  await pool.end();
}
