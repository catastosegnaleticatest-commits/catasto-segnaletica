import { useState, useEffect } from 'react';
import syncService from '../services/sync';
import localStorageService from '../services/localStorage';
import apiService from '../services/api';
import MobileMapView from './MobileMapView';
import MobileAddSign from './MobileAddSign';
import MobileArchive from './MobileArchive';
import MobileSignDetails from './MobileSignDetails';
import MobilePassoCarrabileCheck from './MobilePassoCarrabileCheck';
import MobileVerifySign from './MobileVerifySign';
import { getCensusSession, startCensusSession, closeCensusSession } from '../utils/censusSession';
import ARScanView from './ARScanView';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const LOW_STORAGE_THRESHOLD = 100 * 1024 * 1024; // 100MB

function MobileHome({ user, syncStatus, stats, onDataChange }) {
    const [currentView, setCurrentView] = useState('home');
    const [selectedSign, setSelectedSign] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [serverUrl, setServerUrl] = useState(apiService.getApiUrl());
    const [showServerConfig, setShowServerConfig] = useState(false);
    const [storageWarning, setStorageWarning] = useState(null);
    const [censusSession, setCensusSession] = useState(() => getCensusSession());
    const [showCensusForm, setShowCensusForm] = useState(false);
    const [censusForm, setCensusForm] = useState({ via_predefinita: '', ordinanza_predefinita: '' });

    useEffect(() => {
        const checkStorage = async () => {
            const estimate = await localStorageService.getStorageEstimate();
            if (estimate && estimate.available < LOW_STORAGE_THRESHOLD) {
                setStorageWarning(estimate);
            } else {
                setStorageWarning(null);
            }
        };
        checkStorage();
    }, [stats]);

    const handleOpenDetails = (sign) => {
        setSelectedSign(sign);
        setCurrentView('details');
    };

    const handleForceSync = async () => {
        if (!confirm('Vuoi forzare il caricamento di tutti i dati locali sul server?')) return;

        setIsSyncing(true);
        try {
            await localStorageService.resetSyncStatus();
            await syncService.fullSync();
            if (onDataChange) onDataChange();
            alert('Sincronizzazione completata!');
        } catch (error) {
            console.error('Errore sync:', error);
            alert('Errore durante la sincronizzazione: ' + error.message);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleUsbSync = async () => {
        setIsSyncing(true);
        try {
            await syncService.fullSync();
            if (onDataChange) onDataChange();
            alert('Sincronizzazione via cavo completata!');
        } catch (error) {
            console.error('Errore sync USB:', error);
            alert('Errore durante la sincronizzazione: ' + error.message);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleExportJson = async () => {
        try {
            const data = await localStorageService.exportAllForUsb();
            const unsyncedCount = data.signs.filter(s => !s.synced).length;
            if (unsyncedCount === 0) {
                if (!confirm('Non ci sono segnali nuovi da esportare. Esportare comunque tutti i dati?')) return;
            }
            const json = JSON.stringify(data, null, 2);
            const fileName = `catasto_mobile_${new Date().toISOString().slice(0, 10)}.json`;

            if (Capacitor.isNativePlatform()) {
                // APK: salva su cache del dispositivo poi condividi
                await Filesystem.writeFile({
                    path: fileName,
                    data: json,
                    directory: Directory.Cache,
                    encoding: Encoding.UTF8,
                });
                const uriResult = await Filesystem.getUri({
                    path: fileName,
                    directory: Directory.Cache,
                });
                await Share.share({
                    title: 'Dati Catasto Mobile',
                    text: `Export dati campo del ${new Date().toLocaleDateString('it-IT')} — ${data.signs.length} segnali`,
                    url: uriResult.uri,
                    dialogTitle: 'Condividi o salva il file JSON',
                });
            } else {
                // Browser / PWA: download diretto
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                alert(`Esportati ${data.signs.length} segnali (${unsyncedCount} nuovi) e ${data.interventions.length} interventi.`);
            }
        } catch (e) {
            alert('Errore durante l\'esportazione: ' + e.message);
        }
    };

    const handleStartCensusSession = () => {
        if (!censusForm.via_predefinita.trim()) {
            alert('Inserire la via predefinita per avviare la sessione.');
            return;
        }
        const session = startCensusSession(censusForm);
        setCensusSession(session);
        setShowCensusForm(false);
    };

    const handleCloseCensusSession = () => {
        if (!confirm('Chiudere la sessione di censimento?')) return;
        closeCensusSession();
        setCensusSession(null);
        setCensusForm({ via_predefinita: '', ordinanza_predefinita: '' });
    };

    const handleSaveServerUrl = () => {
        apiService.setApiUrl(serverUrl);
        apiService.connectSocket();
        alert('Indirizzo server salvato: ' + apiService.getApiUrl());
        setShowServerConfig(false);
    };

    if (currentView === 'map') {
        return (
            <MobileMapView
                onBack={() => setCurrentView('home')}
                onOpenDetails={handleOpenDetails}
                onVerifySign={(sign) => { setSelectedSign(sign); setCurrentView('verify'); }}
            />
        );
    }

    if (currentView === 'details' && selectedSign) {
        return (
            <MobileSignDetails
                sign={selectedSign}
                onBack={() => setCurrentView('map')}
            />
        );
    }

    if (currentView === 'verify' && selectedSign) {
        return (
            <MobileVerifySign
                sign={selectedSign}
                onBack={() => setCurrentView('map')}
                onDataChange={onDataChange}
            />
        );
    }

    if (currentView === 'add') {
        return (
            <MobileAddSign
                user={user}
                syncStatus={syncStatus}
                stats={stats}
                onDataChange={onDataChange}
                onBack={() => setCurrentView('home')}
                censusSession={censusSession}
            />
        );
    }

    if (currentView === 'verifica_pc') {
        return (
            <MobilePassoCarrabileCheck
                onBack={() => setCurrentView('home')}
            />
        );
    }

    if (currentView === 'archive') {
        return (
            <MobileArchive
                user={user}
                onDataChange={onDataChange}
                onBack={() => setCurrentView('home')}
            />
        );
    }

    if (currentView === 'ar_scan') {
        return <ARScanView onBack={() => setCurrentView('home')} />;
    }

    return (
        <div className="container" style={{ overflowY: 'auto', height: '100%', paddingTop: '1.5rem', paddingBottom: '2rem' }}>
            <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📍</div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                    Catasto Segnaletica
                </h1>
                <p style={{ color: 'var(--gray-600)' }}>
                    Benvenuto, {user?.username}
                </p>
            </div>

            {/* Avviso spazio di archiviazione insufficiente */}
            {storageWarning && (
                <div style={{
                    padding: '1rem',
                    background: '#fee2e2',
                    color: '#dc2626',
                    borderRadius: 'var(--border-radius)',
                    marginBottom: '1.5rem',
                    fontWeight: '600',
                    textAlign: 'center'
                }}>
                    ⚠️ Spazio disponibile sul telefono insufficiente (
                    {(storageWarning.available / (1024 * 1024)).toFixed(0)} MB liberi).
                    <div style={{ fontWeight: '400', marginTop: '0.25rem', fontSize: '0.875rem' }}>
                        Effettua una sincronizzazione via cavo USB per liberare spazio.
                    </div>
                </div>
            )}

            {/* Sessione di Censimento */}
            <div style={{ marginBottom: '1.5rem' }}>
                {censusSession ? (
                    <div style={{
                        padding: '1rem',
                        background: '#dcfce7',
                        border: '1px solid #86efac',
                        borderRadius: 'var(--border-radius)',
                    }}>
                        <div style={{ fontWeight: '700', color: '#166534', marginBottom: '0.5rem' }}>
                            🟢 Sessione di Censimento Attiva
                        </div>
                        <div style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                            <strong>Via:</strong> {censusSession.via_predefinita}
                        </div>
                        {censusSession.ordinanza_predefinita && (
                            <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                                <strong>Ordinanza:</strong> {censusSession.ordinanza_predefinita}
                            </div>
                        )}
                        <button
                            className="btn btn-secondary"
                            onClick={handleCloseCensusSession}
                            style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.875rem' }}
                        >
                            ✕ Chiudi Sessione
                        </button>
                    </div>
                ) : (
                    <div>
                        <button
                            onClick={() => setShowCensusForm(prev => !prev)}
                            className="btn btn-secondary"
                            style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                        >
                            📝 {showCensusForm ? 'Nascondi' : 'Avvia'} Sessione di Censimento
                        </button>

                        {showCensusForm && (
                            <div style={{
                                marginTop: '0.5rem',
                                padding: '0.75rem',
                                background: 'white',
                                borderRadius: 'var(--border-radius)',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                            }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '0.875rem' }}>Via predefinita</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={censusForm.via_predefinita}
                                        onChange={(e) => setCensusForm(prev => ({ ...prev, via_predefinita: e.target.value }))}
                                        placeholder="Es: Via Roma"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '0.875rem' }}>Ordinanza predefinita (opzionale)</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={censusForm.ordinanza_predefinita}
                                        onChange={(e) => setCensusForm(prev => ({ ...prev, ordinanza_predefinita: e.target.value }))}
                                        placeholder="Es: Ord. N. 142 del 2026"
                                    />
                                </div>
                                <button
                                    onClick={handleStartCensusSession}
                                    className="btn btn-primary"
                                    style={{ width: '100%' }}
                                >
                                    ▶️ Avvia Sessione
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Stats Cards */}
            {stats && (
                <div style={{
                    display: 'flex',
                    gap: '0.75rem',
                    marginBottom: '1.5rem',
                    justifyContent: 'center'
                }}>
                    <div style={{
                        background: 'white',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--border-radius)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        textAlign: 'center',
                        flex: 1
                    }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>
                            {stats.local?.totalSigns || 0}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginTop: '0.25rem' }}>
                            Segnali
                        </div>
                    </div>
                    <div style={{
                        background: 'white',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--border-radius)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        textAlign: 'center',
                        flex: 1
                    }}>
                        <div style={{
                            fontSize: '1.5rem',
                            fontWeight: '700',
                            color: stats.local?.pendingSync > 0 ? 'var(--warning)' : 'var(--success)'
                        }}>
                            {stats.local?.pendingSync || 0}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginTop: '0.25rem' }}>
                            Da Sync
                        </div>
                    </div>
                </div>
            )}

            {/* Export JSON (offline → desktop) */}
            <button
                onClick={handleExportJson}
                className="btn"
                style={{
                    width: '100%',
                    marginBottom: '0.5rem',
                    background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                    color: 'white',
                    padding: '0.75rem',
                    fontWeight: '600'
                }}
            >
                📦 Esporta Dati per Desktop (JSON)
            </button>

            {/* Sync rete (opzionale, solo se connesso) */}
            {syncStatus.online && (
                <button
                    onClick={handleForceSync}
                    disabled={isSyncing}
                    className="btn"
                    style={{
                        width: '100%',
                        marginBottom: '0.5rem',
                        background: isSyncing ? '#ccc' : 'var(--success)',
                        color: 'white',
                        padding: '0.75rem'
                    }}
                >
                    {isSyncing ? '⏳ Sincronizzazione...' : '🔄 Sincronizza via Rete'}
                </button>
            )}

            {/* Configurazione indirizzo server */}
            <div style={{ marginBottom: '1.5rem' }}>
                <button
                    onClick={() => setShowServerConfig(prev => !prev)}
                    className="btn btn-secondary"
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                >
                    ⚙️ {showServerConfig ? 'Nascondi' : 'Configura'} indirizzo server ufficio
                </button>

                {showServerConfig && (
                    <div style={{
                        marginTop: '0.5rem',
                        padding: '0.75rem',
                        background: 'white',
                        borderRadius: 'var(--border-radius)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                        <label className="form-label" style={{ fontSize: '0.875rem' }}>
                            Indirizzo server (es. http://192.168.42.1:3000)
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            value={serverUrl}
                            onChange={(e) => setServerUrl(e.target.value)}
                            placeholder="http://192.168.42.1:3000"
                            style={{ marginBottom: '0.5rem' }}
                        />
                        <button
                            onClick={handleSaveServerUrl}
                            className="btn btn-primary"
                            style={{ width: '100%' }}
                        >
                            💾 Salva indirizzo
                        </button>
                    </div>
                )}
            </div>

            {/* Menu Principale */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button
                    className="btn btn-primary"
                    onClick={() => setCurrentView('add')}
                    style={{
                        width: '100%',
                        padding: '1.5rem',
                        fontSize: '1.125rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem'
                    }}
                >
                    <span style={{ fontSize: '1.5rem' }}>📷</span>
                    <span>Nuovo Rilevamento</span>
                </button>

                <button
                    className="btn btn-secondary"
                    onClick={() => setCurrentView('map')}
                    style={{
                        width: '100%',
                        padding: '1.5rem',
                        fontSize: '1.125rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem'
                    }}
                >
                    <span style={{ fontSize: '1.5rem' }}>🗺️</span>
                    <span>Visualizza Mappa</span>
                </button>

                <button
                    className="btn btn-secondary"
                    onClick={() => setCurrentView('verifica_pc')}
                    style={{
                        width: '100%',
                        padding: '1.5rem',
                        fontSize: '1.125rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem'
                    }}
                >
                    <span style={{ fontSize: '1.5rem' }}>🚪</span>
                    <span>Verifica Passo Carrabile</span>
                </button>

                <button
                    className="btn btn-secondary"
                    onClick={() => setCurrentView('archive')}
                    style={{
                        width: '100%',
                        padding: '1.5rem',
                        fontSize: '1.125rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem'
                    }}
                >
                    <span style={{ fontSize: '1.5rem' }}>📋</span>
                    <span>Archivio Segnali</span>
                </button>

                <button
                    className="btn"
                    onClick={() => setCurrentView('ar_scan')}
                    style={{
                        width: '100%',
                        padding: '1.5rem',
                        fontSize: '1.125rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem',
                        background: 'linear-gradient(135deg, #0f766e 0%, #0e7490 100%)',
                        color: '#fff',
                        border: 'none',
                    }}
                >
                    <span style={{ fontSize: '1.5rem' }}>🔍</span>
                    <span>Scansione Automatica AR</span>
                </button>
            </div>

            {/* Info Box */}
            <div style={{
                marginTop: '2rem',
                padding: '1rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: 'var(--border-radius)',
                color: 'white',
                textAlign: 'center'
            }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                    {syncStatus.online ? '🟢' : '🔴'}
                </div>
                <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                    {syncStatus.online ? 'Server Online' : 'Modalità Offline'}
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                    {syncStatus.online
                        ? 'I dati vengono sincronizzati automaticamente'
                        : 'I dati saranno sincronizzati quando il server sarà disponibile'}
                </div>
            </div>
        </div>
    );
}

export default MobileHome;
