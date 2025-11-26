import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'catasto.db');

try {
    const db = new Database(dbPath, { readonly: true });
    const users = db.prepare('SELECT id, username, role, created_at FROM users').all();
    console.log(JSON.stringify(users, null, 2));
} catch (error) {
    console.error('Error:', error);
}
