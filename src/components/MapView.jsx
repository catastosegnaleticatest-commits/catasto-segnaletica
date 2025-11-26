import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import localStorageService from '../services/localStorage';
import apiService from '../services/api';

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

// Componente Popup con foto
function SignPopupContent({ sign, onOpenDetails }) {
    const [photo, setPhoto] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadPhoto = async () => {
            try {
                // Prima prova da locale
                const localPhoto = await localStorageService.getPhoto(sign.id);
                if (localPhoto) {
                    setPhoto(localPhoto);
                } else {
                    // Se non c'è, usa URL server
                    setPhoto(apiService.getPhotoUrl(sign.id));
                }
            } catch (error) {
                console.error('Errore foto popup:', error);
                setPhoto(apiService.getPhotoUrl(sign.id));
            } finally {
                setLoading(false);
            }
        };
        loadPhoto();
    }, [sign.id]);

    return (
        <div style={{ minWidth: '220px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>{sign.type === 'divieto' ? '🚫' : sign.type === 'obbligo' ? '🔵' : sign.type === 'pericolo' ? '⚠️' : sign.type === 'indicazione' ? 'ℹ️' : '📍'}</span>
                <strong style={{ textTransform: 'capitalize', fontSize: '1rem' }}>{sign.type}</strong>
            </div>

            {loading ? (
                <div style={{ height: '120px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', marginBottom: '0.5rem' }}>
                    <span className="spinner" style={{ width: '20px', height: '20px' }}></span>
                </div>
            ) : photo ? (
                <div style={{ marginBottom: '0.5rem' }}>
                    <img
                        src={photo}
                        alt="Segnale"
                        style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '4px' }}
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.style.display = 'none';
                        }}
                    />
                </div>
            ) : null}

            <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                <span className={`badge ${sign.status === 'ottimo' || sign.status === 'buono' ? 'badge-success' : sign.status === 'discreto' ? 'badge-warning' : 'badge-danger'}`}>
                    {sign.status}
                </span>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginBottom: '0.75rem' }}>
                {sign.latitude.toFixed(6)}, {sign.longitude.toFixed(6)}
            </div>

            <button
                className="btn btn-sm btn-primary"
                style={{ width: '100%', fontSize: '0.875rem', padding: '0.4rem' }}
                onClick={() => onOpenDetails(sign)}
            >
                👁️ Vedi Dettagli
            </button>
        </div>
    );
}

function MapView({ signs, onSignClick, onOpenDetails }) {
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
                                    <SignPopupContent sign={sign} onOpenDetails={onOpenDetails} />
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
