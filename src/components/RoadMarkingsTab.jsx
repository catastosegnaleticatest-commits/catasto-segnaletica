import { useState, useEffect } from 'react';
import { roadMarkingsService } from '../services/firestoreService';
import LocationPickerModal from './LocationPickerModal';

const MARKING_TYPE_LABELS = {
    strisce_pedonali: 'Strisce Pedonali',
    mezzeria: 'Mezzeria',
    stop: 'Stop',
    arresto: 'Linea di Arresto',
    ciclabile: 'Pista Ciclabile',
    parcheggio: 'Posti Auto',
    altro: 'Altro',
};

const MATERIAL_LABELS = {
    vernice: 'Vernice Spartitraffico',
    termoplastico: 'Termoplastico',
    resina: 'Resina',
    vernice_premiscelata: 'Vernice Premiscelata',
};

const STATUS_LABELS = {
    ottimo: 'Ottimo',
    buono: 'Buono',
    discreto: 'Discreto',
    da_rifare: 'Da Rifare',
};

const STATUS_COLORS = {
    ottimo: '#16a34a',
    buono: '#22c55e',
    discreto: '#f59e0b',
    da_rifare: '#dc2626',
};

const EMPTY_FORM = {
    street_name: '',
    latitude: '',
    longitude: '',
    marking_type: 'strisce_pedonali',
    material: 'vernice',
    status: 'buono',
    length_m: '',
    notes: '',
    photo: null,
};

