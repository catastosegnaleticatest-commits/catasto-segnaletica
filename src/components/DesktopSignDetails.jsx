import { useState, useEffect } from 'react';
import localStorageService from '../services/localStorage';
import apiService from '../services/api';

function DesktopSignDetails({ sign, onBack }) {
    const [photo, setPhoto] = useState(null);
    const [loading, setLoading] = useState(true);

    // Verifica che il segnale sia valido
    if (!sign || !sign.id) {
        return (
            <div className="card">
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                    <h3>Segnale non trovato</h3>
                    <p>Il segnale richiesto non è disponibile.</p>
                    <button className="btn btn-primary" onClick={onBack} style={{ marginTop: '1rem' }}>
                        ← Torna indietro
                    </button>
                </div>
            </div>
        );
    }

    useEffect(() => {
        loadPhoto();
    }, [sign.id]);

    const loadPhoto = async () => {
        try {
            // Prima prova da locale
            const localPhoto = await localStorageService.getPhoto(sign.id);
            if (localPhoto) {
                setPhoto(localPhoto);
                setLoading(false);
                return;
            }
            
            // Se non c'è locale, prova dal server
            const serverPhoto = await apiService.getPhotoAsDataUrl(sign.id);
            if (serverPhoto) {
                setPhoto(serverPhoto);
            } else {
                setPhoto(null);
            }
        } catch (error) {
            console.error('Errore caricamento foto:', error);
            setPhoto(null);
        } finally {
            setLoading(false);
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

    const getStatusColor = (status) => {
        const colors = {
            ottimo: '#10b981',
            buono: '#3b82f6',
            discreto: '#f59e0b',
            danneggiato: '#ef4444'
        };
        return colors[status] || '#6b7280';
    };

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--gray-200)', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button className="btn btn-secondary" onClick={onBack}>
                        ← Indietro
                    </button>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>
                        Dettagli Segnale #{sign.id}
                    </h2>
                </div>
                <span className="badge" style={{
                    background: getStatusColor(sign.status || 'buono'),
                    color: 'white',
                    fontSize: '1rem',
                    padding: '0.5rem 1rem'
                }}>
                    {(sign.status || 'buono').toUpperCase()}
                </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* Colonna Sinistra: Foto e Mappa */}
                <div>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>Foto Segnale</h3>
                        {loading ? (
                            <div style={{ height: '300px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--border-radius)' }}>
                                <div className="spinner"></div>
                            </div>
                        ) : photo ? (
                            <img
                                src={photo}
                                alt="Segnale"
                                style={{
                                    width: '100%',
                                    maxHeight: '400px',
                                    objectFit: 'contain',
                                    borderRadius: 'var(--border-radius)',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                    background: '#f3f4f6'
                                }}
                                onError={(e) => {
                                    e.target.onerror = null;
                                    // Placeholder SVG locale (grigio con testo)
                                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KIDxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmM2Y0ZjYiLz4KIDx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM2YjcyODAiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkZvdG8gbm9uIGRpc3BvbmliaWxlPC90ZXh0Pgo8L3N2Zz4=';
                                }}
                            />
                        ) : (
                            <div style={{
                                padding: '3rem',
                                background: '#f3f4f6',
                                borderRadius: 'var(--border-radius)',
                                textAlign: 'center',
                                color: 'var(--gray-500)'
                            }}>
                                Nessuna foto disponibile
                            </div>
                        )}
                    </div>
                </div>

                {/* Colonna Destra: Dettagli */}
                <div>
                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>Informazioni Generali</h3>
                        <div style={{ display: 'grid', gap: '1rem', background: 'var(--gray-50)', padding: '1.5rem', borderRadius: 'var(--border-radius)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ fontSize: '2rem' }}>{getSignIcon(sign.type || 'indicazione')}</span>
                                <div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>TIPO</div>
                                    <div style={{ fontWeight: '600', textTransform: 'capitalize', fontSize: '1.125rem' }}>{sign.type || 'N/A'}</div>
                                </div>
                            </div>

                            <div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>POSIZIONE GPS</div>
                                {sign.latitude && sign.longitude ? (
                                    <>
                                        <div style={{ fontFamily: 'monospace', fontSize: '1.125rem' }}>
                                            {Number(sign.latitude).toFixed(6)}, {Number(sign.longitude).toFixed(6)}
                                        </div>
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${sign.latitude},${sign.longitude}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ display: 'inline-block', marginTop: '0.25rem', fontSize: '0.875rem', color: 'var(--primary)' }}
                                        >
                                            Apri in Google Maps ↗️
                                        </a>
                                    </>
                                ) : (
                                    <div style={{ color: 'var(--gray-500)' }}>Posizione non disponibile</div>
                                )}
                            </div>

                            <div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>DATA INSTALLAZIONE</div>
                                <div>{sign.installation_date ? new Date(sign.installation_date).toLocaleDateString('it-IT') : '-'}</div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>Note e Altro</h3>
                        <div style={{ background: 'var(--gray-50)', padding: '1.5rem', borderRadius: 'var(--border-radius)' }}>
                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '0.25rem' }}>NOTE</div>
                                <div style={{ whiteSpace: 'pre-wrap' }}>{sign.notes || 'Nessuna nota specificata.'}</div>
                            </div>

                            <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '1rem', marginTop: '1rem' }}>
                                <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>METADATI</div>
                                <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                                    <div><strong>Creato il:</strong> {sign.created_at ? new Date(sign.created_at).toLocaleString('it-IT') : 'N/A'}</div>
                                    <div><strong>Stato Sync:</strong> {sign.synced ? '✅ Sincronizzato' : '⏳ In attesa di sync'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DesktopSignDetails;
