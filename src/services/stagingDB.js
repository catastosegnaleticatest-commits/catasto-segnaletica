import { openDB } from 'idb';

const DB_NAME = 'ai_staging_v1';
const STORE = 'detections';

async function getDB() {
    return openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE)) {
                const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
                store.createIndex('status', 'status');
                store.createIndex('captured_at', 'captured_at');
            }
        }
    });
}

export const stagingDB = {
    async add(record) {
        const db = await getDB();
        return db.add(STORE, {
            ...record,
            status: 'DA_CONTROLLARE',
            captured_at: new Date().toISOString(),
        });
    },
    async getAll() {
        const db = await getDB();
        return db.getAll(STORE);
    },
    async get(id) {
        const db = await getDB();
        return db.get(STORE, id);
    },
    async update(id, updates) {
        const db = await getDB();
        const existing = await db.get(STORE, id);
        if (!existing) return;
        return db.put(STORE, { ...existing, ...updates });
    },
    async delete(id) {
        const db = await getDB();
        return db.delete(STORE, id);
    },
    async clear() {
        const db = await getDB();
        return db.clear(STORE);
    },
    async count() {
        const db = await getDB();
        return db.count(STORE);
    },
};
