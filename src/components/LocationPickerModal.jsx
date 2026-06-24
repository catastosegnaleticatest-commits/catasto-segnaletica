import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function MapClickHandler({ onMapClick }) {
    useMapEvents({ click: (e) => onMapClick(e.latlng) });
    return null;
}

function FlyTo({ target }) {
    const map = useMap();
    useEffect(() => {
        if (target) map.flyTo(target, 17, { animate: true, duration: 0.6 });
    }, [target, map]);
    return null;
}

export default function LocationPickerModal({ lat, lng, onConfirm, onClose }) {
    const hasInitial = lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng));
    const initial = hasInitial ? [parseFloat(lat), parseFloat(lng)] : [45.4642, 9.19]; // Milano default

    const [markerPos, setMarkerPos] = useState(hasInitial ? initial : null);
    const [flyTarget, setFlyTarget] = useState(null);
    const [addressQuery, setAddressQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState(null);

    const handleSearch = async (e) => {
        e.preventDefault();
        const q = addressQuery.trim();
        if (!q) return;
        setSearching(true);
        setSearchError(null);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`,
                { headers: { 'Accept-Language': 'it', 'User-Agent': 'CatastoSegnaletica/1.0' } }
            );
            const data = await res.json();
            if (!data.length) { setSearchError('Indirizzo non trovato'); return; }
            const newPos = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
            setMarkerPos(newPos);
            setFlyTarget(newPos);
        } catch {
            setSearchError('Errore di rete');
        } finally {
            setSearching(false);
        }
    };

    // Blocca scroll della pagina mentre la modale è aperta
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 9995,
                background: 'rgba(0,0,0,0.65)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: 'min(720px, 96vw)',
                    background: '#1e293b',
                    borderRadius: 16,
                    overflow: 'hidden',
                    display: 'flex', flexDirection: 'column',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.55)',
                    maxHeight: '92vh',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
                    <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.95rem' }}>📍 Scegli posizione sulla mappa</span>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.15rem', padding: '2px 6px', lineHeight: 1 }}>✕</button>
                </div>

                {/* Barra ricerca indirizzo */}
                <div style={{ padding: '0.6rem 1.25rem', background: '#162032', borderBottom: '1px solid #2d3f58' }}>
                    <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                            type="text"
                            value={addressQuery}
                            onChange={e => { setAddressQuery(e.target.value); setSearchError(null); }}
                            placeholder="Cerca indirizzo per centrare la mappa…"
                            style={{
                                flex: 1, background: '#0f172a',
                                border: `1px solid ${searchError ? '#ef4444' : '#334155'}`,
                                borderRadius: 7, color: '#f1f5f9',
                                padding: '0.38rem 0.75rem', fontSize: '0.85rem', outline: 'none',
                            }}
                        />
                        <button
                            type="submit"
                            disabled={searching}
                            style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 7, padding: '0.38rem 0.9rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.85rem' }}
                        >
                            {searching ? '…' : '🔍 Cerca'}
                        </button>
                    </form>
                    {searchError
                        ? <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: '0.2rem' }}>{searchError}</div>
                        : <div style={{ color: '#475569', fontSize: '0.72rem', marginTop: '0.2rem' }}>Clicca sulla mappa per impostare il punto · oppure trascina il marker</div>
                    }
                </div>

                {/* Mappa */}
                <div style={{ flex: 1, minHeight: '380px' }}>
                    <MapContainer
                        center={initial}
                        zoom={hasInitial ? 17 : 10}
                        style={{ height: '100%', width: '100%', minHeight: '380px' }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MapClickHandler onMapClick={(latlng) => setMarkerPos([latlng.lat, latlng.lng])} />
                        <FlyTo target={flyTarget} />
                        {markerPos && (
                            <Marker
                                position={markerPos}
                                draggable
                                eventHandlers={{
                                    dragend: (e) => {
                                        const ll = e.target.getLatLng();
                                        setMarkerPos([ll.lat, ll.lng]);
                                    },
                                }}
                            />
                        )}
                    </MapContainer>
                </div>

                {/* Footer */}
                <div style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #334155', background: '#162032', gap: '1rem' }}>
                    <span style={{ fontSize: '0.82rem', color: markerPos ? '#94a3b8' : '#475569', fontFamily: 'monospace', flexShrink: 0 }}>
                        {markerPos
                            ? `${markerPos[0].toFixed(6)},  ${markerPos[1].toFixed(6)}`
                            : 'Nessun punto selezionato — clicca sulla mappa'}
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        <button
                            onClick={onClose}
                            style={{ background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 8, padding: '0.45rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
                        >
                            Annulla
                        </button>
                        <button
                            onClick={() => markerPos && onConfirm(markerPos[0], markerPos[1])}
                            disabled={!markerPos}
                            style={{
                                background: markerPos ? '#22c55e' : '#334155',
                                color: '#fff', border: 'none', borderRadius: 8,
                                padding: '0.45rem 1.1rem', fontWeight: 600,
                                cursor: markerPos ? 'pointer' : 'not-allowed', fontSize: '0.875rem',
                            }}
                        >
                            ✓ Conferma posizione
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
