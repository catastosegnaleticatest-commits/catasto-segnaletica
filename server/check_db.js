import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'data', 'catasto.db');

console.log('📂 Checking Database at:', dbPath);

try {
    const db = new Database(dbPath, { readonly: true });

    const signCount = db.prepare('SELECT COUNT(*) as count FROM signs').get();
    console.log(`📊 Total Signs in Server DB: ${signCount.count}`);

    const signs = db.prepare('SELECT id, type, status, created_at, created_by FROM signs ORDER BY created_at DESC LIMIT 5').all();
    console.log('📝 Latest 5 Signs:');
    console.table(signs);

    const users = db.prepare('SELECT id, username, role FROM users').all();
    console.log('👥 Users:');
    console.table(users);

} catch (error) {
    console.error('❌ Error reading DB:', error.message);
}
