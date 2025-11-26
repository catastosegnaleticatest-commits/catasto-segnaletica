import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Configurazione
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

// Middleware
app.use(cors());
app.use(express.json());

// Crea directory necessarie
const dataDir = path.join(__dirname, 'data');
const photosDir = path.join(dataDir, 'photos');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });

// Inizializza database SQLite
const db = new Database(path.join(dataDir, 'catasto.db'));

// Crea tabelle
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'mobile',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS signs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    photo_path TEXT,
    photo_encrypted BOOLEAN DEFAULT 1,
    status TEXT DEFAULT 'buono',
    installation_date TEXT,
    notes TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    synced BOOLEAN DEFAULT 0,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS interventions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sign_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    scheduled_date TEXT,
    completed_date TEXT,
    status TEXT DEFAULT 'programmato',
    cost REAL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sign_id) REFERENCES signs(id)
  );

  CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id INTEGER,
    data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT 0
  );
`);

// Crea utente admin di default se non esiste
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hashedPassword, 'admin');
    console.log('✅ Utente admin creato (username: admin, password: admin123)');
}

// Funzioni di crittografia per foto
function encryptPhoto(buffer) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32), iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    return { iv: iv.toString('hex'), data: encrypted.toString('hex') };
}

function decryptPhoto(encryptedData, ivHex) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32), Buffer.from(ivHex, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedData, 'hex')), decipher.final()]);
    return decrypted;
}

// Middleware autenticazione
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];

    // Supporto per token in query string (es. per immagini)
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

// === ROUTES ===

// Login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.status(400).json({ error: 'Utente non trovato' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Password errata' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

// Registrazione nuovo utente (solo admin)
app.post('/api/auth/register', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Non autorizzato' });

    const { username, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const result = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, hashedPassword, role || 'mobile');
        res.json({ id: result.lastInsertRowid, username, role });
    } catch (error) {
        res.status(400).json({ error: 'Username già esistente' });
    }
});

// === USER MANAGEMENT (Admin only) ===

// Get all users
app.get('/api/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Non autorizzato' });

    const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC').all();
    res.json(users);
});

// Update user role
app.put('/api/users/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Non autorizzato' });

    const { role } = req.body;
    const userId = req.params.id;

    try {
        db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
        res.json({ success: true, message: 'Ruolo aggiornato' });
    } catch (error) {
        res.status(400).json({ error: 'Errore aggiornamento utente' });
    }
});

// Delete user
app.delete('/api/users/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Non autorizzato' });

    const userId = req.params.id;

    // Prevent deleting self
    if (parseInt(userId) === req.user.id) {
        return res.status(400).json({ error: 'Non puoi eliminare il tuo stesso account' });
    }

    try {
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        res.json({ success: true, message: 'Utente eliminato' });
    } catch (error) {
        res.status(400).json({ error: 'Errore eliminazione utente' });
    }
});

// === SIGNS ===


// Ottieni tutti i segnali
app.get('/api/signs', authenticateToken, (req, res) => {
    const signs = db.prepare('SELECT * FROM signs ORDER BY created_at DESC').all();
    res.json(signs);
});

// Ottieni singolo segnale
app.get('/api/signs/:id', authenticateToken, (req, res) => {
    const sign = db.prepare('SELECT * FROM signs WHERE id = ?').get(req.params.id);
    if (!sign) return res.status(404).json({ error: 'Segnale non trovato' });
    res.json(sign);
});

// Crea nuovo segnale
app.post('/api/signs', authenticateToken, (req, res) => {
    const { type, latitude, longitude, status, installation_date, notes, photo } = req.body;

    let photoPath = null;
    if (photo) {
        // Foto in base64, crittografa e salva
        const photoBuffer = Buffer.from(photo.split(',')[1], 'base64');
        const encrypted = encryptPhoto(photoBuffer);
        const filename = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}.enc`;
        photoPath = path.join(photosDir, filename);
        fs.writeFileSync(photoPath, JSON.stringify(encrypted));
    }

    const result = db.prepare(`
    INSERT INTO signs (type, latitude, longitude, photo_path, status, installation_date, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(type, latitude, longitude, photoPath, status || 'buono', installation_date, notes, req.user.id);

    const newSign = db.prepare('SELECT * FROM signs WHERE id = ?').get(result.lastInsertRowid);

    // Notifica via WebSocket
    io.emit('sign:created', newSign);

    res.json(newSign);
});

// Aggiorna segnale
app.put('/api/signs/:id', authenticateToken, (req, res) => {
    const { type, latitude, longitude, status, installation_date, notes } = req.body;

    db.prepare(`
    UPDATE signs 
    SET type = ?, latitude = ?, longitude = ?, status = ?, installation_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(type, latitude, longitude, status, installation_date, notes, req.params.id);

    const updatedSign = db.prepare('SELECT * FROM signs WHERE id = ?').get(req.params.id);
    io.emit('sign:updated', updatedSign);

    res.json(updatedSign);
});

