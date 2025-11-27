import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Server } from 'socket.io';
import { createServer } from 'http';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { query } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-byte-hex-encryption-key-change-in-production';

// Directory per le foto crittografate
const photosDir = path.join(__dirname, 'photos');
if (!fs.existsSync(photosDir)) {
    fs.mkdirSync(photosDir, { recursive: true });
}

// Middleware
app.use(cors({
    origin: '*', // Permette richieste da qualsiasi origine (incluso GitHub Pages)
    credentials: true
}));
// Aumenta il limite per le richieste JSON (per le foto compresse)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configurazione multer per upload foto
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, photosDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

// Funzione per crittografare foto (da data URL)
function encryptPhoto(dataUrl) {
    // Converti data URL in buffer
    const base64Data = dataUrl.split(',')[1];
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Genera IV random
    const iv = crypto.randomBytes(16);
    
    // Crea cipher
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    // Crittografa
    let encrypted = cipher.update(imageBuffer);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return {
        data: encrypted.toString('hex'),
        iv: iv.toString('hex')
    };
}

// Funzione per decrittografare foto
function decryptPhoto(encryptedData, ivHex) {
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(Buffer.from(encryptedData, 'hex'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted;
}

// Middleware di autenticazione
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];

    if (!token && req.query.token) {
        token = req.query.token;
    }

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// === AUTH ===
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        console.log('🔐 Tentativo login:', { username, hasPassword: !!password });

        if (!username || !password) {
            console.log('❌ Credenziali mancanti');
            return res.status(400).json({ error: 'Username e password richiesti' });
        }

        const result = await query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) {
            console.log('❌ Utente non trovato:', username);
            return res.status(401).json({ error: 'Credenziali non valide' });
        }

        console.log('✅ Utente trovato:', user.username, 'Verifica password...');

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.log('❌ Password non valida per:', username);
            return res.status(401).json({ error: 'Credenziali non valide' });
        }

        console.log('✅ Password valida! Generazione token...');

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log('✅ Login riuscito per:', username);

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                password_changed: user.password_changed || false
            },
            requiresPasswordChange: !user.password_changed
        });
    } catch (error) {
        console.error('❌ Errore login:', error);
        res.status(500).json({ error: 'Errore server durante il login' });
    }
});

// Cambio password (obbligatorio al primo accesso)
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Password corrente e nuova password richieste' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'La nuova password deve essere di almeno 6 caratteri' });
        }

        // Verifica password corrente
        const result = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Password corrente non valida' });
        }

        // Aggiorna password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await query(
            'UPDATE users SET password = $1, password_changed = true WHERE id = $2',
            [hashedNewPassword, req.user.id]
        );

        console.log(`✅ Password cambiata per utente: ${user.username}`);

        res.json({ message: 'Password cambiata con successo' });
    } catch (error) {
        console.error('Errore cambio password:', error);
        res.status(500).json({ error: 'Errore durante il cambio password' });
    }
});

app.post('/api/auth/register', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Solo gli admin possono registrare nuovi utenti' });
        }

        const { username, password, role = 'mobile' } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username e password richiesti' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await query(
            'INSERT INTO users (username, password, role, password_changed) VALUES ($1, $2, $3, false) RETURNING id, username, role',
            [username, hashedPassword, role]
        );

        res.json({ user: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Username già esistente' });
        }
        console.error('Errore registrazione:', error);
        res.status(500).json({ error: 'Errore server durante la registrazione' });
    }
});

