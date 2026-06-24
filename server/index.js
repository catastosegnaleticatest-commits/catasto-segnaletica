// Polyfill DOMMatrix per Node.js (richiesto da pdf-parse / pdfjs-dist)
if (typeof globalThis.DOMMatrix === 'undefined') {
    globalThis.DOMMatrix = class DOMMatrix {
        constructor() {
            this.a=1;this.b=0;this.c=0;this.d=1;this.e=0;this.f=0;
            this.m11=1;this.m12=0;this.m13=0;this.m14=0;
            this.m21=0;this.m22=1;this.m23=0;this.m24=0;
            this.m31=0;this.m32=0;this.m33=1;this.m34=0;
            this.m41=0;this.m42=0;this.m43=0;this.m44=1;
            this.is2D=true;this.isIdentity=true;
        }
        static fromFloat64Array() { return new globalThis.DOMMatrix(); }
        static fromFloat32Array() { return new globalThis.DOMMatrix(); }
        static fromMatrix() { return new globalThis.DOMMatrix(); }
        multiply() { return new globalThis.DOMMatrix(); }
        translate() { return new globalThis.DOMMatrix(); }
        scale() { return new globalThis.DOMMatrix(); }
        rotate() { return new globalThis.DOMMatrix(); }
        inverse() { return new globalThis.DOMMatrix(); }
        transformPoint(p) { return p || { x:0, y:0, z:0, w:1 }; }
        toFloat32Array() { return new Float32Array(16); }
        toFloat64Array() { return new Float64Array(16); }
    };
}

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import multer from 'multer';
import crypto from 'crypto';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { createRequire } from 'module';
const archiver = createRequire(import.meta.url)('archiver');
import {
    validateBody,
    loginSchema,
    registerSchema,
    changePasswordSchema,
    updateUserSchema,
    createSignSchema,
    updateSignSchema,
    bulkImportSignsSchema,
    createInterventionSchema,
    updateInterventionSchema,
    createContractSchema,
    createPriceListItemSchema,
    createCommitmentSchema,
    createAccidentLogSchema,
    createTaxReportSchema,
    createSupportSchema,
    updateSupportSchema,
    createPavementDefectSchema,
    updatePavementDefectSchema,
    createTrafficProjectSchema,
    simulateViabilitySchema,
    createRoadMarkingSchema,
    updateRoadMarkingSchema,
    createTrafficLightSchema,
    updateTrafficLightSchema,
    createTrafficLightInterventionSchema,
    updateTrafficLightInterventionSchema,
} from './schemas.js';
import { initAiEngine, executeJsonInference, isAiAvailable, analyzeUserFeedback, executeLocalChat } from './aiService.js';
import { generateParkingGeometry, rotateFeatureCollection, flipSide } from './services/spatialEngine.js';

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
app.use(express.json({ limit: '15mb' }));

// --- BOOT TIMER ---
const _bootT0 = performance.now();

// Crea directory necessarie (parallel async — top-level await ESM)
const dataDir = process.env.CATASTO_DATA_DIR || path.join(__dirname, 'data');
const photosDir = path.join(dataDir, 'photos');
const docsDir = path.join(dataDir, 'documents');
const feedbackDir = path.join(__dirname, 'feedback');
const backupsDir = path.join(dataDir, 'backups');
const contractsDir = path.join(dataDir, 'contracts');
await Promise.all([
    fs.promises.mkdir(dataDir,       { recursive: true }),
    fs.promises.mkdir(photosDir,     { recursive: true }),
    fs.promises.mkdir(docsDir,       { recursive: true }),
    fs.promises.mkdir(feedbackDir,   { recursive: true }),
    fs.promises.mkdir(backupsDir,    { recursive: true }),
    fs.promises.mkdir(contractsDir,  { recursive: true }),
]);
console.log(`[BOOT] Cartelle pronte: ${(performance.now() - _bootT0).toFixed(0)}ms`);

// Inizializza database SQLite
const _tDb = performance.now();
const db = new Database(path.join(dataDir, 'catasto.db'));
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('temp_store = MEMORY');
db.pragma('cache_size = -64000'); // 64MB cache in-memory
db.pragma('busy_timeout = 10000');
console.log(`[BOOT] Database aperto: ${(performance.now() - _tDb).toFixed(0)}ms`);

// Backup automatico giornaliero con rotazione (max 7 file)
async function runAutoBackup() {
    const date = new Date().toISOString().slice(0, 10);
    const dest = path.join(backupsDir, `catasto-${date}.db`);
    try {
        await db.backup(dest);
        console.log(`[BACKUP] Snapshot salvato: ${dest}`);
        const files = (await fs.promises.readdir(backupsDir))
            .filter(f => /^catasto-\d{4}-\d{2}-\d{2}\.db$/.test(f))
            .sort();
        while (files.length > 7) {
            const old = files.shift();
            await fs.promises.unlink(path.join(backupsDir, old));
            console.log(`[BACKUP] Rimosso snapshot scaduto: ${old}`);
        }
    } catch (err) {
        console.error('[BACKUP] Errore snapshot automatico:', err.message);
    }
}
// Backup differito di 10s per non rallentare l'avvio
setTimeout(runAutoBackup, 10000);
setInterval(runAutoBackup, 24 * 60 * 60 * 1000);

// Crea tabelle
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'operatore',
    requires_password_change BOOLEAN DEFAULT 0,
    password_updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS signs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    photo_path TEXT,
    photo_hash TEXT,
    photo_encrypted BOOLEAN DEFAULT 1,
    status TEXT DEFAULT 'buono',
    installation_date TEXT,
    notes TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    synced BOOLEAN DEFAULT 0,
    richiede_revisione BOOLEAN DEFAULT 0,
    ordinanza_rif TEXT,
    source TEXT,
    is_emergency BOOLEAN DEFAULT 0,
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
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    richiede_revisione BOOLEAN DEFAULT 0,
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

  CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cig TEXT,
    company TEXT,
    start_date TEXT,
    end_date TEXT,
    total_budget REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS price_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL,
    item_code TEXT,
    description TEXT,
    unit_price REAL NOT NULL,
    FOREIGN KEY (contract_id) REFERENCES contracts(id)
  );

  CREATE TABLE IF NOT EXISTS expense_commitments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL,
    resolution_number TEXT,
    allocated_amount REAL NOT NULL,
    residual_amount REAL NOT NULL,
    FOREIGN KEY (contract_id) REFERENCES contracts(id)
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    operation TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id INTEGER,
    details TEXT,
    client_ip TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS accident_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    street_name TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    severity TEXT CHECK(severity IN ('lieve','grave','mortale')),
    date TEXT,
    sign_contributing_factor INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS supports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    street_name TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    type TEXT NOT NULL DEFAULT 'palo',
    condition TEXT,
    last_inspected_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pavement_defects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    street_name TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    defect_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'bassa',
    photo_path TEXT,
    description TEXT,
    status TEXT DEFAULT 'segnalato',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    forward_date TEXT
  );

  CREATE TABLE IF NOT EXISTS traffic_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name TEXT NOT NULL,
    target_streets TEXT NOT NULL,
    status TEXT DEFAULT 'bozza',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS project_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    sign_code TEXT NOT NULL,
    reason TEXT,
    price_list_id INTEGER,
    FOREIGN KEY (project_id) REFERENCES traffic_projects(id),
    FOREIGN KEY (price_list_id) REFERENCES price_list(id)
  );

  CREATE TABLE IF NOT EXISTS sensitive_zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'standard',
    priority_multiplier REAL NOT NULL DEFAULT 1.0,
    coordinates TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS road_markings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    street_name TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    marking_type TEXT NOT NULL,
    material TEXT NOT NULL,
    status TEXT DEFAULT 'buono',
    length_m REAL,
    photo_path TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS traffic_lights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'operativo',
    last_maintenance_date TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS traffic_light_interventions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    traffic_light_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    scheduled_date TEXT,
    completed_date TEXT,
    status TEXT DEFAULT 'programmato',
    cost REAL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (traffic_light_id) REFERENCES traffic_lights(id)
  );

  CREATE TABLE IF NOT EXISTS tax_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sign_id INTEGER,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    numero_rilevato TEXT,
    motivo TEXT NOT NULL,
    note TEXT,
    status TEXT DEFAULT 'aperta',
    reported_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sign_id) REFERENCES signs(id),
    FOREIGN KEY (reported_by) REFERENCES users(id)
  );
`);

// Indici per accelerare le query più comuni
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_signs_status      ON signs(status);
  CREATE INDEX IF NOT EXISTS idx_signs_type_status ON signs(type, status);
  CREATE INDEX IF NOT EXISTS idx_signs_latlon       ON signs(latitude, longitude);
  CREATE INDEX IF NOT EXISTS idx_interv_sign_id    ON interventions(sign_id);
  CREATE INDEX IF NOT EXISTS idx_interv_status     ON interventions(status);
  CREATE INDEX IF NOT EXISTS idx_audit_created_at  ON audit_log(created_at);
  CREATE INDEX IF NOT EXISTS idx_accident_street   ON accident_logs(street_name);
  CREATE INDEX IF NOT EXISTS idx_tl_status         ON traffic_lights(status);
  CREATE INDEX IF NOT EXISTS idx_rm_street_status  ON road_markings(street_name, status);
`);

// Migrazione: aggiunge le colonne mancanti su signs (DB creati con versioni precedenti)
const signsColumns = db.prepare("PRAGMA table_info(signs)").all().map(c => c.name);
if (!signsColumns.includes('photo_hash')) {
    db.exec('ALTER TABLE signs ADD COLUMN photo_hash TEXT');
}
if (!signsColumns.includes('richiede_revisione')) {
    db.exec('ALTER TABLE signs ADD COLUMN richiede_revisione BOOLEAN DEFAULT 0');
}
if (!signsColumns.includes('ordinanza_rif')) {
    db.exec('ALTER TABLE signs ADD COLUMN ordinanza_rif TEXT');
}
if (!signsColumns.includes('numero_autorizzazione')) {
    db.exec('ALTER TABLE signs ADD COLUMN numero_autorizzazione TEXT');
}
if (!signsColumns.includes('proprietario')) {
    db.exec('ALTER TABLE signs ADD COLUMN proprietario TEXT');
}
if (!signsColumns.includes('source')) {
    db.exec('ALTER TABLE signs ADD COLUMN source TEXT');
}
if (!signsColumns.includes('is_emergency')) {
    db.exec('ALTER TABLE signs ADD COLUMN is_emergency BOOLEAN DEFAULT 0');
}
if (!signsColumns.includes('support_id')) {
    db.exec('ALTER TABLE signs ADD COLUMN support_id INTEGER REFERENCES supports(id)');
}
if (!signsColumns.includes('valid_from')) {
    db.exec('ALTER TABLE signs ADD COLUMN valid_from TEXT');
    db.exec("UPDATE signs SET valid_from = CURRENT_TIMESTAMP WHERE valid_from IS NULL");
}
if (!signsColumns.includes('valid_to')) {
    db.exec('ALTER TABLE signs ADD COLUMN valid_to TEXT');
}
if (!signsColumns.includes('installation_height_cm')) {
    db.exec('ALTER TABLE signs ADD COLUMN installation_height_cm INTEGER');
}
if (!signsColumns.includes('closest_civic_number')) {
    db.exec('ALTER TABLE signs ADD COLUMN closest_civic_number TEXT');
}
if (!signsColumns.includes('location_context')) {
    db.exec("ALTER TABLE signs ADD COLUMN location_context TEXT DEFAULT 'marciapiede'");
}
if (!signsColumns.includes('street_name')) {
    db.exec('ALTER TABLE signs ADD COLUMN street_name TEXT');
}
if (!signsColumns.includes('road_segment')) {
    db.exec('ALTER TABLE signs ADD COLUMN road_segment TEXT');
}
if (!signsColumns.includes('carriageway_side')) {
    db.exec('ALTER TABLE signs ADD COLUMN carriageway_side TEXT');
}
if (!signsColumns.includes('dimensions')) {
    db.exec('ALTER TABLE signs ADD COLUMN dimensions TEXT');
}
if (!signsColumns.includes('reflective_class')) {
    db.exec('ALTER TABLE signs ADD COLUMN reflective_class TEXT');
}
if (!signsColumns.includes('ordinanza_doc_path')) {
    db.exec('ALTER TABLE signs ADD COLUMN ordinanza_doc_path TEXT');
}
if (!signsColumns.includes('ordinanza_doc_name')) {
    db.exec('ALTER TABLE signs ADD COLUMN ordinanza_doc_name TEXT');
}

// Migrazione: aggiunge colonne geometria e FK verticale alle segnaletica orizzontale
const rmCols = db.prepare("PRAGMA table_info(road_markings)").all().map(c => c.name);
if (!rmCols.includes('parent_vertical_id')) {
    db.exec('ALTER TABLE road_markings ADD COLUMN parent_vertical_id INTEGER REFERENCES signs(id)');
}
if (!rmCols.includes('geometry_json')) {
    db.exec('ALTER TABLE road_markings ADD COLUMN geometry_json TEXT');
}

// Migrazione: aggiunge colonne PDF e importi agli accordi quadro
const contractsColumns = db.prepare("PRAGMA table_info(contracts)").all().map(c => c.name);
if (!contractsColumns.includes('pdf_filename')) {
    db.exec('ALTER TABLE contracts ADD COLUMN pdf_filename TEXT');
}
if (!contractsColumns.includes('importo_netto')) {
    db.exec('ALTER TABLE contracts ADD COLUMN importo_netto REAL');
}
if (!contractsColumns.includes('importo_lordo')) {
    db.exec('ALTER TABLE contracts ADD COLUMN importo_lordo REAL');
}
if (!contractsColumns.includes('aliquota_iva')) {
    db.exec('ALTER TABLE contracts ADD COLUMN aliquota_iva REAL');
}

// Seed zone sensibili di esempio (Scuole, Ospedali, ZTL) se la tabella è vuota
const sensitiveZonesCount = db.prepare('SELECT COUNT(*) as c FROM sensitive_zones').get().c;
if (sensitiveZonesCount === 0) {
    const insertZone = db.prepare('INSERT INTO sensitive_zones (name, category, priority_multiplier, coordinates) VALUES (?, ?, ?, ?)');
    insertZone.run('Area Scolastica - Centro', 'scuola', 2.0, JSON.stringify([
        [41.9030, 12.4960], [41.9030, 12.4970], [41.9020, 12.4970], [41.9020, 12.4960]
    ]));
    insertZone.run('Ospedale Civile', 'ospedale', 2.0, JSON.stringify([
        [41.9040, 12.4980], [41.9040, 12.4995], [41.9028, 12.4995], [41.9028, 12.4980]
    ]));
    insertZone.run('ZTL Centro Storico', 'ztl', 1.5, JSON.stringify([
        [41.9015, 12.4950], [41.9015, 12.4990], [41.8995, 12.4990], [41.8995, 12.4950]
    ]));
}

