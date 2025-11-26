import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import localStorageService from '../services/localStorage';
import UserManagement from './UserManagement';

// Fix per icone Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function DesktopView({ user, syncStatus, stats, onDataChange }) {
    const [activeTab, setActiveTab] = useState('map');
    const [signs, setSigns] = useState([]);
    const [interventions, setInterventions] = useState([]);
    const [loading, setLoading] = useState(true);

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
        <div className="container">
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                        💻 Gestione Desktop
                    </h2>
                    <p style={{ color: 'var(--gray-600)' }}>
                        Visualizza e gestisci il catasto completo
                    </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '600', fontSize: '1.125rem' }}>
                        Ciao, {user?.username || 'Utente'} 👋
                    </div>
                    <div className="badge badge-secondary" style={{ marginTop: '0.25rem', display: 'inline-block' }}>
                        {user?.role?.toUpperCase() || 'GUEST'}
                    </div>
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-value">{stats.local?.totalSigns || 0}</div>
                        <div className="stat-label">Segnali Totali</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{stats.local?.totalInterventions || 0}</div>
                        <div className="stat-label">Interventi</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value" style={{ color: stats.local?.pendingSync > 0 ? 'var(--warning)' : 'var(--success)' }}>
                            {stats.local?.pendingSync || 0}
                        </div>
                        <div className="stat-label">Da Sincronizzare</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value" style={{ color: syncStatus.online ? 'var(--success)' : 'var(--danger)' }}>
                            {syncStatus.online ? '✅' : '❌'}
                        </div>
                        <div className="stat-label">Stato Server</div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'map' ? 'active' : ''}`}
                    onClick={() => setActiveTab('map')}
                >
                    🗺️ Mappa
                </button>
                <button
                    className={`tab ${activeTab === 'archive' ? 'active' : ''}`}
                    onClick={() => setActiveTab('archive')}
                >
                    📋 Archivio
                </button>
                <button
                    className={`tab ${activeTab === 'interventions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('interventions')}
                >
                    🔧 Interventi
                </button>
                {user?.role === 'admin' && (
                    <button
                        className={`tab ${activeTab === 'users' ? 'active' : ''}`}
                        onClick={() => setActiveTab('users')}
                    >
                        👥 Utenti
                    </button>
                )}
            </div>

            {/* Map Tab */}
            {activeTab === 'map' && (
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Mappa Segnali</h3>
                    </div>
                    {signs.length > 0 ? (
                        <div className="map-container">
                            <MapContainer
                                center={[signs[0].latitude, signs[0].longitude]}
                                zoom={13}
                                style={{ height: '100%', width: '100%' }}
                            >
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                />
                                {signs.map((sign) => (
                                    <Marker
                                        key={sign.id}
                                        position={[sign.latitude, sign.longitude]}
                                    >
                                        <Popup>
                                            <div style={{ minWidth: '200px' }}>
                                                <strong>{getSignIcon(sign.type)} {sign.type.toUpperCase()}</strong>
                                                <br />
                                                <span className={`badge ${getStatusBadge(sign.status)}`}>
                                                    {sign.status}
                                                </span>
                                                <br />
                                                <small>{sign.notes || 'Nessuna nota'}</small>
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                            </MapContainer>
                        </div>
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
                                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                                <button
                                                    className="btn btn-sm"
                                                    onClick={() => handleDeleteSign(sign.id)}
                                                    style={{ background: 'var(--danger)', color: 'white' }}
                                                >
                                                    🗑️ Elimina
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
