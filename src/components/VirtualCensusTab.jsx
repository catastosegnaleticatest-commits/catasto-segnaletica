import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Componente interno: vola al nuovo centro ogni volta che cambia
function FlyToCenter({ center, radius }) {
    const map = useMap();
    useEffect(() => {
        if (center) map.flyTo(center, 16, { animate: true, duration: 0.8 });
    }, [center, map]);
    return null;
}
import apiService from '../services/api';

// Fix per icone marker di default in Leaflet con Webpack/Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Token per l'API gratuita Mapillary (Graph API v4): può essere impostato
// in .env (build-time) oppure dall'utente direttamente nell'interfaccia (localStorage).
const MAPILLARY_LS_KEY = 'mapillaryToken';
function getMapillaryToken() {
    return localStorage.getItem(MAPILLARY_LS_KEY) || import.meta.env.VITE_MAPILLARY_TOKEN || '';
}

// Traduce i valori più comuni del tag traffic_sign OSM in etichette leggibili
function describeTrafficSign(tags) {
    const value = tags.traffic_sign || tags['traffic_sign:forward'] || tags['traffic_sign:backward'];
    if (!value) return 'Segnale stradale (non specificato)';
    return value;
}

// Determina l'icona, l'etichetta e la tipologia interna (Catasto) a partire dai tag OSM
function classifyOsmSign(tags) {
    if (tags.highway === 'stop') return { icon: '🛑', label: 'Stop', type: 'precedenza' };
    if (tags.highway === 'give_way') return { icon: '🔻', label: 'Dare Precedenza', type: 'precedenza' };
    if (tags.highway === 'traffic_signals') return { icon: '🚦', label: 'Semaforo', type: 'indicazione' };

    const value = (tags.traffic_sign || tags['traffic_sign:forward'] || tags['traffic_sign:backward'] || '').toLowerCase();
    if (value.includes('stop')) return { icon: '🛑', label: 'Stop', type: 'precedenza' };
    if (value.includes('precedence') || value.includes('priority') || value.includes('give_way')) {
        return { icon: '🔻', label: 'Dare Precedenza', type: 'precedenza' };
    }
    if (value.includes('maxspeed') || value.includes('speed')) {
        return { icon: '🚫', label: 'Limite di Velocità', type: 'divieto' };
    }
    if (value.includes('no_') || value.includes('prohibitory') || value.includes('divieto')) {
        return { icon: '🚫', label: 'Divieto', type: 'divieto' };
    }
    if (value.includes('mandatory') || value.includes('obbligo')) {
        return { icon: '🔵', label: 'Obbligo', type: 'obbligo' };
    }
    if (value.includes('danger') || value.includes('warning') || value.includes('pericolo')) {
        return { icon: '⚠️', label: 'Pericolo', type: 'pericolo' };
    }
    return { icon: '🪧', label: describeTrafficSign(tags), type: 'indicazione' };
}

// Icone marker per il Censimento Virtuale
const normalCensusIcon = L.divIcon({
    className: '',
    html: '<div style="width:18px;height:18px;background:#3b82f6;border:2px solid white;border-radius:50%;box-shadow:0 2px 5px rgba(0,0,0,0.35)"></div>',
    iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -9],
});
const hoveredCensusIcon = L.divIcon({
    className: '',
    html: '<div style="width:26px;height:26px;background:#f59e0b;border:3px solid white;border-radius:50%;box-shadow:0 0 0 3px rgba(245,158,11,0.4),0 3px 10px rgba(0,0,0,0.4)"></div>',
    iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -13],
});