// Numeri civici di riferimento per il reverse-geocoding bbox-based (stub geolocalizzato)
const REFERENCE_CIVIC_NUMBERS = [
    { number: '1', latitude: 41.9028, longitude: 12.4964 },
    { number: '5', latitude: 41.9030, longitude: 12.4970 },
    { number: '10', latitude: 41.9020, longitude: 12.4955 },
    { number: '15', latitude: 41.9015, longitude: 12.4975 },
    { number: '22', latitude: 41.9035, longitude: 12.4945 },
];

// Trova il numero civico di riferimento più vicino entro una bounding box di ~50m
function findClosestCivicNumber(latitude, longitude) {
    const BBOX_DEGREES = 0.0005; // ~50m
    let closest = null;
    let minDist = Infinity;
    for (const civic of REFERENCE_CIVIC_NUMBERS) {
        const dLat = Math.abs(civic.latitude - latitude);
        const dLon = Math.abs(civic.longitude - longitude);
        if (dLat > BBOX_DEGREES || dLon > BBOX_DEGREES) continue;
        const dist = Math.sqrt(dLat * dLat + dLon * dLon);
        if (dist < minDist) {
            minDist = dist;
            closest = civic.number;
        }
    }
    return closest;
}

// Migrazione: aggiunge la colonna requires_password_change se manca (DB creati con versioni precedenti)
const usersColumns = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
if (!usersColumns.includes('requires_password_change')) {
    db.exec('ALTER TABLE users ADD COLUMN requires_password_change BOOLEAN DEFAULT 0');
}
if (!usersColumns.includes('password_updated_at')) {
    db.exec('ALTER TABLE users ADD COLUMN password_updated_at TEXT');
    db.exec("UPDATE users SET password_updated_at = CURRENT_TIMESTAMP WHERE password_updated_at IS NULL");
}
if (!usersColumns.includes('email')) {
    db.exec('ALTER TABLE users ADD COLUMN email TEXT');
}
if (!usersColumns.includes('must_change_password')) {
    db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0');
}
if (!usersColumns.includes('recovery_token')) {
    db.exec('ALTER TABLE users ADD COLUMN recovery_token TEXT');
}
if (!usersColumns.includes('recovery_token_expires')) {
    db.exec('ALTER TABLE users ADD COLUMN recovery_token_expires INTEGER');
}

// Migrazione: aggiunge le colonne client_ip/user_agent su audit_log (DB creati con versioni precedenti)
const auditLogColumns = db.prepare("PRAGMA table_info(audit_log)").all().map(c => c.name);
if (!auditLogColumns.includes('client_ip')) {
    db.exec('ALTER TABLE audit_log ADD COLUMN client_ip TEXT');
}
if (!auditLogColumns.includes('user_agent')) {
    db.exec('ALTER TABLE audit_log ADD COLUMN user_agent TEXT');
}

// Migrazione: adegua i ruoli al nuovo schema (operatore, tecnico, admin)
db.prepare("UPDATE users SET role = 'operatore' WHERE role = 'mobile'").run();
db.prepare("UPDATE users SET role = 'tecnico' WHERE role = 'desktop'").run();

// Migrazione: aggiunge le colonne mancanti su interventions (DB creati con versioni precedenti)
const interventionsColumns = db.prepare("PRAGMA table_info(interventions)").all().map(c => c.name);
if (!interventionsColumns.includes('updated_at')) {
    db.exec('ALTER TABLE interventions ADD COLUMN updated_at DATETIME');
    db.exec("UPDATE interventions SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL");
}
if (!interventionsColumns.includes('richiede_revisione')) {
    db.exec('ALTER TABLE interventions ADD COLUMN richiede_revisione BOOLEAN DEFAULT 0');
}
if (!interventionsColumns.includes('price_list_id')) {
    db.exec('ALTER TABLE interventions ADD COLUMN price_list_id INTEGER REFERENCES price_list(id)');
}
if (!interventionsColumns.includes('quantity')) {
    db.exec('ALTER TABLE interventions ADD COLUMN quantity REAL');
}
if (!interventionsColumns.includes('commitment_id')) {
    db.exec('ALTER TABLE interventions ADD COLUMN commitment_id INTEGER REFERENCES expense_commitments(id)');
}

// Crea utente admin di default se non esiste
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
    (async () => {
        // Usa la password definita in ADMIN_PASSWORD (.env), altrimenti genera una password casuale
        const generatedPassword = !process.env.ADMIN_PASSWORD;
        const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');

        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        db.prepare('INSERT INTO users (username, password, role, requires_password_change) VALUES (?, ?, ?, ?)').run('admin', hashedPassword, 'admin', 1);

        console.log('✅ Utente admin creato (username: admin)');
        if (generatedPassword) {
            console.log(`🔑 Password generata automaticamente: ${adminPassword}`);
            console.log('⚠️  Salva questa password: non verrà mostrata di nuovo. Al primo accesso sarà richiesto il cambio password.');
        } else {
            console.log('🔑 Password impostata da ADMIN_PASSWORD (.env). Al primo accesso sarà richiesto il cambio password.');
        }
    })();
}

// === KNOWLEDGE BASE (RAG) ===
const knowledgeDir = path.join(dataDir, 'knowledge');
if (!fs.existsSync(knowledgeDir)) fs.mkdirSync(knowledgeDir, { recursive: true });

db.exec(`
  CREATE TABLE IF NOT EXISTS knowledge_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    page_count INTEGER DEFAULT 0,
    chunk_count INTEGER DEFAULT 0,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );
  CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks_fts USING fts5(
    content,
    doc_id UNINDEXED,
    chunk_index UNINDEXED,
    tokenize='unicode61'
  );
`);

const knowledgeUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
            cb(null, true);
        } else {
            cb(new Error('Solo file PDF sono accettati'));
        }
    }
});

function chunkText(text, size = 600, overlap = 80) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        chunks.push(text.slice(i, i + size));
        i += size - overlap;
    }
    return chunks;
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

// Risolve il path assoluto del file foto a partire dal path salvato nel DB
// (relativo a photosDir; supporta anche path assoluti salvati da versioni precedenti)
function resolvePhotoPath(photoPath) {
    if (!photoPath) return null;
    return path.isAbsolute(photoPath) ? photoPath : path.join(photosDir, photoPath);
}

// Salva un documento PDF (es. ordinanza) cifrato su disco, restituisce il nome file
function saveEncryptedDoc(base64Doc) {
    const docBuffer = Buffer.from(base64Doc.split(',')[1], 'base64');
    const encrypted = encryptPhoto(docBuffer);
    const filename = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}.pdf.enc`;
    fs.writeFileSync(path.join(docsDir, filename), JSON.stringify(encrypted));
    return filename;
}

// Versioni async dei due helper — usate nelle route per non bloccare l'event loop
async function savePhotoAsync(base64Photo) {
    const photoBuffer = Buffer.from(base64Photo.split(',')[1], 'base64');
    const encrypted = encryptPhoto(photoBuffer);
    const filename = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}.enc`;
    await fs.promises.writeFile(path.join(photosDir, filename), JSON.stringify(encrypted));
    return {
        photoPath: filename,
        photoHash: crypto.createHash('sha256').update(photoBuffer).digest('hex'),
    };
}

async function saveEncryptedDocAsync(base64Doc) {
    const docBuffer = Buffer.from(base64Doc.split(',')[1], 'base64');
    const encrypted = encryptPhoto(docBuffer);
    const filename = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}.pdf.enc`;
    await fs.promises.writeFile(path.join(docsDir, filename), JSON.stringify(encrypted));
    return filename;
}

function resolveDocPath(docPath) {
    if (!docPath) return null;
    return path.isAbsolute(docPath) ? docPath : path.join(docsDir, docPath);
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

// Middleware autorizzazione basata su ruolo
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Non autorizzato' });
        }
        next();
    };
}

// Registra un'operazione nella tabella audit_log, comprensiva di IP e user agent del client
function logAudit(req, operation, tableName, recordId, details = null) {
    const user = req?.user;
    const clientIp = req?.ip ?? null;
    const userAgent = req?.headers?.['user-agent'] ?? null;
    db.prepare(`
        INSERT INTO audit_log (user_id, username, operation, table_name, record_id, details, client_ip, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(user?.id ?? null, user?.username ?? null, operation, tableName, recordId, details ? JSON.stringify(details) : null, clientIp, userAgent);
}

// === RATE LIMITING ===

// Limita i tentativi di login per prevenire attacchi brute-force
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuti
    max: 5,
    message: { error: 'Troppi tentativi di login. Riprova tra 15 minuti.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiting generale sulle API dei segnali per prevenire abusi/DoS locali
const signsLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 100,
    message: { error: 'Troppe richieste, riprova più tardi.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/signs', signsLimiter);

// === ROUTES ===

// Login
app.post('/api/auth/login', loginLimiter, validateBody(loginSchema), async (req, res) => {
    const { username, password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
        console.warn(`[LOGIN FALLITO] utente non trovato: username="${username}" (lunghezza pwd ricevuta=${password ? password.length : 0})`);
        return res.status(400).json({ error: 'Utente non trovato' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        console.warn(`[LOGIN FALLITO] password errata: username="${username}" (lunghezza pwd ricevuta=${password ? password.length : 0})`);
        return res.status(400).json({ error: 'Password errata' });
    }

    // Forza il cambio password se sono trascorsi più di 90 giorni dall'ultimo aggiornamento
    if (user.password_updated_at) {
        const passwordAgeMs = Date.now() - new Date(user.password_updated_at).getTime();
        const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
        if (passwordAgeMs > ninetyDaysMs) {
            // Token a validità breve, sufficiente solo per completare il cambio password forzato
            const changePasswordToken = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '10m' });
            return res.status(403).json({ error: 'PASSWORD_EXPIRED', token: changePasswordToken });
        }
    }

    // Token con scadenza breve: limita il rischio di accessi non autorizzati su dispositivi incustoditi
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
    res.json({
        token,
        user: {
            id: user.id,
            username: user.username,
            role: user.role,
            requiresPasswordChange: !!user.requires_password_change,
        },
    });
});

// Cambio password (utente autenticato)
app.post('/api/auth/change-password', authenticateToken, validateBody(changePasswordSchema), async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Password attuale errata' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password = ?, requires_password_change = 0, password_updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hashedPassword, user.id);

    res.json({ success: true, message: 'Password aggiornata' });
});

// Registrazione nuovo utente (solo admin)
app.post('/api/auth/register', authenticateToken, requireRole('admin'), validateBody(registerSchema), async (req, res) => {
    const { username, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const result = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, hashedPassword, role || 'operatore');
        res.json({ id: result.lastInsertRowid, username, role });
    } catch (error) {
        res.status(400).json({ error: 'Username già esistente' });
    }
});

// === FEEDBACK AI ===

app.post('/api/feedback/submit', authenticateToken, async (req, res) => {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Testo feedback vuoto' });
    try {
        const analysis = await analyzeUserFeedback(text.trim());
        const record = {
            username: req.user.username,
            timestamp: new Date().toISOString(),
            raw_text: text.trim(),
            analysis,
        };
        const filename = `feedback_${Date.now()}.json`;
        await fs.promises.writeFile(path.join(feedbackDir, filename), JSON.stringify(record, null, 2), 'utf8');
        res.status(201).json({ success: true, analysis });
    } catch (error) {
        console.error('Errore salvataggio feedback:', error.message);
        res.status(500).json({ error: 'Errore salvataggio feedback' });
    }
});

// === USER MANAGEMENT (Admin only) ===

// Get all users
app.get('/api/users', authenticateToken, requireRole('admin'), (req, res) => {
    const users = db.prepare('SELECT id, username, role, email, must_change_password, created_at FROM users ORDER BY created_at DESC').all();
    res.json(users);
});

// Update user role
app.put('/api/users/:id', authenticateToken, requireRole('admin'), validateBody(updateUserSchema), async (req, res) => {
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
app.delete('/api/users/:id', authenticateToken, requireRole('admin'), (req, res) => {
    const userId = parseInt(req.params.id);

    if (userId === req.user.id) {
        return res.status(400).json({ error: 'Non puoi eliminare il tuo stesso account' });
    }

    const target = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!target) return res.status(404).json({ error: 'Utente non trovato' });

    try {
        // Nullifica i riferimenti FK nelle tabelle collegate prima di eliminare
        const nullifyFKs = db.transaction(() => {
            db.prepare('UPDATE signs SET created_by = NULL WHERE created_by = ?').run(userId);
            db.prepare('UPDATE audit_log SET user_id = NULL WHERE user_id = ?').run(userId);
            db.prepare('UPDATE knowledge_docs SET created_by = NULL WHERE created_by = ?').run(userId);
            // tax_reports: reported_by se esiste
            const trCols = db.prepare("PRAGMA table_info(tax_reports)").all().map(c => c.name);
            if (trCols.includes('reported_by')) {
                db.prepare('UPDATE tax_reports SET reported_by = NULL WHERE reported_by = ?').run(userId);
            }
            db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        });
        nullifyFKs();
        res.json({ success: true, message: 'Utente eliminato' });
    } catch (error) {
        console.error('Errore eliminazione utente:', error);
        res.status(500).json({ error: 'Errore eliminazione utente: ' + error.message });
    }
});

// Reset password utente (admin genera password temporanea)
app.post('/api/users/:id/reset-password', authenticateToken, requireRole('admin'), async (req, res) => {
    const userId = parseInt(req.params.id);
    const target = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
    if (!target) return res.status(404).json({ error: 'Utente non trovato' });

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
    let tempPassword = '';
    for (let i = 0; i < 12; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];

    try {
        const hash = await bcrypt.hash(tempPassword, 10);
        db.prepare('UPDATE users SET password = ?, must_change_password = 1 WHERE id = ?').run(hash, userId);
        res.json({ tempPassword, username: target.username });
    } catch (err) {
        res.status(500).json({ error: 'Errore reset password: ' + err.message });
    }
});

// Aggiorna ruolo e/o email utente
app.put('/api/users/:id/email', authenticateToken, requireRole('admin'), (req, res) => {
    const { email } = req.body;
    const userId = req.params.id;
    try {
        db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email || null, userId);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: 'Errore aggiornamento email' });
    }
});

// === BACKUP COMPLETO (Database + Codice Sorgente) ===

const PROJECT_ROOT = path.join(__dirname, '..');
const BACKUP_EXCLUDE_DIRS = new Set(['node_modules', 'dist', '.git', 'data', '.claude']);

