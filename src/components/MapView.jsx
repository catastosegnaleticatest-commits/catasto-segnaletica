import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect, useState, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function MapBounds({ signs }) {
    const map = useMap();
    useEffect(() => {
        if (signs && signs.length > 0) {
            const bounds = L.latLngBounds(signs.map(s => [s.latitude, s.longitude]));
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [signs, map]);
    return null;
}

function FlyTo({ coords }) {
    const map = useMap();
    useEffect(() => {
        if (coords) map.flyTo(coords, 17);
    }, [coords, map]);
    return null;
}

function MapView({ signs, onSignClick, onOpenDetails }) {
    const [filterType, setFilterType] = useState('tutti');
    const [filterStatus, setFilterStatus] = useState('tutti');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [flyCoords, setFlyCoords] = useState(null);
    const [searching, setSearching] = useState(false);
    const searchTimeout = useRef(null);

    const defaultCenter = [41.9028, 12.4964];
    const defaultZoom = 6;

    const signTypes = ['tutti', 'divieto', 'obbligo', 'pericolo', 'indicazione', 'precedenza'];
    const signStatuses = ['tutti', 'ottimo', 'buono', 'discreto', 'danneggiato'];

    const filteredSigns = (signs || []).filter(s => {
        if (filterType !== 'tutti' && s.type !== filterType) return false;
        if (filterStatus !== 'tutti' && s.status !== filterStatus) return false;
        return true;
    });

    const handleSearchInput = (value) => {
        setSearchQuery(value);
        setSearchResults([]);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (value.trim().length < 3) return;
        searchTimeout.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5&countrycodes=it`,
                    { headers: { 'Accept-Language': 'it' } }
                );
                const data = await res.json();
                setSearchResults(data);
            } catch { /* silenzioso */ }
            finally { setSearching(false); }
        }, 500);
    };

    const handleResultClick = (result) => {
        setFlyCoords([parseFloat(result.lat), parseFloat(result.lon)]);
        setSearchQuery(result.display_name.split(',').slice(0, 2).join(','));
        setSearchResults([]);
    };

    const getMarkerColor = (status) => {
        const colors = { ottimo: '#10b981', buono: '#3b82f6', discreto: '#f59e0b', danneggiato: '#ef4444' };
        return colors[status] || '#6b7280';
    };

    const createCustomIcon = (sign) => {
        const color = getMarkerColor(sign.status);
        return L.divIcon({
            className: 'custom-marker',
            html: `<div style="background-color:${color};width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3)"></div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 30],
            popupAnchor: [0, -30],
        });
    };

    const getTypeIcon = (type) => {
        const icons = { divieto: '🚫', obbligo: '🔵', pericolo: '⚠️', indicazione: 'ℹ️', precedenza: '🔺' };
        return icons[type] || '📍';
    };

    return (
        <div style={{ height: '100%', width: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>

            {/* Barra strumenti sopra la mappa */}
            <div style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>

                {/* Ricerca indirizzo */}
                <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
                    <input
                        type="text"
                        placeholder="🔍 Cerca indirizzo..."
                        value={searchQuery}
                        onChange={e => handleSearchInput(e.target.value)}
                        style={{ width: '100%', padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box', color: '#111827', background: 'white' }}
                    />
                    {searching && (
                        <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: '#6b7280' }}>⏳</div>
                    )}
                    {searchResults.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 2000, maxHeight: '200px', overflowY: 'auto' }}>
                            {searchResults.map((r, i) => (
                                <div key={i} onClick={() => handleResultClick(r)}
                                    style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', color: '#111827', borderBottom: '1px solid #f1f5f9' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                >
                                    📍 {r.display_name.split(',').slice(0, 3).join(', ')}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Filtro tipo */}
                <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    style={{ padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', color: '#111827', background: 'white' }}
                >
                    {signTypes.map(t => (
                        <option key={t} value={t}>{t === 'tutti' ? 'Tutti i tipi' : `${getTypeIcon(t)} ${t.charAt(0).toUpperCase() + t.slice(1)}`}</option>
                    ))}
                </select>

                {/* Filtro stato */}
                <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    style={{ padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', color: '#111827', background: 'white' }}
                >
                    {signStatuses.map(s => (
                        <option key={s} value={s}>{s === 'tutti' ? 'Tutti gli stati' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                </select>

                <span style={{ fontSize: '0.8rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {filteredSigns.length} segnali
                </span>
            </div>

            {/* Mappa */}
            <div style={{ flex: 1, position: 'relative' }}>
                <MapContainer
                    center={defaultCenter}
                    zoom={defaultZoom}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={true}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {filteredSigns.length > 0 && <MapBounds signs={filteredSigns} />}
                    {flyCoords && <FlyTo coords={flyCoords} />}

                    {filteredSigns.map((sign) => (
                        <Marker
                            key={sign.id}
                            position={[sign.latitude, sign.longitude]}
                            icon={createCustomIcon(sign)}
                            eventHandlers={{ click: () => { if (onSignClick) onSignClick(sign); } }}
                        >
                            <Popup>
                                <div style={{ minWidth: '180px', color: '#111827' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '1.25rem' }}>{getTypeIcon(sign.type)}</span>
                                        <strong style={{ textTransform: 'capitalize' }}>{sign.type}</strong>
                                    </div>
                                    {sign.photo && (
                                        <img src={sign.photo} alt="Segnale"
                                            style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '4px', marginBottom: '0.5rem' }} />
                                    )}
                                    <div style={{ marginBottom: '0.5rem' }}>
                                        <span style={{ background: getMarkerColor(sign.status), color: 'white', borderRadius: '4px', padding: '0.15rem 0.5rem', fontSize: '0.8rem' }}>
                                            {sign.status || 'N/A'}
                                        </span>
                                    </div>
                                    {sign.notes && <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '0.5rem' }}>{sign.notes}</div>}
                                    <button
                                        style={{ width: '100%', padding: '0.35rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                        onClick={() => onOpenDetails && onOpenDetails(sign)}
                                    >
                                        👁️ Dettagli
                                    </button>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>

                {/* Legenda */}
                <div style={{ position: 'absolute', bottom: '20px', right: '20px', background: 'white', padding: '0.75rem 1rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 1000, fontSize: '0.875rem', color: '#111827' }}>
                    <div style={{ fontWeight: '700', marginBottom: '0.4rem', color: '#111827' }}>Stato Segnali</div>
                    {[
                        { color: '#10b981', label: 'Ottimo' },
                        { color: '#3b82f6', label: 'Buono' },
                        { color: '#f59e0b', label: 'Discreto' },
                        { color: '#ef4444', label: 'Danneggiato' },
                    ].map(({ color, label }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: color, flexShrink: 0 }}></div>
                            <span style={{ color: '#111827' }}>{label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default MapView;
