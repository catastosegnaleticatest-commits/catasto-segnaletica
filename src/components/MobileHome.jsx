import { useState } from 'react';
import syncService from '../services/sync';
import localStorageService from '../services/localStorage';
import MobileMapView from './MobileMapView';
import MobileAddSign from './MobileAddSign';
import MobileArchive from './MobileArchive';
import MobileSignDetails from './MobileSignDetails';

function MobileHome({ user, syncStatus, stats, onDataChange }) {
    const [currentView, setCurrentView] = useState('home');
    const [selectedSign, setSelectedSign] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);

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

    if (currentView === 'map') {
        return (
            <MobileMapView
                onBack={() => setCurrentView('home')}
                onOpenDetails={handleOpenDetails}
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

    if (currentView === 'add') {
        return (
            <MobileAddSign
                user={user}
                syncStatus={syncStatus}
                stats={stats}
                onDataChange={onDataChange}
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

    return (
        <div className="container">
            <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📍</div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                    Catasto Segnaletica
                </h1>
                <p style={{ color: 'var(--gray-600)' }}>
                    Benvenuto, {user?.username}
                </p>
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

            {/* Force Sync Button */}
            <button
                onClick={handleForceSync}
                disabled={isSyncing}
                className="btn"
                style={{
                    width: '100%',
                    marginBottom: '1rem',
                    background: isSyncing ? '#ccc' : 'var(--success)',
                    color: 'white',
                    padding: '0.75rem'
                }}
            >
                {isSyncing ? '⏳ Sincronizzazione...' : '🔄 Ricarica Dati'}
            </button>

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