// Aggiunge ricorsivamente i file di una cartella all'archivio, escludendo cartelle non necessarie al ripristino
function addDirectoryToArchive(archive, dirPath, archivePath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        if (BACKUP_EXCLUDE_DIRS.has(entry.name)) continue;
        const fullPath = path.join(dirPath, entry.name);
        const archiveEntryPath = `${archivePath}/${entry.name}`;
        if (entry.isDirectory()) {
            addDirectoryToArchive(archive, fullPath, archiveEntryPath);
        } else {
            archive.file(fullPath, { name: archiveEntryPath });
        }
    }
}

// Genera un backup completo (DB SQLite consistente + foto + codice sorgente) come archivio ZIP
app.get('/api/admin/backup', authenticateToken, requireRole('admin'), async (req, res) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const tmpBackupPath = path.join(dataDir, `backup-tmp-${timestamp}.db`);

    try {
        // Snapshot atomico del database (consistente anche con scritture concorrenti)
        await db.backup(tmpBackupPath);
    } catch (error) {
        console.error('Errore creazione snapshot database:', error);
        return res.status(500).json({ error: 'Errore generazione backup del database' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="catasto-backup-${timestamp}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
        console.error('Errore creazione archivio backup:', err);
        res.destroy();
    });
    archive.on('end', () => {
        fs.unlink(tmpBackupPath, () => {});
    });

    archive.pipe(res);

    // Database (snapshot consistente) + foto allegate
    archive.file(tmpBackupPath, { name: 'database/catasto.db' });
    if (fs.existsSync(photosDir)) {
        addDirectoryToArchive(archive, photosDir, 'database/photos');
    }

    // Codice sorgente completo dell'applicativo (per eventuale ripristino)
    addDirectoryToArchive(archive, PROJECT_ROOT, 'source');

    archive.finalize();
});

// Snapshot manuale su disco (salva in backupsDir, non scarica)
app.post('/api/admin/backup/snapshot', authenticateToken, requireRole('admin'), async (req, res) => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(backupsDir, `catasto-manual-${ts}.db`);
    try {
        await db.backup(dest);
        const stat = fs.statSync(dest);
        res.json({ ok: true, file: path.basename(dest), size: stat.size, created: stat.mtime });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Lista backup su disco (ultimi 7, più recenti prima)
app.get('/api/admin/backup/list', authenticateToken, requireRole('admin'), (req, res) => {
    try {
        const files = fs.readdirSync(backupsDir)
            .filter(f => f.endsWith('.db'))
            .sort().reverse()
            .map(f => {
                const stat = fs.statSync(path.join(backupsDir, f));
                return { name: f, size: stat.size, created: stat.mtime };
            });
        res.json(files);
    } catch {
        res.json([]);
    }
});

// === SIGNS ===


// Ottieni tutti i segnali
app.get('/api/signs', authenticateToken, (req, res) => {
    const signs = db.prepare(`
        SELECT s.*, u.username as creator_username
        FROM signs s
        LEFT JOIN users u ON s.created_by = u.id
        WHERE s.valid_to IS NULL
        ORDER BY s.created_at DESC
    `).all();
    res.json(signs);
});

// Ricostruzione storica: stato dei segnali ad una data passata (time-travel per contenzioso)
app.get('/api/signs/historical', authenticateToken, (req, res) => {
    const { target_date } = req.query;
    if (!target_date) return res.status(400).json({ error: 'Parametro target_date obbligatorio' });

    const signs = db.prepare(`
        SELECT s.*, u.username as creator_username
        FROM signs s
        LEFT JOIN users u ON s.created_by = u.id
        WHERE s.valid_from <= ? AND (s.valid_to IS NULL OR s.valid_to > ?)
        ORDER BY s.created_at DESC
    `).all(target_date, target_date);
    res.json(signs);
});

// === OGC GEOJSON ENDPOINTS (interoperabilità GIS / QGIS / ArcGIS) ===

// GeoJSON FeatureCollection dei segnali attivi e validati
app.get('/api/geojson/signs', authenticateToken, (req, res) => {
    const signs = db.prepare(`
        SELECT id, type, latitude, longitude, support_id, ordinanza_rif, closest_civic_number
        FROM signs
        WHERE valid_to IS NULL
    `).all();

    res.json({
        type: 'FeatureCollection',
        features: signs.map(s => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [s.longitude, s.latitude],
            },
            properties: {
                id: s.id,
                type: s.type,
                support_id: s.support_id,
                ordinanza_rif: s.ordinanza_rif,
                closest_civic_number: s.closest_civic_number,
            },
        })),
    });
});

// GeoJSON FeatureCollection dei dissesti stradali (compatibile QGIS/ArcGIS)
app.get('/api/geojson/pavement-defects', authenticateToken, (req, res) => {
    const defects = db.prepare(`
        SELECT id, street_name, latitude, longitude, defect_type, severity, status, description, created_at, forward_date
        FROM pavement_defects
    `).all();

    res.json({
        type: 'FeatureCollection',
        features: defects.map(d => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [d.longitude, d.latitude],
            },
            properties: {
                id: d.id,
                street_name: d.street_name,
                defect_type: d.defect_type,
                severity: d.severity,
                status: d.status,
                description: d.description,
                created_at: d.created_at,
                forward_date: d.forward_date,
            },
        })),
    });
});

// === ZONE SENSIBILI (Scuole, Ospedali, ZTL) - geofencing ===

app.get('/api/sensitive-zones', authenticateToken, (req, res) => {
    const zones = db.prepare('SELECT * FROM sensitive_zones ORDER BY id').all();
    res.json(zones.map(z => ({ ...z, coordinates: JSON.parse(z.coordinates) })));
});

// === PROGETTI E VARIANTI VIABILITA (Simulazione AI) ===

app.get('/api/ai/status', authenticateToken, (req, res) => {
    res.json({ available: isAiAvailable() });
});

app.get('/api/ai/hardware-check', authenticateToken, (req, res) => {
    const totalRamGb = os.totalmem() / (1024 ** 3);
    const freeRamGb  = os.freemem()  / (1024 ** 3);
    const cpuCount   = os.cpus().length;
    const cpuModel   = os.cpus()[0]?.model || 'Sconosciuto';

    const modelPath  = process.env.CATASTO_MODEL_PATH
        || path.join(path.dirname(fileURLToPath(import.meta.url)), '../models/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf');
    const modelExists = fs.existsSync(modelPath);

    // Spazio disco libero (df funziona su Linux/Mac, fallisce su Windows silenziosamente)
    let diskFreeGb = null;
    try {
        const { execSync } = createRequire(import.meta.url)('child_process');
        const raw = execSync('df -BG .', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().split('\n')[1];
        diskFreeGb = parseInt(raw?.split(/\s+/)[3]) || null;
    } catch { /* Windows o ambienti senza df */ }

    const RAM_MIN_GB  = 7.5;
    const RAM_REC_GB  = 14;
    const DISK_MIN_GB = 6;

    const ramOk   = totalRamGb >= RAM_MIN_GB;
    const ramGood = totalRamGb >= RAM_REC_GB;
    const diskOk  = diskFreeGb === null ? null : diskFreeGb >= DISK_MIN_GB;
    const ready   = ramOk && (diskOk !== false);

    res.json({
        ready,
        modelExists,
        modelPath,
        ram: { total: +totalRamGb.toFixed(1), free: +freeRamGb.toFixed(1), ok: ramOk, good: ramGood, minRequired: RAM_MIN_GB },
        disk: { freeGb: diskFreeGb, ok: diskOk, minRequired: DISK_MIN_GB },
        cpu: { cores: cpuCount, model: cpuModel },
    });
});

// Proxy WMS catastale — senza auth: i tile sono dati pubblici AdE e Leaflet
// non può iniettare JWT header nelle richieste img. Il server è sempre localhost.
app.get('/api/wms-proxy', async (req, res) => {
    const target = new URL('https://wms.cartografia.agenziaentrate.gov.it/geoserver/wms');
    for (const [k, v] of Object.entries(req.query)) {
        target.searchParams.set(k, v);
    }
    try {
        const response = await fetch(target.toString(), {
            headers: { 'User-Agent': 'CatastoSegnaletica/1.0', 'Accept': 'image/png,image/*,*/*' },
            signal: AbortSignal.timeout(12000),
        });
        if (!response.ok) return res.status(response.status).end();
        const ct = response.headers.get('content-type') || 'image/png';
        res.set('Content-Type', ct);
        res.set('Cache-Control', 'public, max-age=86400'); // cache tile 24h
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
    } catch {
        res.status(502).end();
    }
});

const AI_BAR_SCHEMA = `
Tabelle SQLite disponibili (catasto segnaletica stradale comunale):
- signs (id, type, latitude, longitude, status, installation_date, notes, ordinanza_rif, street_name, valid_to, created_at)
  type: divieto|obbligo|pericolo|indicazione|precedenza|passo_carrabile
  status: ottimo|buono|discreto|danneggiato|da_sostituire|rimosso
- interventions (id, sign_id, type, scheduled_date, completed_date, status, cost, notes)
  status: programmato|in_corso|completato|verificato_pattuglia|liquidato|annullato
- users (id, username, role)  role: admin|tecnico|operatore
- contracts (id, cig, company, start_date, end_date, total_budget)
- price_list (id, contract_id, item_code, description, unit_price)
- expense_commitments (id, contract_id, resolution_number, amount, residual_amount)
- accident_logs (id, latitude, longitude, severity, date, street_name, sign_contributing_factor, notes)
  severity: lieve|grave|mortale
- pavement_defects (id, type, severity, status, latitude, longitude, notes, created_at)
  type: buca|cedimento|avvallamento|dissesto|altro  status: aperto|in_lavorazione|risolto
- road_markings (id, type, location_description, status, notes, created_at)
  type: strisce_pedonali|stop|dare_precedenza|frecce|zebre|altro  status: buono|sbiadito|da_riverniciare|rimosso
- traffic_lights (id, location_name, type, status, last_maintenance_date, notes)
  type: veicoli|pedonale|misto  status: operativo|guasto|manutenzione|spento
`.trim();

const AI_BAR_SYSTEM = `Sei un assistente SQL per un comune italiano. Il database è SQLite.
SCHEMA:
${AI_BAR_SCHEMA}

REGOLE ASSOLUTE:
1. Genera SOLO query SELECT (mai INSERT/UPDATE/DELETE/DROP/ALTER)
2. Usa LIMIT 100 se la query può restituire molte righe
3. Rispondi ESCLUSIVAMENTE con JSON valido, nessun testo fuori dal JSON
4. Formato: {"sql":"SELECT ...", "explanation":"Risposta breve in italiano che descrive cosa fa questa query"}`;

app.post('/api/ai/bar-query', authenticateToken, async (req, res) => {
    const { question } = req.body;
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return res.status(400).json({ error: 'Campo "question" obbligatorio' });
    }

    if (!isAiAvailable()) {
        return res.status(503).json({
            error: 'Motore AI non disponibile',
            hint: 'Verifica che il file .gguf sia nella cartella models/'
        });
    }

    let sql, explanation;
    try {
        const raw = await executeLocalChat(AI_BAR_SYSTEM, question.trim());
        const text = raw.trim().replace(/```json/gi, '').replace(/```/g, '').trim();
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1) throw new Error('Risposta AI non contiene JSON');
        const parsed = JSON.parse(text.substring(start, end + 1));
        sql = parsed.sql;
        explanation = parsed.explanation || '';
    } catch (parseErr) {
        return res.status(502).json({ error: 'Risposta AI non interpretabile: ' + parseErr.message });
    }

    if (!sql || typeof sql !== 'string') {
        return res.status(502).json({ error: 'AI non ha generato SQL valido' });
    }

    const trimmedSql = sql.trim().toUpperCase();
    if (!trimmedSql.startsWith('SELECT') && !trimmedSql.startsWith('WITH')) {
        return res.status(400).json({ error: 'Per sicurezza sono consentite solo query SELECT', sql });
    }

    let rows;
    try {
        rows = db.prepare(sql).all();
    } catch (sqlErr) {
        return res.status(422).json({ error: 'Errore SQL: ' + sqlErr.message, sql });
    }

    res.json({ sql, explanation, rows, rowCount: rows.length });
});

// === KNOWLEDGE BASE ENDPOINTS ===

app.post('/api/admin/knowledge/upload', authenticateToken, requireRole('admin'), knowledgeUpload.single('pdf'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nessun file PDF ricevuto' });
    const pdfParse = createRequire(import.meta.url)('pdf-parse');
    let parsed;
    try {
        parsed = await pdfParse(req.file.buffer);
    } catch (e) {
        return res.status(422).json({ error: 'Impossibile leggere il PDF: ' + e.message });
    }
    const text = (parsed.text || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length < 20) {
        return res.status(422).json({ error: 'Il PDF non contiene testo estraibile (potrebbe essere solo immagini)' });
    }
    const chunks = chunkText(text);
    const filename = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}.pdf`;
    fs.writeFileSync(path.join(knowledgeDir, filename), req.file.buffer);
    const docResult = db.prepare(
        'INSERT INTO knowledge_documents (filename, original_name, page_count, chunk_count, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run(filename, req.file.originalname, parsed.numpages || 0, chunks.length, req.user.id);
    const docId = docResult.lastInsertRowid;
    const insertChunk = db.prepare('INSERT INTO knowledge_chunks_fts (content, doc_id, chunk_index) VALUES (?, ?, ?)');
    const insertAll = db.transaction(() => {
        chunks.forEach((chunk, i) => insertChunk.run(chunk, docId, i));
    });
    insertAll();
    logAudit(req, 'insert', 'knowledge_documents', docId, { original_name: req.file.originalname, chunks: chunks.length });
    res.json({ id: docId, original_name: req.file.originalname, page_count: parsed.numpages, chunk_count: chunks.length });
});

app.get('/api/admin/knowledge/list', authenticateToken, requireRole('admin'), (req, res) => {
    const docs = db.prepare('SELECT * FROM knowledge_documents ORDER BY created_at DESC').all();
    res.json(docs);
});

app.delete('/api/admin/knowledge/:id', authenticateToken, requireRole('admin'), (req, res) => {
    const doc = db.prepare('SELECT * FROM knowledge_documents WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento non trovato' });
    db.prepare("DELETE FROM knowledge_chunks_fts WHERE doc_id = ?").run(doc.id);
    db.prepare('DELETE FROM knowledge_documents WHERE id = ?').run(doc.id);
    const filePath = path.join(knowledgeDir, doc.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    logAudit(req, 'delete', 'knowledge_documents', doc.id, { original_name: doc.original_name });
    res.json({ success: true });
});

app.post('/api/ai/rag-query', authenticateToken, async (req, res) => {
    const { question } = req.body;
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return res.status(400).json({ error: 'Campo "question" obbligatorio' });
    }
    const docCount = db.prepare('SELECT COUNT(*) as n FROM knowledge_documents').get().n;
    if (docCount === 0) {
        return res.status(404).json({ error: 'Nessun documento nella knowledge base. Carica prima dei PDF dalla sezione Utenti.' });
    }
    // FTS5 BM25 search
    let topChunks;
    try {
        const ftsQuery = question.trim().split(/\s+/).filter(w => w.length > 2).join(' OR ');
        topChunks = db.prepare(`
            SELECT kf.content, kf.doc_id, kf.chunk_index, kd.original_name,
                   bm25(knowledge_chunks_fts) AS score
            FROM knowledge_chunks_fts kf
            JOIN knowledge_documents kd ON kd.id = kf.doc_id
            WHERE knowledge_chunks_fts MATCH ?
            ORDER BY score
            LIMIT 5
        `).all(ftsQuery || question.trim());
    } catch {
        topChunks = [];
    }
    if (!topChunks.length) {
        return res.status(200).json({
            answer: 'Non ho trovato informazioni rilevanti nella knowledge base per rispondere a questa domanda.',
            sources: [], question
        });
    }
    if (!isAiAvailable()) {
        return res.status(503).json({ error: 'Motore AI non disponibile', hint: 'Verifica che il file .gguf sia nella cartella models/' });
    }
    const context = topChunks.map((c, i) => `[${i + 1}] (da "${c.original_name}")\n${c.content}`).join('\n\n');
    const systemPrompt = `Sei un assistente esperto di normativa stradale e segnaletica per il Comune. Rispondi SOLO in italiano. Usa ESCLUSIVAMENTE le informazioni nei documenti forniti. Se la risposta non è nei documenti, dillo chiaramente. Sii preciso e cita il documento da cui proviene l'informazione.`;
    const userPrompt = `DOCUMENTI:\n${context}\n\nDOMANDA: ${question.trim()}`;
    let answer;
    try {
        answer = await executeLocalChat(systemPrompt, userPrompt);
    } catch (e) {
        return res.status(503).json({ error: 'Errore modello AI: ' + e.message });
    }
    res.json({
        answer: answer.trim(),
        sources: topChunks.map(c => ({ doc_id: c.doc_id, original_name: c.original_name, chunk_index: c.chunk_index, excerpt: c.content.slice(0, 120) + '…' })),
        question
    });
});

