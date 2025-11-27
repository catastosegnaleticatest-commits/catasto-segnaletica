import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ ERRORE: DATABASE_URL non definita nel file .env');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false // Necessario per Supabase/Render
    }
});

// Test connessione
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Errore connessione al database:', err.message);
    } else {
        console.log('✅ Connesso al database PostgreSQL!');
        release();
    }
});

export const query = (text, params) => pool.query(text, params);
export { pool };
export default pool;
