import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix per icone marker di default in Leaflet con Webpack/Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Componente per centrare la mappa sui marker
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

function MapView({ signs, onSignClick }) {
    const [selectedSign, setSelectedSign] = useState(null);

    // Centro Italia come default se non ci sono segnali
    const defaultCenter = [41.9028, 12.4964];
    const defaultZoom = 6;

    const getMarkerColor = (status) => {
        const colors = {
            'ottimo': '#10b981',
            'buono': '#3b82f6',
            'discreto': '#f59e0b',
            'danneggiato': '#ef4444'
        };
        return colors[status] || '#6b7280';
    };

    const createCustomIcon = (sign) => {
        const color = getMarkerColor(sign.status);
        return L.divIcon({
            className: 'custom-marker',
            html: `<div style="
                background-color: ${color};
                width: 30px;
                height: 30px;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                border: 3px solid white;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            "></div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 30],
            popupAnchor: [0, -30]
        });
    };

    const handleMarkerClick = (sign) => {
        setSelectedSign(sign);
        if (onSignClick) {
            onSignClick(sign);
        }
    };

    return (
        <div style={{ height: '100%', width: '100%', position: 'relative' }}>
            <MapContainer
                center={defaultCenter}
                zoom={defaultZoom}
                style={{ height: '100%', width: '100%', borderRadius: 'var(--border-radius)' }}
                scrollWheelZoom={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {signs && signs.length > 0 && (
                    <>
                        <MapBounds signs={signs} />
                        {signs.map((sign) => (
                            <Marker
                                key={sign.id}
                                position={[sign.latitude, sign.longitude]}
                                icon={createCustomIcon(sign)}
                                eventHandlers={{
                                    click: () => handleMarkerClick(sign)
                                }}
                            >
                                <Popup>
                                    <div style={{ minWidth: '200px' }}>
                                        <h3 style={{
                                            margin: '0 0 0.5rem 0',
                                            fontSize: '1rem',
                                            fontWeight: '700'
                                        }}>
                                            {sign.type.charAt(0).toUpperCase() + sign.type.slice(1)}
                                        </h3>
                                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                            <p style={{ margin: '0.25rem 0' }}>
                                                <strong>Stato:</strong> {sign.status}
                                            </p>
                                            <p style={{ margin: '0.25rem 0' }}>
                                                <strong>Coordinate:</strong><br />
                                                {sign.latitude.toFixed(6)}, {sign.longitude.toFixed(6)}
                                            </p>
                                            {sign.notes && (
                                                <p style={{ margin: '0.25rem 0' }}>
                                                    <strong>Note:</strong> {sign.notes}
                                                </p>
                                            )}
                                            {sign.installation_date && (
                                                <p style={{ margin: '0.25rem 0' }}>
                                                    <strong>Installato:</strong> {new Date(sign.installation_date).toLocaleDateString('it-IT')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </>
                )}
            </MapContainer>

            {/* Legenda */}
            <div style={{
                position: 'absolute',
                bottom: '20px',
                right: '20px',
                background: 'white',
                padding: '1rem',
                borderRadius: 'var(--border-radius)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                zIndex: 1000,
                fontSize: '0.875rem'
            }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '700' }}>
                    Stato Segnali
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981' }}></div>
                        <span>Ottimo</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#3b82f6' }}></div>
                        <span>Buono</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b' }}></div>
                        <span>Discreto</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }}></div>
                        <span>Danneggiato</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MapView;
