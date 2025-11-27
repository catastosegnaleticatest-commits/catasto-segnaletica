import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { Server } from 'socket.io';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { query } from './db.js'; // Modulo PostgreSQL
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-prod';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'catasto-segnaletica-key-2024';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Cartelle dati (per foto temporanee o cache, ma il DB è esterno ora)
const dataDir = path.join(__dirname, 'data');
const photosDir = path.join(dataDir, 'photos');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir);

// === UTILS ===

function encryptPhoto(buffer) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let encrypted = cipher.update(buffer);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return { iv: iv.toString('hex'), data: encrypted.toString('hex') };
}

function decryptPhoto(encryptedData, ivHex) {
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(Buffer.from(encryptedData, 'hex'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted;
}

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

// === ROUTES ===

// Login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const result = await query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Credenziali non valide' });
        }

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Errore server' });
    }
});

// Registrazione (solo admin)
app.post('/api/auth/register', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Non autorizzato' });

    const { username, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const result = await query(
            'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
            [username, hashedPassword, role || 'mobile']
        );
        res.json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            res.status(400).json({ error: 'Username già esistente' });
        } else {
            res.status(500).json({ error: 'Errore server' });
        }
    }
});

// === USERS ===
app.get('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Non autorizzato' });
    const result = await query('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
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
        console.error('Error getting signs:', error);
        res.status(500).json({ error: 'Errore server' });
    }
});

app.post('/api/signs', authenticateToken, async (req, res) => {
    const { type, latitude, longitude, status, installation_date, notes, photo } = req.body;

    let photoPath = null;
    if (photo) {
        // Nota: Con un DB esterno, idealmente le foto dovrebbero andare su S3/Supabase Storage.
        // Per ora manteniamo il salvataggio su disco locale (che su Render è effimero) 
        // MA dato che il DB persiste, almeno i dati testuali rimangono.
        // TODO: Migrare foto su Storage esterno.
        const photoBuffer = Buffer.from(photo.split(',')[1], 'base64');
        const encrypted = encryptPhoto(photoBuffer);
        const filename = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}.enc`;
        photoPath = path.join(photosDir, filename);
        fs.writeFileSync(photoPath, JSON.stringify(encrypted));
    }

    try {
        const result = await query(`
            INSERT INTO signs (type, latitude, longitude, photo_path, status, installation_date, notes, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [type, latitude, longitude, photoPath, status || 'buono', installation_date, notes, req.user.id]);

        const newSign = result.rows[0];
        io.emit('sign:created', newSign);
        res.json(newSign);
    } catch (error) {
        console.error('Error creating sign:', error);
        res.status(500).json({ error: 'Errore creazione segnale' });
    }
});

app.put('/api/signs/:id', authenticateToken, async (req, res) => {
    const { type, latitude, longitude, status, installation_date, notes } = req.body;
    try {
        const result = await query(`
            UPDATE signs 
            SET type = $1, latitude = $2, longitude = $3, status = $4, installation_date = $5, notes = $6, updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
            RETURNING *
        `, [type, latitude, longitude, status, installation_date, notes, req.params.id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Segnale non trovato' });

        const updatedSign = result.rows[0];
        io.emit('sign:updated', updatedSign);
        res.json(updatedSign);
    } catch (error) {
        console.error('Error updating sign:', error);
        res.status(500).json({ error: 'Errore aggiornamento' });
    }
});

app.delete('/api/signs/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Non autorizzato' });

    try {
        // Recupera path foto per eliminazione
        const signResult = await query('SELECT photo_path FROM signs WHERE id = $1', [req.params.id]);
        const sign = signResult.rows[0];

        if (sign && sign.photo_path && fs.existsSync(sign.photo_path)) {
            fs.unlinkSync(sign.photo_path);
        }

        await query('DELETE FROM signs WHERE id = $1', [req.params.id]);
        io.emit('sign:deleted', { id: req.params.id });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting sign:', error);
        res.status(500).json({ error: 'Errore eliminazione' });
    }
});

// Foto (rimane su disco per ora)
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
            ORDER BY i.scheduled_date DESC
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Errore server' });
    }
});

app.post('/api/interventions', authenticateToken, async (req, res) => {
    const { sign_id, type, scheduled_date, cost, notes } = req.body;
    try {
        const result = await query(`
            INSERT INTO interventions (sign_id, type, scheduled_date, cost, notes)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [sign_id, type, scheduled_date, cost, notes]);

        const newIntervention = result.rows[0];
        io.emit('intervention:created', newIntervention);
        res.json(newIntervention);
    } catch (error) {
        res.status(500).json({ error: 'Errore creazione intervento' });
    }
});

// === STATUS ===
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

// Start Server
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server Catasto Segnaletica (PostgreSQL) avviato su porta ${PORT}`);
});