// === MODULO 14 — COMPLIANCE AI (Traffic Engineering) ===

app.post('/api/ai/verify-compliance', authenticateToken, requireRole('admin', 'tecnico'), async (req, res) => {
    const { project_id } = req.body;
    if (!project_id) return res.status(400).json({ error: 'project_id obbligatorio' });

    const project = db.prepare('SELECT * FROM traffic_projects WHERE id = ?').get(project_id);
    if (!project) return res.status(404).json({ error: 'Progetto non trovato' });

    const items = db.prepare(`
        SELECT pi.*, pl.description, pl.unit_price
        FROM project_items pi LEFT JOIN price_list pl ON pl.id = pi.price_list_id
        WHERE pi.project_id = ?
    `).all(project_id);

    if (!isAiAvailable()) return res.status(503).json({ error: 'Motore AI non disponibile' });

    // Recupera chunk normativi dalla knowledge base
    let normativeChunks = [];
    try {
        normativeChunks = db.prepare(`
            SELECT kf.content, kd.original_name
            FROM knowledge_chunks_fts kf
            JOIN knowledge_documents kd ON kd.id = kf.doc_id
            WHERE knowledge_chunks_fts MATCH 'corsia OR larghezza OR carreggiata OR segnale OR sicurezza OR velocita'
            ORDER BY bm25(knowledge_chunks_fts)
            LIMIT 6
        `).all();
    } catch { normativeChunks = []; }

    const contextDocs = normativeChunks.length > 0
        ? '\n\nESTRATTI NORMATIVI:\n' + normativeChunks.map((c, i) => `[${i+1}] (${c.original_name}): ${c.content.slice(0, 400)}`).join('\n\n')
        : '\n\n(Nessun documento normativo caricato nella Knowledge Base)';

    const systemPrompt = `Agisci come Ingegnere del Traffico e Consulente Legale per la Sicurezza Stradale.
Analizza il progetto di modifica viabilistica e valuta la conformità normativa.
Rispondi SOLO con JSON valido: { "compliant": true|false, "score": 0-100, "issues": ["lista problemi"], "suggestions": ["suggerimenti correttivi"], "summary": "sintesi in italiano" }`;

    const userPrompt = JSON.stringify({
        progetto: { nome: project.project_name, via: project.target_streets, stato: project.status },
        azioni: items.map(i => ({ azione: i.action, segnale: i.sign_code, motivo: i.reason })),
        note_normative: contextDocs
    });

    let result;
    try {
        const raw = await executeLocalChat(systemPrompt, userPrompt);
        const text = raw.trim().replace(/```json/gi, '').replace(/```/g, '').trim();
        const s = text.indexOf('{'), e = text.lastIndexOf('}');
        result = JSON.parse(text.substring(s, e + 1));
    } catch (err) {
        return res.status(502).json({ error: 'Risposta AI non interpretabile: ' + err.message });
    }

    res.json(result);
});

// === MODULI 15/16 — SPATIAL COMMAND (NL → GeoJSON geometry) ===

const SPATIAL_INTENT_SYSTEM = `Agisci esclusivamente come parser semantico GIS. Converti il testo in JSON strutturato senza markdown.
Schema: { "intent": "DRAFT_INFRASTRUCTURE", "target_asset": "parking_stalls"|"bike_lane"|"pedestrian_crossing", "count": number, "arrangement": "parallel"|"perpendicular"|"angled", "street_name": "string" }
Default: count=3, arrangement="parallel". Rispondi SOLO con il JSON, nessun testo aggiuntivo.`;

app.post('/api/ai/parse-spatial-intent', authenticateToken, async (req, res) => {
    const { command_text } = req.body;
    if (!command_text) return res.status(400).json({ error: 'command_text obbligatorio' });
    if (!isAiAvailable()) return res.status(503).json({ error: 'Modello AI non disponibile' });
    try {
        const raw = await executeLocalChat(SPATIAL_INTENT_SYSTEM, command_text);
        const text = raw.trim().replace(/```json/gi, '').replace(/```/g, '').trim();
        const s = text.indexOf('{'), e = text.lastIndexOf('}');
        const parsed = JSON.parse(text.substring(s, e + 1));
        res.json(parsed);
    } catch (err) {
        res.status(502).json({ error: 'Parsing intent fallito: ' + err.message });
    }
});

app.post('/api/ai/spatial-command', authenticateToken, async (req, res) => {
    const { command_text, map_center_lat, map_center_lng, angle_deg = 90, side = 1 } = req.body;
    if (!command_text) return res.status(400).json({ error: 'command_text obbligatorio' });

    const lat = parseFloat(map_center_lat) || 45.4654;
    const lng = parseFloat(map_center_lng) || 9.1859;

    let intent = { count: 3, arrangement: 'parallel', street_name: '' };
    if (isAiAvailable()) {
        try {
            const raw = await executeLocalChat(SPATIAL_INTENT_SYSTEM, command_text);
            const text = raw.trim().replace(/```json/gi, '').replace(/```/g, '').trim();
            const s = text.indexOf('{'), e = text.lastIndexOf('}');
            Object.assign(intent, JSON.parse(text.substring(s, e + 1)));
        } catch { /* usa default */ }
    }

    const count       = Math.min(Math.max(parseInt(intent.count) || 3, 1), 20);
    const arrangement = ['parallel', 'perpendicular', 'angled'].includes(intent.arrangement) ? intent.arrangement : 'parallel';
    const geojson     = generateParkingGeometry(lat, lng, count, arrangement, parseFloat(angle_deg), parseInt(side));

    res.json({
        intent,
        geojson,
        anchor: { lat, lng },
        params: { count, arrangement, angle_deg: parseFloat(angle_deg), side: parseInt(side) }
    });
});

// Salva layout AI approvato come items di progetto
app.post('/api/projects/commit-layout', authenticateToken, requireRole('admin', 'tecnico'), (req, res) => {
    const { project_name, target_streets, features } = req.body;
    if (!features || !Array.isArray(features) || features.length === 0) {
        return res.status(400).json({ error: 'features GeoJSON obbligatorio' });
    }
    const result = db.prepare(
        'INSERT INTO traffic_projects (project_name, target_streets, status) VALUES (?, ?, ?)'
    ).run(project_name || `Layout AI — ${new Date().toLocaleDateString('it-IT')}`, target_streets || 'generato da AI', 'bozza');
    const projectId = result.lastInsertRowid;

    const insertItem = db.prepare('INSERT INTO project_items (project_id, action, sign_code, reason) VALUES (?, ?, ?, ?)');
    const insertAll = db.transaction(() => {
        features.forEach((f, i) => {
            insertItem.run(projectId, 'aggiungi', f.properties?.target_asset || 'stallo_sosta',
                f.properties?.note || `Stallo ${i + 1} posizionato da AI`);
        });
    });
    insertAll();
    logAudit(req, 'insert', 'traffic_projects', projectId, { source: 'ai_spatial', features: features.length });
    res.json({ project_id: projectId, items_created: features.length });
});

// Ricalcola geometria con rotazione / flip lato (Module 17 — backend support)
app.post('/api/ai/spatial-transform', authenticateToken, (req, res) => {
    const { geojson, anchor_lat, anchor_lng, delta_angle = 0, new_side, count, arrangement, angle_deg, side } = req.body;
    if (!geojson || !anchor_lat || !anchor_lng) return res.status(400).json({ error: 'geojson, anchor_lat, anchor_lng obbligatori' });

    let result = geojson;
    if (delta_angle !== 0) {
        result = rotateFeatureCollection(result, parseFloat(anchor_lat), parseFloat(anchor_lng), parseFloat(delta_angle));
    }
    if (new_side !== undefined) {
        result = flipSide(result, parseFloat(anchor_lat), parseFloat(anchor_lng),
            parseInt(count) || 3, arrangement || 'parallel', parseFloat(angle_deg) || 90);
    }
    res.json({ geojson: result });
});

// ============================================================
// MODULO 4 — Catasto Agenzia delle Entrate (WMS GetFeatureInfo)
// ============================================================
app.get('/api/external/cataster-lookup', authenticateToken, async (req, res) => {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat e lng obbligatori' });

    const FALLBACK = { sheet: null, parcel: null, owner_type: 'Non identificato (Offline)', liability: 'verifica_manuale' };

    try {
        const latN = parseFloat(lat);
        const lngN = parseFloat(lng);
        const delta = 0.0001;

        // WMS GetFeatureInfo verso il servizio pubblico AdE (INSPIRE)
        const wmsUrl = new URL('https://wms.cartografia.agenziaentrate.gov.it/inspire/wms/ows01.php');
        wmsUrl.searchParams.set('SERVICE', 'WMS');
        wmsUrl.searchParams.set('VERSION', '1.3.0');
        wmsUrl.searchParams.set('REQUEST', 'GetFeatureInfo');
        wmsUrl.searchParams.set('LAYERS', 'CP.CadastralParcel');
        wmsUrl.searchParams.set('QUERY_LAYERS', 'CP.CadastralParcel');
        wmsUrl.searchParams.set('CRS', 'EPSG:4326');
        wmsUrl.searchParams.set('BBOX', `${latN - delta},${lngN - delta},${latN + delta},${lngN + delta}`);
        wmsUrl.searchParams.set('WIDTH', '101');
        wmsUrl.searchParams.set('HEIGHT', '101');
        wmsUrl.searchParams.set('I', '50');
        wmsUrl.searchParams.set('J', '50');
        wmsUrl.searchParams.set('INFO_FORMAT', 'application/json');
        wmsUrl.searchParams.set('FEATURE_COUNT', '1');

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(wmsUrl.toString(), {
            headers: { 'User-Agent': 'CatastoSegnaletica/1.0' },
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) return res.json(FALLBACK);

        const contentType = response.headers.get('content-type') || '';
        let sheet = null, parcel = null, owner_type = 'comunale', liability = 'manutenzione_comune';

        if (contentType.includes('json')) {
            const json = await response.json();
            const feature = json?.features?.[0];
            if (feature) {
                const props = feature.properties || {};
                // Campi standard INSPIRE per le particelle catastali
                parcel = props.label || props.nationalCadastralReference || props.PARTICELLA || null;
                sheet = props.FOGLIO || (parcel ? parcel.split('/')[0] : null);
                const category = (props.areaValue || '').toLowerCase();
                if (category.includes('privat') || category.includes('P')) {
                    owner_type = 'privato';
                    liability = 'competenza_privata';
                } else if (category.includes('demanio') || category.includes('stato')) {
                    owner_type = 'demaniale';
                    liability = 'manutenzione_comune';
                }
            }
        } else {
            const text = await response.text();
            // Prova a estrarre foglio/particella da risposta XML/testo
            const foglioMatch = text.match(/FOGLIO[^\d]*(\d+)/i);
            const particellaMatch = text.match(/PARTICELLA[^\d]*(\d+)/i);
            if (foglioMatch) sheet = foglioMatch[1];
            if (particellaMatch) parcel = particellaMatch[1];
        }

        return res.json({ sheet, parcel, owner_type, liability });
    } catch (err) {
        // Timeout o rete non disponibile: restituisce fallback graceful
        return res.json(FALLBACK);
    }
});

// ============================================================
// MODULO 6 — Waze for Cities (CIFS export)
// ============================================================
app.post('/api/external/waze-disruption/publish', authenticateToken, requireRole('admin', 'tecnico'), async (req, res) => {
    const { project_id } = req.body;
    if (!project_id) return res.status(400).json({ error: 'project_id obbligatorio' });

    const project = db.prepare('SELECT * FROM traffic_projects WHERE id = ?').get(project_id);
    if (!project) return res.status(404).json({ error: 'Progetto non trovato' });

    const items = db.prepare('SELECT * FROM project_items WHERE project_id = ?').all(project_id);

    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 30);

    const incidentId = `CSG-${project_id}-${Date.now()}`;
    const street = project.target_streets || 'Via non specificata';

    const cifsPayload = {
        incidents: [{
            id: incidentId,
            type: 'ROAD_CLOSED',
            subtype: 'ROAD_CLOSED_CONSTRUCTION',
            polyline: `${street}`,
            location: {
                street,
                direction: 'BOTH_DIRECTIONS',
                polyline: street
            },
            starttime: now.toISOString(),
            endtime: endDate.toISOString(),
            description: `Variante viabilità comunale: ${project.project_name}. Interventi: ${items.length} segnali/modifiche. Ente: Comune.`,
            reference: `Progetto #${project_id}`,
            street
        }]
    };

    try {
        const WAZE_ENDPOINT = process.env.WAZE_CIFS_ENDPOINT || null;

        if (WAZE_ENDPOINT) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4000);
            await fetch(WAZE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cifsPayload),
                signal: controller.signal
            });
            clearTimeout(timeout);
        }

        logAudit(req, 'waze_publish', 'traffic_projects', project_id, { incident_id: incidentId, items: items.length });
        res.json({
            success: true,
            incident_id: incidentId,
            message: `Disruption CIFS pubblicata per "${project.project_name}" (${items.length} voci). ID: ${incidentId}`,
            cifs: cifsPayload
        });
    } catch (err) {
        // Rete non disponibile: log locale e risposta soft
        logAudit(req, 'waze_publish_failed', 'traffic_projects', project_id, { error: err.message });
        res.json({
            success: false,
            incident_id: incidentId,
            message: `Export CIFS generato localmente (endpoint Waze non raggiungibile). ID: ${incidentId}`,
            cifs: cifsPayload
        });
    }
});

