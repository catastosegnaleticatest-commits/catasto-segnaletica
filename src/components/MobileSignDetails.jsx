import { useState } from 'react';
import EditSignModal from './EditSignModal';

function MobileSignDetails({ sign: initialSign, onBack }) {
    const [sign, setSign] = useState(initialSign);
    const [showEditModal, setShowEditModal] = useState(false);

    const getSignIcon = (type) => {
        const icons = { divieto: '🚫', obbligo: '🔵', pericolo: '⚠️', indicazione: 'ℹ️', precedenza: '🔺', passo_carrabile: '🚪' };
        return icons[type] || '📍';
    };

    const getStatusColor = (status) => {
        const colors = { ottimo: '#10b981', buono: '#3b82f6', discreto: '#f59e0b', danneggiato: '#ef4444' };
        return colors[status] || '#6b7280';
    };

    const getStatusLabel = (status) => {
        const labels = { ottimo: 'Ottimo', buono: 'Buono', discreto: 'Discreto', danneggiato: 'Danneggiato' };
        return labels[status] || status;
    };

    return (
        <>
            {showEditModal && (
                <EditSignModal
                    sign={sign}
                    onSaved={(updated) => {
                        setSign(updated);
                        setShowEditModal(false);
                    }}
                    onClose={() => setShowEditModal(false)}
                />
            )}

            <div className="container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <button className="btn btn-secondary" onClick={onBack}>← Indietro</button>
                    <button className="btn btn-secondary" onClick={() => setShowEditModal(true)} style={{ fontSize: '0.875rem' }}>
                        ✏️ Modifica
                    </button>
                </div>

                <div className="card" style={{ borderTop: `4px solid ${getStatusColor(sign.status)}` }}>
                    <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{getSignIcon(sign.type)}</div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', textTransform: 'capitalize' }}>{sign.type}</h2>
                        <span className="badge" style={{ background: getStatusColor(sign.status), color: 'white', marginTop: '0.5rem', display: 'inline-block' }}>
                            {getStatusLabel(sign.status)}
                        </span>
                    </div>

                    {sign.photo ? (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <img src={sign.photo} alt="Segnale" style={{ width: '100%', borderRadius: 'var(--border-radius)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                        </div>
                    ) : (
                        <div style={{ padding: '2rem', background: '#f3f4f6', borderRadius: 'var(--border-radius)', textAlign: 'center', color: 'var(--gray-500)', marginBottom: '1.5rem' }}>
                            Nessuna foto disponibile
                        </div>
                    )}

                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div style={{
                            padding: '1rem', borderRadius: 'var(--border-radius-sm)',
                            background: sign.ordinanza_rif ? '#dcfce7' : '#fee2e2',
                            border: sign.ordinanza_rif ? '1px solid #86efac' : '1px solid #fca5a5'
                        }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginBottom: '0.25rem' }}>RIFERIMENTO ORDINANZA</div>
                            {sign.ordinanza_rif ? (
                                <div style={{ fontWeight: '600', color: '#166534' }}>📄 {sign.ordinanza_rif}</div>
                            ) : (
                                <div style={{ fontWeight: '700', color: '#991b1b' }}>⚠️ Non Regolarizzato</div>
                            )}
                        </div>

                        <div style={{ padding: '1rem', background: 'var(--gray-50)', borderRadius: 'var(--border-radius-sm)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginBottom: '0.25rem' }}>POSIZIONE GPS</div>
                            <div style={{ fontWeight: '600', fontFamily: 'monospace' }}>
                                {parseFloat(sign.latitude).toFixed(6)}, {parseFloat(sign.longitude).toFixed(6)}
                            </div>
                            <a href={`https://www.google.com/maps/search/?api=1&query=${sign.latitude},${sign.longitude}`}
                                target="_blank" rel="noopener noreferrer"
                                style={{ display: 'inline-block', marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--primary)' }}>
                                Apri in Google Maps ↗️
                            </a>
                        </div>

                        {sign.type === 'passo_carrabile' && (
                            <div style={{ padding: '1rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 'var(--border-radius-sm)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginBottom: '0.25rem' }}>NUMERO AUTORIZZAZIONE</div>
                                <div style={{ fontWeight: '700', color: '#0369a1', marginBottom: '0.5rem' }}>{sign.numero_autorizzazione || 'Non specificato'}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginBottom: '0.25rem' }}>PROPRIETARIO</div>
                                <div style={{ fontWeight: '700', color: '#0369a1' }}>{sign.proprietario || 'Non specificato'}</div>
                            </div>
                        )}

                        {sign.notes && (
                            <div style={{ padding: '1rem', background: 'var(--gray-50)', borderRadius: 'var(--border-radius-sm)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginBottom: '0.25rem' }}>NOTE</div>
                                <div>{sign.notes}</div>
                            </div>
                        )}

                        <div style={{ padding: '1rem', background: 'var(--gray-50)', borderRadius: 'var(--border-radius-sm)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginBottom: '0.25rem' }}>DETTAGLI TECNICI</div>
                            <div style={{ fontSize: '0.875rem', display: 'grid', gap: '0.25rem' }}>
                                <div><strong>ID:</strong> #{sign.id}</div>
                                {sign.installation_date && (
                                    <div><strong>Data Installazione:</strong> {new Date(sign.installation_date).toLocaleDateString('it-IT')}</div>
                                )}
                                <div><strong>Archiviazione:</strong> ✅ Su Firestore</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default MobileSignDetails;