// === RESET ADMIN (endpoint temporaneo - rimuovere dopo l'uso) ===
app.post('/api/auth/reset-admin', async (req, res) => {
    try {
        // Protezione semplice con secret key (cambia questo valore!)
        const RESET_SECRET = process.env.RESET_ADMIN_SECRET || 'reset-admin-2024';
        const { secret, password = 'admin123' } = req.body;

        if (secret !== RESET_SECRET) {
            console.log('❌ Tentativo reset admin con secret errato');
            return res.status(403).json({ error: 'Secret non valido' });
        }

        console.log('🔄 Reset password admin...');
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Verifica se l'admin esiste
        const checkResult = await query('SELECT id, username FROM users WHERE username = $1', ['admin']);
        
        if (checkResult.rows.length > 0) {
            // Aggiorna password esistente
            await query(
                'UPDATE users SET password = $1 WHERE username = $2',
                [hashedPassword, 'admin']
            );
            console.log('✅ Password admin aggiornata!');
            res.json({ 
                success: true, 
                message: 'Password admin aggiornata con successo',
                username: 'admin',
                password: password
            });
        } else {
            // Crea nuovo admin
            await query(
                'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
                ['admin', hashedPassword, 'admin']
            );
            console.log('✅ Admin creato!');
            res.json({ 
                success: true, 
                message: 'Admin creato con successo',
                username: 'admin',
                password: password
            });
        }
    } catch (error) {
        console.error('❌ Errore reset admin:', error);
        res.status(500).json({ error: 'Errore durante il reset dell\'admin', details: error.message });
    }
});

// === STATUS (senza autenticazione per permettere check server) ===
app.get('/api/status', async (req, res) => {
    try {
        const signsCount = await query('SELECT COUNT(*) as count FROM signs');
        const intCount = await query('SELECT COUNT(*) as count FROM interventions');

        res.json({
            online: true,
            uptime: process.uptime(),
            totalSigns: parseInt(signsCount.rows[0].count),
            totalInterventions: parseInt(intCount.rows[0].count),
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        res.json({ online: true, error: error.message, totalSigns: 0 });
    }
});

// === USERS ===
app.get('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Non autorizzato' });
    try {
        const result = await query('SELECT id, username, role, password_changed, created_at FROM users ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Errore recupero utenti:', error);
        res.status(500).json({ error: 'Errore nel recupero degli utenti' });
    }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Non autorizzato' });
    try {
        const { role } = req.body;
        
        if (!role) {
            return res.status(400).json({ error: 'Il campo role è richiesto' });
        }

        const result = await query(
            'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role, created_at',
            [role, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Errore aggiornamento utente:', error);
        res.status(500).json({ error: 'Errore nell\'aggiornamento dell\'utente' });
    }
});

// Reset password utente (admin only)
app.post('/api/users/:id/reset-password', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Solo gli admin possono resettare le password' });
    }

    try {
        const { newPassword = 'password123' } = req.body;
        const userId = parseInt(req.params.id);

        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Non puoi resettare la tua stessa password' });
        }

        // Verifica che l'utente esista
        const userCheck = await query('SELECT id, username FROM users WHERE id = $1', [userId]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        // Reset password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await query(
            'UPDATE users SET password = $1, password_changed = false WHERE id = $2',
            [hashedPassword, userId]
        );

        console.log(`🔄 Password resettata per utente ${userCheck.rows[0].username} da admin ${req.user.username}`);

        res.json({ 
            message: 'Password resettata con successo',
            username: userCheck.rows[0].username,
            newPassword: newPassword
        });
    } catch (error) {
        console.error('Errore reset password:', error);
        res.status(500).json({ error: 'Errore durante il reset della password' });
    }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Non autorizzato' });
    try {
        // Non permettere di eliminare se stessi
        if (parseInt(req.params.id) === req.user.id) {
            return res.status(400).json({ error: 'Non puoi eliminare il tuo stesso account' });
        }

        const result = await query('DELETE FROM users WHERE id = $1 RETURNING id, username', [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        res.json({ message: 'Utente eliminato con successo', user: result.rows[0] });
    } catch (error) {
        console.error('Errore eliminazione utente:', error);
        res.status(500).json({ error: 'Errore nell\'eliminazione dell\'utente' });
    }
});