// Elimina segnale
app.delete('/api/signs/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Non autorizzato' });

    const sign = db.prepare('SELECT * FROM signs WHERE id = ?').get(req.params.id);
    if (sign && sign.photo_path && fs.existsSync(sign.photo_path)) {
        fs.unlinkSync(sign.photo_path);
    }

    db.prepare('DELETE FROM signs WHERE id = ?').run(req.params.id);
    io.emit('sign:deleted', { id: req.params.id });

    res.json({ success: true });
});

// Ottieni foto decrittografata
app.get('/api/signs/:id/photo', authenticateToken, (req, res) => {
    const sign = db.prepare('SELECT photo_path FROM signs WHERE id = ?').get(req.params.id);

    if (!sign || !sign.photo_path || !fs.existsSync(sign.photo_path)) {
        return res.status(404).json({ error: 'Foto non trovata' });
    }

    const encrypted = JSON.parse(fs.readFileSync(sign.photo_path, 'utf8'));
    const decrypted = decryptPhoto(encrypted.data, encrypted.iv);

    res.set('Content-Type', 'image/jpeg');
    res.send(decrypted);
});

// Interventi
app.get('/api/interventions', authenticateToken, (req, res) => {
    const interventions = db.prepare(`
    SELECT i.*, s.type as sign_type, s.latitude, s.longitude 
    FROM interventions i 
    LEFT JOIN signs s ON i.sign_id = s.id 
    ORDER BY i.scheduled_date DESC
  `).all();
    res.json(interventions);
});

app.post('/api/interventions', authenticateToken, (req, res) => {
    const { sign_id, type, scheduled_date, cost, notes } = req.body;

    const result = db.prepare(`
    INSERT INTO interventions (sign_id, type, scheduled_date, cost, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(sign_id, type, scheduled_date, cost, notes);

    const newIntervention = db.prepare('SELECT * FROM interventions WHERE id = ?').get(result.lastInsertRowid);
    io.emit('intervention:created', newIntervention);

    res.json(newIntervention);
});

// Stato server
app.get('/api/status', (req, res) => {
    const stats = {
        totalSigns: db.prepare('SELECT COUNT(*) as count FROM signs').get().count,
        totalInterventions: db.prepare('SELECT COUNT(*) as count FROM interventions').get().count,
        pendingSync: db.prepare('SELECT COUNT(*) as count FROM sync_queue WHERE processed = 0').get().count,
        serverTime: new Date().toISOString(),
        online: true
    };
    res.json(stats);
});

// WebSocket per sincronizzazione real-time
io.on('connection', (socket) => {
    console.log('📱 Client connesso:', socket.id);

    socket.on('sync:request', async (data) => {
        console.log('🔄 Richiesta sincronizzazione da:', socket.id);
        // Invia tutti i dati al client
        const signs = db.prepare('SELECT * FROM signs').all();
        socket.emit('sync:data', { signs });
    });

    socket.on('disconnect', () => {
        console.log('📴 Client disconnesso:', socket.id);
    });
});

// Avvia server
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server Catasto Segnaletica avviato!`);
    console.log(`📡 HTTP Server: http://localhost:${PORT}`);
    console.log(`📡 Network: http://192.168.1.50:${PORT}`);
    console.log(`🔌 WebSocket Server: ws://localhost:${PORT}`);
    console.log(`🔐 Database: ${path.join(dataDir, 'catasto.db')}`);
    console.log(`📁 Foto crittografate: ${photosDir}\n`);
});
