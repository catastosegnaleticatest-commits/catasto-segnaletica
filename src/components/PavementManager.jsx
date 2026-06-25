import { useState, useEffect } from 'react';
import { pavementDefectsService } from '../services/firestoreService';
import LocationPickerModal from './LocationPickerModal';

const DEFECT_TYPE_LABELS = {
    buca: 'Buca',
    avvallamento: 'Avvallamento',
    crepa: 'Crepa',
    cedimento: 'Cedimento',
};

const SEVERITY_LABELS = {
    bassa: 'Bassa',
    media: 'Media',
    alta_emergenza: 'Alta - Emergenza',
};

const SEVERITY_COLORS = {
    bassa: '#facc15',
    media: '#f97316',
    alta_emergenza: '#dc2626',
};

const STATUS_LABELS = {
    segnalato: 'Segnalato',
    preso_in_carico: 'Preso in Carico',
    ripristinato: 'Ripristinato',
};

const SEVERITY_ORDER = { alta_emergenza: 0, media: 1, bassa: 2 };
const STATUS_ORDER = { segnalato: 0, preso_in_carico: 1, ripristinato: 2 };

function PavementManager({ user }) {
    const [defects, setDefects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        street_name: '',
        latitude: '',
        longitude: '',
        defect_type: 'buca',
        severity: 'media',
        description: '',
        photo: null,
    });

    const [showLocationPicker, setShowLocationPicker] = useState(false);

    const canManage = user && (user.role === 'admin' || user.role === 'tecnico' || user.role === 'operatore');
    const canForward = user && (user.role === 'admin' || user.role === 'tecnico');

    useEffect(() => {
        loadDefects();
    }, []);

    const loadDefects = async () => {
        setLoading(true);
        try {
            const data = await pavementDefectsService.getAll();
            setDefects(data);
            setError('');
        } catch (err) {
            setError('Errore caricamento dissesti: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const sortedDefects = [...defects].sort((a, b) => {
        const sevDiff = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
        if (sevDiff !== 0) return sevDiff;
        return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    });

    const selected = defects.find(d => d.id === selectedId) || null;

    const unresolvedEmergencies = defects.filter(d => d.severity === 'alta_emergenza' && d.status !== 'ripristinato').length;

    const handlePhotoChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setFormData(prev => ({ ...prev, photo: reader.result }));
        reader.readAsDataURL(file);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await pavementDefectsService.create({
                ...formData,
                latitude: parseFloat(formData.latitude),
                longitude: parseFloat(formData.longitude),
            });
            setShowForm(false);
            setFormData({
                street_name: '', latitude: '', longitude: '',
                defect_type: 'buca', severity: 'media', description: '', photo: null,
            });
            await loadDefects();
        } catch (err) {
            alert('Errore creazione segnalazione: ' + err.message);
        }
    };

    const handleStatusChange = async (defect, newStatus) => {
        try {
            await pavementDefectsService.update(defect.id, { status: newStatus });
            await loadDefects();
        } catch (err) {
            alert('Errore aggiornamento stato: ' + err.message);
        }
    };

    const handleDelete = async (defect) => {
        if (!window.confirm(`Eliminare definitivamente la segnalazione #${defect.id}?`)) return;
        try {
            await pavementDefectsService.delete(defect.id);
            if (selectedId === defect.id) setSelectedId(null);
            await loadDefects();
        } catch (err) {
            alert('Errore eliminazione: ' + err.message);
        }
    };

    const handleForward = async (defect) => {
        try {
            const { defect: updated, transmission } = await pavementDefectsService.forward(defect.id);
            generatePrintableReport(updated, transmission);
            await loadDefects();
        } catch (err) {
            alert('Errore inoltro a Ufficio Tecnico: ' + err.message);
        }
    };

    const generatePrintableReport = (defect, transmission) => {
        const photoUrl = defect.photo || null;

        const html = `
            <!DOCTYPE html>
            <html lang="it">
            <head>
                <meta charset="UTF-8">
                <title>Segnalazione Dissesto Stradale #${defect.id}</title>
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: 'Times New Roman', Georgia, serif; color: #1f2937; padding: 2.5rem; }
                    h1 { font-size: 1.3rem; text-align: center; margin: 0 0 0.25rem; text-transform: uppercase; }
                    .subtitle { text-align: center; color: #6b7280; font-size: 0.85rem; margin-bottom: 2rem; }
                    .section { margin-bottom: 1.5rem; }
                    .section-title { font-size: 1rem; font-weight: 700; border-bottom: 1px solid #1f2937; padding-bottom: 0.25rem; margin-bottom: 0.75rem; }
                    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
                    th, td { border: 1px solid #9ca3af; padding: 0.5rem; text-align: left; }
                    th { background: #f3f4f6; width: 35%; }
                    img.photo { max-width: 100%; max-height: 320px; object-fit: contain; border: 1px solid #9ca3af; border-radius: 4px; margin-top: 0.5rem; }
                    .footer-note { margin-top: 2.5rem; font-size: 0.8rem; color: #6b7280; }
                    .signature { margin-top: 3rem; display: flex; justify-content: space-between; }
                    .signature div { width: 45%; border-top: 1px solid #1f2937; padding-top: 0.25rem; font-size: 0.8rem; text-align: center; }
                    @media print { body { padding: 1.5cm; } }
                </style>
            </head>
            <body>
                <h1>Segnalazione di Dissesto Stradale per Intervento Manutentivo</h1>
                <div class="subtitle">Destinatario: Ufficio Tecnico Comunale - Generato il ${new Date().toLocaleString('it-IT')}</div>

                <div class="section">
                    <div class="section-title">Dati Identificativi della Segnalazione</div>
                    <table>
                        <tr><th>ID Segnalazione</th><td>#${defect.id}</td></tr>
                        <tr><th>Via</th><td>${defect.street_name}</td></tr>
                        <tr><th>Coordinate GPS</th><td>${defect.latitude.toFixed(6)}, ${defect.longitude.toFixed(6)}</td></tr>
                        <tr><th>Tipo Dissesto</th><td>${DEFECT_TYPE_LABELS[defect.defect_type] || defect.defect_type}</td></tr>
                        <tr><th>Gravità</th><td>${SEVERITY_LABELS[defect.severity] || defect.severity}</td></tr>
                        <tr><th>Descrizione</th><td>${defect.description || '-'}</td></tr>
                        <tr><th>Data Segnalazione</th><td>${defect.created_at ? new Date(defect.created_at).toLocaleString('it-IT') : '-'}</td></tr>
                        <tr><th>Data Inoltro</th><td>${defect.forward_date ? new Date(defect.forward_date).toLocaleString('it-IT') : '-'}</td></tr>
                        <tr><th>Inoltrato da</th><td>${transmission?.body?.inoltrato_da || '-'}</td></tr>
                    </table>
                </div>

                ${photoUrl ? `
                <div class="section">
                    <div class="section-title">Documentazione Fotografica</div>
                    <img class="photo" src="${photoUrl}" alt="Foto dissesto #${defect.id}" />
                </div>` : ''}

                <div class="footer-note">
                    La presente segnalazione viene trasmessa all'Ufficio Tecnico Comunale per la presa in carico e la programmazione dell'intervento manutentivo necessario al ripristino della sede stradale.
                </div>

                <div class="signature">
                    <div>Il Funzionario Responsabile</div>
                    <div>Data e Timbro</div>
                </div>
            </body>
            </html>
        `;

        const reportWindow = window.open('', '_blank');
        if (!reportWindow) {
            alert('Impossibile aprire la finestra di stampa. Controlla il blocco popup del browser.');
            return;
        }
        reportWindow.document.open();
        reportWindow.document.write(html);
        reportWindow.document.close();

        const triggerPrint = () => {
            reportWindow.focus();
            reportWindow.print();
        };

        const img = reportWindow.document.querySelector('img.photo');
        if (img && !img.complete) {
            img.addEventListener('load', triggerPrint);
            img.addEventListener('error', triggerPrint);
        } else {
            setTimeout(triggerPrint, 300);
        }
    };

    if (loading) return <div style={{ padding: '1rem' }}>Caricamento dissesti...</div>;

    return (
        <>
        {showLocationPicker && (
            <LocationPickerModal
                lat={formData.latitude}
                lng={formData.longitude}
                onConfirm={(lat, lng) => {
                    setFormData(prev => ({ ...prev, latitude: String(lat), longitude: String(lng) }));
                    setShowLocationPicker(false);
                }}
                onClose={() => setShowLocationPicker(false)}
            />
        )}
        <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>🕳️ Dissesti e Pavimentazione</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {unresolvedEmergencies > 0 && (
                        <span className="animate-pulse-warning" style={{
                            background: '#dc2626', color: '#fff', padding: '0.35rem 0.75rem',
                            borderRadius: '999px', fontWeight: 700, fontSize: '0.85rem',
                        }}>
                            ⚠️ {unresolvedEmergencies} emergenza/e attiva/e
                        </span>
                    )}
                    {canManage && (
                        <button onClick={() => setShowForm(s => !s)} style={{ padding: '0.4rem 0.8rem' }}>
                            {showForm ? 'Annulla' : '+ Nuova Segnalazione'}
                        </button>
                    )}
                </div>
            </div>

            {error && <div style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</div>}

            {showForm && (
                <form onSubmit={handleCreate} style={{
                    border: '1px solid #d1d5db', borderRadius: '8px', padding: '1rem', marginBottom: '1rem',
                    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem',
                }}>
                    <label>
                        Via
                        <input required value={formData.street_name}
                            onChange={e => setFormData(prev => ({ ...prev, street_name: e.target.value }))}
                            style={{ width: '100%' }} />
                    </label>
                    <label>
                        Tipo Dissesto
                        <select value={formData.defect_type}
                            onChange={e => setFormData(prev => ({ ...prev, defect_type: e.target.value }))}
                            style={{ width: '100%' }}>
                            {Object.entries(DEFECT_TYPE_LABELS).map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Latitudine
                        <input required type="number" step="any" value={formData.latitude}
                            onChange={e => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                            style={{ width: '100%' }} />
                    </label>
                    <label>
                        Longitudine
                        <input required type="number" step="any" value={formData.longitude}
                            onChange={e => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                            style={{ width: '100%' }} />
                    </label>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <button type="button" onClick={() => setShowLocationPicker(true)}
                            style={{ background: '#334155', color: '#f1f5f9', border: '1px solid #475569', borderRadius: 6, padding: '0.35rem 0.9rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                            📍 Scegli sulla mappa
                        </button>
                        {formData.latitude && formData.longitude && (
                            <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: '#6b7280', fontFamily: 'monospace' }}>
                                {parseFloat(formData.latitude).toFixed(6)}, {parseFloat(formData.longitude).toFixed(6)}
                            </span>
                        )}
                    </div>
                    <label>
                        Gravità
                        <select value={formData.severity}
                            onChange={e => setFormData(prev => ({ ...prev, severity: e.target.value }))}
                            style={{ width: '100%' }}>
                            {Object.entries(SEVERITY_LABELS).map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Foto
                        <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ width: '100%' }} />
                    </label>
                    <label style={{ gridColumn: '1 / -1' }}>
                        Descrizione
                        <textarea value={formData.description}
                            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            style={{ width: '100%' }} />
                    </label>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <button type="submit">Salva Segnalazione</button>
                    </div>
                </form>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: '1rem' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ background: 'var(--gray-100)', textAlign: 'left' }}>
                                <th style={{ padding: '0.5rem' }}>ID</th>
                                <th style={{ padding: '0.5rem' }}>Via</th>
                                <th style={{ padding: '0.5rem' }}>Tipo</th>
                                <th style={{ padding: '0.5rem' }}>Gravità</th>
                                <th style={{ padding: '0.5rem' }}>Stato</th>
                                <th style={{ padding: '0.5rem' }}>Azioni</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedDefects.map(d => (
                                <tr key={d.id}
                                    onClick={() => setSelectedId(d.id)}
                                    style={{
                                        cursor: 'pointer',
                                        background: selectedId === d.id ? 'rgba(99,102,241,0.12)' : 'transparent',
                                        borderBottom: '1px solid var(--gray-200)',
                                    }}>
                                    <td style={{ padding: '0.5rem' }}>#{d.id}</td>
                                    <td style={{ padding: '0.5rem' }}>{d.street_name}</td>
                                    <td style={{ padding: '0.5rem' }}>{DEFECT_TYPE_LABELS[d.defect_type] || d.defect_type}</td>
                                    <td style={{ padding: '0.5rem' }}>
                                        <span style={{
                                            background: SEVERITY_COLORS[d.severity], color: '#fff',
                                            borderRadius: '4px', padding: '0.15rem 0.5rem', fontSize: '0.8rem',
                                        }}>
                                            {SEVERITY_LABELS[d.severity] || d.severity}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.5rem' }}>{STATUS_LABELS[d.status] || d.status}</td>
                                    <td style={{ padding: '0.5rem' }}>
                                        {canForward && d.status !== 'ripristinato' && (
                                            <button onClick={(e) => { e.stopPropagation(); handleForward(d); }} style={{ marginRight: '0.5rem' }}>
                                                Inoltra a Ufficio Tecnico
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {sortedDefects.length === 0 && (
                                <tr><td colSpan={6} style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>Nessun dissesto segnalato.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {selected && (
                    <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>Dissesto #{selected.id}</h3>
                            <button onClick={() => setSelectedId(null)}>✕</button>
                        </div>
                        <p><strong>Via:</strong> {selected.street_name}</p>
                        <p><strong>Tipo:</strong> {DEFECT_TYPE_LABELS[selected.defect_type] || selected.defect_type}</p>
                        <p><strong>Gravità:</strong> {SEVERITY_LABELS[selected.severity] || selected.severity}</p>
                        <p><strong>Stato:</strong> {STATUS_LABELS[selected.status] || selected.status}</p>
                        <p><strong>Descrizione:</strong> {selected.description || '-'}</p>
                        <p><strong>Coordinate:</strong> {selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</p>
                        <p>
                            <a href={`https://www.google.com/maps?q=${selected.latitude},${selected.longitude}`} target="_blank" rel="noreferrer">
                                Visualizza su mappa
                            </a>
                        </p>
                        {selected.photo_path && (
                            <img src={selected.photo} alt={`Foto dissesto #${selected.id}`}
                                style={{ maxWidth: '100%', maxHeight: '260px', objectFit: 'contain', border: '1px solid #d1d5db', borderRadius: '4px' }} />
                        )}

                        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {canManage && selected.status !== 'ripristinato' && (
                                <button onClick={() => handleStatusChange(selected, 'ripristinato')}>
                                    Segna come Ripristinato
                                </button>
                            )}
                            {canForward && selected.status !== 'ripristinato' && (
                                <button onClick={() => handleForward(selected)}>
                                    Inoltra a Ufficio Tecnico
                                </button>
                            )}
                            {user?.role === 'admin' && (
                                <button onClick={() => handleDelete(selected)} style={{ color: '#dc2626' }}>
                                    Elimina
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
        </>
    );
}

export default PavementManager;
