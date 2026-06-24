import { useState, useEffect } from 'react';
import localStorageService from '../services/localStorage';
import apiService from '../services/api';
import EditSignModal from './EditSignModal';

function MobileSignDetails({ sign: initialSign, onBack }) {
    const [sign, setSign] = useState(initialSign);
    const [photo, setPhoto] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);
    const [catastoOpen, setCatastoOpen] = useState(false);
    const [catastoData, setCatastoData] = useState(null);
    const [catastoLoading, setCatastoLoading] = useState(false);

    useEffect(() => {
        loadPhoto();
    }, [sign.id]);

    const loadPhoto = async () => {
        setLoading(true);
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
        const icons = { divieto: '🚫', obbligo: '🔵', pericolo: '⚠️', indicazione: 'ℹ️', precedenza: '🔺', passo_carrabile: '🚪' };
        return icons[type] || '📍';
    };

    const getStatusColor = (status) => {
        const colors = { ottimo: '#10b981', buono: '#3b82f6', discreto: '#f59e0b', danneggiato: '#ef4444' };
        return colors[status] || '#6b7280';
    };

    const handleCatastoLookup = async () => {
        setCatastoLoading(true);
        setCatastoData(null);
        try {
            const data = await apiService.catastoLookup(sign.latitude, sign.longitude);
            setCatastoData(data);
        } catch (err) {
            setCatastoData({ error: err.message });
        } finally {
            setCatastoLoading(false);
        }
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
                        loadPhoto();
                    }}
                    onClose={() => setShowEditModal(false)}
                />
            )}

            <div className="container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <button className="btn btn-secondary" onClick={onBack}>← Indietro</button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => setShowEditModal(true)}
                        style={{ fontSize: '0.875rem' }}
                    >
                        ✏️ Modifica
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
                                style={{ width: '100%', borderRadius: 'var(--border-radius)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                            />
                        </div>
                    ) : (
                        <div style={{ padding: '2rem', background: '#f3f4f6', borderRadius: 'var(--border-radius)', textAlign: 'center', color: 'var(--gray-500)', marginBottom: '1.5rem' }}>
                            Nessuna foto disponibile
                        </div>
                    )}

                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div style={{
                            padding: '1rem',
                            borderRadius: 'var(--border-radius-sm)',
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
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${sign.latitude},${sign.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ display: 'inline-block', marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--primary)' }}
                            >
                                Apri in Google Maps ↗️
                            </a>
                        </div>

                        {sign.type === 'passo_carrabile' && (
                            <div style={{ padding: '1rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 'var(--border-radius-sm)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginBottom: '0.25rem' }}>NUMERO AUTORIZZAZIONE</div>
                                <div style={{ fontWeight: '700', color: '#0369a1', marginBottom: '0.5rem' }}>
                                    {sign.numero_autorizzazione || 'Non specificato'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginBottom: '0.25rem' }}>PROPRIETARIO</div>
                                <div style={{ fontWeight: '700', color: '#0369a1' }}>
                                    {sign.proprietario || 'Non specificato'}
                                </div>
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
                                <div><strong>Stato Sync:</strong> {sign.synced ? '✅ Sincronizzato' : '⏳ In attesa'}</div>
                            </div>
                        </div>

                        {/* Modulo 4 — Dati Catastali (espandibile) */}
                        <div style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden' }}>
                            <button
                                onClick={() => { setCatastoOpen(o => !o); if (!catastoOpen && !catastoData) handleCatastoLookup(); }}
                                style={{ width: '100%', padding: '1rem', background: 'var(--gray-50)', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', fontWeight: '600' }}
                            >
                                <span>🗺️ Dati Catastali Terreno (AdE)</span>
                                <span>{catastoOpen ? '▲' : '▼'}</span>
                            </button>
                            {catastoOpen && (
                                <div style={{ padding: '1rem', background: 'white' }}>
                                    {catastoLoading && <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>⏳ Interrogazione catasto...</div>}
                                    {catastoData && !catastoData.error && (
                                        <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.85rem' }}>
                                            <div><strong>Foglio:</strong> {catastoData.sheet || '—'}</div>
                                            <div><strong>Particella:</strong> {catastoData.parcel || '—'}</div>
                                            <div style={{
                                                marginTop: '0.25rem', padding: '0.4rem 0.75rem', borderRadius: '9999px', display: 'inline-block', fontWeight: '700',
                                                background: catastoData.owner_type === 'comunale' ? '#dcfce7' : catastoData.owner_type === 'privato' ? '#fee2e2' : '#fef3c7',
                                                color: catastoData.owner_type === 'comunale' ? '#166534' : catastoData.owner_type === 'privato' ? '#991b1b' : '#92400e'
                                            }}>
                                                {catastoData.owner_type === 'comunale' ? '✅ Suolo Comunale' : catastoData.owner_type === 'privato' ? '⚠️ Suolo Privato' : `❓ ${catastoData.owner_type}`}
                                            </div>
                                        </div>
                                    )}
                                    {catastoData?.error && <div style={{ fontSize: '0.85rem', color: '#dc2626' }}>❌ {catastoData.error}</div>}
                                    {!catastoLoading && !catastoData && (
                                        <button className="btn btn-secondary" style={{ fontSize: '0.85rem', width: '100%' }} onClick={handleCatastoLookup}>
                                            🔍 Interroga Catasto AdE
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default MobileSignDetails;
