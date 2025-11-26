import { useState, useEffect } from 'react';
import localStorageService from '../services/localStorage';
import apiService from '../services/api';

function DesktopSignDetails({ sign, onBack }) {
    const [photo, setPhoto] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPhoto();
    }, [sign.id]);

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
            console.error('Errore caricamento foto:', error);
            // Fallback su URL server in caso di errore
            setPhoto(apiService.getPhotoUrl(sign.id));
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
                    background: getStatusColor(sign.status),
                    color: 'white',
                    fontSize: '1rem',
                    padding: '0.5rem 1rem'
                }}>
                    {sign.status.toUpperCase()}
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
                                    e.target.src = 'https://via.placeholder.com/400x300?text=Foto+non+disponibile';
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
                                <span style={{ fontSize: '2rem' }}>{getSignIcon(sign.type)}</span>
                                <div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>TIPO</div>
                                    <div style={{ fontWeight: '600', textTransform: 'capitalize', fontSize: '1.125rem' }}>{sign.type}</div>
                                </div>
                            </div>

                            <div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>POSIZIONE GPS</div>
                                <div style={{ fontFamily: 'monospace', fontSize: '1.125rem' }}>
                                    {sign.latitude.toFixed(6)}, {sign.longitude.toFixed(6)}
                                </div>
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${sign.latitude},${sign.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ display: 'inline-block', marginTop: '0.25rem', fontSize: '0.875rem', color: 'var(--primary)' }}
                                >
                                    Apri in Google Maps ↗️
                                </a>
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
                                    <div><strong>Creato il:</strong> {new Date(sign.created_at).toLocaleString('it-IT')}</div>
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