// === SIGNS ===
app.get('/api/signs', authenticateToken, async (req, res) => {
    try {
        const result = await query(`
            SELECT s.*, u.username as creator_username 
            FROM signs s 
            LEFT JOIN users u ON s.created_by = u.id 
            ORDER BY s.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching signs:', error);
        res.status(500).json({ error: 'Errore nel recupero dei segnali' });
    }
});

app.get('/api/signs/:id', authenticateToken, async (req, res) => {
    try {
        const result = await query(`
            SELECT s.*, u.username as creator_username 
            FROM signs s 
            LEFT JOIN users u ON s.created_by = u.id 
            WHERE s.id = $1
        `, [req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Segnale non trovato' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching sign:', error);
        res.status(500).json({ error: 'Errore nel recupero del segnale' });
    }
});

app.post('/api/signs', authenticateToken, async (req, res) => {
    try {
        const { type, latitude, longitude, status, installation_date, notes, photo } = req.body;

        if (!type || !latitude || !longitude) {
            return res.status(400).json({ error: 'Tipo, latitudine e longitudine richiesti' });
        }

        let photoPath = null;
        if (photo && photo.data && photo.iv) {
            // Salva foto crittografata
            const photoFileName = `sign-${Date.now()}.json`;
            photoPath = path.join(photosDir, photoFileName);
            fs.writeFileSync(photoPath, JSON.stringify(photo));
        }

        const result = await query(
            `INSERT INTO signs (type, latitude, longitude, photo_path, status, installation_date, notes, created_by, synced)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
             RETURNING *`,
            [type, latitude, longitude, photoPath, status || 'buono', installation_date, notes, req.user.id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating sign:', error);
        res.status(500).json({ error: 'Errore nella creazione del segnale' });
    }
});

app.put('/api/signs/:id', authenticateToken, async (req, res) => {
    try {
        const { type, latitude, longitude, status, installation_date, notes, photo } = req.body;

        let photoPath = null;
        if (photo && photo.data && photo.iv) {
            const photoFileName = `sign-${Date.now()}.json`;
            photoPath = path.join(photosDir, photoFileName);
            fs.writeFileSync(photoPath, JSON.stringify(photo));
        }

        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (type) { updates.push(`type = $${paramIndex++}`); values.push(type); }
        if (latitude !== undefined) { updates.push(`latitude = $${paramIndex++}`); values.push(latitude); }
        if (longitude !== undefined) { updates.push(`longitude = $${paramIndex++}`); values.push(longitude); }
        if (photoPath) { updates.push(`photo_path = $${paramIndex++}`); values.push(photoPath); }
        if (status) { updates.push(`status = $${paramIndex++}`); values.push(status); }
        if (installation_date !== undefined) { updates.push(`installation_date = $${paramIndex++}`); values.push(installation_date); }
        if (notes !== undefined) { updates.push(`notes = $${paramIndex++}`); values.push(notes); }
        
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(req.params.id);

        const result = await query(
            `UPDATE signs SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Segnale non trovato' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating sign:', error);
        res.status(500).json({ error: 'Errore nell\'aggiornamento del segnale' });
    }
});

app.delete('/api/signs/:id', authenticateToken, async (req, res) => {
    try {
        const result = await query('DELETE FROM signs WHERE id = $1 RETURNING *', [req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Segnale non trovato' });
        }

        // Elimina foto se esiste
        if (result.rows[0].photo_path && fs.existsSync(result.rows[0].photo_path)) {
            fs.unlinkSync(result.rows[0].photo_path);
        }

        res.json({ message: 'Segnale eliminato con successo' });
    } catch (error) {
        console.error('Error deleting sign:', error);
        res.status(500).json({ error: 'Errore nell\'eliminazione del segnale' });
    }
});

// === PHOTOS ===
// Ottieni tutte le foto di un segnale
app.get('/api/signs/:id/photos', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            `SELECT id, sign_id, photo_path, uploaded_at, is_primary, display_order
             FROM sign_photos 
             WHERE sign_id = $1 
             ORDER BY is_primary DESC, display_order ASC, uploaded_at ASC`,
            [req.params.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching photos:', error);
        res.status(500).json({ error: 'Errore nel recupero delle foto' });
    }
});

