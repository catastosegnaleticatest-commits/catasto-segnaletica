// Script di migrazione per aggiungere supporto a più foto per segnale
import { pool } from './db.js';

const migration = `
-- Tabella per le foto dei segnali (supporto a più foto per segnale)
CREATE TABLE IF NOT EXISTS sign_photos (
    id SERIAL PRIMARY KEY,
    sign_id INTEGER NOT NULL REFERENCES signs(id) ON DELETE CASCADE,
    photo_path TEXT NOT NULL,
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_primary BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0
);

-- Indice per migliorare le query
CREATE INDEX IF NOT EXISTS idx_sign_photos_sign_id ON sign_photos(sign_id);
CREATE INDEX IF NOT EXISTS idx_sign_photos_primary ON sign_photos(sign_id, is_primary) WHERE is_primary = true;

-- Migrazione dati esistenti: sposta le foto dalla tabella signs a sign_photos
DO $$
DECLARE
    sign_record RECORD;
BEGIN
    FOR sign_record IN SELECT id, photo_path, created_by FROM signs WHERE photo_path IS NOT NULL AND photo_path != ''
    LOOP
        -- Inserisci la foto esistente come foto primaria
        INSERT INTO sign_photos (sign_id, photo_path, uploaded_by, is_primary, display_order)
        VALUES (sign_record.id, sign_record.photo_path, sign_record.created_by, true, 0)
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;
`;

async function runMigration() {
    try {
        console.log('🔄 Esecuzione migrazione: aggiunta tabella sign_photos...');
        await pool.query(migration);
        console.log('✅ Migrazione completata con successo!');
        
        // Verifica
        const result = await pool.query('SELECT COUNT(*) as count FROM sign_photos');
        console.log(`📊 Foto migrate: ${result.rows[0].count}`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Errore migrazione:', error);
        process.exit(1);
    }
}

runMigration();

