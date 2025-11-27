import { useState, useRef } from 'react';
import localStorageService from '../services/localStorage';
import apiService from '../services/api';

function DesktopAddSign({ user, onDataChange, onBack }) {
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

    // Funzione per comprimere l'immagine (stessa logica di DesktopSignDetails)
    const compressImage = (file, maxWidth = 1920, maxHeight = 1920, quality = 0.8, maxSizeMB = 1) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth || height > maxHeight) {
                        const ratio = Math.min(maxWidth / width, maxHeight / height);
                        width = width * ratio;
                        height = height * ratio;
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    let dataUrl = canvas.toDataURL('image/jpeg', quality);
                    
                    const sizeMB = (dataUrl.length * 3) / 4 / 1024 / 1024;
                    if (sizeMB > maxSizeMB) {
                        let newQuality = quality;
                        let attempts = 0;
                        while (sizeMB > maxSizeMB && newQuality > 0.1 && attempts < 5) {
                            newQuality -= 0.1;
                            dataUrl = canvas.toDataURL('image/jpeg', newQuality);
                            attempts++;
                        }
                    }

                    resolve(dataUrl);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

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

    const handlePhotoCapture = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Per favore seleziona un file immagine');
            return;
        }

        try {
            // Comprimi l'immagine prima di mostrarla
            const compressedDataUrl = await compressImage(file);
            setPhotoPreview(compressedDataUrl);
            setFormData(prev => ({ ...prev, photo: compressedDataUrl }));
        } catch (error) {
            console.error('Errore compressione immagine:', error);
            alert('Errore nella compressione dell\'immagine: ' + error.message);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.latitude || !formData.longitude) {
            alert('Inserire le coordinate GPS');
            return;
        }

        if (!formData.photo) {
            alert('Caricare prima una foto del segnale');
            return;
        }

        setLoading(true);

        try {
            // Salva il segnale localmente
            const signId = await localStorageService.saveSign({
                type: formData.type,
                latitude: formData.latitude,
                longitude: formData.longitude,
                status: formData.status,
                notes: formData.notes,
                installation_date: new Date().toISOString().split('T')[0]
            });

            // Salva la foto localmente
            await localStorageService.savePhoto(signId, formData.photo);

            // Prova a caricare la foto sul server se online
            try {
                await apiService.uploadPhoto(signId, formData.photo, true); // true = foto primaria
            } catch (uploadError) {
                console.log('Foto non caricata sul server (sarà sincronizzata dopo):', uploadError);
            }

            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                // Reset form
                setFormData({
                    type: 'divieto',
                    status: 'buono',
                    notes: '',
                    latitude: null,
                    longitude: null,
                    photo: null
                });
                setPhotoPreview(null);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
                if (onDataChange) onDataChange();
                if (onBack) onBack();
            }, 2000);
        } catch (error) {
            alert('Errore nel salvataggio: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="desktop-view" style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 1rem' }}>
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                        📷 Nuovo Segnale
                    </h2>
                    <p style={{ color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                        Inserisci i dati di un nuovo segnale stradale
                    </p>
                </div>
                <button className="btn btn-secondary" onClick={onBack}>
                    ← Indietro
                </button>
            </div>

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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        {/* Colonna Sinistra */}
                        <div>
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
                                            padding: '0.75rem',
                                            background: '#dcfce7',
                                            borderRadius: 'var(--border-radius-sm)',
                                            fontSize: '0.875rem',
                                            color: '#166534',
                                            fontWeight: '600',
                                            fontFamily: 'monospace'
                                        }}>
                                            ✅ {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>

                        {/* Colonna Destra */}
                        <div>
                            <div className="form-group">
                                <label className="form-label">Foto Segnale</label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoCapture}
                                    style={{ display: 'none' }}
                                />
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{ width: '100%', marginBottom: '0.5rem' }}
                                >
                                    📷 {photoPreview ? 'Cambia Foto' : 'Carica Foto'}
                                </button>
                                {photoPreview && (
                                    <div style={{
                                        marginTop: '0.5rem',
                                        borderRadius: 'var(--border-radius)',
                                        overflow: 'hidden',
                                        border: '2px solid var(--gray-200)'
                                    }}>
                                        <img 
                                            src={photoPreview} 
                                            alt="Preview" 
                                            style={{
                                                width: '100%',
                                                maxHeight: '300px',
                                                objectFit: 'contain',
                                                display: 'block'
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Note / Via (opzionale)</label>
                                <textarea
                                    className="form-textarea"
                                    value={formData.notes}
                                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Es: Via Roma, angolo Via Verdi"
                                    rows="4"
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onBack}
                        >
                            Annulla
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? '💾 Salvataggio...' : '💾 Salva Segnale'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default DesktopAddSign;

