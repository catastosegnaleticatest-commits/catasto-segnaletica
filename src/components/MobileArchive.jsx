import { useState, useEffect } from 'react';
import localStorageService from '../services/localStorage';

function MobileArchive({ user, onDataChange, onBack }) {
    const [signs, setSigns] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSigns();
    }, []);

    const loadSigns = async () => {
        setLoading(true);
        try {
            const signsData = await localStorageService.getSigns();
            setSigns(signsData);
        } catch (error) {
            console.error('Errore caricamento segnali:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (signId) => {
        if (!confirm('Sei sicuro di voler eliminare questo segnale?')) return;

        try {
            await localStorageService.deleteSign(signId);
            alert('✅ Segnale eliminato!');
            loadSigns();
            if (onDataChange) onDataChange();
        } catch (error) {
            alert('❌ Errore: ' + error.message);
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
        <div className="container">
            <div style={{ marginBottom: '1rem' }}>
                <button className="btn btn-secondary" onClick={onBack}>
                    ← Indietro
                </button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                    📋 Archivio Segnali
                </h2>
                <p style={{ color: 'var(--gray-600)' }}>
                    {signs.length} segnali totali
                </p>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>
                    Caricamento...
                </div>
            ) : signs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>
                    Nessun segnale presente
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {signs.map((sign) => (
                        <div
                            key={sign.id}
                            className="card"
                            style={{
                                borderLeft: `4px solid ${getStatusColor(sign.status)}`,
                                padding: '1rem'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '1.5rem' }}>{getSignIcon(sign.type)}</span>
                                    <div>
                                        <div style={{ fontWeight: '700', fontSize: '1.125rem' }}>
                                            {sign.type.charAt(0).toUpperCase() + sign.type.slice(1)}
                                        </div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                                            {sign.status}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    className="btn btn-sm"
                                    onClick={() => handleDelete(sign.id)}
                                    style={{ background: 'var(--danger)', color: 'white', padding: '0.5rem 0.75rem' }}
                                >
                                    🗑️
                                </button>
                            </div>

                            <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '0.5rem' }}>
                                <strong>📍 Coordinate:</strong><br />
                                {sign.latitude.toFixed(6)}, {sign.longitude.toFixed(6)}
                            </div>

                            {sign.notes && (
                                <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '0.5rem' }}>
                                    <strong>📝 Note:</strong> {sign.notes}
                                </div>
                            )}

                            {sign.installation_date && (
                                <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                                    <strong>📅 Installato:</strong> {new Date(sign.installation_date).toLocaleDateString('it-IT')}
                                </div>
                            )}

                            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                                ✅ Su Firestore
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default MobileArchive;
