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

        // IMPORTANTE: Non sovrascrivere tutto! Unisci i dati dal server con quelli locali
        const existingSigns = await db.getAll('signs');
        const existingMap = new Map(existingSigns.map(s => [s.id, s]));
        const serverIds = new Set(signs.map(s => s.id));

        const tx = db.transaction('signs', 'readwrite');

        for (const serverSign of signs) {
            const localSign = existingMap.get(serverSign.id);

            // Se il segnale esiste localmente E ha modifiche non sincronizzate, MANTIENI la versione locale
            if (localSign && !localSign.synced) {
                console.log(`⚠️ Mantengo versione locale di segnale ${serverSign.id} (ha modifiche non sincronizzate)`);
                continue; // Salta questo segnale, mantieni la versione locale
            }

            // Altrimenti, usa la versione del server (è più aggiornata)
            await tx.store.put({ ...serverSign, synced: true });
            existingMap.delete(serverSign.id); // Rimuovi dalla mappa (già processato)
        }

        // ELIMINAZIONI: Se un segnale esiste localmente, è sincronizzato, ma NON è sul server → è stato eliminato
        for (const [id, localSign] of existingMap.entries()) {
            if (localSign.synced && !serverIds.has(id)) {
                console.log(`🗑️ Rimuovo segnale ${id} (eliminato dal server)`);
                await tx.store.delete(id);
                // Rimuovi anche la foto associata
                await db.delete('photos', id);
            }
        }

        await tx.done;

        // Log per debug
        const remainingLocal = Array.from(existingMap.values()).filter(s => !s.synced);
        if (remainingLocal.length > 0) {
            console.log(`📝 ${remainingLocal.length} segnali locali non sincronizzati mantenuti`);
        }
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

        // OTTIMIZZAZIONE: Se sto per aggiungere un'operazione, controlla se ci sono operazioni precedenti sullo stesso record
        const existingQueue = await db.getAll('syncQueue');
        const pendingOps = existingQueue.filter(item =>
            !item.processed &&
            item.tableName === tableName &&
            item.recordId === recordId
        );

        // LOGICA DI CANCELLAZIONE:
        // - create + delete = rimuovi entrambi (il record non è mai esistito sul server)
        // - create + update = mantieni solo create con i dati aggiornati
        // - update + delete = mantieni solo delete

        if (operation === 'delete' && pendingOps.length > 0) {
            // Se sto eliminando e c'era un 'create' in coda, annulla entrambi
            const createOp = pendingOps.find(op => op.operation === 'create');
            if (createOp) {
                console.log(`🔄 Ottimizzazione: create+delete annullati per record ${recordId}`);
                await db.delete('syncQueue', createOp.id);
                return; // Non aggiungere il delete
            }

            // Se c'erano update, rimuovili (il delete li sostituisce)
            for (const op of pendingOps.filter(op => op.operation === 'update')) {
                await db.delete('syncQueue', op.id);
            }
        }

        if (operation === 'update' && pendingOps.length > 0) {
            const createOp = pendingOps.find(op => op.operation === 'create');
            if (createOp) {
                // Aggiorna il create con i nuovi dati invece di aggiungere un update
                console.log(`🔄 Ottimizzazione: update fuso in create per record ${recordId}`);
                createOp.data = data ? JSON.stringify(data) : null;
                await db.put('syncQueue', createOp);
                return;
            }

            // Rimuovi eventuali update precedenti (mantieni solo l'ultimo)
            for (const op of pendingOps.filter(op => op.operation === 'update')) {
                await db.delete('syncQueue', op.id);
            }
        }

        // Aggiungi la nuova operazione
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

            // IMPORTANTE: Aggiorna anche il campo synced del segnale/intervento corrispondente
            if (item.tableName === 'signs' && item.recordId) {
                const sign = await db.get('signs', item.recordId);
                if (sign) {
                    sign.synced = true;
                    await db.put('signs', sign);
                }
            } else if (item.tableName === 'interventions' && item.recordId) {
                const intervention = await db.get('interventions', item.recordId);
                if (intervention) {
                    intervention.synced = true;
                    await db.put('interventions', intervention);
                }
            }
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
    // === FORCE RESYNC ===
    async resetSyncStatus() {
        const db = await this.db;
        const tx = db.transaction(['signs', 'interventions', 'syncQueue'], 'readwrite');

        // 1. Reset Segnali
        let cursor = await tx.objectStore('signs').openCursor();
        while (cursor) {
            const sign = cursor.value;
            sign.synced = false;
            await cursor.update(sign);

            // Aggiungi a syncQueue
            await tx.objectStore('syncQueue').add({
                operation: 'create', // Usa create per sicurezza se il server è vuoto
                tableName: 'signs',
                recordId: sign.id,
                data: JSON.stringify(sign),
                created_at: new Date().toISOString(),
                processed: false
            });

            cursor = await cursor.continue();
        }

        // 2. Reset Interventi
        cursor = await tx.objectStore('interventions').openCursor();
        while (cursor) {
            const intervention = cursor.value;
            intervention.synced = false;
            await cursor.update(intervention);

            await tx.objectStore('syncQueue').add({
                operation: 'create',
                tableName: 'interventions',
                recordId: intervention.id,
                data: JSON.stringify(intervention),
                created_at: new Date().toISOString(),
                processed: false
            });

            cursor = await cursor.continue();
        }

        await tx.done;
        console.log('🔄 Sync status resettato: tutti i dati pronti per upload');
    }
}

export default new LocalStorageService();
