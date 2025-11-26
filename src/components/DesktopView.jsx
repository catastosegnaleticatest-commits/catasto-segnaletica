import { useState, useEffect } from 'react';
import localStorageService from '../services/localStorage';
import UserManagement from './UserManagement';
import MapView from './MapView';
import DesktopSignDetails from './DesktopSignDetails';

function DesktopView({ user, syncStatus, stats, onDataChange }) {
    const [activeTab, setActiveTab] = useState('map');
    const [signs, setSigns] = useState([]);
    const [interventions, setInterventions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSign, setSelectedSign] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const signsData = await localStorageService.getSigns();
            const interventionsData = await localStorageService.getInterventions();
            setSigns(signsData);
            setInterventions(interventionsData);
        } catch (error) {
            console.error('Errore caricamento dati:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSign = async (signId) => {
        if (!confirm('Sei sicuro di voler eliminare questo segnale?')) return;

        try {
            await localStorageService.deleteSign(signId);
            alert('Segnale eliminato con successo!');
            loadData();
            if (onDataChange) onDataChange();
        } catch (error) {
            console.error('Errore eliminazione segnale:', error);
            alert('Errore eliminazione segnale: ' + error.message);
        }
    };

    const handleOpenDetails = (sign) => {
        setSelectedSign(sign);
        setActiveTab('details');
    };

    const getSignIcon = (type) => {
        const icons = {
            divieto: '🚫',
            obbligo: '🔵',
            pericolo: '⚠️',
            indicazione: 'ℹ️',
            precedenza: '🔺'
        };
        return icons[type] || '📍';
    };

    const getStatusBadge = (status) => {
        const badges = {
            ottimo: 'badge-success',
            buono: 'badge-success',
            discreto: 'badge-warning',
            danneggiato: 'badge-danger'
        };
        return badges[status] || 'badge-info';
    };

    if (loading) {
        return (
            <div className="container">
                <div className="loading">
                    <div className="spinner"></div>
                </div>
            </div>
        );
    }

    return (
    return (
        <div className="container" style={{ maxWidth: '100%', padding: '1rem' }}>
            {/* Compact Header & Tabs */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                background: 'white',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--border-radius)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        💻 Catasto
                    </h2>

                    <div className="tabs" style={{ margin: 0, gap: '0.5rem' }}>
                        <button
                            className={`tab ${activeTab === 'map' ? 'active' : ''}`}
                            onClick={() => setActiveTab('map')}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                        >
                            🗺️ Mappa
                        </button>
                        <button
                            className={`tab ${activeTab === 'archive' ? 'active' : ''}`}
                            onClick={() => setActiveTab('archive')}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                        >
                            📋 Archivio
                        </button>
                        <button
                            className={`tab ${activeTab === 'interventions' ? 'active' : ''}`}
                            onClick={() => setActiveTab('interventions')}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                        >
                            🔧 Interventi
                        </button>
                        {user?.role === 'admin' && (
                            <button
                                className={`tab ${activeTab === 'users' ? 'active' : ''}`}
                                onClick={() => setActiveTab('users')}
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                            >
                                👥 Utenti
                            </button>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {/* Mini Stats */}
                    {stats && (
                        <div style={{ display: 'flex', gap: '1rem', marginRight: '1rem', borderRight: '1px solid #eee', paddingRight: '1rem' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontWeight: '700', fontSize: '1rem' }}>{stats.local?.totalSigns || 0}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--gray-600)' }}>Segnali</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontWeight: '700', fontSize: '1rem', color: stats.local?.pendingSync > 0 ? 'var(--warning)' : 'var(--success)' }}>
                                    {stats.local?.pendingSync || 0}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--gray-600)' }}>Sync</div>
                            </div>
                        </div>
                    )}

                    <div style={{ textAlign: 'right', lineHeight: '1.2' }}>
                        <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                            {user?.username || 'Utente'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                            {user?.role?.toUpperCase()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Details Tab (Hidden from nav, activated by map) */}
            {activeTab === 'details' && selectedSign && (
                <DesktopSignDetails
                    sign={selectedSign}
                    onBack={() => setActiveTab('map')}
                />
            )}

            {/* Map Tab */}
            {activeTab === 'map' && (
                <div className="card" style={{ height: '600px', padding: 0, overflow: 'hidden' }}>
                    {signs.length > 0 ? (
                        <MapView
                            signs={signs}
                            onSignClick={(sign) => console.log('Selected sign:', sign)}
                            onOpenDetails={handleOpenDetails}
                        />
                    ) : (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-500)' }}>
                            Nessun segnale presente
                        </div>
                    )}
                </div>
            )}

            {/* Archive Tab */}
            {activeTab === 'archive' && (
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Archivio Segnali ({signs.length})</h3>
                    </div>
                    {signs.length > 0 ? (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--gray-200)', textAlign: 'left' }}>
                                        <th style={{ padding: '0.75rem' }}>Tipo</th>
                                        <th style={{ padding: '0.75rem' }}>Stato</th>
                                        <th style={{ padding: '0.75rem' }}>Utente</th>
                                        <th style={{ padding: '0.75rem' }}>Posizione</th>
                                        <th style={{ padding: '0.75rem' }}>Data</th>
                                        <th style={{ padding: '0.75rem' }}>Note</th>
                                        <th style={{ padding: '0.75rem' }}>Sync</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Azioni</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {signs.map((sign) => (
                                        <tr key={sign.id} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                                            <td style={{ padding: '0.75rem' }}>
                                                {getSignIcon(sign.type)} {sign.type}
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <span className={`badge ${getStatusBadge(sign.status)}`}>
                                                    {sign.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                                                👤 {sign.creator_username || 'N/D'}
                                            </td>
                                            <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                                                {sign.latitude.toFixed(4)}, {sign.longitude.toFixed(4)}
                                            </td>
                                            <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                                                {sign.created_at ? new Date(sign.created_at).toLocaleDateString('it-IT') : '-'}
                                            </td>
                                            <td style={{ padding: '0.75rem', fontSize: '0.875rem', maxWidth: '200px' }}>
                                                {sign.notes || '-'}
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                {sign.synced ? '✅' : '⏳'}
                                            </td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                <button
                                                    className="btn btn-sm btn-primary"
                                                    onClick={() => handleOpenDetails(sign)}
                                                    title="Vedi Dettagli"
                                                >
                                                    👁️
                                                </button>
                                                <button
                                                    className="btn btn-sm"
                                                    onClick={() => handleDeleteSign(sign.id)}
                                                    style={{ background: 'var(--danger)', color: 'white' }}
                                                    title="Elimina"
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-500)' }}>
                            Nessun segnale presente
                        </div>
                    )}
                </div>
            )}

            {/* Interventions Tab */}
            {activeTab === 'interventions' && (
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Interventi Programmati ({interventions.length})</h3>
                    </div>
                    {interventions.length > 0 ? (
                        <div className="grid">
                            {interventions.map((intervention) => (
                                <div key={intervention.id} className="card">
                                    <h4 style={{ marginBottom: '0.5rem' }}>🔧 {intervention.type}</h4>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                                        {intervention.notes}
                                    </p>
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                                        <strong>Data:</strong> {intervention.scheduled_date || '-'}
                                    </div>
                                    <span className={`badge ${intervention.status === 'completato' ? 'badge-success' : 'badge-warning'}`}>
                                        {intervention.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-500)' }}>
                            Nessun intervento programmato
                        </div>
                    )}
                </div>
            )}

            {/* Users Tab (Admin only) */}
            {activeTab === 'users' && user?.role === 'admin' && (
                <UserManagement user={user} />
            )}
        </div>
    );
}

export default DesktopView;
