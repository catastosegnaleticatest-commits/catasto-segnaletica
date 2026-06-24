// Servizio per gestire la sincronizzazione tra locale e server
import apiService from './api';
import localStorageService from './localStorage';

class SyncService {
    constructor() {
        this.isSyncing = false;
        this.syncListeners = [];
        this.statusListeners = [];
    }

    // Aggiungi listener per eventi di sync
    onSyncEvent(callback) {
        this.syncListeners.push(callback);
        return () => {
            this.syncListeners = this.syncListeners.filter(cb => cb !== callback);
        };
    }

    // Aggiungi listener per cambiamenti di stato
    onStatusChange(callback) {
        this.statusListeners.push(callback);
        return () => {
            this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
        };
    }

    // Notifica listeners
    notifySyncEvent(event, data) {
        this.syncListeners.forEach(cb => cb(event, data));
    }

    notifyStatusChange(status) {
        this.statusListeners.forEach(cb => cb(status));
    }

    // Verifica se il server è online
    async checkServerStatus() {
        try {
            const status = await apiService.getServerStatus();
            this.notifyStatusChange({ online: true, ...status });
            return true;
        } catch (error) {
            this.notifyStatusChange({ online: false, error: error.message });
            return false;
        }
    }

    // Sincronizza dal server al locale (download)
    async syncFromServer() {
        try {
            this.notifySyncEvent('download:start');

            // Scarica tutti i segnali
            const signs = await apiService.getSigns();
            await localStorageService.saveSigns(signs);

            // Scarica tutti gli interventi
            const interventions = await apiService.getInterventions();
            for (const intervention of interventions) {
                await localStorageService.saveIntervention({ ...intervention, synced: true });
            }

            this.notifySyncEvent('download:complete', { signs: signs.length, interventions: interventions.length });
            return { success: true, signs: signs.length, interventions: interventions.length };
        } catch (error) {
            this.notifySyncEvent('download:error', error);
            throw error;
        }
    }

    // Confronta i timestamp di modifica locale e server per applicare la strategia Last-Write-Wins.
    // Ritorna true se il record locale è più recente (o uguale) e può essere inviato senza conflitti,
    // false se il server ha una versione più recente (conflitto: il record va segnalato per revisione).
    isLocalNewerOrEqual(localData, serverRecord) {
        const localTimestamp = new Date(localData?.updated_at || localData?.created_at || 0).getTime();
        const serverTimestamp = new Date(serverRecord?.updated_at || serverRecord?.created_at || 0).getTime();
        return localTimestamp >= serverTimestamp;
    }

    // Gestisce un conflitto: il server ha una versione più recente di quella locale.
    // La modifica offline viene scartata (LWW: vince il server) e il record viene
    // marcato richiede_revisione=1 per il controllo da desktop.
    async handleConflict(tableName, recordId) {
        console.warn(`⚠️ Conflitto rilevato su ${tableName} #${recordId}: il server ha una versione più recente. Segnalato per revisione.`);

        if (tableName === 'signs') {
            await apiService.flagSignForReview(recordId);
        } else if (tableName === 'interventions') {
            await apiService.flagInterventionForReview(recordId);
        }

        this.notifySyncEvent('sync:conflict', { tableName, recordId });
    }

