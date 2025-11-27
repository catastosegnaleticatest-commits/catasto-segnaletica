// Script di migrazione per aggiungere campo password_changed
import { pool } from './db.js';

const migration = `
-- Aggiungi campo password_changed alla tabella users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_changed BOOLEAN DEFAULT false;

-- Imposta password_changed = true per tutti gli utenti esistenti (hanno già fatto login)
UPDATE users 
SET password_changed = true 
WHERE password_changed IS NULL OR password_changed = false;
`;

async function runMigration() {
    try {
        console.log('🔄 Esecuzione migrazione: aggiunta campo password_changed...');
        await pool.query(migration);
        console.log('✅ Migrazione completata con successo!');
        
        // Verifica
        const result = await pool.query('SELECT id, username, password_changed FROM users LIMIT 5');
        console.log('📊 Utenti (prime 5 righe):');
        result.rows.forEach(user => {
            console.log(`  - ${user.username}: password_changed = ${user.password_changed}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Errore migrazione:', error);
        process.exit(1);
    }
}

runMigration();

