import bcrypt from 'bcrypt';
import { query } from './db.js';

async function resetAdmin() {
    try {
        console.log('🔄 Reset password admin...');
        
        // Password di default: admin123
        const password = 'admin123';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        console.log('📝 Hash password generato:', hashedPassword);
        
        // Verifica se l'admin esiste
        const checkResult = await query('SELECT id, username FROM users WHERE username = $1', ['admin']);
        
        if (checkResult.rows.length > 0) {
            // Aggiorna password esistente
            await query(
                'UPDATE users SET password = $1 WHERE username = $2',
                [hashedPassword, 'admin']
            );
            console.log('✅ Password admin aggiornata!');
        } else {
            // Crea nuovo admin
            await query(
                'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
                ['admin', hashedPassword, 'admin']
            );
            console.log('✅ Admin creato!');
        }
        
        console.log('\n📋 Credenziali:');
        console.log('   Username: admin');
        console.log('   Password: admin123');
        console.log('\n✅ Completato!');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Errore:', error);
        process.exit(1);
    }
}

resetAdmin();

