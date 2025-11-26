// Servizio per gestire lo storage locale con IndexedDB
import { openDB } from 'idb';
import CryptoJS from 'crypto-js';

const DB_NAME = 'CatastoSegnaleticaDB';
const DB_VERSION = 1;
const ENCRYPTION_KEY = 'catasto-local-key-2024'; // In produzione, usa una chiave più sicura

class LocalStorageService {
    constructor() {
        this.db = null;
        this.initDB();
    }

    async initDB() {
        this.db = await openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                // Store per i segnali
                if (!db.objectStoreNames.contains('signs')) {
                    const signsStore = db.createObjectStore('signs', { keyPath: 'id', autoIncrement: true });
                    signsStore.createIndex('synced', 'synced');
                    signsStore.createIndex('created_at', 'created_at');
                }

                // Store per le foto (crittografate)
                if (!db.objectStoreNames.contains('photos')) {
                    db.createObjectStore('photos', { keyPath: 'signId' });
                }

                // Store per gli interventi
                if (!db.objectStoreNames.contains('interventions')) {
                    const interventionsStore = db.createObjectStore('interventions', { keyPath: 'id', autoIncrement: true });
                    interventionsStore.createIndex('sign_id', 'sign_id');
                    interventionsStore.createIndex('synced', 'synced');
                }

                // Queue di sincronizzazione
                if (!db.objectStoreNames.contains('syncQueue')) {
                    const queueStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
                    queueStore.createIndex('processed', 'processed');
                    queueStore.createIndex('created_at', 'created_at');
                }
            }
        });
    }

    // === SIGNS ===
    async saveSigns(signs) {
        const db = await this.db;
        const tx = db.transaction('signs', 'readwrite');
        for (const sign of signs) {
            await tx.store.put(sign);
        }
        await tx.done;
    }

    async saveSign(sign) {
        const db = await this.db;
        sign.synced = false;
        sign.created_at = sign.created_at || new Date().toISOString();
        const id = await db.put('signs', sign);

        // Aggiungi alla queue di sincronizzazione
        await this.addToSyncQueue('create', 'signs', id, sign);

        return id;
    }

    async getSigns() {
        const db = await this.db;
        return await db.getAll('signs');
    }

    async getSign(id) {
        const db = await this.db;
        return await db.get('signs', id);
    }

    async updateSign(id, signData) {
        const db = await this.db;
        const sign = await db.get('signs', id);
        const updated = { ...sign, ...signData, synced: false, updated_at: new Date().toISOString() };
        await db.put('signs', updated);

        await this.addToSyncQueue('update', 'signs', id, updated);

        return updated;
    }

    async deleteSign(id) {
        const db = await this.db;
        await db.delete('signs', id);
        await db.delete('photos', id);

        await this.addToSyncQueue('delete', 'signs', id);
    }

    // === PHOTOS ===
    async savePhoto(signId, photoDataUrl) {
        const db = await this.db;
        // Crittografa la foto prima di salvarla
        const encrypted = CryptoJS.AES.encrypt(photoDataUrl, ENCRYPTION_KEY).toString();
        await db.put('photos', { signId, data: encrypted });
    }

    async getPhoto(signId) {
        const db = await this.db;
        const photo = await db.get('photos', signId);
        if (!photo) return null;

        // Decrittografa la foto
        const decrypted = CryptoJS.AES.decrypt(photo.data, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
        return decrypted;
    }

    // === INTERVENTIONS ===
    async saveIntervention(intervention) {
        const db = await this.db;
        intervention.synced = false;
        intervention.created_at = intervention.created_at || new Date().toISOString();
        const id = await db.put('interventions', intervention);

        await this.addToSyncQueue('create', 'interventions', id, intervention);

        return id;
    }

    async getInterventions() {
        const db = await this.db;
        return await db.getAll('interventions');
    }

    // === SYNC QUEUE ===
    async addToSyncQueue(operation, tableName, recordId, data = null) {
        const db = await this.db;
        await db.add('syncQueue', {
            operation,
            tableName,
            recordId,
            data: data ? JSON.stringify(data) : null,
            created_at: new Date().toISOString(),
            processed: false
        });
    }

    async getSyncQueue() {
        const db = await this.db;
        const allItems = await db.getAll('syncQueue');
        // Filtra manualmente gli elementi non processati
        return allItems.filter(item => item.processed === false);
    }

    async markSyncQueueProcessed(id) {
        const db = await this.db;
        const item = await db.get('syncQueue', id);
        if (item) {
            item.processed = true;
            await db.put('syncQueue', item);
        }
    }

    async clearSyncQueue() {
        const db = await this.db;
        const tx = db.transaction('syncQueue', 'readwrite');
        await tx.store.clear();
        await tx.done;
    }

    // === STATS ===
    async getStats() {
        const db = await this.db;
        const signs = await db.getAll('signs');
        const interventions = await db.getAll('interventions');
        const syncQueue = await this.getSyncQueue();

        return {
            totalSigns: signs.length,
            unsyncedSigns: signs.filter(s => !s.synced).length,
            totalInterventions: interventions.length,
            pendingSync: syncQueue.length
        };
    }

    // === CLEAR ALL ===
    async clearAll() {
        const db = await this.db;
        const tx = db.transaction(['signs', 'photos', 'interventions', 'syncQueue'], 'readwrite');
        await tx.objectStore('signs').clear();
        await tx.objectStore('photos').clear();
        await tx.objectStore('interventions').clear();
        await tx.objectStore('syncQueue').clear();
        await tx.done;
    }
}

export default new LocalStorageService();
