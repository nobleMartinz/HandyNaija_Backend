import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, query } from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function runMigrations() {
  console.log('Running database migrations...');
  
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    console.log(`Applying migration: ${file}`);
    
    try {
      await query(sql);
      console.log(`✓ ${file} applied successfully`);
    } catch (err) {
      console.error(`✗ Failed to apply ${file}:`, err.message);
      throw err;
    }
  }
  
  console.log('All migrations completed successfully!');
}

async function rollbackMigrations() {
  console.log('Rollback not implemented for safety. Use manual SQL if needed.');
}

const command = process.argv[2];

if (command === 'run') {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} else if (command === 'rollback') {
  rollbackMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} else {
  console.log('Usage: node migrations/run.js [run|rollback]');
  process.exit(1);
}