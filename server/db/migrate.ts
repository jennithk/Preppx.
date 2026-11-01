import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

try {
  const schema = await readFile(fileURLToPath(new URL('./schema.sql', import.meta.url)), 'utf8');
  await pool.query(schema);
  console.log('PREPPX schema migration completed.');
} finally {
  await pool.end();
}