app.get('/api/projects', authenticateToken, (req, res) => {
    const projects = db.prepare('SELECT * FROM traffic_projects ORDER BY id DESC').all();
    res.json(projects);
});

app.get('/api/projects/:id', authenticateToken, (req, res) => {
    const project = db.prepare('SELECT * FROM traffic_projects WHERE id = ?').get(req.params.id);
    if (!project) return res.status(404).json({ error: 'Progetto non trovato' });

    const items = db.prepare(`
        SELECT pi.*, pl.description AS price_description, pl.unit_price, pl.contract_id
        FROM project_items pi
        LEFT JOIN price_list pl ON pl.id = pi.price_list_id
        WHERE pi.project_id = ?
        ORDER BY pi.id
    `).all(project.id);

    res.json({ project, items });
});

app.post('/api/projects/simulate-viability', authenticateToken, requireRole('admin', 'tecnico'), validateBody(simulateViabilitySchema), async (req, res) => {
    const { project_id, project_name, target_streets, modification_request } = req.body;

    let project;
    if (project_id) {
        project = db.prepare('SELECT * FROM traffic_projects WHERE id = ?').get(project_id);
        if (!project) return res.status(404).json({ error: 'Progetto non trovato' });
    } else {
        const result = db.prepare('INSERT INTO traffic_projects (project_name, target_streets, status) VALUES (?, ?, ?)').run(project_name, target_streets, 'bozza');
        project = db.prepare('SELECT * FROM traffic_projects WHERE id = ?').get(result.lastInsertRowid);
    }

    const existingSigns = db.prepare(`
        SELECT id, type, status, notes, ordinanza_rif
        FROM signs
        WHERE valid_to IS NULL AND notes LIKE ?
    `).all(`%${project.target_streets}%`);

    const priceListItems = db.prepare('SELECT id, item_code, description, unit_price FROM price_list WHERE item_code IS NOT NULL').all();

    if (priceListItems.length === 0) {
        return res.status(400).json({ error: 'Nessuna voce di tariffario disponibile per la simulazione' });
    }

    const systemPrompt = "Agisci come Ingegnere del Traffico. Analizza l'elenco dei cartelli attuali e la modifica stradale richiesta. Genera l'elenco delle azioni necessarie (aggiungi/rimuovi/sostituisci) usando SOLO i codici presenti nel tariffario fornito. Rispondi esclusivamente con un array JSON strutturato: [{ \"action\": \"rimuovi\"|\"aggiungi\"|\"sostituisci\", \"sign_code\": \"CdS_Code\", \"reason\": \"testo\" }]";

    const userPrompt = JSON.stringify({
        via: project.target_streets,
        modifica_richiesta: modification_request,
        segnali_attuali: existingSigns.map(s => ({ id: s.id, type: s.type, status: s.status, ordinanza_rif: s.ordinanza_rif })),
        tariffario: priceListItems.map(p => ({ codice: p.item_code, descrizione: p.description, prezzo: p.unit_price })),
    });

    let actions;
    try {
        actions = await executeJsonInference(systemPrompt, userPrompt);
    } catch (error) {
        return res.status(503).json({ error: 'Motore AI non disponibile: ' + error.message });
    }

    if (!Array.isArray(actions)) {
        return res.status(502).json({ error: 'Risposta AI non valida (era atteso un array)' });
    }

    db.prepare('DELETE FROM project_items WHERE project_id = ?').run(project.id);

    const insertItem = db.prepare('INSERT INTO project_items (project_id, action, sign_code, reason, price_list_id) VALUES (?, ?, ?, ?, ?)');
    for (const item of actions) {
        if (!item || !item.action || !item.sign_code) continue;
        const matchedPrice = priceListItems.find(p => p.item_code === item.sign_code);
        insertItem.run(project.id, item.action, item.sign_code, item.reason || null, matchedPrice ? matchedPrice.id : null);
    }

    const items = db.prepare(`
        SELECT pi.*, pl.description AS price_description, pl.unit_price, pl.contract_id
        FROM project_items pi
        LEFT JOIN price_list pl ON pl.id = pi.price_list_id
        WHERE pi.project_id = ?
        ORDER BY pi.id
    `).all(project.id);

    res.json({ project, items });
});

app.post('/api/projects/:id/execute', authenticateToken, requireRole('admin', 'tecnico'), (req, res) => {
    const project = db.prepare('SELECT * FROM traffic_projects WHERE id = ?').get(req.params.id);
    if (!project) return res.status(404).json({ error: 'Progetto non trovato' });

    const items = db.prepare(`
        SELECT pi.*, pl.unit_price
        FROM project_items pi
        LEFT JOIN price_list pl ON pl.id = pi.price_list_id
        WHERE pi.project_id = ?
    `).all(project.id);

    if (items.length === 0) return res.status(400).json({ error: 'Nessuna voce da eseguire' });

    const actionTypeMap = { aggiungi: 'installazione', rimuovi: 'rimozione', sostituisci: 'sostituzione' };

    const insertIntervention = db.prepare(`
        INSERT INTO interventions (sign_id, type, status, price_list_id, quantity, cost, notes)
        VALUES (?, ?, 'programmato', ?, ?, ?, ?)
    `);

    const execute = db.transaction(() => {
        let created = 0;
        for (const item of items) {
            let signId = null;
            if (item.action === 'rimuovi' || item.action === 'sostituisci') {
                const sign = db.prepare(`
                    SELECT id FROM signs WHERE valid_to IS NULL AND type = ? AND notes LIKE ? LIMIT 1
                `).get(item.sign_code, `%${project.target_streets}%`);
                signId = sign ? sign.id : null;
            }
            if (!signId) {
                const result = db.prepare(`
                    INSERT INTO signs (type, latitude, longitude, status, notes, source)
                    VALUES (?, 0, 0, 'da_sostituire', ?, 'simulazione_ai')
                `).run(item.sign_code, `${project.target_streets} - ${item.reason || ''}`);
                signId = result.lastInsertRowid;
            }
            const quantity = 1;
            const cost = item.unit_price != null ? item.unit_price * quantity : null;
            insertIntervention.run(signId, actionTypeMap[item.action] || item.action, item.price_list_id, quantity, cost, item.reason);
            created++;
        }

        db.prepare("UPDATE traffic_projects SET status = 'approvato' WHERE id = ?").run(project.id);
        return created;
    });

    const created = execute();
    res.json({ success: true, created, project: db.prepare('SELECT * FROM traffic_projects WHERE id = ?').get(project.id) });
});

// Ottieni singolo segnale
app.get('/api/signs/:id', authenticateToken, (req, res) => {
    const sign = db.prepare('SELECT * FROM signs WHERE id = ?').get(req.params.id);
    if (!sign) return res.status(404).json({ error: 'Segnale non trovato' });
    res.json(sign);
});

// Crea nuovo segnale
app.post('/api/signs', authenticateToken, validateBody(createSignSchema), async (req, res) => {
    const { type, latitude, longitude, status, installation_date, notes, photo, ordinanza_rif, is_emergency, support_id, installation_height_cm, closest_civic_number, location_context, street_name, road_segment, carriageway_side, dimensions, reflective_class, ordinanza_doc, ordinanza_doc_name } = req.body;

    // Scrittura file async (non blocca l'event loop durante l'upload)
    let photoPath = null;
    let photoHash = null;
    if (photo) {
        ({ photoPath, photoHash } = await savePhotoAsync(photo));
    }

    let ordinanzaDocPath = null;
    if (ordinanza_doc) {
        ordinanzaDocPath = await saveEncryptedDocAsync(ordinanza_doc);
    }

    // Reverse geocoding stub: associa automaticamente il numero civico più vicino se non fornito
    const resolvedCivicNumber = closest_civic_number || findClosestCivicNumber(latitude, longitude);

    const result = db.prepare(`
    INSERT INTO signs (type, latitude, longitude, photo_path, photo_hash, status, installation_date, notes, ordinanza_rif, created_by, is_emergency, support_id, installation_height_cm, closest_civic_number, location_context, street_name, road_segment, carriageway_side, dimensions, reflective_class, ordinanza_doc_path, ordinanza_doc_name, valid_from)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(type, latitude, longitude, photoPath, photoHash, status || 'buono', installation_date, notes, ordinanza_rif || null, req.user.id, is_emergency ? 1 : 0, support_id || null, installation_height_cm ?? null, resolvedCivicNumber, location_context || 'marciapiede', street_name || null, road_segment || null, carriageway_side || null, dimensions || null, reflective_class || null, ordinanzaDocPath, ordinanza_doc_name || null);

    const newSign = db.prepare('SELECT * FROM signs WHERE id = ?').get(result.lastInsertRowid);

    logAudit(req, 'insert', 'signs', newSign.id);

    // Notifica via WebSocket
    io.emit('sign:created', newSign);

    res.json(newSign);
});

// Importa un segnale individuato dal "Censimento Virtuale" (rilevamento AI/community
// su Mapillary/OpenStreetMap) come segnale ufficiale "da verificare" sul campo
app.post('/api/signs/import-virtual', authenticateToken, validateBody(createSignSchema), (req, res) => {
    const { type, latitude, longitude, status, installation_date, notes, photo, ordinanza_rif } = req.body;

    let photoPath = null;
    let photoHash = null;
    if (photo) {
        const photoBuffer = Buffer.from(photo.split(',')[1], 'base64');
        const encrypted = encryptPhoto(photoBuffer);
        const filename = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}.enc`;
        fs.writeFileSync(path.join(photosDir, filename), JSON.stringify(encrypted));
        photoPath = filename;
        photoHash = crypto.createHash('sha256').update(photoBuffer).digest('hex');
    }

    const importNote = 'Rilevamento: Virtual AI';
    const combinedNotes = notes ? `${notes} — ${importNote}` : importNote;

    const result = db.prepare(`
        INSERT INTO signs (type, latitude, longitude, photo_path, photo_hash, status, installation_date, notes, ordinanza_rif, created_by, source, richiede_revisione)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(type, latitude, longitude, photoPath, photoHash, status || 'buono', installation_date || null, combinedNotes, ordinanza_rif || null, req.user.id, 'virtual_ai', 1);

    const newSign = db.prepare('SELECT * FROM signs WHERE id = ?').get(result.lastInsertRowid);

    logAudit(req, 'insert', 'signs', newSign.id, { source: 'virtual_ai' });

    io.emit('sign:created', newSign);

    res.json(newSign);
});

// Importazione massiva di segnali (es. sessione di censimento scaricata via USB) -
// esegue tutti gli inserimenti in un'unica transazione SQL per massimizzare la
// velocità di scrittura e ridurre i tempi di attesa
app.post('/api/signs/bulk-import', authenticateToken, validateBody(bulkImportSignsSchema), async (req, res) => {
    const { signs: signsToImport } = req.body;

    // Fase 1: scrivi tutte le foto in parallelo su disco (async, fuori dalla transazione DB)
    const photoData = await Promise.all(signsToImport.map(item =>
        item.photo ? savePhotoAsync(item.photo) : Promise.resolve({ photoPath: null, photoHash: null })
    ));

    // Fase 2: inserisci nel DB in un'unica transazione (solo CPU/RAM, zero I/O disco)
    const insertStmt = db.prepare(`
        INSERT INTO signs (type, latitude, longitude, photo_path, photo_hash, status, installation_date, notes, ordinanza_rif, numero_autorizzazione, proprietario, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items) => items.map((item, i) => {
        const result = insertStmt.run(
            item.type, item.latitude, item.longitude,
            photoData[i].photoPath, photoData[i].photoHash,
            item.status || 'buono', item.installation_date || null,
            item.notes || null, item.ordinanza_rif || null,
            item.numero_autorizzazione || null, item.proprietario || null,
            req.user.id
        );
        return db.prepare('SELECT * FROM signs WHERE id = ?').get(result.lastInsertRowid);
    }));

    const insertedSigns = insertMany(signsToImport);
    insertedSigns.forEach(s => io.emit('sign:created', s));
    logAudit(req, 'insert', 'signs', null, { bulk: true, count: insertedSigns.length });

    res.json({ success: true, count: insertedSigns.length, signs: insertedSigns });
});

