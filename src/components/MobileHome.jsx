import { useState } from 'react';
import MobileMapView from './MobileMapView';
import MobileAddSign from './MobileAddSign';
import MobileArchive from './MobileArchive';

function MobileHome({ user, syncStatus, stats, onDataChange }) {
    const [currentView, setCurrentView] = useState('home');

    if (currentView === 'map') {
        return <MobileMapView onBack={() => setCurrentView('home')} />;
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
                <div className="stats-grid" style={{ marginBottom: '2rem' }}>
                    <div className="stat-card">
                        <div className="stat-value">{stats.local?.totalSigns || 0}</div>
                        <div className="stat-label">Segnali</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value" style={{ color: stats.local?.pendingSync > 0 ? 'var(--warning)' : 'var(--success)' }}>
                            {stats.local?.pendingSync || 0}
                        </div>
                        <div className="stat-label">Da Sync</div>
                    </div>
                </div>
            )}

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
