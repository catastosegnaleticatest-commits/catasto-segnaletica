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
        <div className="desktop-view">
            <div className="tabs" style={{ marginBottom: '1rem', borderBottom: '1px solid #ddd', paddingBottom: '0.5rem' }}>
                <button
                    className={`btn ${activeTab === 'map' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveTab('map')}
                    style={{ marginRight: '0.5rem' }}
                >
                    🗺️ Mappa
                </button>
                <button
                    className={`btn ${activeTab === 'archive' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveTab('archive')}
                    style={{ marginRight: '0.5rem' }}
                >
                    📋 Archivio ({signs.length})
                </button>
                <button
                    className={`btn ${activeTab === 'interventions' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveTab('interventions')}
                    style={{ marginRight: '0.5rem' }}
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

                <button
                    onClick={handleForceSync}
                    className="btn btn-sm btn-secondary"
                    style={{ float: 'right' }}
                >
                    🔄 Ricarica Dati
                </button>
            </div>

            <div className="tab-content">
                {activeTab === 'map' && (
                    <div className="card" style={{ height: '600px', padding: 0, overflow: 'hidden' }}>
                        <MapView
                            signs={signs}
                            onSignClick={handleOpenDetails}
                            onOpenDetails={handleOpenDetails}
                        />
                    </div>
                )}

                {activeTab === 'archive' && (
                    <div className="card">
                        <div className="table-responsive">
                            <table className="table" style={{ width: '100%' }}>
                                <thead>
                                    <tr>
                                        <th>Tipo</th>
                                        <th>Stato</th>
                                        <th>Posizione</th>
                                        <th>Data</th>
                                        <th>Note</th>
                                        <th>Sync</th>
                                        <th>Azioni</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {signs.length === 0 ? (
                                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>Nessun segnale presente</td></tr>
                                    ) : (
                                        signs.map(sign => (
                                            <tr key={sign.id}>
                                                <td>{getSignIcon(sign.type)} {sign.type}</td>
                                                <td><span className={`badge ${getStatusBadge(sign.status)}`}>{sign.status}</span></td>
                                                <td>{sign.latitude?.toFixed(4)}, {sign.longitude?.toFixed(4)}</td>
                                                <td>{new Date(sign.created_at).toLocaleDateString()}</td>
                                                <td>{sign.notes}</td>
                                                <td>{sign.synced ? '✅' : '⏳'}</td>
                                                <td>
                                                    <button onClick={() => handleOpenDetails(sign)} className="btn btn-sm btn-primary" style={{ marginRight: '0.5rem' }}>👁️</button>
                                                    <button onClick={() => handleDeleteSign(sign.id)} className="btn btn-sm btn-danger">🗑️</button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
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
                    <UserManagement />
                )}
            </div>
        </div>
    );
}

export default DesktopView;
