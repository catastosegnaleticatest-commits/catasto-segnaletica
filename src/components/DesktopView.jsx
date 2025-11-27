import React, { useState } from 'react';
import MapView from './MapView';
import DesktopSignDetails from './DesktopSignDetails';
import UserManagement from './UserManagement';
import localStorageService from '../services/localStorage';
import syncService from '../services/sync';

function DesktopView({ user, syncStatus, stats, onDataChange }) {
    const [activeTab, setActiveTab] = useState('map');
    const [selectedSign, setSelectedSign] = useState(null);
    const [signs, setSigns] = useState([]);
    const [interventions, setInterventions] = useState([]);

    // Carica dati all'avvio e quando cambiano
    React.useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 5000);
        return () => clearInterval(interval);
    }, []);

    const loadData = async () => {
        try {
            const localSigns = await localStorageService.getSigns();
            const localInterventions = await localStorageService.getInterventions();
            setSigns(localSigns);
            setInterventions(localInterventions);
        } catch (error) {
            console.error('Errore caricamento dati:', error);
        }
    };

    const handleForceSync = async () => {
        if (!confirm('Vuoi forzare la sincronizzazione?')) return;
        try {
            await localStorageService.resetSyncStatus();
            await syncService.fullSync();
            if (onDataChange) onDataChange();
            loadData();
            alert('Sincronizzazione completata!');
        } catch (error) {
            alert('Errore sync: ' + error.message);
        }
    };

    const handleOpenDetails = (sign) => {
        setSelectedSign(sign);
        setActiveTab('details');
    };

    const handleDeleteSign = async (id) => {
        if (!confirm('Sei sicuro di voler eliminare questo segnale?')) return;
        try {
            await localStorageService.deleteSign(id);
            loadData();
            if (onDataChange) onDataChange();
        } catch (error) {
            alert('Errore eliminazione: ' + error.message);
        }
    };

    const getSignIcon = (type) => {
        const icons = {
            pericolo: '⚠️',
            divieto: '⛔',
            obbligo: '🔵',
            indicazione: 'ℹ️'
        };
        return icons[type] || '📍';
    };

    const getStatusBadge = (status) => {
        const colors = {
            buono: 'badge-success',
            discreto: 'badge-warning',
            scadente: 'badge-danger',
            danneggiato: 'badge-danger'
        };
        return colors[status] || 'badge-secondary';
    };

    if (activeTab === 'details' && selectedSign) {
        return (
            <DesktopSignDetails
                sign={selectedSign}
                onBack={() => setActiveTab('map')}
            />
        );
    }

    return (
        <div className="desktop-view" style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 1rem' }}>
            <div className="tabs" style={{ 
                marginBottom: '1.5rem', 
                borderBottom: '1px solid #ddd', 
                paddingBottom: '0.5rem',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.5rem',
                flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                        className={`btn ${activeTab === 'map' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setActiveTab('map')}
                    >
                        🗺️ Mappa
                    </button>
                    <button
                        className={`btn ${activeTab === 'archive' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setActiveTab('archive')}
                    >
                        📋 Archivio ({signs.length})
                    </button>
                    <button
                        className={`btn ${activeTab === 'interventions' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setActiveTab('interventions')}
                    >
                        🔧 Interventi
                    </button>
                    {user?.role === 'admin' && (
                        <button
                            className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setActiveTab('users')}
                        >
                            👥 Utenti
                        </button>
                    )}
                </div>

                <button
                    onClick={handleForceSync}
                    className="btn btn-sm btn-secondary"
                    style={{ marginLeft: 'auto' }}
                >
                    🔄 Ricarica Dati
                </button>
            </div>

            <div className="tab-content">
                {activeTab === 'map' && (
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center',
                        minHeight: '500px'
                    }}>
                        <div className="card" style={{ 
                            width: '900px', 
                            maxWidth: '100%',
                            height: '600px', 
                            padding: 0, 
                            overflow: 'hidden',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                        }}>
                            <MapView
                                signs={signs}
                                onSignClick={handleOpenDetails}
                                onOpenDetails={handleOpenDetails}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'archive' && (
                    <div className="card">
                        <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: '600' }}>
                            📋 Archivio Segnali
                        </h3>
                        {!signs || signs.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                                <h4>Nessun segnale presente</h4>
                                <p>Sincronizza i dati o aggiungi un nuovo segnale dalla vista mobile.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--gray-200)', background: 'var(--gray-50)' }}>
                                            <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Tipo</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Stato</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Posizione</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Data</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Note</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600' }}>Sync</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>Azioni</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {signs.map(sign => (
                                            <tr key={sign.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                                                <td style={{ padding: '0.75rem' }}>
                                                    <span style={{ fontSize: '1.25rem', marginRight: '0.5rem' }}>{getSignIcon(sign.type)}</span>
                                                    {sign.type || 'N/A'}
                                                </td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    <span className={`badge ${getStatusBadge(sign.status)}`}>
                                                        {sign.status || 'N/A'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                                    {sign.latitude ? `${Number(sign.latitude).toFixed(4)}, ${Number(sign.longitude).toFixed(4)}` : 'N/A'}
                                                </td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    {sign.created_at ? new Date(sign.created_at).toLocaleDateString('it-IT') : 'N/A'}
                                                </td>
                                                <td style={{ padding: '0.75rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {sign.notes || '-'}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                    {sign.synced ? '✅' : '⏳'}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                                    <button 
                                                        onClick={() => handleOpenDetails(sign)} 
                                                        className="btn btn-sm btn-primary" 
                                                        style={{ marginRight: '0.5rem' }}
                                                    >
                                                        👁️
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteSign(sign.id)} 
                                                        className="btn btn-sm btn-danger"
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'interventions' && (
                    <div className="grid">
                        {interventions.length === 0 ? (
                            <div className="card" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem' }}>
                                Nessun intervento programmato
                            </div>
                        ) : (
                            interventions.map(intervention => (
                                <div key={intervention.id} className="card">
                                    <h4>{intervention.type}</h4>
                                    <p>{intervention.notes}</p>
                                    <small>Data: {intervention.scheduled_date}</small>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'users' && user?.role === 'admin' && (
                    <UserManagement user={user} />
                )}
            </div>
        </div>
    );
}

export default DesktopView;
