import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'server', 'data', 'catasto.db');
console.log('Opening database at:', dbPath);

const db = new Database(dbPath);

const users = db.prepare('SELECT * FROM users').all();
console.log('Users in database:');
console.table(users);
