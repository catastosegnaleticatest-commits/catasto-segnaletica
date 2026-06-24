import { useState, useRef, useEffect } from 'react';
import localStorageService from '../services/localStorage';
import { compressImage } from '../utils/imageCompression';
import { classifySignPhoto } from '../utils/signClassifier';
import { extractSignLabelData } from '../utils/signLabelOcr';
import PhotoRedactor from './PhotoRedactor';
import { incrementCensusCount, closeCensusSession } from '../utils/censusSession';

const MAX_GPS_ACCURACY = 15; // metri

// Tipologie di cartello più frequenti durante un censimento rapido
const QUICK_SIGN_TYPES = [
    { value: 'precedenza', label: 'STOP', icon: '🛑' },
    { value: 'precedenza', label: 'Dare Precedenza', icon: '🔻' },
    { value: 'divieto', label: 'Limite Velocità', icon: '🚫' }
];

function MobileAddSign({ user, syncStatus, stats, onDataChange, onBack, censusSession }) {
    const [formData, setFormData] = useState({
        type: 'divieto',
        status: 'buono',
        notes: censusSession?.via_predefinita || '',
        latitude: null,
        longitude: null,
        photo: null,
        installation_date: '',
        ordinanza_rif: censusSession?.ordinanza_predefinita || '',
        numero_autorizzazione: '',
        proprietario: ''
    });
    const [photoPreview, setPhotoPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [manualGPS, setManualGPS] = useState(false);
    const [gpsAccuracy, setGpsAccuracy] = useState(null);
    const [showRedactor, setShowRedactor] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState(null);
    const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
    const [labelPhotoPreview, setLabelPhotoPreview] = useState(null);
    const [labelSuggestion, setLabelSuggestion] = useState(null);
    const [analyzingLabel, setAnalyzingLabel] = useState(false);
    const [censusCount, setCensusCount] = useState(censusSession?.count || 0);
    const fileInputRef = useRef(null);
    const labelFileInputRef = useRef(null);

    // In sessione di censimento acquisisce automaticamente la posizione GPS
    // appena si entra nella schermata e dopo ogni salvataggio
    useEffect(() => {
        if (censusSession) {
            handleGetLocation();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const signTypes = [
        { value: 'divieto', label: '🚫 Divieto' },
        { value: 'obbligo', label: '🔵 Obbligo' },
        { value: 'pericolo', label: '⚠️ Pericolo' },
        { value: 'indicazione', label: 'ℹ️ Indicazione' },
        { value: 'precedenza', label: '🔺 Precedenza' },
        { value: 'passo_carrabile', label: '🚪 Passo Carrabile' }
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
                setGpsAccuracy(position.coords.accuracy);
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

        setAiSuggestion(null);

        try {
            const compressed = await compressImage(file);
            setPhotoPreview(compressed);
            setFormData(prev => ({ ...prev, photo: compressed }));
            analyzePhoto(compressed);
        } catch (error) {
            alert('Errore nella compressione della foto: ' + error.message);
        }
    };

    // Analizza la foto in locale (TensorFlow.js) per suggerire il tipo di segnale
    const analyzePhoto = async (imageDataUrl) => {
        setAnalyzingPhoto(true);
        try {
            const result = await classifySignPhoto(imageDataUrl);
            setAiSuggestion(result);
        } catch (error) {
            console.warn('Riconoscimento automatico non disponibile:', error.message);
        } finally {
            setAnalyzingPhoto(false);
        }
    };

    const applyAiSuggestion = () => {
        if (!aiSuggestion) return;
        setFormData(prev => ({ ...prev, type: aiSuggestion.type }));
        setAiSuggestion(null);
    };

    const handleLabelPhotoCapture = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLabelSuggestion(null);

        try {
            const compressed = await compressImage(file);
            setLabelPhotoPreview(compressed);
            analyzeLabelPhoto(compressed);
        } catch (error) {
            alert('Errore nella compressione della foto: ' + error.message);
        }
    };

    // Estrae anno di fabbricazione/installazione e riferimento ordinanza
    // dall'etichetta sul retro del cartello tramite OCR (Tesseract.js)
    const analyzeLabelPhoto = async (imageDataUrl) => {
        setAnalyzingLabel(true);
        try {
            const result = await extractSignLabelData(imageDataUrl);
            setLabelSuggestion(result);
        } catch (error) {
            console.warn('OCR etichetta non disponibile:', error.message);
        } finally {
            setAnalyzingLabel(false);
        }
    };

    const applyLabelSuggestion = () => {
        if (!labelSuggestion) return;
        setFormData(prev => ({
            ...prev,
            installation_date: labelSuggestion.year ? `${labelSuggestion.year}-01-01` : prev.installation_date,
            ordinanza_rif: labelSuggestion.ordinance || prev.ordinanza_rif
        }));
        setLabelSuggestion(null);
    };

    const handleRedactionConfirm = (redactedPhoto) => {
        setPhotoPreview(redactedPhoto);
        setFormData(prev => ({ ...prev, photo: redactedPhoto }));
        setShowRedactor(false);
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
                installation_date: formData.installation_date || new Date().toISOString().split('T')[0],
                ordinanza_rif: formData.ordinanza_rif || null,
                numero_autorizzazione: formData.type === 'passo_carrabile' ? (formData.numero_autorizzazione || null) : null,
                proprietario: formData.type === 'passo_carrabile' ? (formData.proprietario || null) : null
            });

            await localStorageService.savePhoto(signId, formData.photo);

            setSuccess(true);

            if (censusSession) {
                const updatedSession = incrementCensusCount();
                setCensusCount(updatedSession?.count || censusCount + 1);

                // Prepara la schermata per il segnale successivo
                setFormData(prev => ({
                    ...prev,
                    type: 'divieto',
                    status: 'buono',
                    photo: null,
                    latitude: null,
                    longitude: null
                }));
                setPhotoPreview(null);
                setGpsAccuracy(null);
                setAiSuggestion(null);
                setTimeout(() => setSuccess(false), 1200);
                handleGetLocation();
            } else {
                setTimeout(() => {
                    setSuccess(false);
                    if (onBack) onBack();
                }, 2000);
            }

            if (onDataChange) onDataChange();
        } catch (error) {
            alert('Errore nel salvataggio: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEndCensus = () => {
        if (!confirm('Terminare la sessione di censimento?')) return;
        closeCensusSession();
        if (onBack) onBack();
    };

    if (censusSession) {
        return (
            <div className="container">
                {/* Banner persistente di sessione attiva */}
                <div style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    padding: '0.75rem 1rem',
                    background: '#166534',
                    color: 'white',
                    borderRadius: 'var(--border-radius)',
                    marginBottom: '1rem'
                }}>
                    <div style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '0.25rem' }}>
                        🟢 Censimento Attivo: Via {censusSession.via_predefinita}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem' }}>
                            📋 Segnali censiti: <strong>{censusCount}</strong>
                        </span>
                        <button
                            type="button"
                            className="btn btn-sm"
                            onClick={handleEndCensus}
                            style={{ background: 'white', color: '#166534', fontWeight: '600' }}
                        >
                            🏁 Termina Censimento
                        </button>
                    </div>
                </div>

                {success && (
                    <div style={{
                        padding: '0.75rem',
                        background: '#dcfce7',
                        color: '#166534',
                        borderRadius: 'var(--border-radius)',
                        marginBottom: '1rem',
                        fontWeight: '600',
                        textAlign: 'center'
                    }}>
                        ✅ Segnale salvato!
                    </div>
                )}

                <div className="card">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Via / Note</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.notes}
                                disabled
                                style={{ background: 'var(--gray-100)', color: 'var(--gray-600)' }}
                            />
                        </div>

                        {formData.ordinanza_rif && (
                            <div className="form-group">
                                <label className="form-label">Riferimento Ordinanza</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.ordinanza_rif}
                                    disabled
                                    style={{ background: 'var(--gray-100)', color: 'var(--gray-600)' }}
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Tipologia rapida</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                                {QUICK_SIGN_TYPES.map((qt) => (
                                    <button
                                        key={qt.label}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, type: qt.value }))}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '0.25rem',
                                            padding: '0.75rem 0.25rem',
                                            borderRadius: 'var(--border-radius)',
                                            border: formData.type === qt.value ? '2px solid var(--primary)' : '1px solid var(--gray-300)',
                                            background: formData.type === qt.value ? '#eff6ff' : 'white',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <span style={{ fontSize: '1.75rem' }}>{qt.icon}</span>
                                        <span>{qt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {!manualGPS && gpsAccuracy !== null && (
                            <div style={{
                                padding: '0.5rem',
                                marginBottom: '0.75rem',
                                borderRadius: 'var(--border-radius-sm)',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                background: gpsAccuracy > MAX_GPS_ACCURACY ? '#fee2e2' : '#dcfce7',
                                color: gpsAccuracy > MAX_GPS_ACCURACY ? '#dc2626' : '#166534',
                                textAlign: 'center'
                            }}>
                                {gpsAccuracy > MAX_GPS_ACCURACY ? `⚠️ GPS impreciso (±${Math.round(gpsAccuracy)}m)` : `✅ GPS pronto (±${Math.round(gpsAccuracy)}m)`}
                            </div>
                        )}

                        <div className="form-group">
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

                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading || !formData.latitude || !formData.photo || (!manualGPS && gpsAccuracy !== null && gpsAccuracy > MAX_GPS_ACCURACY)}
                            style={{ width: '100%', padding: '1rem', fontSize: '1.125rem', fontWeight: '700' }}
                        >
                            {loading ? '💾 Salvataggio...' : '💾 Salva e Prosegui'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            <div style={{ marginBottom: '1rem' }}>
                <button className="btn btn-secondary" onClick={onBack}>
                    ← Indietro
                </button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                    📷 Nuovo Rilevamento
                </h2>
                <p style={{ color: 'var(--gray-600)' }}>
                    Acquisici dati del segnale stradale
                </p>
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
                                onClick={() => {
                                    setManualGPS(!manualGPS);
                                    setGpsAccuracy(null);
                                }}
                                style={{ flex: 1 }}
                            >
                                ✏️ Manuale
                            </button>
                        </div>

                        {!manualGPS && gpsAccuracy !== null && (
                            <div style={{
                                padding: '0.5rem',
                                marginBottom: '0.5rem',
                                borderRadius: 'var(--border-radius-sm)',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                background: gpsAccuracy > MAX_GPS_ACCURACY ? '#fee2e2' : '#dcfce7',
                                color: gpsAccuracy > MAX_GPS_ACCURACY ? '#dc2626' : '#166534'
                            }}>
                                {gpsAccuracy > MAX_GPS_ACCURACY ? '⚠️' : '✅'} Precisione GPS: ±{Math.round(gpsAccuracy)}m
                                {gpsAccuracy > MAX_GPS_ACCURACY && (
                                    <div style={{ fontWeight: '400', marginTop: '0.25rem' }}>
                                        Precisione insufficiente (massimo {MAX_GPS_ACCURACY}m). Riprova all'aperto o attendi un segnale migliore prima di salvare.
                                    </div>
                                )}
                            </div>
                        )}

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
                        {analyzingPhoto && (
                            <div style={{
                                marginTop: '0.5rem',
                                padding: '0.5rem',
                                borderRadius: 'var(--border-radius-sm)',
                                fontSize: '0.85rem',
                                color: 'var(--gray-600)',
                                textAlign: 'center'
                            }}>
                                🤖 Riconoscimento automatico in corso...
                            </div>
                        )}
                        {aiSuggestion && (
                            <div style={{
                                marginTop: '0.5rem',
                                padding: '0.6rem 0.9rem',
                                borderRadius: 'var(--border-radius-sm)',
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                color: '#1e3a8a',
                                fontSize: '0.85rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '0.5rem',
                                flexWrap: 'wrap'
                            }}>
                                <span>
                                    🤖 Rilevato: <strong>{signTypes.find(t => t.value === aiSuggestion.type)?.label || aiSuggestion.type}</strong>
                                    {' '}({Math.round(aiSuggestion.confidence * 100)}%)
                                </span>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button type="button" className="btn btn-sm btn-primary" onClick={applyAiSuggestion}>
                                        Usa suggerimento
                                    </button>
                                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setAiSuggestion(null)}>
                                        Ignora
                                    </button>
                                </div>
                            </div>
                        )}
                        {photoPreview && (
                            <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ width: '100%', marginTop: '0.5rem' }}
                                onClick={() => setShowRedactor(true)}
                            >
                                ⬛ Censura volti/targhe
                            </button>
                        )}
                    </div>

                    {showRedactor && photoPreview && (
                        <PhotoRedactor
                            photo={photoPreview}
                            onConfirm={handleRedactionConfirm}
                            onCancel={() => setShowRedactor(false)}
                        />
                    )}

                    <div className="form-group">
                        <label className="form-label">Etichetta produttore (retro cartello, opzionale)</label>
                        <input
                            ref={labelFileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleLabelPhotoCapture}
                            style={{ display: 'none' }}
                        />
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => labelFileInputRef.current.click()}
                            style={{ width: '100%' }}
                        >
                            🔍 {labelPhotoPreview ? 'Cambia Foto Etichetta' : 'Fotografa Etichetta Retro'}
                        </button>
                        {labelPhotoPreview && (
                            <div className="camera-preview" style={{ marginTop: '1rem' }}>
                                <img src={labelPhotoPreview} alt="Etichetta retro" />
                            </div>
                        )}
                        {analyzingLabel && (
                            <div style={{
                                marginTop: '0.5rem',
                                padding: '0.5rem',
                                borderRadius: 'var(--border-radius-sm)',
                                fontSize: '0.85rem',
                                color: 'var(--gray-600)',
                                textAlign: 'center'
                            }}>
                                🔍 Lettura etichetta in corso (OCR)...
                            </div>
                        )}
                        {labelSuggestion && (
                            <div style={{
                                marginTop: '0.5rem',
                                padding: '0.6rem 0.9rem',
                                borderRadius: 'var(--border-radius-sm)',
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                color: '#1e3a8a',
                                fontSize: '0.85rem',
                            }}>
                                <div style={{ marginBottom: '0.5rem' }}>
                                    🔍 Dati riconosciuti:
                                    {labelSuggestion.year && <> Anno <strong>{labelSuggestion.year}</strong></>}
                                    {labelSuggestion.year && labelSuggestion.ordinance && ' — '}
                                    {labelSuggestion.ordinance && <>Ordinanza <strong>{labelSuggestion.ordinance}</strong></>}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button type="button" className="btn btn-sm btn-primary" onClick={applyLabelSuggestion}>
                                        Usa dati riconosciuti
                                    </button>
                                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setLabelSuggestion(null)}>
                                        Ignora
                                    </button>
                                </div>
                            </div>
                        )}
                        {!analyzingLabel && labelPhotoPreview && !labelSuggestion && (
                            <div style={{
                                marginTop: '0.5rem',
                                padding: '0.5rem',
                                borderRadius: 'var(--border-radius-sm)',
                                fontSize: '0.8rem',
                                color: 'var(--gray-600)',
                                textAlign: 'center'
                            }}>
                                Nessun anno o riferimento ordinanza riconosciuto. Inserisci i dati manualmente.
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Anno installazione (opzionale)</label>
                        <input
                            type="date"
                            className="form-input"
                            value={formData.installation_date}
                            onChange={(e) => setFormData(prev => ({ ...prev, installation_date: e.target.value }))}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Riferimento Ordinanza (opzionale)</label>
                        <input
                            type="text"
                            className="form-input"
                            value={formData.ordinanza_rif}
                            onChange={(e) => setFormData(prev => ({ ...prev, ordinanza_rif: e.target.value }))}
                            placeholder="Es: 45/2019"
                        />
                    </div>

                    {formData.type === 'passo_carrabile' && (
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            <div className="form-group">
                                <label className="form-label">Numero Autorizzazione</label>
                                <input
                                    type="text" className="form-input"
                                    value={formData.numero_autorizzazione}
                                    onChange={(e) => setFormData(prev => ({ ...prev, numero_autorizzazione: e.target.value }))}
                                    placeholder="Es: PC-2024-0123"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Proprietario</label>
                                <input
                                    type="text" className="form-input"
                                    value={formData.proprietario}
                                    onChange={(e) => setFormData(prev => ({ ...prev, proprietario: e.target.value }))}
                                    placeholder="Nome/Ragione sociale"
                                />
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Note / Via (opzionale)</label>
                        <textarea
                            className="form-textarea"
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Es: Via Roma, angolo Via Verdi"
                            rows="3"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading || (!manualGPS && gpsAccuracy !== null && gpsAccuracy > MAX_GPS_ACCURACY)}
                        style={{ width: '100%' }}
                    >
                        {loading ? '💾 Salvataggio...' : '💾 Salva Segnale'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default MobileAddSign;
