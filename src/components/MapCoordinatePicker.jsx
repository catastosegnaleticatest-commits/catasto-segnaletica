import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix per icone marker di default in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Componente per gestire i click sulla mappa
function MapClickHandler({ onMapClick }) {
    useMapEvents({
        click: (e) => {
            onMapClick(e.latlng);
        }
    });
    return null;
}

function MapCoordinatePicker({ initialLat, initialLng, onCoordinateSelect, onClose }) {
    const [selectedPosition, setSelectedPosition] = useState(
        initialLat && initialLng ? [initialLat, initialLng] : [45.4845, 9.5200] // Truccazzano (MI)
    );
    const [marker, setMarker] = useState(
        initialLat && initialLng ? [initialLat, initialLng] : null
    );

    // Centro su Truccazzano se non ci sono coordinate iniziali
    const center = initialLat && initialLng ? [initialLat, initialLng] : [45.4845, 9.5200];
    const zoom = initialLat && initialLng ? 15 : 13;

    const handleMapClick = (latlng) => {
        const newPosition = [latlng.lat, latlng.lng];
        setSelectedPosition(newPosition);
        setMarker(newPosition);
    };

    const handleConfirm = () => {
        if (marker) {
            onCoordinateSelect(marker[0], marker[1]);
        }
    };

    const handleSearch = () => {
        const address = prompt('Inserisci un indirizzo o luogo da cercare:');
        if (!address) return;

        // Usa Nominatim (OpenStreetMap) per geocoding
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`)
            .then(res => res.json())
            .then(data => {
                if (data && data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lon = parseFloat(data[0].lon);
                    setSelectedPosition([lat, lon]);
                    setMarker([lat, lon]);
                } else {
                    alert('Indirizzo non trovato');
                }
            })
            .catch(error => {
                console.error('Errore ricerca indirizzo:', error);
                alert('Errore nella ricerca dell\'indirizzo');
            });
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '2rem'
        }}>
            <div style={{
                background: 'white',
                borderRadius: 'var(--border-radius)',
                width: '90%',
                maxWidth: '1200px',
                height: '80vh',
                maxHeight: '800px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid var(--gray-200)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>
                            📍 Seleziona Posizione sulla Mappa
                        </h3>
                        <p style={{ margin: '0.25rem 0 0 0', color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                            Clicca sulla mappa per selezionare le coordinate precise
                        </p>
                    </div>
                    <button
                        className="btn btn-secondary"
                        onClick={onClose}
                        style={{ marginLeft: '1rem' }}
                    >
                        ✕ Chiudi
                    </button>
                </div>

                {/* Mappa */}
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    <MapContainer
                        center={center}
                        zoom={zoom}
                        style={{ height: '100%', width: '100%' }}
                        scrollWheelZoom={true}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MapClickHandler onMapClick={handleMapClick} />
                        {marker && (
                            <Marker position={marker} />
                        )}
                    </MapContainer>
                </div>

                {/* Footer con coordinate e azioni */}
                <div style={{
                    padding: '1.5rem',
                    borderTop: '1px solid var(--gray-200)',
                    background: 'var(--gray-50)'
                }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '0.25rem' }}>
                                Coordinate Selezionate
                            </div>
                            {marker ? (
                                <div style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: '600' }}>
                                    {marker[0].toFixed(6)}, {marker[1].toFixed(6)}
                                </div>
                            ) : (
                                <div style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
                                    Clicca sulla mappa per selezionare
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={handleSearch}
                            >
                                🔍 Cerca Indirizzo
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={onClose}
                            >
                                Annulla
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleConfirm}
                                disabled={!marker}
                            >
                                ✅ Conferma Coordinate
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MapCoordinatePicker;

