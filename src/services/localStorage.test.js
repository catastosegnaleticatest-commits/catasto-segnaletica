import { describe, it, expect, beforeEach } from 'vitest';
import CryptoJS from 'crypto-js';
import localStorageService from './localStorage';

// Garantisce uno stato pulito di IndexedDB prima di ogni test
async function resetDB() {
    await localStorageService.initDB();
    await localStorageService.clearAll();
}

describe('LocalStorageService - cifratura foto', () => {
    beforeEach(async () => {
        await resetDB();
    });

    it('salva la foto in forma crittografata (diversa dal dato originale)', async () => {
        const signId = 1;
        const photoDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD==';

        await localStorageService.savePhoto(signId, photoDataUrl);

        const db = await localStorageService.db;
        const stored = await db.get('photos', signId);

        expect(stored).toBeDefined();
        expect(stored.data).not.toEqual(photoDataUrl);
        // Il payload salvato deve essere un cifrato CryptoJS, non il dataURL originale
        expect(stored.data.startsWith('data:image')).toBe(false);
    });

    it('decritta correttamente la foto salvata (round-trip)', async () => {
        const signId = 2;
        const photoDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD==';

        await localStorageService.savePhoto(signId, photoDataUrl);
        const decrypted = await localStorageService.getPhoto(signId);

        expect(decrypted).toBe(photoDataUrl);
    });

    it('ritorna null se la foto non esiste', async () => {
        const result = await localStorageService.getPhoto(999);
        expect(result).toBeNull();
    });

    it('usa la chiave di cifratura del servizio (cifrati con chiavi diverse non sono decifrabili allo stesso modo)', async () => {
        const signId = 3;
        const photoDataUrl = 'data:image/jpeg;base64,ABCDEF==';
        await localStorageService.savePhoto(signId, photoDataUrl);

        const db = await localStorageService.db;
        const stored = await db.get('photos', signId);

        // Decifrando con una chiave errata non si deve ottenere il dato originale
        const wrongDecryption = CryptoJS.AES.decrypt(stored.data, 'chiave-sbagliata').toString(CryptoJS.enc.Utf8);
        expect(wrongDecryption).not.toBe(photoDataUrl);
    });
});

describe('LocalStorageService - coda di sincronizzazione (syncQueue)', () => {
    beforeEach(async () => {
        await resetDB();
    });

    it('aggiunge una nuova operazione alla coda', async () => {
        await localStorageService.addToSyncQueue('create', 'signs', 1, { type: 'stop' });

        const queue = await localStorageService.getSyncQueue();
        expect(queue).toHaveLength(1);
        expect(queue[0]).toMatchObject({
            operation: 'create',
            tableName: 'signs',
            recordId: 1,
            processed: false,
        });
    });

    it('getSyncQueue restituisce solo le operazioni non processate', async () => {
        await localStorageService.addToSyncQueue('create', 'signs', 1, { type: 'stop' });
        await localStorageService.addToSyncQueue('create', 'signs', 2, { type: 'divieto' });

        let queue = await localStorageService.getSyncQueue();
        expect(queue).toHaveLength(2);

        await localStorageService.markSyncQueueProcessed(queue[0].id);

        queue = await localStorageService.getSyncQueue();
        expect(queue).toHaveLength(1);
        expect(queue[0].recordId).toBe(2);
    });

    it('create + delete sullo stesso record annullano entrambe le operazioni', async () => {
        await localStorageService.addToSyncQueue('create', 'signs', 10, { type: 'stop' });
        await localStorageService.addToSyncQueue('delete', 'signs', 10);

        const queue = await localStorageService.getSyncQueue();
        expect(queue).toHaveLength(0);
    });

    it('create + update fonde l\'update nei dati della create', async () => {
        await localStorageService.addToSyncQueue('create', 'signs', 11, { type: 'stop', notes: 'iniziale' });
        await localStorageService.addToSyncQueue('update', 'signs', 11, { type: 'stop', notes: 'aggiornata' });

        const queue = await localStorageService.getSyncQueue();
        expect(queue).toHaveLength(1);
        expect(queue[0].operation).toBe('create');
        expect(JSON.parse(queue[0].data)).toMatchObject({ notes: 'aggiornata' });
    });

    it('update + update mantiene solo l\'ultimo aggiornamento', async () => {
        await localStorageService.addToSyncQueue('update', 'signs', 12, { notes: 'primo' });
        await localStorageService.addToSyncQueue('update', 'signs', 12, { notes: 'secondo' });

        const queue = await localStorageService.getSyncQueue();
        expect(queue).toHaveLength(1);
        expect(queue[0].operation).toBe('update');
        expect(JSON.parse(queue[0].data)).toMatchObject({ notes: 'secondo' });
    });

    it('update + delete mantiene solo la delete', async () => {
        await localStorageService.addToSyncQueue('update', 'signs', 13, { notes: 'modifica' });
        await localStorageService.addToSyncQueue('delete', 'signs', 13);

        const queue = await localStorageService.getSyncQueue();
        expect(queue).toHaveLength(1);
        expect(queue[0].operation).toBe('delete');
    });

    it('operazioni su record diversi rimangono indipendenti', async () => {
        await localStorageService.addToSyncQueue('create', 'signs', 20, { type: 'stop' });
        await localStorageService.addToSyncQueue('update', 'signs', 21, { notes: 'altro record' });

        const queue = await localStorageService.getSyncQueue();
        expect(queue).toHaveLength(2);
        const recordIds = queue.map(q => q.recordId).sort();
        expect(recordIds).toEqual([20, 21]);
    });

    it('clearSyncQueue svuota completamente la coda', async () => {
        await localStorageService.addToSyncQueue('create', 'signs', 30, { type: 'stop' });
        await localStorageService.addToSyncQueue('create', 'interventions', 31, { type: 'manutenzione' });

        await localStorageService.clearSyncQueue();

        const queue = await localStorageService.getSyncQueue();
        expect(queue).toHaveLength(0);
    });
});