// Ottieni una foto specifica (per compatibilità con vecchio codice)
app.get('/api/signs/:id/photo', authenticateToken, async (req, res) => {
    try {
        // Prima prova dalla nuova tabella sign_photos
        const photosResult = await query(
            'SELECT photo_path FROM sign_photos WHERE sign_id = $1 ORDER BY is_primary DESC, display_order ASC LIMIT 1',
            [req.params.id]
        );

        let photoPath = null;
        if (photosResult.rows.length > 0) {
            photoPath = photosResult.rows[0].photo_path;
        } else {
            // Fallback alla vecchia tabella signs
            const result = await query('SELECT photo_path FROM signs WHERE id = $1', [req.params.id]);
            if (result.rows[0] && result.rows[0].photo_path) {
                photoPath = result.rows[0].photo_path;
            }
        }

        if (!photoPath || !fs.existsSync(photoPath)) {
            return res.status(404).json({ error: 'Foto non trovata' });
        }

        const encrypted = JSON.parse(fs.readFileSync(photoPath, 'utf8'));
        const decrypted = decryptPhoto(encrypted.data, encrypted.iv);

        res.set('Content-Type', 'image/jpeg');
        res.send(decrypted);
    } catch (error) {
        console.error('Error reading photo:', error);
        res.status(500).json({ error: 'Errore lettura foto' });
    }
});

// Ottieni una foto specifica per ID
app.get('/api/photos/:photoId', authenticateToken, async (req, res) => {
    try {
        const result = await query('SELECT photo_path FROM sign_photos WHERE id = $1', [req.params.photoId]);
        const photo = result.rows[0];

        if (!photo || !photo.photo_path || !fs.existsSync(photo.photo_path)) {
            return res.status(404).json({ error: 'Foto non trovata' });
        }

        const encrypted = JSON.parse(fs.readFileSync(photo.photo_path, 'utf8'));
        const decrypted = decryptPhoto(encrypted.data, encrypted.iv);

        res.set('Content-Type', 'image/jpeg');
        res.send(decrypted);
    } catch (error) {
        console.error('Error reading photo:', error);
        res.status(500).json({ error: 'Errore lettura foto' });
    }
});