// Aggiorna segnale: storicizza la riga attiva (valid_to) e inserisce la nuova versione (valid_from)
app.put('/api/signs/:id', authenticateToken, validateBody(updateSignSchema), async (req, res) => {
    const { type, latitude, longitude, status, installation_date, notes, ordinanza_rif, photo, is_emergency, support_id, installation_height_cm, closest_civic_number, location_context, street_name, road_segment, carriageway_side, dimensions, reflective_class, ordinanza_doc, ordinanza_doc_name } = req.body;

    const existing = db.prepare('SELECT * FROM signs WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Segnale non trovato' });

    let photoPath = existing.photo_path;
    let photoHash = existing.photo_hash;
    if (photo) {
        ({ photoPath, photoHash } = await savePhotoAsync(photo));
    }

    let ordinanzaDocPath = existing.ordinanza_doc_path;
    let ordinanzaDocName = existing.ordinanza_doc_name;
    if (ordinanza_doc) {
        ordinanzaDocPath = await saveEncryptedDocAsync(ordinanza_doc);
        ordinanzaDocName = ordinanza_doc_name || ordinanzaDocName;
    }

    const newSign = db.transaction(() => {
        db.prepare('UPDATE signs SET valid_to = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);

        const result = db.prepare(`
            INSERT INTO signs (type, latitude, longitude, photo_path, photo_hash, status, installation_date, notes, ordinanza_rif, numero_autorizzazione, proprietario, created_by, is_emergency, support_id, installation_height_cm, closest_civic_number, location_context, street_name, road_segment, carriageway_side, dimensions, reflective_class, ordinanza_doc_path, ordinanza_doc_name, source, valid_from)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(type, latitude, longitude, photoPath, photoHash, status, installation_date, notes, ordinanza_rif || null, existing.numero_autorizzazione, existing.proprietario, existing.created_by, is_emergency ? 1 : 0, support_id ?? existing.support_id, installation_height_cm ?? existing.installation_height_cm, closest_civic_number ?? existing.closest_civic_number, location_context ?? existing.location_context, street_name ?? existing.street_name, road_segment ?? existing.road_segment, carriageway_side ?? existing.carriageway_side, dimensions ?? existing.dimensions, reflective_class ?? existing.reflective_class, ordinanzaDocPath, ordinanzaDocName, existing.source);

        return db.prepare('SELECT * FROM signs WHERE id = ?').get(result.lastInsertRowid);
    })();

    logAudit(req, 'update', 'signs', newSign.id, { previousId: existing.id });

    io.emit('sign:updated', newSign);
    io.emit('sign:deleted', { id: existing.id });

    res.json(newSign);
});

// Segna un segnale come "richiede revisione" (conflitto di sincronizzazione rilevato dal client)
app.put('/api/signs/:id/flag-review', authenticateToken, (req, res) => {
    const sign = db.prepare('SELECT * FROM signs WHERE id = ?').get(req.params.id);
    if (!sign) return res.status(404).json({ error: 'Segnale non trovato' });

    db.prepare('UPDATE signs SET richiede_revisione = 1 WHERE id = ?').run(req.params.id);

    const updatedSign = db.prepare('SELECT * FROM signs WHERE id = ?').get(req.params.id);
    io.emit('sign:updated', updatedSign);

    res.json(updatedSign);
});

// Elimina segnale: storicizza la riga (valid_to) invece di rimuoverla fisicamente
app.delete('/api/signs/:id', authenticateToken, requireRole('admin'), (req, res) => {
    const sign = db.prepare('SELECT * FROM signs WHERE id = ?').get(req.params.id);
    if (!sign) return res.status(404).json({ error: 'Segnale non trovato' });

    db.prepare('UPDATE signs SET valid_to = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);

    logAudit(req, 'delete', 'signs', req.params.id);

    io.emit('sign:deleted', { id: req.params.id });

    res.json({ success: true });
});

// Ottieni foto decrittografata
app.get('/api/signs/:id/photo', authenticateToken, (req, res) => {
    console.log(`📸 Richiesta foto per segnale ${req.params.id}`);

    const sign = db.prepare('SELECT photo_path FROM signs WHERE id = ?').get(req.params.id);

    if (!sign) {
        console.log('❌ Segnale non trovato nel DB');
        return res.status(404).json({ error: 'Segnale non trovato' });
    }

    if (!sign.photo_path) {
        console.log('❌ Path foto mancante nel DB');
        return res.status(404).json({ error: 'Foto non presente' });
    }

    const filePath = resolvePhotoPath(sign.photo_path);
    if (!fs.existsSync(filePath)) {
        console.log(`❌ File non trovato su disco: ${filePath}`);
        return res.status(404).json({ error: 'File foto non trovato' });
    }

    try {
        const encrypted = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const decrypted = decryptPhoto(encrypted.data, encrypted.iv);

        console.log('✅ Foto decrittografata e inviata');
        res.set('Content-Type', 'image/jpeg');
        res.send(decrypted);
    } catch (error) {
        console.error('❌ Errore decrittografia:', error);
        res.status(500).json({ error: 'Errore decrittografia' });
    }
});

// Ottieni documento ordinanza decrittografato (PDF)
app.get('/api/signs/:id/ordinanza-doc', authenticateToken, (req, res) => {
    const sign = db.prepare('SELECT ordinanza_doc_path, ordinanza_doc_name FROM signs WHERE id = ?').get(req.params.id);
    if (!sign || !sign.ordinanza_doc_path) return res.status(404).json({ error: 'Documento non presente' });

    const filePath = resolveDocPath(sign.ordinanza_doc_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File documento non trovato' });

    try {
        const encrypted = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const decrypted = decryptPhoto(encrypted.data, encrypted.iv);
        res.set('Content-Type', 'application/pdf');
        res.set('Content-Disposition', `inline; filename="${sign.ordinanza_doc_name || 'ordinanza.pdf'}"`);
        res.send(decrypted);
    } catch (error) {
        console.error('❌ Errore decrittografia documento:', error);
        res.status(500).json({ error: 'Errore decrittografia' });
    }
});

// === SUPPORTI (Pali / Portali / Staffe) ===

app.get('/api/supports', authenticateToken, (req, res) => {
    const supports = db.prepare('SELECT * FROM supports ORDER BY street_name, id').all();
    res.json(supports);
});

app.get('/api/supports/:id', authenticateToken, (req, res) => {
    const support = db.prepare('SELECT * FROM supports WHERE id = ?').get(req.params.id);
    if (!support) return res.status(404).json({ error: 'Supporto non trovato' });
    const signsOnSupport = db.prepare('SELECT * FROM signs WHERE support_id = ? AND valid_to IS NULL').all(req.params.id);
    res.json({ ...support, signs: signsOnSupport });
});

app.post('/api/supports', authenticateToken, requireRole('admin', 'tecnico'), validateBody(createSupportSchema), (req, res) => {
    const { street_name, latitude, longitude, type, condition, last_inspected_at } = req.body;

    const result = db.prepare(`
        INSERT INTO supports (street_name, latitude, longitude, type, condition, last_inspected_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(street_name, latitude, longitude, type, condition || null, last_inspected_at || null);

    const newSupport = db.prepare('SELECT * FROM supports WHERE id = ?').get(result.lastInsertRowid);

    logAudit(req, 'insert', 'supports', newSupport.id);
    io.emit('support:created', newSupport);

    res.json(newSupport);
});

app.put('/api/supports/:id', authenticateToken, requireRole('admin', 'tecnico'), validateBody(updateSupportSchema), (req, res) => {
    const { street_name, latitude, longitude, type, condition, last_inspected_at } = req.body;

    const existing = db.prepare('SELECT * FROM supports WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Supporto non trovato' });

    db.prepare(`
        UPDATE supports
        SET street_name = ?, latitude = ?, longitude = ?, type = ?, condition = ?, last_inspected_at = ?
        WHERE id = ?
    `).run(street_name, latitude, longitude, type, condition || null, last_inspected_at || null, req.params.id);

    const updated = db.prepare('SELECT * FROM supports WHERE id = ?').get(req.params.id);

    logAudit(req, 'update', 'supports', updated.id);
    io.emit('support:updated', updated);

    res.json(updated);
});

app.delete('/api/supports/:id', authenticateToken, requireRole('admin'), (req, res) => {
    const support = db.prepare('SELECT * FROM supports WHERE id = ?').get(req.params.id);
    if (!support) return res.status(404).json({ error: 'Supporto non trovato' });

    const attachedSigns = db.prepare('SELECT id FROM signs WHERE support_id = ? AND valid_to IS NULL').all(req.params.id);
    if (attachedSigns.length > 0) {
        return res.status(400).json({ error: 'Impossibile eliminare: il supporto ha segnali collegati' });
    }

    db.prepare('DELETE FROM supports WHERE id = ?').run(req.params.id);

    logAudit(req, 'delete', 'supports', req.params.id);
    io.emit('support:deleted', { id: req.params.id });

    res.json({ success: true });
});

// === DISSESTI STRADALI (Pavement Defects) ===

app.get('/api/pavement-defects', authenticateToken, (req, res) => {
    const defects = db.prepare('SELECT * FROM pavement_defects ORDER BY created_at DESC').all();
    res.json(defects);
});

app.get('/api/pavement-defects/:id', authenticateToken, (req, res) => {
    const defect = db.prepare('SELECT * FROM pavement_defects WHERE id = ?').get(req.params.id);
    if (!defect) return res.status(404).json({ error: 'Dissesto non trovato' });
    res.json(defect);
});

app.post('/api/pavement-defects', authenticateToken, validateBody(createPavementDefectSchema), (req, res) => {
    const { street_name, latitude, longitude, defect_type, severity, photo, description, status } = req.body;

    let photoPath = null;
    if (photo) {
        const photoBuffer = Buffer.from(photo.split(',')[1], 'base64');
        const encrypted = encryptPhoto(photoBuffer);
        const filename = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}.enc`;
        fs.writeFileSync(path.join(photosDir, filename), JSON.stringify(encrypted));
        photoPath = filename;
    }

    const result = db.prepare(`
        INSERT INTO pavement_defects (street_name, latitude, longitude, defect_type, severity, photo_path, description, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(street_name, latitude, longitude, defect_type, severity, photoPath, description || null, status || 'segnalato');

    const newDefect = db.prepare('SELECT * FROM pavement_defects WHERE id = ?').get(result.lastInsertRowid);

    logAudit(req, 'insert', 'pavement_defects', newDefect.id);
    io.emit('defect:created', newDefect);

    res.json(newDefect);
});

app.put('/api/pavement-defects/:id', authenticateToken, validateBody(updatePavementDefectSchema), (req, res) => {
    const { street_name, latitude, longitude, defect_type, severity, description, status } = req.body;

    const existing = db.prepare('SELECT * FROM pavement_defects WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Dissesto non trovato' });

    db.prepare(`
        UPDATE pavement_defects
        SET street_name = ?, latitude = ?, longitude = ?, defect_type = ?, severity = ?, description = ?, status = ?
        WHERE id = ?
    `).run(street_name, latitude, longitude, defect_type, severity, description || null, status || existing.status, req.params.id);

    const updated = db.prepare('SELECT * FROM pavement_defects WHERE id = ?').get(req.params.id);

    logAudit(req, 'update', 'pavement_defects', updated.id);
    io.emit('defect:updated', updated);

    res.json(updated);
});

// Inoltra un dissesto all'Ufficio Tecnico Comunale: marca come "preso_in_carico" e
// genera il payload formattato per la trasmissione (email/JSON export)
app.patch('/api/pavement-defects/:id/forward', authenticateToken, requireRole('admin', 'tecnico'), (req, res) => {
    const defect = db.prepare('SELECT * FROM pavement_defects WHERE id = ?').get(req.params.id);
    if (!defect) return res.status(404).json({ error: 'Dissesto non trovato' });

    db.prepare(`
        UPDATE pavement_defects
        SET status = 'preso_in_carico', forward_date = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(req.params.id);

    const updated = db.prepare('SELECT * FROM pavement_defects WHERE id = ?').get(req.params.id);

    const transmission = {
        to: 'ufficio.tecnico@comune.it',
        subject: `Segnalazione Dissesto Stradale #${updated.id} - ${updated.defect_type.toUpperCase()} (${updated.severity})`,
        body: {
            oggetto: 'Segnalazione di Dissesto Stradale per Intervento Manutentivo',
            id_segnalazione: updated.id,
            via: updated.street_name,
            coordinate: { latitude: updated.latitude, longitude: updated.longitude },
            tipo_dissesto: updated.defect_type,
            gravita: updated.severity,
            descrizione: updated.description || '-',
            data_segnalazione: updated.created_at,
            data_inoltro: updated.forward_date,
            inoltrato_da: req.user.username,
        }
    };

    logAudit(req, 'update', 'pavement_defects', updated.id, { forwarded: true });
    io.emit('defect:updated', updated);

    res.json({ defect: updated, transmission });
});

app.delete('/api/pavement-defects/:id', authenticateToken, requireRole('admin'), (req, res) => {
    const defect = db.prepare('SELECT * FROM pavement_defects WHERE id = ?').get(req.params.id);
    if (!defect) return res.status(404).json({ error: 'Dissesto non trovato' });

    if (defect.photo_path) {
        const filePath = resolvePhotoPath(defect.photo_path);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    db.prepare('DELETE FROM pavement_defects WHERE id = ?').run(req.params.id);

    logAudit(req, 'delete', 'pavement_defects', req.params.id);
    io.emit('defect:deleted', { id: req.params.id });

    res.json({ success: true });
});

// Ottieni foto decrittografata del dissesto
app.get('/api/pavement-defects/:id/photo', authenticateToken, (req, res) => {
    const defect = db.prepare('SELECT photo_path FROM pavement_defects WHERE id = ?').get(req.params.id);
    if (!defect || !defect.photo_path) return res.status(404).json({ error: 'Foto non presente' });

    const filePath = resolvePhotoPath(defect.photo_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File foto non trovato' });

    try {
        const encrypted = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const decrypted = decryptPhoto(encrypted.data, encrypted.iv);
        res.set('Content-Type', 'image/jpeg');
        res.send(decrypted);
    } catch (error) {
        console.error('❌ Errore decrittografia:', error);
        res.status(500).json({ error: 'Errore decrittografia' });
    }
});

// === SEGNALETICA ORIZZONTALE (Strisce, Mezzeria, ecc.) ===

app.get('/api/road-markings', authenticateToken, (req, res) => {
    const markings = db.prepare('SELECT * FROM road_markings ORDER BY created_at DESC').all();
    res.json(markings);
});

app.get('/api/road-markings/:id', authenticateToken, (req, res) => {
    const marking = db.prepare('SELECT * FROM road_markings WHERE id = ?').get(req.params.id);
    if (!marking) return res.status(404).json({ error: 'Segnaletica orizzontale non trovata' });
    res.json(marking);
});

app.post('/api/road-markings', authenticateToken, validateBody(createRoadMarkingSchema), async (req, res) => {
    const { street_name, latitude, longitude, marking_type, material, status, length_m, notes, photo, parent_vertical_id, geometry_json } = req.body;

    let photoPath = null;
    if (photo) {
        ({ photoPath } = await savePhotoAsync(photo));
    }

    const result = db.prepare(`
        INSERT INTO road_markings (street_name, latitude, longitude, marking_type, material, status, length_m, photo_path, notes, parent_vertical_id, geometry_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(street_name, latitude, longitude, marking_type, material, status || 'buono', length_m ?? null, photoPath, notes || null, parent_vertical_id ?? null, geometry_json ?? null);

    const newMarking = db.prepare('SELECT * FROM road_markings WHERE id = ?').get(result.lastInsertRowid);

    logAudit(req, 'insert', 'road_markings', newMarking.id);
    io.emit('roadmarking:created', newMarking);

    res.json(newMarking);
});

app.put('/api/road-markings/:id', authenticateToken, validateBody(updateRoadMarkingSchema), async (req, res) => {
    const { street_name, latitude, longitude, marking_type, material, status, length_m, notes, photo } = req.body;

    const existing = db.prepare('SELECT * FROM road_markings WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Segnaletica orizzontale non trovata' });

    let photoPath = existing.photo_path;
    if (photo) {
        ({ photoPath } = await savePhotoAsync(photo));
    }

    db.prepare(`
        UPDATE road_markings
        SET street_name = ?, latitude = ?, longitude = ?, marking_type = ?, material = ?, status = ?, length_m = ?, photo_path = ?, notes = ?
        WHERE id = ?
    `).run(street_name, latitude, longitude, marking_type, material, status || existing.status, length_m ?? existing.length_m, photoPath, notes || null, req.params.id);

    const updated = db.prepare('SELECT * FROM road_markings WHERE id = ?').get(req.params.id);

    logAudit(req, 'update', 'road_markings', updated.id);
    io.emit('roadmarking:updated', updated);

    res.json(updated);
});

app.delete('/api/road-markings/:id', authenticateToken, requireRole('admin'), (req, res) => {
    const marking = db.prepare('SELECT * FROM road_markings WHERE id = ?').get(req.params.id);
    if (!marking) return res.status(404).json({ error: 'Segnaletica orizzontale non trovata' });

    if (marking.photo_path) {
        const filePath = resolvePhotoPath(marking.photo_path);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    db.prepare('DELETE FROM road_markings WHERE id = ?').run(req.params.id);

    logAudit(req, 'delete', 'road_markings', req.params.id);
    io.emit('roadmarking:deleted', { id: req.params.id });

    res.json({ success: true });
});

app.get('/api/road-markings/:id/photo', authenticateToken, (req, res) => {
    const marking = db.prepare('SELECT photo_path FROM road_markings WHERE id = ?').get(req.params.id);
    if (!marking || !marking.photo_path) return res.status(404).json({ error: 'Foto non presente' });

    const filePath = resolvePhotoPath(marking.photo_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File foto non trovato' });

    try {
        const encrypted = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const decrypted = decryptPhoto(encrypted.data, encrypted.iv);
        res.set('Content-Type', 'image/jpeg');
        res.send(decrypted);
    } catch (error) {
        console.error('❌ Errore decrittografia:', error);
        res.status(500).json({ error: 'Errore decrittografia' });
    }
});

// === IMPIANTI SEMAFORICI ===

app.get('/api/traffic-lights', authenticateToken, (req, res) => {
    const lights = db.prepare('SELECT * FROM traffic_lights ORDER BY id DESC').all();
    res.json(lights);
});

app.get('/api/traffic-lights/:id', authenticateToken, (req, res) => {
    const light = db.prepare('SELECT * FROM traffic_lights WHERE id = ?').get(req.params.id);
    if (!light) return res.status(404).json({ error: 'Impianto semaforico non trovato' });
    res.json(light);
});

app.post('/api/traffic-lights', authenticateToken, validateBody(createTrafficLightSchema), (req, res) => {
    const { location_name, latitude, longitude, type, status, last_maintenance_date, notes } = req.body;

    const result = db.prepare(`
        INSERT INTO traffic_lights (location_name, latitude, longitude, type, status, last_maintenance_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(location_name, latitude, longitude, type, status || 'operativo', last_maintenance_date || null, notes || null);

    const newLight = db.prepare('SELECT * FROM traffic_lights WHERE id = ?').get(result.lastInsertRowid);

    logAudit(req, 'insert', 'traffic_lights', newLight.id);
    io.emit('trafficlight:created', newLight);

    res.json(newLight);
});

app.put('/api/traffic-lights/:id', authenticateToken, validateBody(updateTrafficLightSchema), (req, res) => {
    const { location_name, latitude, longitude, type, status, last_maintenance_date, notes } = req.body;

    const existing = db.prepare('SELECT * FROM traffic_lights WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Impianto semaforico non trovato' });

    db.prepare(`
        UPDATE traffic_lights
        SET location_name = ?, latitude = ?, longitude = ?, type = ?, status = ?, last_maintenance_date = ?, notes = ?
        WHERE id = ?
    `).run(location_name, latitude, longitude, type, status || existing.status, last_maintenance_date || null, notes || null, req.params.id);

    const updated = db.prepare('SELECT * FROM traffic_lights WHERE id = ?').get(req.params.id);

    logAudit(req, 'update', 'traffic_lights', updated.id);
    io.emit('trafficlight:updated', updated);

    res.json(updated);
});

app.delete('/api/traffic-lights/:id', authenticateToken, requireRole('admin'), (req, res) => {
    const light = db.prepare('SELECT * FROM traffic_lights WHERE id = ?').get(req.params.id);
    if (!light) return res.status(404).json({ error: 'Impianto semaforico non trovato' });

    db.prepare('DELETE FROM traffic_light_interventions WHERE traffic_light_id = ?').run(req.params.id);
    db.prepare('DELETE FROM traffic_lights WHERE id = ?').run(req.params.id);

    logAudit(req, 'delete', 'traffic_lights', req.params.id);
    io.emit('trafficlight:deleted', { id: req.params.id });

    res.json({ success: true });
});

// Interventi di manutenzione sugli impianti semaforici
app.get('/api/traffic-light-interventions', authenticateToken, (req, res) => {
    const interventions = db.prepare(`
        SELECT tli.*, tl.location_name
        FROM traffic_light_interventions tli
        JOIN traffic_lights tl ON tl.id = tli.traffic_light_id
        ORDER BY tli.id DESC
    `).all();
    res.json(interventions);
});

app.post('/api/traffic-light-interventions', authenticateToken, validateBody(createTrafficLightInterventionSchema), (req, res) => {
    const { traffic_light_id, type, scheduled_date, cost, notes } = req.body;

    const light = db.prepare('SELECT id FROM traffic_lights WHERE id = ?').get(traffic_light_id);
    if (!light) return res.status(404).json({ error: 'Impianto semaforico non trovato' });

    const result = db.prepare(`
        INSERT INTO traffic_light_interventions (traffic_light_id, type, scheduled_date, cost, notes)
        VALUES (?, ?, ?, ?, ?)
    `).run(traffic_light_id, type, scheduled_date || null, cost ?? null, notes || null);

    const newIntervention = db.prepare('SELECT * FROM traffic_light_interventions WHERE id = ?').get(result.lastInsertRowid);

    logAudit(req, 'insert', 'traffic_light_interventions', newIntervention.id);
    io.emit('trafficlightintervention:created', newIntervention);

    res.json(newIntervention);
});

app.put('/api/traffic-light-interventions/:id', authenticateToken, validateBody(updateTrafficLightInterventionSchema), (req, res) => {
    const { type, scheduled_date, completed_date, status, cost, notes } = req.body;

    const existing = db.prepare('SELECT * FROM traffic_light_interventions WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Intervento non trovato' });

    db.prepare(`
        UPDATE traffic_light_interventions
        SET type = ?, scheduled_date = ?, completed_date = ?, status = ?, cost = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(type, scheduled_date || null, completed_date || null, status, cost ?? null, notes || null, req.params.id);

    const updated = db.prepare('SELECT * FROM traffic_light_interventions WHERE id = ?').get(req.params.id);

    if (status === 'completato') {
        db.prepare('UPDATE traffic_lights SET last_maintenance_date = ?, status = ? WHERE id = ?')
            .run(completed_date || new Date().toISOString().split('T')[0], 'operativo', existing.traffic_light_id);
    }

    logAudit(req, 'update', 'traffic_light_interventions', updated.id);
    io.emit('trafficlightintervention:updated', updated);

    res.json(updated);
});

app.delete('/api/traffic-light-interventions/:id', authenticateToken, requireRole('admin'), (req, res) => {
    const existing = db.prepare('SELECT * FROM traffic_light_interventions WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Intervento non trovato' });

    db.prepare('DELETE FROM traffic_light_interventions WHERE id = ?').run(req.params.id);

    logAudit(req, 'delete', 'traffic_light_interventions', req.params.id);
    io.emit('trafficlightintervention:deleted', { id: req.params.id });

    res.json({ success: true });
});

// === CONTRATTI, LISTINO PREZZI E IMPEGNI DI SPESA ===

// Contratti
app.get('/api/contracts', authenticateToken, (req, res) => {
    const contracts = db.prepare('SELECT * FROM contracts ORDER BY id DESC').all();
    res.json(contracts);
});

app.post('/api/contracts', authenticateToken, requireRole('admin'), validateBody(createContractSchema), (req, res) => {
    const { cig, company, start_date, end_date, total_budget } = req.body;

    const result = db.prepare(`
        INSERT INTO contracts (cig, company, start_date, end_date, total_budget)
        VALUES (?, ?, ?, ?, ?)
    `).run(cig || null, company, start_date || null, end_date || null, total_budget ?? null);

    const newContract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(result.lastInsertRowid);
    logAudit(req, 'insert', 'contracts', newContract.id);

    res.json(newContract);
});

// Upload PDF accordo quadro + estrazione automatica importi
const contractUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
            cb(null, true);
        } else {
            cb(new Error('Solo file PDF sono accettati'));
        }
    }
});

function extractImportiFromText(text) {
    // Normalizza separatori italiani in numeri: 1.234,56 → 1234.56
    const parseItalian = (s) => parseFloat(s.replace(/\./g, '').replace(',', '.'));

    // Pattern: cifra in formato italiano (1.234,56 o 1234,56)
    const numRe = /\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?/;

    // Cerca importo netto / imponibile
    const nettoMatch = text.match(
        new RegExp(`(?:importo\\s+(?:netto|imponibile|senza\\s+iva)|imponibile|base\\s+d[''']asta)[^\\d€]*?(${numRe.source})`, 'i')
    );
    // Cerca importo lordo / totale compreso IVA
    const lordoMatch = text.match(
        new RegExp(`(?:importo\\s+(?:lordo|complessivo|totale\\s+iva\\s+inclusa|comprensivo\\s+di\\s+iva)|totale\\s+(?:complessivo|a\\s+pagare|accordo))[^\\d€]*?(${numRe.source})`, 'i')
    );
    // Cerca aliquota IVA
    const ivaMatch = text.match(/(\d{1,2})\s*%\s*(?:di\s+)?iva/i) || text.match(/iva\s+(?:al\s+)?(\d{1,2})\s*%/i);

    // Fallback: raccogli tutti gli importi con €
    const allEuro = [...text.matchAll(/€\s*([\d.]+,\d{2})|(?:EUR\s+)([\d.]+,\d{2})/gi)]
        .map(m => parseItalian(m[1] || m[2]))
        .filter(v => !isNaN(v) && v > 100)
        .sort((a, b) => b - a);

    const netto = nettoMatch ? parseItalian(nettoMatch[1]) : null;
    const lordo = lordoMatch ? parseItalian(lordoMatch[1]) : null;
    const iva = ivaMatch ? parseFloat(ivaMatch[1]) : null;

    return {
        importo_netto: !isNaN(netto) ? netto : (allEuro[1] ?? allEuro[0] ?? null),
        importo_lordo: !isNaN(lordo) ? lordo : (allEuro[0] ?? null),
        aliquota_iva: iva,
    };
}

app.post('/api/contracts/:id/upload-pdf', authenticateToken, requireRole('admin', 'tecnico'), contractUpload.single('pdf'), async (req, res) => {
    const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contratto non trovato' });
    if (!req.file) return res.status(400).json({ error: 'Nessun file PDF ricevuto' });

    const pdfParse = createRequire(import.meta.url)('pdf-parse');
    let parsed;
    try {
        parsed = await pdfParse(req.file.buffer);
    } catch (e) {
        return res.status(422).json({ error: 'Impossibile leggere il PDF: ' + e.message });
    }

    // Elimina vecchio PDF se presente
    if (contract.pdf_filename) {
        const old = path.join(contractsDir, contract.pdf_filename);
        if (fs.existsSync(old)) fs.unlinkSync(old);
    }

    const filename = `contract_${contract.id}_${Date.now()}.pdf`;
    fs.writeFileSync(path.join(contractsDir, filename), req.file.buffer);

    const text = (parsed.text || '').replace(/\s+/g, ' ');
    const { importo_netto, importo_lordo, aliquota_iva } = extractImportiFromText(text);

    db.prepare(`
        UPDATE contracts SET pdf_filename = ?, importo_netto = ?, importo_lordo = ?, aliquota_iva = ? WHERE id = ?
    `).run(filename, importo_netto, importo_lordo, aliquota_iva, contract.id);

    const updated = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contract.id);
    logAudit(req, 'update', 'contracts', contract.id, { pdf: req.file.originalname });
    res.json({ ...updated, pdf_original_name: req.file.originalname, extracted_text_preview: text.slice(0, 500) });
});

app.patch('/api/contracts/:id/importi', authenticateToken, requireRole('admin', 'tecnico'), (req, res) => {
    const contract = db.prepare('SELECT id FROM contracts WHERE id = ?').get(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contratto non trovato' });
    const { importo_netto, importo_lordo, aliquota_iva } = req.body;
    db.prepare('UPDATE contracts SET importo_netto = ?, importo_lordo = ?, aliquota_iva = ? WHERE id = ?')
        .run(importo_netto ?? null, importo_lordo ?? null, aliquota_iva ?? null, contract.id);
    res.json(db.prepare('SELECT * FROM contracts WHERE id = ?').get(contract.id));
});

app.get('/api/contracts/:id/pdf', authenticateToken, (req, res) => {
    const contract = db.prepare('SELECT pdf_filename FROM contracts WHERE id = ?').get(req.params.id);
    if (!contract?.pdf_filename) return res.status(404).json({ error: 'Nessun PDF allegato' });
    const filePath = path.join(contractsDir, contract.pdf_filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File non trovato' });
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="accordo_${req.params.id}.pdf"`);
    res.send(fs.readFileSync(filePath));
});

app.delete('/api/contracts/:id/pdf', authenticateToken, requireRole('admin'), (req, res) => {
    const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
    if (!contract?.pdf_filename) return res.status(404).json({ error: 'Nessun PDF allegato' });
    const filePath = path.join(contractsDir, contract.pdf_filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('UPDATE contracts SET pdf_filename = NULL WHERE id = ?').run(contract.id);
    logAudit(req, 'delete', 'contracts', contract.id, { pdf: true });
    res.json({ success: true });
});

// Listino prezzi
app.get('/api/price-list', authenticateToken, (req, res) => {
    const { contract_id } = req.query;
    const items = contract_id
        ? db.prepare('SELECT * FROM price_list WHERE contract_id = ? ORDER BY id DESC').all(contract_id)
        : db.prepare('SELECT * FROM price_list ORDER BY id DESC').all();
    res.json(items);
});

app.post('/api/price-list', authenticateToken, requireRole('admin'), validateBody(createPriceListItemSchema), (req, res) => {
    const { contract_id, item_code, description, unit_price } = req.body;

    const contract = db.prepare('SELECT id FROM contracts WHERE id = ?').get(contract_id);
    if (!contract) return res.status(400).json({ error: 'Contratto non trovato' });

    const result = db.prepare(`
        INSERT INTO price_list (contract_id, item_code, description, unit_price)
        VALUES (?, ?, ?, ?)
    `).run(contract_id, item_code || null, description, unit_price);

    const newItem = db.prepare('SELECT * FROM price_list WHERE id = ?').get(result.lastInsertRowid);
    logAudit(req, 'insert', 'price_list', newItem.id);

    res.json(newItem);
});

// Impegni di spesa
app.get('/api/commitments', authenticateToken, (req, res) => {
    const { contract_id } = req.query;
    const commitments = contract_id
        ? db.prepare('SELECT * FROM expense_commitments WHERE contract_id = ? ORDER BY id DESC').all(contract_id)
        : db.prepare('SELECT * FROM expense_commitments ORDER BY id DESC').all();
    res.json(commitments);
});

app.post('/api/commitments', authenticateToken, requireRole('admin'), validateBody(createCommitmentSchema), (req, res) => {
    const { contract_id, resolution_number, allocated_amount } = req.body;

    const contract = db.prepare('SELECT id FROM contracts WHERE id = ?').get(contract_id);
    if (!contract) return res.status(400).json({ error: 'Contratto non trovato' });

    const result = db.prepare(`
        INSERT INTO expense_commitments (contract_id, resolution_number, allocated_amount, residual_amount)
        VALUES (?, ?, ?, ?)
    `).run(contract_id, resolution_number || null, allocated_amount, allocated_amount);

    const newCommitment = db.prepare('SELECT * FROM expense_commitments WHERE id = ?').get(result.lastInsertRowid);
    logAudit(req, 'insert', 'expense_commitments', newCommitment.id);

    res.json(newCommitment);
});

// Registro incidenti stradali (rilevati dal Comando)
app.get('/api/accident-logs', authenticateToken, (req, res) => {
    const accidentLogs = db.prepare('SELECT * FROM accident_logs ORDER BY date DESC, id DESC').all();
    res.json(accidentLogs);
});

app.post('/api/accident-logs', authenticateToken, requireRole('admin', 'tecnico'), validateBody(createAccidentLogSchema), (req, res) => {
    const { latitude, longitude, date, severity } = req.body;

    const result = db.prepare(`
        INSERT INTO accident_logs (latitude, longitude, date, severity)
        VALUES (?, ?, ?, ?)
    `).run(latitude, longitude, date || null, severity || null);

    const newLog = db.prepare('SELECT * FROM accident_logs WHERE id = ?').get(result.lastInsertRowid);
    logAudit(req, 'insert', 'accident_logs', newLog.id);

    res.json(newLog);
});

app.delete('/api/accident-logs/:id', authenticateToken, requireRole('admin'), (req, res) => {
    const log = db.prepare('SELECT id FROM accident_logs WHERE id = ?').get(req.params.id);
    if (!log) return res.status(404).json({ error: 'Incidente non trovato' });

    db.prepare('DELETE FROM accident_logs WHERE id = ?').run(req.params.id);
    logAudit(req, 'delete', 'accident_logs', req.params.id);

    res.json({ success: true });
});

// Migration: aggiungi colonne mancanti a accident_logs per DB esistenti
try {
    db.prepare("ALTER TABLE accident_logs ADD COLUMN street_name TEXT").run();
} catch {}
try {
    db.prepare("ALTER TABLE accident_logs ADD COLUMN sign_contributing_factor INTEGER DEFAULT 0").run();
} catch {}
try {
    db.prepare("ALTER TABLE accident_logs ADD COLUMN notes TEXT").run();
} catch {}

// Matrice di Priorità Interventi (PriorityScore)
app.get('/api/interventions/priority-matrix', authenticateToken, (req, res) => {
    const SIGN_WEIGHT = { precedenza: 10, pericolo: 8, divieto: 7, obbligo: 5, indicazione: 3, passo_carrabile: 2 };
    const SEVERITY_WEIGHT = { rimosso: 5, danneggiato: 4, da_sostituire: 3, discreto: 2, buono: 1, ottimo: 1 };
    const STREET_WEIGHT_KEYWORDS = ['statale', 'provinciale', 'principale', 'corso', 'viale'];

    const interventions = db.prepare(`
        SELECT i.*, s.type AS sign_type, s.status AS sign_status, s.street_name, s.latitude, s.longitude
        FROM interventions i
        LEFT JOIN signs s ON i.sign_id = s.id
        WHERE i.status IN ('programmato', 'in_corso')
    `).all();

    const result = interventions.map(i => {
        const sw = SIGN_WEIGHT[i.sign_type] ?? 3;
        const sev = SEVERITY_WEIGHT[i.sign_status] ?? 2;
        const street = (i.street_name || '').toLowerCase();
        const streetW = STREET_WEIGHT_KEYWORDS.some(k => street.includes(k)) ? 4 : 2;
        const priorityScore = (sw * sev) + streetW;
        return { ...i, priorityScore };
    });

    result.sort((a, b) => b.priorityScore - a.priorityScore);
    res.json(result);
});

// Correlazione sinistri: incidenti entro 50m da segnali danneggiati/rimossi alla data del sinistro
app.get('/api/analytics/accident-correlation', authenticateToken, (req, res) => {
    const DISTANCE_M = 50;
    const DEG_PER_METER = 1 / 111320;
    const accidents = db.prepare('SELECT * FROM accident_logs ORDER BY date DESC').all();
    const badSigns = db.prepare("SELECT * FROM signs WHERE status IN ('danneggiato','rimosso','da_sostituire') AND valid_to IS NULL").all();

    const result = accidents.map(acc => {
        const nearby = badSigns.filter(s => {
            const dlat = (s.latitude - acc.latitude) / DEG_PER_METER;
            const dlng = (s.longitude - acc.longitude) / (DEG_PER_METER / Math.cos(acc.latitude * Math.PI / 180));
            return Math.sqrt(dlat * dlat + dlng * dlng) <= DISTANCE_M;
        });
        return { ...acc, nearby_damaged_signs: nearby.map(s => ({ id: s.id, type: s.type, status: s.status })) };
    });

    res.json(result);
});

// Segnalazioni all'Ufficio Tributi per passi carrabili non censiti o con
// numero di autorizzazione non corrispondente, generate dalle pattuglie sul campo
app.get('/api/tax-reports', authenticateToken, requireRole('admin', 'tecnico'), (req, res) => {
    const reports = db.prepare(`
        SELECT tr.*, s.numero_autorizzazione AS sign_numero_autorizzazione, s.proprietario AS sign_proprietario
        FROM tax_reports tr
        LEFT JOIN signs s ON s.id = tr.sign_id
        ORDER BY tr.created_at DESC
    `).all();
    res.json(reports);
});

app.post('/api/tax-reports', authenticateToken, validateBody(createTaxReportSchema), (req, res) => {
    const { sign_id, latitude, longitude, numero_rilevato, motivo, note } = req.body;

    if (sign_id) {
        const sign = db.prepare('SELECT id FROM signs WHERE id = ?').get(sign_id);
        if (!sign) return res.status(400).json({ error: 'Segnale non trovato' });
    }

    const result = db.prepare(`
        INSERT INTO tax_reports (sign_id, latitude, longitude, numero_rilevato, motivo, note, reported_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sign_id || null, latitude, longitude, numero_rilevato || null, motivo, note || null, req.user.id);

    const newReport = db.prepare('SELECT * FROM tax_reports WHERE id = ?').get(result.lastInsertRowid);
    logAudit(req, 'insert', 'tax_reports', newReport.id, { motivo, sign_id });

    res.json(newReport);
});

app.put('/api/tax-reports/:id/status', authenticateToken, requireRole('admin', 'tecnico'), (req, res) => {
    const { status } = req.body;
    if (!['aperta', 'in_verifica', 'chiusa'].includes(status)) {
        return res.status(400).json({ error: 'Stato non valido' });
    }

    const report = db.prepare('SELECT id FROM tax_reports WHERE id = ?').get(req.params.id);
    if (!report) return res.status(404).json({ error: 'Segnalazione non trovata' });

    db.prepare('UPDATE tax_reports SET status = ? WHERE id = ?').run(status, req.params.id);
    logAudit(req, 'update', 'tax_reports', req.params.id, { status });

    res.json(db.prepare('SELECT * FROM tax_reports WHERE id = ?').get(req.params.id));
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

// Ottieni singolo intervento
app.get('/api/interventions/:id', authenticateToken, (req, res) => {
    const intervention = db.prepare('SELECT * FROM interventions WHERE id = ?').get(req.params.id);
    if (!intervention) return res.status(404).json({ error: 'Intervento non trovato' });
    res.json(intervention);
});

app.post('/api/interventions', authenticateToken, requireRole('admin', 'tecnico'), validateBody(createInterventionSchema), (req, res) => {
    const { sign_id, type, scheduled_date, price_list_id, quantity, commitment_id, notes } = req.body;

    const priceItem = db.prepare('SELECT * FROM price_list WHERE id = ?').get(price_list_id);
    if (!priceItem) return res.status(400).json({ error: 'Voce di listino non trovata' });

    const cost = priceItem.unit_price * quantity;

    if (commitment_id) {
        const commitment = db.prepare('SELECT * FROM expense_commitments WHERE id = ?').get(commitment_id);
        if (!commitment) return res.status(400).json({ error: 'Impegno di spesa non trovato' });
        if (commitment.residual_amount < cost) {
            return res.status(400).json({ error: 'Capienza Impegno di Spesa Insufficiente' });
        }
    }

    const createIntervention = db.transaction(() => {
        if (commitment_id) {
            db.prepare('UPDATE expense_commitments SET residual_amount = residual_amount - ? WHERE id = ?').run(cost, commitment_id);
        }

        const result = db.prepare(`
            INSERT INTO interventions (sign_id, type, scheduled_date, cost, price_list_id, quantity, commitment_id, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(sign_id, type, scheduled_date, cost, price_list_id, quantity, commitment_id || null, notes);

        return db.prepare('SELECT * FROM interventions WHERE id = ?').get(result.lastInsertRowid);
    });

    const newIntervention = createIntervention();
    io.emit('intervention:created', newIntervention);
    logAudit(req, 'insert', 'interventions', newIntervention.id);

    res.json(newIntervention);
});

// Aggiorna intervento
app.put('/api/interventions/:id', authenticateToken, requireRole('admin', 'tecnico'), validateBody(updateInterventionSchema), (req, res) => {
    const { type, scheduled_date, completed_date, status, notes } = req.body;

    db.prepare(`
        UPDATE interventions
        SET type = ?, scheduled_date = ?, completed_date = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP, richiede_revisione = 0
        WHERE id = ?
    `).run(type, scheduled_date, completed_date || null, status, notes, req.params.id);

    const updated = db.prepare('SELECT * FROM interventions WHERE id = ?').get(req.params.id);
    io.emit('intervention:updated', updated);
    logAudit(req, 'update', 'interventions', updated.id);

    res.json(updated);
});

// Segna un intervento come "richiede revisione" (conflitto di sincronizzazione rilevato dal client)
app.put('/api/interventions/:id/flag-review', authenticateToken, (req, res) => {
    const intervention = db.prepare('SELECT * FROM interventions WHERE id = ?').get(req.params.id);
    if (!intervention) return res.status(404).json({ error: 'Intervento non trovato' });

    db.prepare('UPDATE interventions SET richiede_revisione = 1 WHERE id = ?').run(req.params.id);

    const updated = db.prepare('SELECT * FROM interventions WHERE id = ?').get(req.params.id);
    io.emit('intervention:updated', updated);

    res.json(updated);
});

// Elimina intervento (solo admin)
app.delete('/api/interventions/:id', authenticateToken, requireRole('admin'), (req, res) => {
    db.prepare('DELETE FROM interventions WHERE id = ?').run(req.params.id);
    io.emit('intervention:deleted', { id: req.params.id });
    logAudit(req, 'delete', 'interventions', req.params.id);

    res.json({ success: true });
});

// Reset totale del database - solo admin. Svuota segnali, interventi, appalti/listino/impegni,
// foto e coda di sincronizzazione per permettere un inserimento dati pulito da zero.
// Gli account utente vengono mantenuti per non perdere gli accessi.
app.post('/api/admin/reset-database', authenticateToken, requireRole('admin'), (req, res) => {
    if (req.body?.confirm !== 'RESET') {
        return res.status(400).json({ error: 'Conferma mancante. Inviare { "confirm": "RESET" } per procedere.' });
    }

    const tablesToClear = ['interventions', 'expense_commitments', 'price_list', 'contracts', 'signs', 'sync_queue', 'audit_log', 'accident_logs', 'tax_reports'];

    try {
        const hasSequenceTable = !!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'").get();

        const resetDatabase = db.transaction(() => {
            for (const table of tablesToClear) {
                db.prepare(`DELETE FROM ${table}`).run();
                if (hasSequenceTable) {
                    db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(table);
                }
            }
        });
        resetDatabase();

        // Elimina tutte le foto salvate su disco
        for (const file of fs.readdirSync(photosDir)) {
            fs.unlinkSync(path.join(photosDir, file));
        }

        logAudit(req, 'reset', 'database', null, { resetBy: req.user.username });

        io.emit('database:reset');

        res.json({ success: true, message: 'Database resettato con successo' });
    } catch (error) {
        console.error('Errore durante il reset del database:', error);
        res.status(500).json({ error: 'Errore durante il reset del database: ' + error.message });
    }
});

// Registro attività (audit log) - solo admin
app.get('/api/audit-log', authenticateToken, requireRole('admin'), (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 200, 1000);
    const logs = db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?').all(limit);
    res.json(logs);
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

// Serve il frontend compilato (Electron / produzione standalone)
const distDir = process.env.CATASTO_DIST_DIR || path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^(?!\/api|\/socket\.io).*/, (req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
    });
}

// Restituisce gli indirizzi IPv4 locali di tutte le interfacce di rete
function getLocalIPs() {
    const ips = [];
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push({ name, address: iface.address });
            }
        }
    }
    return ips;
}

// Middleware errori Express — SQLITE_BUSY → 423
app.use((err, req, res, next) => {
    if (err?.code === 'SQLITE_BUSY' || err?.code === 'SQLITE_LOCKED') {
        return res.status(423).json({ error: 'Database temporaneamente occupato, riprova tra poco' });
    }
    console.error('[SERVER ERROR]', err);
    res.status(500).json({ error: err.message || 'Errore interno del server' });
});

// Avvia server
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server Catasto Segnaletica avviato!`);
    console.log(`📡 HTTP Server: http://localhost:${PORT}`);

    const localIPs = getLocalIPs();
    if (localIPs.length > 0) {
        console.log('📡 Indirizzi di rete disponibili (da usare sullo smartphone):');
        for (const { name, address } of localIPs) {
            console.log(`   - http://${address}:${PORT}  (${name})`);
        }
    } else {
        console.log('⚠️  Nessuna interfaccia di rete esterna trovata');
    }

    console.log(`🔌 WebSocket Server: ws://localhost:${PORT}`);
    console.log(`🔐 Database: ${path.join(dataDir, 'catasto.db')}`);
    console.log(`📁 Foto crittografate: ${photosDir}\n`);

    console.log(`[BOOT] Server pronto: ${(performance.now() - _bootT0).toFixed(0)}ms totali`);
    initAiEngine();
});
