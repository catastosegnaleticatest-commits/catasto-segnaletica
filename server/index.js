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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
                role: user.role
            }
        });
    } catch (error) {
        console.error('❌ Errore login:', error);
        res.status(500).json({ error: 'Errore server durante il login' });
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
            'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
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
        const result = await query('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Errore recupero utenti:', error);
        res.status(500).json({ error: 'Errore nel recupero degli utenti' });
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

app.get('/api/signs/:id/photo', authenticateToken, async (req, res) => {
    try {
        const result = await query('SELECT photo_path FROM signs WHERE id = $1', [req.params.id]);
        const sign = result.rows[0];

        if (!sign || !sign.photo_path || !fs.existsSync(sign.photo_path)) {
            return res.status(404).json({ error: 'Foto non trovata' });
        }

        const encrypted = JSON.parse(fs.readFileSync(sign.photo_path, 'utf8'));
        const decrypted = decryptPhoto(encrypted.data, encrypted.iv);

        res.set('Content-Type', 'image/jpeg');
        res.send(decrypted);
    } catch (error) {
        console.error('Error reading photo:', error);
        res.status(500).json({ error: 'Errore lettura foto' });
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
