import { pool } from './db.js';

const schema = `
-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'mobile',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Signs Table
CREATE TABLE IF NOT EXISTS signs (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    photo_path TEXT,
    status TEXT DEFAULT 'buono',
    installation_date DATE,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    synced BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Interventions Table
CREATE TABLE IF NOT EXISTS interventions (
    id SERIAL PRIMARY KEY,
    sign_id INTEGER REFERENCES signs(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    scheduled_date DATE,
    cost DECIMAL(10, 2),
    notes TEXT,
    status TEXT DEFAULT 'programmato',
    synced BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Initial Admin User (password: admin123)
INSERT INTO users (username, password, role) 
VALUES ('admin', '$2b$10$5.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0', 'admin')
ON CONFLICT (username) DO NOTHING;
`;

async function setupDatabase() {
    try {
        console.log('🔄 Inizializzazione schema database...');
        await pool.query(schema);
        console.log('✅ Tabelle create con successo!');

        // Verifica
        const res = await pool.query('SELECT tablename FROM pg_tables WHERE schemaname = \'public\'');
        console.log('📊 Tabelle presenti:', res.rows.map(r => r.tablename).join(', '));

        process.exit(0);
    } catch (error) {
        console.error('❌ Errore inizializzazione DB:', error);
        process.exit(1);
    }
}

setupDatabase();
