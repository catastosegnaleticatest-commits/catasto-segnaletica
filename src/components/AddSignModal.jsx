import { useState, useRef, useEffect } from 'react';
import localStorageService from '../services/localStorage';
import apiService from '../services/api';

const SUPPORT_TYPES = [
    { value: 'palo', label: 'Palo' },
    { value: 'portale', label: 'Portale' },
    { value: 'staffa_muro', label: 'Staffa a Muro' },
];

const SIGN_TYPES = [
    { value: 'divieto', label: '🚫 Divieto' },
    { value: 'obbligo', label: '🔵 Obbligo' },
    { value: 'pericolo', label: '⚠️ Pericolo' },
    { value: 'indicazione', label: 'ℹ️ Indicazione' },
    { value: 'precedenza', label: '🔺 Precedenza' },
    { value: 'passo_carrabile', label: '🚪 Passo Carrabile' }
];

const STATUS_OPTIONS = [
    { value: 'ottimo', label: '✅ Ottimo' },
    { value: 'buono', label: '👍 Buono' },
    { value: 'discreto', label: '⚠️ Discreto' },
    { value: 'danneggiato', label: '❌ Danneggiato' }
];

function AddSignModal({ onSaved, onClose }) {
    const [form, setForm] = useState({
        type: 'divieto',
        status: 'buono',
        notes: '',
        latitude: '',
        longitude: '',
        ordinanza_rif: '',
        numero_autorizzazione: '',
        proprietario: '',
        street_name: '',
        road_segment: '',
        carriageway_side: '',
        dimensions: '',
        reflective_class: '',
    });
    const [photo, setPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [ordinanzaDoc, setOrdinanzaDoc] = useState(null);
    const [ordinanzaDocName, setOrdinanzaDocName] = useState(null);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [geocoding, setGeocoding] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const [supports, setSupports] = useState([]);
    const [supportMode, setSupportMode] = useState('existing'); // 'existing' | 'new'
    const [selectedSupportId, setSelectedSupportId] = useState('');
    const [newSupport, setNewSupport] = useState({
        street_name: '', latitude: '', longitude: '', type: 'palo', condition: '', last_inspected_at: '',
    });

    useEffect(() => {
        apiService.getSupports()
            .then(data => {
                setSupports(data);
                if (data.length === 0) setSupportMode('new');
            })
            .catch(err => console.error('Errore caricamento pali/supporti:', err));
    }, []);

    const reverseGeocode = async (lat, lng) => {
        setGeocoding(true);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=it`,
                { headers: { 'User-Agent': 'CatastoSegnaletica/1.0' } }
            );
            const data = await res.json();
            const addr = data.address || {};
            const via = addr.road || addr.pedestrian || addr.footway || addr.path || '';
            const civico = addr.house_number ? `, ${addr.house_number}` : '';
            const comune = addr.city || addr.town || addr.village || addr.municipality || '';
            const addressStr = [via + civico, comune].filter(Boolean).join(' — ');
            if (addressStr) {
                setForm(p => ({ ...p, street_name: addressStr }));
            }
        } catch {
            // geocoding non critico: ignora errori silenziosamente
        } finally {
            setGeocoding(false);
        }
    };

    const handleGetGPS = () => {
        if (!navigator.geolocation) {
            setError('Geolocalizzazione non supportata dal browser.');
            return;
        }
        setGpsLoading(true);
        setError(null);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude.toFixed(6);
                const lng = pos.coords.longitude.toFixed(6);
                setForm(p => ({ ...p, latitude: lat, longitude: lng }));
                setGpsLoading(false);
                reverseGeocode(lat, lng);
            },
            () => {
                setError('GPS non disponibile: inserisci le coordinate manualmente.');
                setGpsLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handlePhoto = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setPhotoPreview(reader.result);
            setPhoto(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleOrdinanzaDoc = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setOrdinanzaDoc(reader.result);
            setOrdinanzaDocName(file.name);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        if (!form.latitude || !form.longitude) {
            setError('Inserisci le coordinate GPS o usa il rilevamento automatico.');
            return;
        }
        if (supportMode === 'existing' && !selectedSupportId) {
            setError('Seleziona un palo/supporto esistente oppure creane uno nuovo.');
            return;
        }
        if (supportMode === 'new' && !newSupport.street_name) {
            setError('Inserisci la via del nuovo palo/supporto.');
            return;
        }
        setSaving(true);
        try {
            let supportId = selectedSupportId ? parseInt(selectedSupportId) : null;
            if (supportMode === 'new') {
                const created = await apiService.createSupport({
                    street_name: newSupport.street_name,
                    latitude: parseFloat(form.latitude),
                    longitude: parseFloat(form.longitude),
                    type: newSupport.type,
                    condition: newSupport.condition || null,
                    last_inspected_at: newSupport.last_inspected_at || null,
                });
                supportId = created.id;
            }

            const signId = await localStorageService.saveSign({
                type: form.type,
                status: form.status,
                notes: form.notes,
                latitude: parseFloat(form.latitude),
                longitude: parseFloat(form.longitude),
                installation_date: new Date().toISOString().split('T')[0],
                ordinanza_rif: form.ordinanza_rif || null,
                numero_autorizzazione: form.type === 'passo_carrabile' ? (form.numero_autorizzazione || null) : null,
                proprietario: form.type === 'passo_carrabile' ? (form.proprietario || null) : null,
                support_id: supportId,
                street_name: form.street_name || null,
                road_segment: form.road_segment || null,
                carriageway_side: form.carriageway_side || null,
                dimensions: form.dimensions || null,
                reflective_class: form.reflective_class || null,
                ordinanza_doc: ordinanzaDoc || null,
                ordinanza_doc_name: ordinanzaDocName || null,
            });
            if (photo) {
                await localStorageService.savePhoto(signId, photo);
            }
            onSaved();
        } catch (err) {
            setError('Errore salvataggio: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
            <div style={{
                background: '#1e293b', borderRadius: 'var(--border-radius)', padding: '1.5rem',
                width: '100%', maxWidth: '560px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                maxHeight: '90vh', overflowY: 'auto', border: '1px solid #334155'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '700' }}>📍 Nuovo Segnale</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--gray-500)' }}>✕</button>
                </div>

                {error && (
                    <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: 'var(--border-radius)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group">
                            <label className="form-label">Tipo Segnale</label>
                            <select className="form-select" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                                {SIGN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Stato</label>
                            <select className="form-select" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Struttura di Supporto (Palo / Portale / Staffa)</label>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <button
                                type="button"
                                className={`btn ${supportMode === 'existing' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setSupportMode('existing')}
                                style={{ flex: 1, fontSize: '0.85rem' }}
                                disabled={supports.length === 0}
                            >
                                Seleziona Palo Esistente
                            </button>
                            <button
                                type="button"
                                className={`btn ${supportMode === 'new' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setSupportMode('new')}
                                style={{ flex: 1, fontSize: '0.85rem' }}
                            >
                                Crea Nuovo Palo/Supporto
                            </button>
                        </div>

                        {supportMode === 'existing' && (
                            <select className="form-select" value={selectedSupportId} onChange={e => setSelectedSupportId(e.target.value)}>
                                <option value="">-- Seleziona un palo/supporto --</option>
                                {supports.map(s => (
                                    <option key={s.id} value={s.id}>
                                        Palo #{s.id} ({s.street_name}) - {s.type}
                                    </option>
                                ))}
                            </select>
                        )}

                        {supportMode === 'new' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <input
                                    type="text" className="form-input" style={{ gridColumn: '1 / -1' }}
                                    value={newSupport.street_name} onChange={e => setNewSupport(p => ({ ...p, street_name: e.target.value }))}
                                    placeholder="Via del nuovo palo/supporto" required
                                />
                                <select className="form-select" value={newSupport.type} onChange={e => setNewSupport(p => ({ ...p, type: e.target.value }))}>
                                    {SUPPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                                <input
                                    type="text" className="form-input"
                                    value={newSupport.condition} onChange={e => setNewSupport(p => ({ ...p, condition: e.target.value }))}
                                    placeholder="Condizione (opzionale)"
                                />
                                <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', gridColumn: '1 / -1' }}>
                                    Il nuovo supporto verrà creato con le coordinate GPS indicate sotto.
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Posizione GPS</label>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <button type="button" className="btn btn-secondary" onClick={handleGetGPS} disabled={gpsLoading} style={{ flex: 1, fontSize: '0.875rem' }}>
                                {gpsLoading ? '⏳ Rilevamento...' : '📍 Rileva GPS'}
                            </button>
                            {form.latitude && form.longitude && (
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    disabled={geocoding}
                                    onClick={() => reverseGeocode(form.latitude, form.longitude)}
                                    style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}
                                >
                                    {geocoding ? '⏳' : '🔍 Indirizzo'}
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            <input
                                type="number" step="0.000001" className="form-input"
                                value={form.latitude} onChange={e => setForm(p => ({ ...p, latitude: e.target.value }))}
                                placeholder="Latitudine" required
                            />
                            <input
                                type="number" step="0.000001" className="form-input"
                                value={form.longitude} onChange={e => setForm(p => ({ ...p, longitude: e.target.value }))}
                                placeholder="Longitudine" required
                            />
                        </div>
                        {form.latitude && form.longitude && (
                            <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#166534', background: '#dcfce7', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
                                ✅ {parseFloat(form.latitude).toFixed(6)}, {parseFloat(form.longitude).toFixed(6)}
                                {geocoding && <span style={{ marginLeft: '0.5rem', color: '#0369a1' }}>🔍 Geocoding...</span>}
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Foto Segnale</label>
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
                        <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current.click()} style={{ width: '100%' }}>
                            📷 {photoPreview ? 'Cambia Foto' : 'Carica Foto'}
                        </button>
                        {photoPreview && (
                            <img src={photoPreview} alt="Preview" style={{ marginTop: '0.75rem', width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: 'var(--border-radius)' }} />
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Note / Via (opzionale)</label>
                        <textarea className="form-textarea" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Es: Via Roma, angolo Via Verdi" rows="2" />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Riferimento Ordinanza</label>
                        <input
                            type="text" className="form-input"
                            value={form.ordinanza_rif} onChange={e => setForm(p => ({ ...p, ordinanza_rif: e.target.value }))}
                            placeholder='Es: Ord. N. 142 del 2026'
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.25rem' }}>
                            Senza ordinanza il segnale sarà evidenziato come "Non Regolarizzato" sulla mappa.
                        </div>
                    </div>

                    {form.type === 'passo_carrabile' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div className="form-group">
                                <label className="form-label">Numero Autorizzazione</label>
                                <input
                                    type="text" className="form-input"
                                    value={form.numero_autorizzazione} onChange={e => setForm(p => ({ ...p, numero_autorizzazione: e.target.value }))}
                                    placeholder="Es: PC-2024-0123"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Proprietario</label>
                                <input
                                    type="text" className="form-input"
                                    value={form.proprietario} onChange={e => setForm(p => ({ ...p, proprietario: e.target.value }))}
                                    placeholder="Nome/Ragione sociale"
                                />
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Localizzazione Stradale</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                            <input
                                type="text" className="form-input"
                                value={form.street_name} onChange={e => setForm(p => ({ ...p, street_name: e.target.value }))}
                                placeholder="Tratto stradale (via)"
                            />
                            <input
                                type="text" className="form-input"
                                value={form.road_segment} onChange={e => setForm(p => ({ ...p, road_segment: e.target.value }))}
                                placeholder="Progressiva km (es: 1+250)"
                            />
                            <select className="form-select" value={form.carriageway_side} onChange={e => setForm(p => ({ ...p, carriageway_side: e.target.value }))}>
                                <option value="">Lato carreggiata</option>
                                <option value="destra">Destra</option>
                                <option value="sinistra">Sinistra</option>
                                <option value="centro">Centro</option>
                                <option value="ambo_i_lati">Ambo i lati</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Caratteristiche Tecniche Cartello</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            <input
                                type="text" className="form-input"
                                value={form.dimensions} onChange={e => setForm(p => ({ ...p, dimensions: e.target.value }))}
                                placeholder="Dimensioni (es: 60x60 cm)"
                            />
                            <select className="form-select" value={form.reflective_class} onChange={e => setForm(p => ({ ...p, reflective_class: e.target.value }))}>
                                <option value="">Classe pellicola rifrangente</option>
                                <option value="classe1">Classe 1 (HI)</option>
                                <option value="classe2">Classe 2 (DG)</option>
                                <option value="classe3">Classe 3 (EG)</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Documento Ordinanza (PDF)</label>
                        <input type="file" accept="application/pdf" onChange={handleOrdinanzaDoc} className="form-input" />
                        {ordinanzaDocName && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.25rem' }}>
                                📎 {ordinanzaDocName}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: '100%' }}>
                            {saving ? '💾 Salvataggio...' : '💾 Salva Segnale'}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={onClose} style={{ width: '100%' }}>Annulla</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default AddSignModal;
