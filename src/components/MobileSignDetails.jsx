import { useState, useEffect } from 'react';
import localStorageService from '../services/localStorage';

function MobileSignDetails({ sign, onBack }) {
    const [photo, setPhoto] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPhoto();
    }, [sign.id]);

    const loadPhoto = async () => {
        try {
            const photoData = await localStorageService.getPhoto(sign.id);
            setPhoto(photoData);
        } catch (error) {
            console.error('Errore caricamento foto:', error);
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

    const getStatusLabel = (status) => {
        const labels = {
            ottimo: 'Ottimo',
            buono: 'Buono',
            discreto: 'Discreto',
            danneggiato: 'Danneggiato'
        };
        return labels[status] || status;
    };

    return (
        <div className="container">
            <div style={{ marginBottom: '1rem' }}>
                <button className="btn btn-secondary" onClick={onBack}>
                    ← Indietro
                </button>
            </div>

            <div className="card" style={{ borderTop: `4px solid ${getStatusColor(sign.status)}` }}>
                <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
                        {getSignIcon(sign.type)}
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', textTransform: 'capitalize' }}>
                        {sign.type}
                    </h2>
                    <span className="badge" style={{
                        background: getStatusColor(sign.status),
                        color: 'white',
                        marginTop: '0.5rem',
                        display: 'inline-block'
                    }}>
                        {getStatusLabel(sign.status)}
                    </span>
                </div>

                {loading ? (
                    <div style={{ height: '200px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--border-radius)', marginBottom: '1.5rem' }}>
                        <div className="spinner"></div>
                    </div>
                ) : photo ? (
                    <div style={{ marginBottom: '1.5rem' }}>
                        <img
                            src={photo}
                            alt="Segnale"
                            style={{
                                width: '100%',
                                borderRadius: 'var(--border-radius)',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                        />
                    </div>
                ) : (
                    <div style={{
                        padding: '2rem',
                        background: '#f3f4f6',
                        borderRadius: 'var(--border-radius)',
                        textAlign: 'center',
                        color: 'var(--gray-500)',
                        marginBottom: '1.5rem'
                    }}>
                        Nessuna foto disponibile
                    </div>
                )}

                <div style={{ display: 'grid', gap: '1rem' }}>
                    <div style={{ padding: '1rem', background: 'var(--gray-50)', borderRadius: 'var(--border-radius-sm)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginBottom: '0.25rem' }}>
                            POSIZIONE GPS
                        </div>
                        <div style={{ fontWeight: '600', fontFamily: 'monospace' }}>
                            {sign.latitude.toFixed(6)}, {sign.longitude.toFixed(6)}
                        </div>
                        <a
                            href={`https://www.google.com/maps/search/?api=1&query=${sign.latitude},${sign.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-block', marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--primary)' }}
                        >
                            Apri in Google Maps ↗️
                        </a>
                    </div>

                    {sign.notes && (
                        <div style={{ padding: '1rem', background: 'var(--gray-50)', borderRadius: 'var(--border-radius-sm)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginBottom: '0.25rem' }}>
                                NOTE
                            </div>
                            <div>{sign.notes}</div>
                        </div>
                    )}

                    <div style={{ padding: '1rem', background: 'var(--gray-50)', borderRadius: 'var(--border-radius-sm)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginBottom: '0.25rem' }}>
                            DETTAGLI TECNICI
                        </div>
                        <div style={{ fontSize: '0.875rem', display: 'grid', gap: '0.25rem' }}>
                            <div><strong>ID:</strong> {sign.id}</div>
                            <div><strong>Data Installazione:</strong> {new Date(sign.installation_date).toLocaleDateString('it-IT')}</div>
                            <div><strong>Stato Sync:</strong> {sign.synced ? '✅ Sincronizzato' : '⏳ In attesa'}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MobileSignDetails;