// Carica una nuova foto per un segnale
app.post('/api/signs/:id/photos', authenticateToken, async (req, res) => {
    try {
        console.log(`📸 Upload foto richiesto per segnale ${req.params.id}`);
        const { photo, is_primary } = req.body;
        const signId = parseInt(req.params.id);

        if (!photo) {
            console.log('❌ Foto non fornita nel body');
            return res.status(400).json({ error: 'Foto non fornita' });
        }

        console.log(`📝 Tipo foto ricevuta: ${typeof photo}, is_primary: ${is_primary}`);

        // Verifica che il segnale esista
        const signCheck = await query('SELECT id FROM signs WHERE id = $1', [signId]);
        if (signCheck.rows.length === 0) {
            console.log(`❌ Segnale ${signId} non trovato`);
            return res.status(404).json({ error: 'Segnale non trovato' });
        }

        let encryptedPhoto;
        
        // Se la foto è già crittografata (dal mobile), usa quella
        if (photo && photo.data && photo.iv) {
            console.log('✅ Foto già crittografata (dal mobile)');
            encryptedPhoto = photo;
        } 
        // Se è un data URL (dal desktop), crittografalo
        else if (photo && typeof photo === 'string' && photo.startsWith('data:image/')) {
            console.log('🔐 Crittografando data URL...');
            encryptedPhoto = encryptPhoto(photo);
            console.log('✅ Foto crittografata');
        }
        // Se è un oggetto con data (data URL come stringa)
        else if (photo && photo.data && typeof photo.data === 'string' && photo.data.startsWith('data:image/')) {
            console.log('🔐 Crittografando data URL da oggetto...');
            encryptedPhoto = encryptPhoto(photo.data);
            console.log('✅ Foto crittografata');
        }
        else {
            console.log(`❌ Formato foto non valido: ${typeof photo}, keys: ${photo ? Object.keys(photo).join(',') : 'null'}`);
            return res.status(400).json({ error: 'Formato foto non valido. Atteso: data URL stringa o oggetto con data/iv' });
        }

        // Salva foto crittografata
        const photoFileName = `sign-${signId}-${Date.now()}.json`;
        const photoPath = path.join(photosDir, photoFileName);
        fs.writeFileSync(photoPath, JSON.stringify(encryptedPhoto));
        console.log(`💾 Foto salvata in: ${photoPath}`);

        // Se questa è la foto primaria, rimuovi il flag dalle altre
        if (is_primary) {
            await query('UPDATE sign_photos SET is_primary = false WHERE sign_id = $1', [signId]);
            console.log('⭐ Foto impostata come primaria');
        }

        // Ottieni il prossimo display_order
        const maxOrderResult = await query(
            'SELECT COALESCE(MAX(display_order), 0) as max_order FROM sign_photos WHERE sign_id = $1',
            [signId]
        );
        const nextOrder = (maxOrderResult.rows[0]?.max_order || 0) + 1;

        // Inserisci nella tabella sign_photos
        const result = await query(
            `INSERT INTO sign_photos (sign_id, photo_path, uploaded_by, is_primary, display_order)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [signId, photoPath, req.user.id, is_primary || false, nextOrder]
        );

        console.log(`✅ Foto caricata con successo, ID: ${result.rows[0].id}`);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('❌ Error uploading photo:', error);
        console.error('Stack:', error.stack);
        res.status(500).json({ error: 'Errore nel caricamento della foto', details: error.message });
    }
});

// Elimina una foto
app.delete('/api/photos/:photoId', authenticateToken, async (req, res) => {
    try {
        const result = await query('SELECT photo_path, sign_id FROM sign_photos WHERE id = $1', [req.params.photoId]);
        const photo = result.rows[0];

        if (!photo) {
            return res.status(404).json({ error: 'Foto non trovata' });
        }

        // Elimina il file fisico
        if (photo.photo_path && fs.existsSync(photo.photo_path)) {
            fs.unlinkSync(photo.photo_path);
        }

        // Elimina dal database
        await query('DELETE FROM sign_photos WHERE id = $1', [req.params.photoId]);

        res.json({ message: 'Foto eliminata con successo' });
    } catch (error) {
        console.error('Error deleting photo:', error);
        res.status(500).json({ error: 'Errore nell\'eliminazione della foto' });
    }
});

// Imposta foto primaria
app.put('/api/photos/:photoId/primary', authenticateToken, async (req, res) => {
    try {
        const result = await query('SELECT sign_id FROM sign_photos WHERE id = $1', [req.params.photoId]);
        const photo = result.rows[0];

        if (!photo) {
            return res.status(404).json({ error: 'Foto non trovata' });
        }

        // Rimuovi il flag primario da tutte le foto del segnale
        await query('UPDATE sign_photos SET is_primary = false WHERE sign_id = $1', [photo.sign_id]);

        // Imposta questa come primaria
        await query('UPDATE sign_photos SET is_primary = true WHERE id = $1', [req.params.photoId]);

        res.json({ message: 'Foto primaria aggiornata' });
    } catch (error) {
        console.error('Error setting primary photo:', error);
        res.status(500).json({ error: 'Errore nell\'aggiornamento della foto primaria' });
    }
});

// === INTERVENTIONS ===
app.get('/api/interventions', authenticateToken, async (req, res) => {
    try {
        const result = await query(`
            SELECT i.*, s.type as sign_type, s.latitude, s.longitude
            FROM interventions i
            LEFT JOIN signs s ON i.sign_id = s.id
            ORDER BY i.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching interventions:', error);
        res.status(500).json({ error: 'Errore nel recupero degli interventi' });
    }
});

app.post('/api/interventions', authenticateToken, async (req, res) => {
    try {
        const { sign_id, type, scheduled_date, cost, notes, status } = req.body;

        if (!sign_id || !type) {
            return res.status(400).json({ error: 'sign_id e type richiesti' });
        }

        const result = await query(
            `INSERT INTO interventions (sign_id, type, scheduled_date, cost, notes, status, synced)
             VALUES ($1, $2, $3, $4, $5, $6, true)
             RETURNING *`,
            [sign_id, type, scheduled_date, cost, notes, status || 'programmato']
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating intervention:', error);
        res.status(500).json({ error: 'Errore nella creazione dell\'intervento' });
    }
});

app.put('/api/interventions/:id', authenticateToken, async (req, res) => {
    try {
        const { type, scheduled_date, cost, notes, status } = req.body;

        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (type) { updates.push(`type = $${paramIndex++}`); values.push(type); }
        if (scheduled_date !== undefined) { updates.push(`scheduled_date = $${paramIndex++}`); values.push(scheduled_date); }
        if (cost !== undefined) { updates.push(`cost = $${paramIndex++}`); values.push(cost); }
        if (notes !== undefined) { updates.push(`notes = $${paramIndex++}`); values.push(notes); }
        if (status) { updates.push(`status = $${paramIndex++}`); values.push(status); }
        
        values.push(req.params.id);

        const result = await query(
            `UPDATE interventions SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Intervento non trovato' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating intervention:', error);
        res.status(500).json({ error: 'Errore nell\'aggiornamento dell\'intervento' });
    }
});

app.delete('/api/interventions/:id', authenticateToken, async (req, res) => {
    try {
        const result = await query('DELETE FROM interventions WHERE id = $1 RETURNING *', [req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Intervento non trovato' });
        }

        res.json({ message: 'Intervento eliminato con successo' });
    } catch (error) {
        console.error('Error deleting intervention:', error);
        res.status(500).json({ error: 'Errore nell\'eliminazione dell\'intervento' });
    }
});

// WebSocket per sincronizzazione real-time
io.on('connection', (socket) => {
    console.log('📱 Client connesso:', socket.id);

    socket.on('sync:request', async (data) => {
        console.log('🔄 Richiesta sincronizzazione da:', socket.id);
        try {
            const result = await query('SELECT * FROM signs');
            socket.emit('sync:data', { signs: result.rows });
        } catch (error) {
            console.error('Errore sync socket:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('📴 Client disconnesso:', socket.id);
    });
});

// Middleware per gestire errori 404 per tutte le richieste API non trovate (PRIMA del catch-all)
app.use((req, res, next) => {
    if (req.path.startsWith('/api/') && req.method !== 'GET') {
        // Per richieste POST/PUT/DELETE API non trovate
        console.log(`⚠️ Richiesta API non gestita: ${req.method} ${req.path}`);
        return res.status(404).json({ error: 'Endpoint API non trovato', path: req.path, method: req.method });
    }
    next();
});

// SERVI FILE STATICI DEL FRONTEND (Per Render)
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
    console.log(`📂 Servendo frontend da: ${distPath}`);
    app.use(express.static(distPath));
    // Qualsiasi altra richiesta GET (non API) ritorna index.html (per SPA routing)
    app.get('*', (req, res) => {
        // Non servire index.html per richieste API
        if (req.path.startsWith('/api/')) {
            return res.status(404).json({ error: 'Endpoint API non trovato' });
        }
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    console.log('⚠️ Cartella dist non trovata. Frontend non servito dal backend.');
}

// Avvia server
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server Catasto Segnaletica avviato!`);
    console.log(`📡 HTTP Server: http://localhost:${PORT}`);
    console.log(`🔐 Database: PostgreSQL (Supabase)`);
    console.log(`📁 Foto crittografate: ${photosDir}\n`);
});
