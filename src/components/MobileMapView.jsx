import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import localStorageService from '../services/localStorage';

// Fix per icone Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Componente per controllare la mappa programmaticamente
function MapController({ center, zoom }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, zoom, {
                animate: true,
                duration: 1.5
            });
        }
    }, [center, zoom, map]);
    return null;
}

function MobileMapView({ onBack }) {
    const [signs, setSigns] = useState([]);
    const [filteredSigns, setFilteredSigns] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedType, setSelectedType] = useState('all');
    const [loading, setLoading] = useState(true);
    const [mapCenter, setMapCenter] = useState([45.4642, 9.1900]); // Milano default
    const [mapZoom, setMapZoom] = useState(13);
    const [activeSignId, setActiveSignId] = useState(null);

    const signTypes = [
        { value: 'all', label: '🔍 Tutti' },
        { value: 'divieto', label: '🚫 Divieto' },
        { value: 'obbligo', label: '🔵 Obbligo' },
        { value: 'pericolo', label: '⚠️ Pericolo' },
        { value: 'indicazione', label: 'ℹ️ Indicazione' },
        { value: 'precedenza', label: '🔺 Precedenza' }
    ];

    useEffect(() => {
        loadSigns();
    }, []);

    useEffect(() => {
        filterSigns();
    }, [signs, searchTerm, selectedType]);

    const loadSigns = async () => {
        setLoading(true);
        try {
            const data = await localStorageService.getSigns();
            setSigns(data);

            // Centra la mappa sul primo segnale se disponibile
            if (data.length > 0) {
                setMapCenter([data[0].latitude, data[0].longitude]);
            }
        } catch (error) {
            console.error('Errore caricamento segnali:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterSigns = () => {
        let filtered = signs;

        // Filtra per tipo
        if (selectedType !== 'all') {
            filtered = filtered.filter(sign => sign.type === selectedType);
        }

        // Filtra per ricerca (nelle note)
        if (searchTerm) {
            filtered = filtered.filter(sign =>
                sign.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                sign.type.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        setFilteredSigns(filtered);
    };

    const handleSignClick = (sign) => {
        setMapCenter([sign.latitude, sign.longitude]);
        setMapZoom(18); // Zoom molto vicino
        setActiveSignId(sign.id);

        // Scrolla alla mappa
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
            <div style={{ marginBottom: '1rem' }}>
                <button className="btn btn-secondary" onClick={onBack}>
                    ← Indietro
                </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                    🗺️ Mappa Segnali
                </h2>
                <p style={{ color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                    {filteredSigns.length} segnali trovati
                </p>
            </div>

            {/* Filtri */}
            <div className="card" style={{ marginBottom: '1rem' }}>
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="🔍 Cerca per via o note..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                    <select
                        className="form-select"
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                    >
                        {signTypes.map(type => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Mappa */}
            {filteredSigns.length > 0 ? (
                <div className="map-container" style={{ height: '400px', marginBottom: '1rem', borderRadius: 'var(--border-radius)', overflow: 'hidden' }}>
                    <MapContainer
                        center={mapCenter}
                        zoom={mapZoom}
                        style={{ height: '100%', width: '100%' }}
                    >
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        />
                        <MapController center={mapCenter} zoom={mapZoom} />
                        {filteredSigns.map((sign) => (
                            <Marker
                                key={sign.id}
                                position={[sign.latitude, sign.longitude]}
                                opacity={activeSignId === sign.id ? 1 : 0.8}
                            >
                                <Popup>
                                    <div style={{ minWidth: '200px' }}>
                                        <strong>{getSignIcon(sign.type)} {sign.type.toUpperCase()}</strong>
                                        <br />
                                        <span className={`badge ${getStatusBadge(sign.status)}`}>
                                            {sign.status}
                                        </span>
                                        <br />
                                        <small style={{ fontSize: '0.75rem', color: 'var(--gray-600)' }}>
                                            {sign.notes || 'Nessuna nota'}
                                        </small>
                                        <br />
                                        <small style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>
                                            {sign.latitude.toFixed(6)}, {sign.longitude.toFixed(6)}
                                        </small>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>
            ) : (
                <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-500)' }}>
                    Nessun segnale trovato
                </div>
            )}

            {/* Lista segnali */}
            {filteredSigns.length > 0 && (
                <div className="card">
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
                        Lista Segnali
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {filteredSigns.map((sign) => (
                            <div
                                key={sign.id}
                                onClick={() => handleSignClick(sign)}
                                style={{
                                    padding: '0.75rem',
                                    background: activeSignId === sign.id ? '#eff6ff' : 'var(--gray-50)',
                                    borderRadius: 'var(--border-radius-sm)',
                                    borderLeft: `4px solid ${activeSignId === sign.id ? 'var(--primary)' : '#cbd5e1'}`,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                                    <strong>{getSignIcon(sign.type)} {sign.type}</strong>
                                    <span className={`badge ${getStatusBadge(sign.status)}`}>
                                        {sign.status}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                                    {sign.notes || 'Nessuna nota'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.25rem' }}>
                                    📍 {sign.latitude.toFixed(4)}, {sign.longitude.toFixed(4)}
                                </div>
                                {activeSignId === sign.id && (
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '600' }}>
                                        👁️ Visualizzato su mappa
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default MobileMapView;