function RoadMarkingsTab({ user }) {
    const [markings, setMarkings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);

    const [showLocationPicker, setShowLocationPicker] = useState(false);

    const canManage = user && (user.role === 'admin' || user.role === 'tecnico' || user.role === 'operatore');

    useEffect(() => {
        loadMarkings();
    }, []);

    const loadMarkings = async () => {
        setLoading(true);
        try {
            const data = await roadMarkingsService.getAll();
            setMarkings(data);
            setError('');
        } catch (err) {
            setError('Errore caricamento segnaletica orizzontale: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const selected = markings.find(m => m.id === selectedId) || null;

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
            await roadMarkingsService.create({
                ...formData,
                latitude: parseFloat(formData.latitude),
                longitude: parseFloat(formData.longitude),
                length_m: formData.length_m !== '' ? parseFloat(formData.length_m) : null,
            });
            setShowForm(false);
            setFormData(EMPTY_FORM);
            await loadMarkings();
        } catch (err) {
            alert('Errore creazione: ' + err.message);
        }
    };

    const handleStatusChange = async (marking, newStatus) => {
        try {
            await roadMarkingsService.update(marking.id, { status: newStatus });
            await loadMarkings();
        } catch (err) {
            alert('Errore aggiornamento stato: ' + err.message);
        }
    };

    const handleDelete = async (marking) => {
        if (!window.confirm(`Eliminare la segnaletica "${marking.street_name}"?`)) return;
        try {
            await roadMarkingsService.delete(marking.id);
            if (selectedId === marking.id) setSelectedId(null);
            await loadMarkings();
        } catch (err) {
            alert('Errore eliminazione: ' + err.message);
        }
    };

    if (loading) return <div style={{ padding: '1rem' }}>Caricamento segnaletica orizzontale...</div>;

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
                <h2 style={{ margin: 0 }}>🛣️ Segnaletica Orizzontale</h2>
                {canManage && (
                    <button onClick={() => setShowForm(s => !s)} style={{ padding: '0.4rem 0.8rem' }}>
                        {showForm ? 'Annulla' : '+ Nuovo Elemento'}
                    </button>
                )}
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
                        Tipo Segnaletica
                        <select value={formData.marking_type}
                            onChange={e => setFormData(prev => ({ ...prev, marking_type: e.target.value }))}
                            style={{ width: '100%' }}>
                            {Object.entries(MARKING_TYPE_LABELS).map(([val, label]) => (
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
                        Materiale
                        <select value={formData.material}
                            onChange={e => setFormData(prev => ({ ...prev, material: e.target.value }))}
                            style={{ width: '100%' }}>
                            {Object.entries(MATERIAL_LABELS).map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Stato di Conservazione
                        <select value={formData.status}
                            onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))}
                            style={{ width: '100%' }}>
                            {Object.entries(STATUS_LABELS).map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Lunghezza (m)
                        <input type="number" step="any" min="0" value={formData.length_m}
                            onChange={e => setFormData(prev => ({ ...prev, length_m: e.target.value }))}
                            style={{ width: '100%' }} />
                    </label>
                    <label>
                        Foto
                        <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ width: '100%' }} />
                    </label>
                    <label style={{ gridColumn: '1 / -1' }}>
                        Note
                        <textarea value={formData.notes}
                            onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            style={{ width: '100%' }} />
                    </label>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <button type="submit">Salva Elemento</button>
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
                                <th style={{ padding: '0.5rem' }}>Materiale</th>
                                <th style={{ padding: '0.5rem' }}>Stato</th>
                                <th style={{ padding: '0.5rem' }}>Lunghezza</th>
                            </tr>
                        </thead>
                        <tbody>
                            {markings.map(m => (
                                <tr key={m.id}
                                    onClick={() => setSelectedId(m.id)}
                                    style={{
                                        cursor: 'pointer',
                                        background: selectedId === m.id ? 'rgba(99,102,241,0.12)' : 'transparent',
                                        borderBottom: '1px solid var(--gray-200)',
                                    }}>
                                    <td style={{ padding: '0.5rem' }}>#{m.id}</td>
                                    <td style={{ padding: '0.5rem' }}>{m.street_name}</td>
                                    <td style={{ padding: '0.5rem' }}>{MARKING_TYPE_LABELS[m.marking_type] || m.marking_type}</td>
                                    <td style={{ padding: '0.5rem' }}>{MATERIAL_LABELS[m.material] || m.material}</td>
                                    <td style={{ padding: '0.5rem' }}>
                                        <span style={{
                                            background: STATUS_COLORS[m.status], color: '#fff',
                                            borderRadius: '4px', padding: '0.15rem 0.5rem', fontSize: '0.8rem',
                                        }}>
                                            {STATUS_LABELS[m.status] || m.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.5rem' }}>{m.length_m ? `${m.length_m} m` : '-'}</td>
                                </tr>
                            ))}
                            {markings.length === 0 && (
                                <tr><td colSpan={6} style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>Nessun elemento di segnaletica orizzontale registrato.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {selected && (
                    <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>Elemento #{selected.id}</h3>
                            <button onClick={() => setSelectedId(null)}>✕</button>
                        </div>
                        <p><strong>Via:</strong> {selected.street_name}</p>
                        <p><strong>Tipo:</strong> {MARKING_TYPE_LABELS[selected.marking_type] || selected.marking_type}</p>
                        <p><strong>Materiale:</strong> {MATERIAL_LABELS[selected.material] || selected.material}</p>
                        <p><strong>Stato:</strong> {STATUS_LABELS[selected.status] || selected.status}</p>
                        <p><strong>Lunghezza:</strong> {selected.length_m ? `${selected.length_m} m` : '-'}</p>
                        <p><strong>Note:</strong> {selected.notes || '-'}</p>
                        <p><strong>Coordinate:</strong> {selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</p>
                        <p>
                            <a href={`https://www.google.com/maps?q=${selected.latitude},${selected.longitude}`} target="_blank" rel="noreferrer">
                                Visualizza su mappa
                            </a>
                        </p>
                        {selected.photo && (
                            <img src={selected.photo} alt={`Foto elemento #${selected.id}`}
                                style={{ maxWidth: '100%', maxHeight: '260px', objectFit: 'contain', border: '1px solid #d1d5db', borderRadius: '4px' }} />
                        )}

                        {canManage && (
                            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {Object.entries(STATUS_LABELS).filter(([val]) => val !== selected.status).map(([val, label]) => (
                                    <button key={val} onClick={() => handleStatusChange(selected, val)}>
                                        Imposta: {label}
                                    </button>
                                ))}
                                {user?.role === 'admin' && (
                                    <button onClick={() => handleDelete(selected)} style={{ color: '#dc2626' }}>
                                        Elimina
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
        </>
    );
}

export default RoadMarkingsTab;
