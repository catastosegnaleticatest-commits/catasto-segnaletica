import { useState, useRef } from 'react';
import localStorageService from '../services/localStorage';
import { compressImage } from '../utils/imageCompression';

const STATUS_OPTIONS = [
    { value: 'buono', label: '👍 Buono', color: '#166534', bg: '#dcfce7' },
    { value: 'danneggiato', label: '❌ Danneggiato', color: '#dc2626', bg: '#fee2e2' }
];

const SIGN_ICONS = { divieto: '🚫', obbligo: '🔵', pericolo: '⚠️', indicazione: 'ℹ️', precedenza: '🔺', passo_carrabile: '🚪' };

// Schermata rapida per la pattuglia: conferma sul campo di un segnale importato
// tramite il "Censimento Virtuale" (rilevamento AI/community), già georeferenziato
// e tipizzato. Basta scattare la foto reale e confermare lo stato di conservazione.
function MobileVerifySign({ sign, onBack, onDataChange }) {
    const [status, setStatus] = useState('buono');
    const [photoPreview, setPhotoPreview] = useState(null);
    const [photoData, setPhotoData] = useState(null);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef(null);

    const handlePhotoCapture = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const compressed = await compressImage(file);
            setPhotoPreview(compressed);
            setPhotoData(compressed);
        } catch (error) {
            alert('Errore nella compressione della foto: ' + error.message);
        }
    };

    const handleConfirm = async () => {
        if (!photoData) {
            alert('Scatta una foto del segnale prima di confermare');
            return;
        }

        setSaving(true);
        try {
            const baseNotes = (sign.notes || '').replace(/\s*—\s*Rilevamento: Virtual AI/i, '').trim();
            await localStorageService.updateSign(sign.id, {
                ...sign,
                status,
                photo: photoData,
                notes: baseNotes ? `${baseNotes} — Verificato sul campo` : 'Verificato sul campo',
                richiede_revisione: 0
            });
            await localStorageService.savePhoto(sign.id, photoData);

            if (onDataChange) onDataChange();
            if (onBack) onBack();
        } catch (error) {
            alert('Errore nel salvataggio: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="container">
            <div style={{ marginBottom: '1rem' }}>
                <button className="btn btn-secondary" onClick={onBack}>
                    ← Indietro
                </button>
            </div>

            <div style={{
                padding: '0.75rem 1rem',
                background: '#dbeafe',
                color: '#1e40af',
                borderRadius: 'var(--border-radius)',
                marginBottom: '1.5rem',
                fontWeight: '700'
            }}>
                🔵 Da Verificare — Censimento Virtuale
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                    {SIGN_ICONS[sign.type] || '📍'} <span style={{ fontSize: '1.25rem', fontWeight: '700', textTransform: 'capitalize' }}>{sign.type}</span>
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                    📍 {parseFloat(sign.latitude).toFixed(6)}, {parseFloat(sign.longitude).toFixed(6)}
                </div>
                {sign.notes && (
                    <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginTop: '0.25rem' }}>
                        🛣️ {sign.notes}
                    </div>
                )}
            </div>

            <div className="form-group">
                <label className="form-label">Foto reale del segnale</label>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoCapture}
                    style={{ display: 'none' }}
                />
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => fileInputRef.current.click()}
                    style={{ width: '100%', padding: '2rem', fontSize: '1.5rem', fontWeight: '700' }}
                >
                    📷 {photoPreview ? 'Cambia Foto' : 'Scatta Foto'}
                </button>
                {photoPreview && (
                    <div className="camera-preview" style={{ marginTop: '1rem' }}>
                        <img src={photoPreview} alt="Preview" />
                    </div>
                )}
            </div>

            <div className="form-group">
                <label className="form-label">Stato di conservazione</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {STATUS_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => setStatus(opt.value)}
                            style={{
                                padding: '1rem',
                                borderRadius: 'var(--border-radius)',
                                border: status === opt.value ? `2px solid ${opt.color}` : '1px solid var(--gray-300)',
                                background: status === opt.value ? opt.bg : 'white',
                                color: status === opt.value ? opt.color : 'var(--gray-700)',
                                fontWeight: '700',
                                fontSize: '1rem',
                                cursor: 'pointer'
                            }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirm}
                disabled={saving || !photoData}
                style={{ width: '100%', padding: '1rem', fontSize: '1.125rem', fontWeight: '700' }}
            >
                {saving ? '💾 Salvataggio...' : '✅ Conferma e Chiudi Censimento'}
            </button>
        </div>
    );
}

export default MobileVerifySign;
