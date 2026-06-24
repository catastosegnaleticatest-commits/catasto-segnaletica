import { useState, useRef } from 'react';
import localStorageService from '../services/localStorage';

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

function EditSignModal({ sign, onSaved, onClose }) {
    const [form, setForm] = useState({
        type: sign.type || 'divieto',
        status: sign.status || 'buono',
        notes: sign.notes || '',
        ordinanza_rif: sign.ordinanza_rif || '',
        numero_autorizzazione: sign.numero_autorizzazione || '',
        proprietario: sign.proprietario || '',
        installation_height_cm: sign.installation_height_cm ?? '',
        location_context: sign.location_context || 'marciapiede',
        street_name: sign.street_name || '',
        road_segment: sign.road_segment || '',
        carriageway_side: sign.carriageway_side || '',
        dimensions: sign.dimensions || '',
        reflective_class: sign.reflective_class || '',
    });
    const [newPhoto, setNewPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [ordinanzaDoc, setOrdinanzaDoc] = useState(null);
    const [ordinanzaDocName, setOrdinanzaDocName] = useState(null);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef(null);

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setPhotoPreview(reader.result);
            setNewPhoto(reader.result);
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
        setSaving(true);
        try {
            await localStorageService.updateSign(sign.id, {
                type: form.type,
                status: form.status,
                notes: form.notes,
                latitude: sign.latitude,
                longitude: sign.longitude,
                installation_date: sign.installation_date,
                ordinanza_rif: form.ordinanza_rif || null,
                numero_autorizzazione: form.type === 'passo_carrabile' ? (form.numero_autorizzazione || null) : null,
                proprietario: form.type === 'passo_carrabile' ? (form.proprietario || null) : null,
                installation_height_cm: form.installation_height_cm !== '' ? parseInt(form.installation_height_cm, 10) : null,
                location_context: form.location_context,
                street_name: form.street_name || null,
                road_segment: form.road_segment || null,
                carriageway_side: form.carriageway_side || null,
                dimensions: form.dimensions || null,
                reflective_class: form.reflective_class || null,
                ordinanza_doc: ordinanzaDoc || null,
                ordinanza_doc_name: ordinanzaDocName || null,
            });

            if (newPhoto) {
                await localStorageService.savePhoto(sign.id, newPhoto);
            }

            onSaved({ ...sign, ...form });
        } catch (err) {
            alert('Errore salvataggio: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem'
        }}>
            <div style={{
                background: '#1e293b', borderRadius: 'var(--border-radius)',
                padding: '1.5rem', width: '100%', maxWidth: '480px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto',
                border: '1px solid #334155'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '700' }}>
                        ✏️ Modifica Segnale #{sign.id}
                    </h3>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--gray-500)', lineHeight: 1 }}
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Tipo Segnale</label>
                        <select
                            className="form-select"
                            value={form.type}
                            onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                        >
                            {SIGN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Stato</label>
                        <select
                            className="form-select"
                            value={form.status}
                            onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                        >
                            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Note / Via</label>
                        <textarea
                            className="form-textarea"
                            value={form.notes}
                            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                            placeholder="Es: Via Roma, angolo Via Verdi"
                            rows="3"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Riferimento Ordinanza</label>
                        <input
                            type="text"
                            className="form-input"
                            value={form.ordinanza_rif}
                            onChange={e => setForm(p => ({ ...p, ordinanza_rif: e.target.value }))}
                            placeholder='Es: Ord. N. 142 del 2026'
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.25rem' }}>
                            Senza ordinanza il segnale sarà evidenziato come "Non Regolarizzato" sulla mappa.
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group">
                            <label className="form-label">Altezza Installazione (cm)</label>
                            <input
                                type="number" min="0" max="500" className="form-input"
                                value={form.installation_height_cm}
                                onChange={e => setForm(p => ({ ...p, installation_height_cm: e.target.value }))}
                                placeholder="Es: 220"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Contesto Posizionamento</label>
                            <select
                                className="form-select"
                                value={form.location_context}
                                onChange={e => setForm(p => ({ ...p, location_context: e.target.value }))}
                            >
                                <option value="marciapiede">Marciapiede / Area Pedonale</option>
                                <option value="pista_ciclabile">Pista Ciclabile</option>
                                <option value="carreggiata">Carreggiata</option>
                            </select>
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
                        {sign.ordinanza_doc_path && !ordinanzaDocName && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.25rem' }}>
                                📎 Documento già presente: {sign.ordinanza_doc_name || 'ordinanza.pdf'}
                            </div>
                        )}
                        {ordinanzaDocName && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.25rem' }}>
                                📎 Nuovo file: {ordinanzaDocName}
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Aggiorna Foto (opzionale)</label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handlePhotoChange}
                            style={{ display: 'none' }}
                        />
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => fileInputRef.current.click()}
                            style={{ width: '100%' }}
                        >
                            📷 {photoPreview ? 'Cambia Foto' : 'Sostituisci Foto'}
                        </button>
                        {photoPreview && (
                            <img
                                src={photoPreview}
                                alt="Preview"
                                style={{ marginTop: '0.75rem', width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: 'var(--border-radius)' }}
                            />
                        )}
                    </div>

                    <div style={{ display: 'grid', gap: '0.5rem', marginTop: '1.25rem' }}>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={saving}
                            style={{ width: '100%' }}
                        >
                            {saving ? '💾 Salvataggio...' : '💾 Salva Modifiche'}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onClose}
                            style={{ width: '100%' }}
                        >
                            Annulla
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default EditSignModal;