    // Sincronizza dal locale al server (upload)
    async syncToServer() {
        try {
            this.notifySyncEvent('upload:start');

            const queue = await localStorageService.getSyncQueue();
            let uploaded = 0;
            let failed = 0;
            let conflicts = 0;
            const errors = [];

            for (const item of queue) {
                try {
                    const data = item.data ? JSON.parse(item.data) : null;

                    if (item.tableName === 'signs') {
                        if (item.operation === 'create') {
                            await apiService.createSign(data);
                        } else if (item.operation === 'update') {
                            // Risoluzione conflitti Last-Write-Wins basata su updated_at
                            let serverSign = null;
                            try {
                                serverSign = await apiService.getSign(item.recordId);
                            } catch {
                                // Record non trovato sul server: nessun conflitto, procedi con l'update
                            }

                            if (serverSign && !this.isLocalNewerOrEqual(data, serverSign)) {
                                // Il server è più recente: la modifica offline viene scartata
                                await this.handleConflict('signs', item.recordId);
                                conflicts++;
                            } else {
                                await apiService.updateSign(item.recordId, data);
                            }
                        } else if (item.operation === 'delete') {
                            await apiService.deleteSign(item.recordId);
                        }
                    } else if (item.tableName === 'interventions') {
                        if (item.operation === 'create') {
                            await apiService.createIntervention(data);
                        } else if (item.operation === 'update') {
                            // Risoluzione conflitti Last-Write-Wins basata su updated_at
                            let serverIntervention = null;
                            try {
                                serverIntervention = await apiService.getIntervention(item.recordId);
                            } catch {
                                // Record non trovato sul server: nessun conflitto, procedi con l'update
                            }

                            if (serverIntervention && !this.isLocalNewerOrEqual(data, serverIntervention)) {
                                // Il server è più recente: la modifica offline viene scartata
                                await this.handleConflict('interventions', item.recordId);
                                conflicts++;
                            } else {
                                await apiService.updateIntervention(item.recordId, data);
                            }
                        } else if (item.operation === 'delete') {
                            await apiService.deleteIntervention(item.recordId);
                        }
                    }

                    await localStorageService.markSyncQueueProcessed(item.id);
                    uploaded++;
                } catch (error) {
                    failed++;
                    const errorMsg = `${item.tableName} (${item.operation}): ${error.message}`;
                    errors.push(errorMsg);
                    console.error('Errore sincronizzazione item:', item, error);
                    // Continua con il prossimo item
                }
            }

            if (failed > 0) {
                this.notifySyncEvent('upload:partial', { uploaded, failed, conflicts, errors });
            } else {
                this.notifySyncEvent('upload:complete', { uploaded, conflicts });
            }

            return { success: true, uploaded, failed, conflicts, errors };
        } catch (error) {
            this.notifySyncEvent('upload:error', error);
            throw error;
        }
    }

    // Sincronizzazione bidirezionale completa
    async fullSync() {
        if (this.isSyncing) {
            console.log('Sincronizzazione già in corso...');
            return;
        }

        this.isSyncing = true;
        this.notifySyncEvent('sync:start');

        try {
            // Verifica connessione server
            const serverStatus = await apiService.getServerStatus();
            this.notifyStatusChange({ online: true, ...serverStatus });

            // CHECK: Se il server è vuoto ma noi abbiamo dati, forza il re-upload
            const localStats = await localStorageService.getStats();
            if (serverStatus.totalSigns === 0 && localStats.totalSigns > 0) {
                console.warn('⚠️ Rilevato reset del server! Forzo il re-upload dei dati locali...');
                await localStorageService.resetSyncStatus();
            }

            // 1. Upload dati locali non sincronizzati
            const uploadResult = await this.syncToServer();

            // 2. Download dati dal server
            const downloadResult = await this.syncFromServer();

            this.notifySyncEvent('sync:complete', { upload: uploadResult, download: downloadResult });

            return {
                success: true,
                uploaded: uploadResult.uploaded,
                downloaded: downloadResult.signs + downloadResult.interventions
            };
        } catch (error) {
            this.notifySyncEvent('sync:error', error);
            throw error;
        } finally {
            this.isSyncing = false;
        }
    }

    // Ottieni statistiche di sincronizzazione
    async getSyncStats() {
        const localStats = await localStorageService.getStats();
        let serverStats = null;

        try {
            serverStats = await apiService.getServerStatus();
        } catch (error) {
            // Server offline
        }

        return {
            local: localStats,
            server: serverStats,
            needsSync: localStats.pendingSync > 0
        };
    }
}

export default new SyncService();
