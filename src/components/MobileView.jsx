import { useState, useRef } from 'react';
import localStorageService from '../services/localStorage';

function MobileView({ user, syncStatus, stats, onDataChange }) {
    const [formData, setFormData] = useState({
        type: 'divieto',
        status: 'buono',
        notes: '',
        latitude: null,
        longitude: null,
        photo: null
    });
    const [photoPreview, setPhotoPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [manualGPS, setManualGPS] = useState(false);
    const fileInputRef = useRef(null);

    const signTypes = [
        { value: 'divieto', label: '🚫 Divieto' },
        { value: 'obbligo', label: '🔵 Obbligo' },
        { value: 'pericolo', label: '⚠️ Pericolo' },
        { value: 'indicazione', label: 'ℹ️ Indicazione' },
        { value: 'precedenza', label: '🔺 Precedenza' }
    ];

    const statusOptions = [
        { value: 'ottimo', label: '✅ Ottimo' },
        { value: 'buono', label: '👍 Buono' },
        { value: 'discreto', label: '⚠️ Discreto' },
        { value: 'danneggiato', label: '❌ Danneggiato' }
    ];

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            alert('Geolocalizzazione non supportata. Usa inserimento manuale.');
            setManualGPS(true);
            return;
        }

        setLoading(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setFormData(prev => ({
                    ...prev,
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                }));
                setLoading(false);
            },
            (error) => {
                setLoading(false);
                if (error.code === 1) {
                    alert('⚠️ GPS richiede HTTPS. Usa inserimento manuale coordinate.');
                } else {
                    alert('Errore GPS: ' + error.message + '\nUsa inserimento manuale.');
                }
                setManualGPS(true);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handlePhotoCapture = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            setPhotoPreview(reader.result);
            setFormData(prev => ({ ...prev, photo: reader.result }));
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.latitude || !formData.longitude) {
            alert('Inserire le coordinate GPS');
            return;
        }

        if (!formData.photo) {
            alert('Acquisire prima una foto del segnale');
            return;
        }

        setLoading(true);

        try {
            const signId = await localStorageService.saveSign({
                type: formData.type,
                latitude: formData.latitude,
                longitude: formData.longitude,
                status: formData.status,
                notes: formData.notes,
                installation_date: new Date().toISOString().split('T')[0]
            });

            await localStorageService.savePhoto(signId, formData.photo);

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);

            setFormData({
                type: 'divieto',
                status: 'buono',
                notes: '',
                latitude: null,
                longitude: null,
                photo: null
            });
            setPhotoPreview(null);
            setManualGPS(false);

            if (onDataChange) onDataChange();
        } catch (error) {
            alert('Errore nel salvataggio: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container">
            <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                    📱 Rilevamento Mobile
                </h2>
                <p style={{ color: 'var(--gray-600)' }}>
                    Acquisici dati del segnale stradale
                </p>
            </div>

            {stats && (
                <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                    <div className="stat-card">
                        <div className="stat-value">{stats.local?.totalSigns || 0}</div>
                        <div className="stat-label">Segnali Locali</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value" style={{ color: stats.local?.pendingSync > 0 ? 'var(--warning)' : 'var(--success)' }}>
                            {stats.local?.pendingSync || 0}
                        </div>
                        <div className="stat-label">Da Sincronizzare</div>
                    </div>
                </div>
            )}

            {success && (
                <div style={{
                    padding: '1rem',
                    background: '#dcfce7',
                    color: '#166534',
                    borderRadius: 'var(--border-radius)',
                    marginBottom: '1.5rem',
                    fontWeight: '600',
                    textAlign: 'center'
                }}>
                    ✅ Segnale salvato con successo!
                </div>
            )}

            <div className="card">
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Tipo Segnale</label>
                        <select
                            className="form-select"
                            value={formData.type}
                            onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                        >
                            {signTypes.map(type => (
                                <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Stato</label>
                        <select
                            className="form-select"
                            value={formData.status}
                            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                        >
                            {statusOptions.map(status => (
                                <option key={status.value} value={status.value}>{status.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Posizione GPS</label>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <button
                                type="button"
                                className={`btn ${!manualGPS ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={handleGetLocation}
                                disabled={loading}
                                style={{ flex: 1 }}
                            >
                                📍 GPS Auto
                            </button>
                            <button
                                type="button"
                                className={`btn ${manualGPS ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setManualGPS(!manualGPS)}
                                style={{ flex: 1 }}
                            >
                                ✏️ Manuale
                            </button>
                        </div>

                        {manualGPS ? (
                            <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr 1fr' }}>
                                <div>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        className="form-input"
                                        value={formData.latitude || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, latitude: parseFloat(e.target.value) || null }))}
                                        placeholder="Latitudine"
                                    />
                                </div>
                                <div>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        className="form-input"
                                        value={formData.longitude || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, longitude: parseFloat(e.target.value) || null }))}
                                        placeholder="Longitudine"
                                    />
                                </div>
                            </div>
                        ) : (
                            formData.latitude && (
                                <div style={{
                                    padding: '0.5rem',
                                    background: '#dcfce7',
                                    borderRadius: 'var(--border-radius-sm)',
                                    fontSize: '0.875rem',
                                    color: '#166534',
                                    fontWeight: '600'
                                }}>
                                    ✅ {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                                </div>
                            )
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Foto Segnale</label>
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
                            className="btn btn-secondary"
                            onClick={() => fileInputRef.current.click()}
                            style={{ width: '100%' }}
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
                        <label className="form-label">Note (opzionale)</label>
                        <textarea
                            className="form-textarea"
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Aggiungi note sul segnale..."
                            rows="3"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                        style={{ width: '100%' }}
                    >
                        {loading ? '💾 Salvataggio...' : '💾 Salva Segnale'}
                    </button>
                </form>
            </div>

            <div style={{
                marginTop: '1.5rem',
                padding: '1rem',
                background: '#fef3c7',
                borderRadius: 'var(--border-radius)',
                fontSize: '0.875rem',
                color: '#92400e'
            }}>
                <strong>⚠️ GPS su HTTP</strong><br />
                Il GPS automatico richiede HTTPS. Se non funziona, usa il pulsante "✏️ Manuale" per inserire le coordinate manualmente (puoi copiarle da Google Maps).
            </div>
        </div>
    );
}

export default MobileView;