describe('LocalStorageService - operazioni su signs e queue associata', () => {
    beforeEach(async () => {
        await resetDB();
    });

    it('saveSign marca il segnale come non sincronizzato e accoda una create', async () => {
        const id = await localStorageService.saveSign({ type: 'stop', latitude: 45.1, longitude: 9.1 });

        const sign = await localStorageService.getSign(id);
        expect(sign.synced).toBe(false);

        const queue = await localStorageService.getSyncQueue();
        expect(queue).toHaveLength(1);
        expect(queue[0].operation).toBe('create');
        expect(queue[0].tableName).toBe('signs');
        expect(queue[0].recordId).toBe(id);
    });

    it('updateSign aggiorna il record, lo marca non sincronizzato e accoda un update', async () => {
        const id = await localStorageService.saveSign({ type: 'stop', latitude: 45.1, longitude: 9.1, synced: true });
        await localStorageService.markSyncQueueProcessed((await localStorageService.getSyncQueue())[0].id);

        const updated = await localStorageService.updateSign(id, { notes: 'danneggiato' });

        expect(updated.notes).toBe('danneggiato');
        expect(updated.synced).toBe(false);

        const queue = await localStorageService.getSyncQueue();
        expect(queue).toHaveLength(1);
        expect(queue[0].operation).toBe('update');
        expect(queue[0].recordId).toBe(id);
    });

    it('deleteSign rimuove il segnale e la foto associata, e accoda una delete', async () => {
        const id = await localStorageService.saveSign({ type: 'stop', latitude: 45.1, longitude: 9.1, synced: true });
        await localStorageService.savePhoto(id, 'data:image/jpeg;base64,ABC==');
        await localStorageService.markSyncQueueProcessed((await localStorageService.getSyncQueue())[0].id);

        await localStorageService.deleteSign(id);

        expect(await localStorageService.getSign(id)).toBeUndefined();
        expect(await localStorageService.getPhoto(id)).toBeNull();

        const queue = await localStorageService.getSyncQueue();
        expect(queue).toHaveLength(1);
        expect(queue[0].operation).toBe('delete');
        expect(queue[0].recordId).toBe(id);
    });

    it('getStats riflette segnali totali, non sincronizzati e operazioni in coda', async () => {
        await localStorageService.saveSign({ type: 'stop', latitude: 45.1, longitude: 9.1 });
        await localStorageService.saveSign({ type: 'divieto', latitude: 45.2, longitude: 9.2 });

        const stats = await localStorageService.getStats();

        expect(stats.totalSigns).toBe(2);
        expect(stats.unsyncedSigns).toBe(2);
        expect(stats.pendingSync).toBe(2);
    });
});
