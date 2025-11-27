import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
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

// Componente Tooltip personalizzato
function SignTooltip({ sign, position, onOpenDetails, onClose, onMouseEnter, onMouseLeave }) {
    const [photo, setPhoto] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadPhoto = async () => {
            try {
                // Prima prova da locale
                const localPhoto = await localStorageService.getPhoto(sign.id);
                if (localPhoto) {
                    setPhoto(localPhoto);
                    setLoading(false);
                    return;
                }
                
                // Prova a caricare la prima foto dal server (nuova API)
                try {
                    const photos = await apiService.getSignPhotos(sign.id);
                    if (photos && photos.length > 0) {
                        // Ordina per primaria e display_order
                        const sortedPhotos = photos.sort((a, b) => {
                            if (a.is_primary && !b.is_primary) return -1;
                            if (!a.is_primary && b.is_primary) return 1;
                            return (a.display_order || 0) - (b.display_order || 0);
                        });
                        const firstPhoto = await apiService.getPhotoByIdAsDataUrl(sortedPhotos[0].id);
                        if (firstPhoto) {
                            setPhoto(firstPhoto);
                            setLoading(false);
                            return;
                        }
                    }
                } catch (e) {
                    console.log('Nuova API foto non disponibile, provo vecchia API');
                }
                
                // Fallback alla vecchia API
                const serverPhoto = await apiService.getPhotoAsDataUrl(sign.id);
                if (serverPhoto) {
                    setPhoto(serverPhoto);
                } else {
                    setPhoto(null);
                }
            } catch (error) {
                console.error('Errore caricamento foto tooltip:', error);
                setPhoto(null);
            } finally {
                setLoading(false);
            }
        };
        loadPhoto();
    }, [sign.id]);

    const getTypeIcon = (type) => {
        const icons = {
            'divieto': '🚫',
            'obbligo': '🔵',
            'pericolo': '⚠️',
            'indicazione': 'ℹ️'
        };
        return icons[type] || '📍';
    };

    return (
        <div
            className="sign-tooltip"
            style={{
                position: 'fixed',
                left: `${position.x}px`,
                top: `${position.y}px`,
                transform: 'translate(-50%, calc(-100% - 15px))',
                zIndex: 10000,
                background: 'white',
                borderRadius: '8px',
                padding: '0.75rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                minWidth: '200px',
                maxWidth: '250px',
                width: '200px',
                pointerEvents: 'auto'
            }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>{getTypeIcon(sign.type)}</span>
                <strong style={{ textTransform: 'capitalize', fontSize: '0.9rem' }}>{sign.type || 'N/A'}</strong>
            </div>

            {loading ? (
                <div style={{ height: '80px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Caricamento...</span>
                </div>
            ) : photo ? (
                <div style={{ marginBottom: '0.5rem', height: '100px', overflow: 'hidden', borderRadius: '4px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img
                        src={photo}
                        alt="Segnale"
                        style={{ 
                            maxWidth: '100%', 
                            maxHeight: '100%', 
                            width: 'auto',
                            height: 'auto',
                            objectFit: 'contain', 
                            borderRadius: '4px'
                        }}
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.style.display = 'none';
                        }}
                    />
                </div>
            ) : null}

            <div style={{ marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                <span className={`badge ${sign.status === 'ottimo' || sign.status === 'buono' ? 'badge-success' : sign.status === 'discreto' ? 'badge-warning' : 'badge-danger'}`}>
                    {sign.status || 'N/A'}
                </span>
            </div>

            {sign.notes && (
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem', maxHeight: '40px', overflow: 'hidden' }}>
                    {sign.notes}
                </div>
            )}

            <button
                className="btn btn-sm btn-primary"
                style={{ 
                    width: '100%', 
                    fontSize: '0.75rem', 
                    padding: '0.35rem',
                    cursor: 'pointer'
                }}
                onClick={() => {
                    if (onOpenDetails) onOpenDetails(sign);
                    onClose();
                }}
            >
                👁️ Dettagli
            </button>
        </div>
    );
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
                    setLoading(false);
                    return;
                }
                
                // Prova a caricare la prima foto dal server (nuova API)
                try {
                    const photos = await apiService.getSignPhotos(sign.id);
                    if (photos && photos.length > 0) {
                        // Ordina per primaria e display_order
                        const sortedPhotos = photos.sort((a, b) => {
                            if (a.is_primary && !b.is_primary) return -1;
                            if (!a.is_primary && b.is_primary) return 1;
                            return (a.display_order || 0) - (b.display_order || 0);
                        });
                        const firstPhoto = await apiService.getPhotoByIdAsDataUrl(sortedPhotos[0].id);
                        if (firstPhoto) {
                            setPhoto(firstPhoto);
                            setLoading(false);
                            return;
                        }
                    }
                } catch (e) {
                    console.log('Nuova API foto non disponibile, provo vecchia API');
                }
                
                // Fallback alla vecchia API
                const serverPhoto = await apiService.getPhotoAsDataUrl(sign.id);
                if (serverPhoto) {
                    setPhoto(serverPhoto);
                } else {
                    setPhoto(null);
                }
            } catch (error) {
                console.error('Errore foto popup:', error);
                setPhoto(null);
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
                <div style={{ marginBottom: '0.5rem', height: '140px', overflow: 'hidden', borderRadius: '4px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img
                        src={photo}
                        alt="Segnale"
                        style={{ 
                            maxWidth: '100%', 
                            maxHeight: '100%', 
                            width: 'auto',
                            height: 'auto',
                            objectFit: 'contain', 
                            borderRadius: '4px'
                        }}
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KIDxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmM2Y0ZjYiLz4KIDx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM2YjcyODAiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkZvdG8gbm9uIGRpc3BvbmliaWxlPC90ZXh0Pgo8L3N2Zz4=';
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
    const [hoveredSign, setHoveredSign] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [isTooltipHovered, setIsTooltipHovered] = useState(false);

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
                                    click: () => handleMarkerClick(sign),
                                    mouseover: (e) => {
                                        const marker = e.target;
                                        const latlng = marker.getLatLng();
                                        const map = marker._map;
                                        const point = map.latLngToContainerPoint(latlng);
                                        const container = map.getContainer();
                                        const rect = container.getBoundingClientRect();
                                        // Calcola posizione fissa sopra il marker
                                        setTooltipPos({
                                            x: rect.left + point.x,
                                            y: rect.top + point.y - 10 // Offset sopra il marker
                                        });
                                        setHoveredSign(sign);
                                    },
                                    mouseout: () => {
                                        // Chiudi solo se il mouse non è sul tooltip
                                        setTimeout(() => {
                                            if (!isTooltipHovered) {
                                                setHoveredSign(null);
                                            }
                                        }, 150);
                                    }
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

            {/* Tooltip personalizzato React */}
            {hoveredSign && (
                <SignTooltip 
                    sign={hoveredSign} 
                    position={tooltipPos}
                    onOpenDetails={onOpenDetails}
                    onClose={() => {
                        setIsTooltipHovered(false);
                        setHoveredSign(null);
                    }}
                    onMouseEnter={() => setIsTooltipHovered(true)}
                    onMouseLeave={() => {
                        setIsTooltipHovered(false);
                        setHoveredSign(null);
                    }}
                />
            )}

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