// Card per un singolo segnale rilevato: carica (se possibile) la foto da Mapillary
// e permette al tecnico di approvare l'importazione nel Catasto ufficiale
function VirtualSignCard({ result, via, onImport, importing, imported, mapillaryToken, isHovered, onHoverStart, onHoverEnd }) {
    const [photoUrl, setPhotoUrl] = useState(null);
    const [photoLoading, setPhotoLoading] = useState(false);

    useEffect(() => {
        const mapillaryId = result.tags.mapillary;
        if (!mapillaryId || !mapillaryToken) return;

        let cancelled = false;
        setPhotoLoading(true);
        fetch(`https://graph.mapillary.com/${mapillaryId}?fields=thumb_256_url&access_token=${mapillaryToken}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!cancelled && data?.thumb_256_url) setPhotoUrl(data.thumb_256_url);
            })
            .catch(() => {})
            .finally(() => { if (!cancelled) setPhotoLoading(false); });

        return () => { cancelled = true; };
    }, [result.tags.mapillary, mapillaryToken]);

    const { icon, label, type } = classifyOsmSign(result.tags);

    return (
        <div
            className="card"
            style={{
                display: 'flex', gap: '1rem', alignItems: 'center',
                outline: isHovered ? '2px solid #f59e0b' : '2px solid transparent',
                background: isHovered ? 'rgba(245,158,11,0.08)' : undefined,
                transition: 'outline 0.12s, background 0.12s',
                cursor: 'default',
            }}
            onMouseEnter={onHoverStart}
            onMouseLeave={onHoverEnd}
        >
            <div style={{
                width: '90px',
                height: '90px',
                flexShrink: 0,
                borderRadius: 'var(--border-radius)',
                background: 'var(--gray-100)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
            }}>
                {photoLoading ? (
                    <span className="spinner" style={{ width: '20px', height: '20px' }}></span>
                ) : photoUrl ? (
                    <img src={photoUrl} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <span style={{ fontSize: '2.5rem' }}>{icon}</span>
                )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '700', marginBottom: '0.25rem' }}>{icon} {label}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>
                    📍 {result.lat.toFixed(6)}, {result.lon.toFixed(6)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.25rem' }}>
                    Tipologia Catasto: <strong>{type}</strong>
                    {!photoUrl && !mapillaryToken && ' · Foto Mapillary non disponibile (token non configurato)'}
                    {!photoUrl && mapillaryToken && !result.tags.mapillary && ' · Nessuna foto Mapillary associata a questo nodo OSM'}
                </div>
                <a
                    href={`https://www.openstreetmap.org/node/${result.id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '0.75rem' }}
                >
                    Apri su OpenStreetMap ↗
                </a>
            </div>

            <button
                className={`btn ${imported ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => onImport(result, type)}
                disabled={importing || imported}
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
                {imported ? '✅ Importato' : importing ? '⏳ Importazione...' : '✅ Approva e Importa nel Catasto'}
            </button>
        </div>
    );
}

function VirtualCensusTab() {
    const [via, setVia] = useState('');
    const [radius, setRadius] = useState(300);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [center, setCenter] = useState(null);
    const [results, setResults] = useState([]);
    const [searchedVia, setSearchedVia] = useState('');
    const [importingId, setImportingId] = useState(null);
    const [importedIds, setImportedIds] = useState(new Set());

    const [mapillaryToken, setMapillaryToken] = useState(getMapillaryToken);
    const [tokenInput, setTokenInput] = useState('');
    const [showTokenPanel, setShowTokenPanel] = useState(!getMapillaryToken());
    const [hoveredId, setHoveredId] = useState(null);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!via.trim()) {
            alert('Inserire il nome della via da cercare');
            return;
        }
        const radiusMeters = parseInt(radius, 10);
        if (!radiusMeters || radiusMeters <= 0) {
            alert('Inserire un raggio di ricerca valido (in metri)');
            return;
        }

        setLoading(true);
        setError(null);
        setResults([]);
        setImportedIds(new Set());

        try {
            // 1. Geocodifica la via tramite Nominatim (OpenStreetMap)
            const geoResp = await fetch(
                `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(via)}`,
                { headers: { 'Accept-Language': 'it' } }
            );
            if (!geoResp.ok) throw new Error('Errore nella geocodifica della via');
            const geoData = await geoResp.json();
            if (!geoData.length) throw new Error('Via non trovata. Specificare anche il comune (es. "Via Roma, Milano")');

            const lat = parseFloat(geoData[0].lat);
            const lon = parseFloat(geoData[0].lon);
            setCenter([lat, lon]);
            setSearchedVia(geoData[0].display_name);

            // 2. Interroga Overpass per i segnali stradali già catalogati dalla community OSM
            const query = `
                [out:json][timeout:25];
                (
                  node["traffic_sign"](around:${radiusMeters},${lat},${lon});
                  node["highway"="traffic_signals"](around:${radiusMeters},${lat},${lon});
                  node["highway"="stop"](around:${radiusMeters},${lat},${lon});
                  node["highway"="give_way"](around:${radiusMeters},${lat},${lon});
                );
                out body;
            `;

            const overpassResp = await fetch(OVERPASS_URL, {
                method: 'POST',
                body: `data=${encodeURIComponent(query)}`,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            if (!overpassResp.ok) throw new Error('Errore nella ricerca dei segnali (Overpass API)');
            const overpassData = await overpassResp.json();

            const elements = (overpassData.elements || []).map(el => ({
                id: el.id,
                lat: el.lat,
                lon: el.lon,
                tags: el.tags || {},
            }));

            setResults(elements);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const saveToken = (e) => {
        e.preventDefault();
        const t = tokenInput.trim();
        if (t) {
            localStorage.setItem(MAPILLARY_LS_KEY, t);
            setMapillaryToken(t);
        } else {
            localStorage.removeItem(MAPILLARY_LS_KEY);
            setMapillaryToken('');
        }
        setShowTokenPanel(false);
    };

    const removeToken = () => {
        localStorage.removeItem(MAPILLARY_LS_KEY);
        setMapillaryToken('');
        setTokenInput('');
        setShowTokenPanel(true);
    };

    const handleImport = async (result, type) => {
        setImportingId(result.id);
        try {
            await apiService.importVirtualSign({
                type,
                latitude: result.lat,
                longitude: result.lon,
                status: 'buono',
                notes: searchedVia || via,
            });
            setImportedIds(prev => new Set(prev).add(result.id));
            // Notifica DesktopView di ricaricare la lista segnali
            window.dispatchEvent(new CustomEvent('catasto:signs-updated'));
        } catch (err) {
            alert('Errore nell\'importazione del segnale: ' + err.message);
        } finally {
            setImportingId(null);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

            {/* ── Sezione superiore: form + configurazione ── */}
            <div style={{
                padding: '1rem 1.5rem',
                flexShrink: 0,
                overflowY: 'auto',
                borderBottom: center ? '1px solid var(--gray-200)' : 'none',
                maxHeight: center ? '210px' : '100%',
            }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: center ? '0.5rem' : '0.4rem' }}>
                    🛰️ Censimento Virtuale
                </h2>

                {/* Descrizione: nascosta quando i risultati occupano la metà inferiore */}
                {!center && (
                    <p style={{ color: 'var(--gray-600)', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
                        Cerca i segnali stradali già rilevati e catalogati dalla community OpenStreetMap (Mapillary/Overpass)
                        in una determinata via, per pianificare il censimento sul campo. I segnali approvati vengono importati
                        nel Catasto come "da verificare" e compariranno sulla mappa dei tecnici sul campo.
                    </p>
                )}

                {/* Pannello configurazione token Mapillary */}
                {showTokenPanel ? (
                    <div className="card" style={{ marginBottom: '1rem', background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
                        <div style={{ fontWeight: '700', marginBottom: '0.5rem' }}>📸 Configura token Mapillary (opzionale)</div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '0.75rem' }}>
                            Con un token Mapillary puoi vedere le foto reali dei cartelli rilevati dalla community.
                            Per ottenerlo gratuitamente: crea un account su{' '}
                            <a href="https://www.mapillary.com" target="_blank" rel="noreferrer">mapillary.com</a>,
                            poi vai su{' '}
                            <a href="https://www.mapillary.com/dashboard/developers" target="_blank" rel="noreferrer">
                                Dashboard → Developers
                            </a>{' '}
                            e crea una nuova applicazione — il <strong>Client Token</strong> è quello da incollare qui.
                        </p>
                        <form onSubmit={saveToken} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <input
                                type="text"
                                className="form-input"
                                style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.8rem' }}
                                placeholder="Incolla qui il tuo Client Token Mapillary..."
                                value={tokenInput}
                                onChange={e => setTokenInput(e.target.value)}
                            />
                            <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>💾 Salva token</button>
                            {mapillaryToken && (
                                <button type="button" className="btn btn-secondary" onClick={() => setShowTokenPanel(false)}>Annulla</button>
                            )}
                        </form>
                    </div>
                ) : mapillaryToken ? (
                    <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                        <span style={{ color: '#16a34a' }}>✅ Token Mapillary configurato</span>
                        <button className="btn btn-secondary" style={{ padding: '0.15rem 0.5rem', fontSize: '0.72rem' }}
                            onClick={() => { setTokenInput(mapillaryToken); setShowTokenPanel(true); }}>✏️ Modifica</button>
                        <button className="btn btn-secondary" style={{ padding: '0.15rem 0.5rem', fontSize: '0.72rem', color: '#dc2626' }}
                            onClick={removeToken}>🗑️ Rimuovi</button>
                    </div>
                ) : null}

                {/* Form di ricerca */}
                <div className="card" style={{ marginBottom: '0.75rem', padding: '0.75rem 1rem' }}>
                    <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ flex: 2, minWidth: '200px', marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.8rem' }}>Nome via</label>
                            <input type="text" className="form-input" value={via}
                                onChange={e => setVia(e.target.value)} placeholder="Es: Via Roma, Milano" />
                        </div>
                        <div className="form-group" style={{ flex: 1, minWidth: '130px', marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.8rem' }}>Raggio (m)</label>
                            <input type="number" min="50" step="50" className="form-input"
                                value={radius} onChange={e => setRadius(e.target.value)} />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={loading} style={{ whiteSpace: 'nowrap' }}>
                            {loading ? '🔍 Ricerca...' : '🔍 Cerca segnali'}
                        </button>
                    </form>
                </div>

                {error && (
                    <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#dc2626', borderRadius: 'var(--border-radius)', fontSize: '0.875rem' }}>
                        ⚠️ {error}
                    </div>
                )}

                {center && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginTop: '0.25rem' }}>
                        📍 <strong>{searchedVia}</strong> — <strong>{results.length}</strong> segnale/i nel raggio di {radius}m
                    </div>
                )}
            </div>

            {/* ── Sezione inferiore: mappa fissa | card scrollabili ── */}
            {center && (
                <div style={{ flex: 1, display: 'flex', gap: '1rem', padding: '1rem 1.5rem 1.5rem', minHeight: 0 }}>

                    {/* Mappa — colonna sinistra, occupa tutta l'altezza disponibile */}
                    <div style={{
                        width: '400px', flexShrink: 0,
                        borderRadius: 'var(--border-radius)', overflow: 'hidden',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                    }}>
                        <MapContainer center={center} zoom={16} style={{ height: '100%', width: '100%' }}>
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <FlyToCenter center={center} />
                            <Circle center={center} radius={parseInt(radius, 10)} pathOptions={{ color: '#3b82f6', fillOpacity: 0.05 }} />
                            <Marker position={center}>
                                <Popup>📍 {searchedVia}</Popup>
                            </Marker>
                            {results.map(r => (
                                <Marker
                                    key={r.id}
                                    position={[r.lat, r.lon]}
                                    icon={hoveredId === r.id ? hoveredCensusIcon : normalCensusIcon}
                                    eventHandlers={{
                                        mouseover: () => setHoveredId(r.id),
                                        mouseout: () => setHoveredId(null),
                                    }}
                                >
                                    <Popup>
                                        <strong>{classifyOsmSign(r.tags).icon} {classifyOsmSign(r.tags).label}</strong>
                                        <br />
                                        {Object.entries(r.tags).map(([k, v]) => (
                                            <div key={k} style={{ fontSize: '0.75rem' }}>{k}: {v}</div>
                                        ))}
                                        <br />
                                        <a href={`https://www.openstreetmap.org/node/${r.id}`} target="_blank" rel="noreferrer">
                                            Apri su OpenStreetMap
                                        </a>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    </div>

                    {/* Card — colonna destra, scrollabile indipendentemente */}
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem' }}>
                        {results.length > 0 ? (
                            results.map(r => (
                                <VirtualSignCard
                                    key={r.id}
                                    result={r}
                                    via={searchedVia || via}
                                    onImport={handleImport}
                                    importing={importingId === r.id}
                                    imported={importedIds.has(r.id)}
                                    mapillaryToken={mapillaryToken}
                                    isHovered={hoveredId === r.id}
                                    onHoverStart={() => setHoveredId(r.id)}
                                    onHoverEnd={() => setHoveredId(null)}
                                />
                            ))
                        ) : (
                            <div style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--gray-600)' }}>
                                Nessun segnale catalogato dalla community trovato in questa zona.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default VirtualCensusTab;
