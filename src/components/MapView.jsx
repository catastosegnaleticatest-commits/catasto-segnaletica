import { MapContainer, TileLayer, WMSTileLayer, LayersControl, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { useEffect, useState, useRef, useCallback } from 'react';
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
    const fittedRef = useRef(false);
    useEffect(() => {
        if (signs && signs.length > 0 && !fittedRef.current) {
            fittedRef.current = true;
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

// Traccia zoom corrente e visibilità overlay catastale
function CadastralZoomWarning({ onZoomChange, onOverlayChange }) {
    useMapEvents({
        zoomend: (e) => onZoomChange(e.target.getZoom()),
        overlayadd: (e) => { if (e.name.includes('Catastale')) onOverlayChange(true); },
        overlayremove: (e) => { if (e.name.includes('Catastale')) onOverlayChange(false); },
    });
    return null;
}

function MapView({ signs, onSignClick, onOpenDetails }) {
    const [filterType, setFilterType] = useState('tutti');
    const [filterStatuses, setFilterStatuses] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [flyCoords, setFlyCoords] = useState(null);
    const [searching, setSearching] = useState(false);
    const [currentZoom, setCurrentZoom] = useState(6);
    const [cadastralActive, setCadastralActive] = useState(true);
    const searchTimeout = useRef(null);

    const defaultCenter = [41.9028, 12.4964];
    const defaultZoom = 6;
    const CADASTRAL_MIN_ZOOM = 16;

    const signTypes = ['tutti', 'divieto', 'obbligo', 'pericolo', 'indicazione', 'precedenza'];
    const signStatuses = ['tutti', 'ottimo', 'buono', 'discreto', 'danneggiato'];

    const toggleStatus = useCallback((status) => {
        setFilterStatuses(prev => {
            const next = new Set(prev);
            if (next.has(status)) next.delete(status); else next.add(status);
            return next;
        });
    }, []);

    const filteredSigns = (signs || []).filter(s => {
        if (filterType !== 'tutti' && s.type !== filterType) return false;
        if (filterStatuses.size > 0 && !filterStatuses.has(s.status)) return false;
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

                {/* Filtro tipo segnale */}
                <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    style={{ padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', color: '#111827', background: 'white' }}
                >
                    {signTypes.map(t => (
                        <option key={t} value={t}>{t === 'tutti' ? 'Tutti i tipi' : `${getTypeIcon(t)} ${t.charAt(0).toUpperCase() + t.slice(1)}`}</option>
                    ))}
                </select>

                {/* Filtro stato — toggle dinamico multi-selezione */}
                <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {[
                        { key: 'ottimo',     label: 'Ottimo',     color: '#10b981' },
                        { key: 'buono',      label: 'Buono',      color: '#3b82f6' },
                        { key: 'discreto',   label: 'Discreto',   color: '#f59e0b' },
                        { key: 'danneggiato',label: 'Danneggiato',color: '#ef4444' },
                    ].map(({ key, label, color }) => {
                        const active = filterStatuses.has(key);
                        return (
                            <button
                                key={key}
                                onClick={() => toggleStatus(key)}
                                style={{
                                    padding: '0.25rem 0.65rem',
                                    borderRadius: '999px',
                                    border: `2px solid ${color}`,
                                    background: active ? color : 'white',
                                    color: active ? 'white' : color,
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {label}
                            </button>
                        );
                    })}
                    {filterStatuses.size > 0 && (
                        <button
                            onClick={() => setFilterStatuses(new Set())}
                            style={{ padding: '0.25rem 0.5rem', borderRadius: '999px', border: '1px solid #cbd5e1', background: 'white', color: '#6b7280', fontSize: '0.75rem', cursor: 'pointer' }}
                        >✕ tutti</button>
                    )}
                </div>

                <span style={{ fontSize: '0.8rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {filteredSigns.length} segnali
                </span>
            </div>

            {/* Mappa */}
            <div style={{ flex: 1, position: 'relative' }}>
                <MapContainer
                    center={defaultCenter}
                    zoom={defaultZoom}
                    maxZoom={20}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={true}
                >
                    {/* Selettore layer */}
                    <LayersControl position="topright">

                        <LayersControl.BaseLayer checked name="🗺️ Mappa Standard">
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                maxZoom={20}
                                maxNativeZoom={19}
                            />
                        </LayersControl.BaseLayer>

                        <LayersControl.BaseLayer name="🛰️ Satellitare">
                            <TileLayer
                                attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                maxZoom={20}
                                maxNativeZoom={19}
                            />
                        </LayersControl.BaseLayer>

                        <LayersControl.BaseLayer name="🏔️ Topografica">
                            <TileLayer
                                attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
                                url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                                maxZoom={20}
                                maxNativeZoom={17}
                            />
                        </LayersControl.BaseLayer>

                        {/* Overlay WMS Agenzia delle Entrate — Geoportale Cartografico Nazionale */}
                        <LayersControl.Overlay checked name="📋 Particelle Catastali (ADE)">
                            <WMSTileLayer
                                url="https://wms.cartografia.agenziaentrate.gov.it/geoserver/wms"
                                layers="province,comuni,fogli,particelle,fabbricati"
                                format="image/png"
                                transparent={true}
                                attribution='&copy; <a href="https://www.agenziaentrate.gov.it">Agenzia delle Entrate</a>'
                                maxZoom={20}
                                opacity={0.7}
                            />
                        </LayersControl.Overlay>

                    </LayersControl>

                    <CadastralZoomWarning
                        onZoomChange={setCurrentZoom}
                        onOverlayChange={setCadastralActive}
                    />

                    {/* Banner avviso zoom catastale */}
                    {cadastralActive && currentZoom < CADASTRAL_MIN_ZOOM && (
                        <div style={{
                            position: 'absolute', bottom: '2.5rem', left: '50%', transform: 'translateX(-50%)',
                            zIndex: 1000, background: 'rgba(245,158,11,0.95)', color: '#1c1917',
                            padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem',
                            fontWeight: 600, boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            pointerEvents: 'none', whiteSpace: 'nowrap',
                        }}>
                            🔍 Fai zoom avanti (≥ livello {CADASTRAL_MIN_ZOOM}) per vedere le particelle catastali
                        </div>
                    )}

                    {signs && signs.length > 0 && <MapBounds signs={signs} />}
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
                <div style={{ position: 'absolute', bottom: '20px', left: '20px', background: 'white', padding: '0.75rem 1rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 1000, fontSize: '0.875rem', color: '#111827' }}>
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
