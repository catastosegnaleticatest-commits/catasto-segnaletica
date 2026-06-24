import { useState, useEffect } from 'react';
import apiService from '../services/api';
import LocationPickerModal from './LocationPickerModal';

const TYPE_LABELS = {
    intersezione: 'Intersezione Semaforizzata',
    pedonale: 'Attraversamento Pedonale',
    pedonale_a_chiamata: 'Pedonale a Chiamata',
    lanterna_singola: 'Lanterna Singola',
};

const STATUS_LABELS = {
    operativo: 'Operativo',
    guasto: 'Guasto',
    manutenzione: 'In Manutenzione',
    fuori_servizio: 'Fuori Servizio',
};

const STATUS_COLORS = {
    operativo: '#16a34a',
    guasto: '#dc2626',
    manutenzione: '#f59e0b',
    fuori_servizio: '#6b7280',
};

const INTERVENTION_STATUS_LABELS = {
    programmato: 'Programmato',
    in_corso: 'In Corso',
    completato: 'Completato',
    annullato: 'Annullato',
};

const EMPTY_FORM = {
    location_name: '',
    latitude: '',
    longitude: '',
    type: 'intersezione',
    status: 'operativo',
    last_maintenance_date: '',
    notes: '',
};

const EMPTY_INTERVENTION = {
    type: '',
    scheduled_date: '',
    cost: '',
    notes: '',
};

function TrafficLightsTab({ user }) {
    const [lights, setLights] = useState([]);
    const [interventions, setInterventions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [showInterventionForm, setShowInterventionForm] = useState(false);
    const [interventionForm, setInterventionForm] = useState(EMPTY_INTERVENTION);

    const [showLocationPicker, setShowLocationPicker] = useState(false);

    const canManage = user && (user.role === 'admin' || user.role === 'tecnico' || user.role === 'operatore');

    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [lightsData, interventionsData] = await Promise.all([
                apiService.getTrafficLights(),
                apiService.getTrafficLightInterventions(),
            ]);
            setLights(lightsData);
            setInterventions(interventionsData);
            setError('');
        } catch (err) {
            setError('Errore caricamento impianti semaforici: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const selected = lights.find(l => l.id === selectedId) || null;
    const selectedInterventions = interventions.filter(i => i.traffic_light_id === selectedId);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await apiService.createTrafficLight({
                ...formData,
                latitude: parseFloat(formData.latitude),
                longitude: parseFloat(formData.longitude),
                last_maintenance_date: formData.last_maintenance_date || null,
            });
            setShowForm(false);
            setFormData(EMPTY_FORM);
            await loadAll();
        } catch (err) {
            alert('Errore creazione: ' + err.message);
        }
    };

    const handleStatusChange = async (light, newStatus) => {
        try {
            await apiService.updateTrafficLight(light.id, {
                location_name: light.location_name,
                latitude: light.latitude,
                longitude: light.longitude,
                type: light.type,
                status: newStatus,
                last_maintenance_date: light.last_maintenance_date,
                notes: light.notes,
            });
            await loadAll();
        } catch (err) {
            alert('Errore aggiornamento stato: ' + err.message);
        }
    };

    const handleDelete = async (light) => {
        if (!window.confirm(`Eliminare definitivamente l'impianto semaforico #${light.id}?`)) return;
        try {
            await apiService.deleteTrafficLight(light.id);
            if (selectedId === light.id) setSelectedId(null);
            await loadAll();
        } catch (err) {
            alert('Errore eliminazione: ' + err.message);
        }
    };

    const handleCreateIntervention = async (e) => {
        e.preventDefault();
        try {
            await apiService.createTrafficLightIntervention({
                traffic_light_id: selectedId,
                type: interventionForm.type,
                scheduled_date: interventionForm.scheduled_date || null,
                cost: interventionForm.cost !== '' ? parseFloat(interventionForm.cost) : null,
                notes: interventionForm.notes || null,
            });
            setShowInterventionForm(false);
            setInterventionForm(EMPTY_INTERVENTION);
            await loadAll();
        } catch (err) {
            alert('Errore creazione intervento: ' + err.message);
        }
    };

    const handleInterventionStatusChange = async (intervention, newStatus) => {
        try {
            await apiService.updateTrafficLightIntervention(intervention.id, {
                type: intervention.type,
                scheduled_date: intervention.scheduled_date,
                completed_date: newStatus === 'completato' ? new Date().toISOString().split('T')[0] : intervention.completed_date,
                status: newStatus,
                cost: intervention.cost,
                notes: intervention.notes,
            });
            await loadAll();
        } catch (err) {
            alert('Errore aggiornamento intervento: ' + err.message);
        }
    };

    if (loading) return <div style={{ padding: '1rem' }}>Caricamento impianti semaforici...</div>;

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
                <h2 style={{ margin: 0 }}>🚥 Impianti Semaforici</h2>
                {canManage && (
                    <button onClick={() => setShowForm(s => !s)} style={{ padding: '0.4rem 0.8rem' }}>
                        {showForm ? 'Annulla' : '+ Nuovo Impianto'}
                    </button>
                )}
            </div>

            {error && <div style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</div>}

            {showForm && (
                <form onSubmit={handleCreate} style={{
                    border: '1px solid #d1d5db', borderRadius: '8px', padding: '1rem', marginBottom: '1rem',
                    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem',
                }}>
                    <label style={{ gridColumn: '1 / -1' }}>
                        Ubicazione
                        <input required value={formData.location_name}
                            onChange={e => setFormData(prev => ({ ...prev, location_name: e.target.value }))}
                            placeholder="Es. Incrocio Via Roma / Via Verdi"
                            style={{ width: '100%' }} />
                    </label>
                    <label>
                        Tipo Impianto
                        <select value={formData.type}
                            onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
                            style={{ width: '100%' }}>
                            {Object.entries(TYPE_LABELS).map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Stato
                        <select value={formData.status}
                            onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))}
                            style={{ width: '100%' }}>
                            {Object.entries(STATUS_LABELS).map(([val, label]) => (
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
                        Ultima Manutenzione
                        <input type="date" value={formData.last_maintenance_date}
                            onChange={e => setFormData(prev => ({ ...prev, last_maintenance_date: e.target.value }))}
                            style={{ width: '100%' }} />
                    </label>
                    <label style={{ gridColumn: '1 / -1' }}>
                        Note
                        <textarea value={formData.notes}
                            onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            style={{ width: '100%' }} />
                    </label>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <button type="submit">Salva Impianto</button>
                    </div>
                </form>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: '1rem' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ background: 'var(--gray-100)', textAlign: 'left' }}>
                                <th style={{ padding: '0.5rem' }}>ID</th>
                                <th style={{ padding: '0.5rem' }}>Ubicazione</th>
                                <th style={{ padding: '0.5rem' }}>Tipo</th>
                                <th style={{ padding: '0.5rem' }}>Stato</th>
                                <th style={{ padding: '0.5rem' }}>Ultima Manutenzione</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lights.map(l => (
                                <tr key={l.id}
                                    onClick={() => setSelectedId(l.id)}
                                    style={{
                                        cursor: 'pointer',
                                        background: selectedId === l.id ? 'rgba(99,102,241,0.12)' : 'transparent',
                                        borderBottom: '1px solid var(--gray-200)',
                                    }}>
                                    <td style={{ padding: '0.5rem' }}>#{l.id}</td>
                                    <td style={{ padding: '0.5rem' }}>{l.location_name}</td>
                                    <td style={{ padding: '0.5rem' }}>{TYPE_LABELS[l.type] || l.type}</td>
                                    <td style={{ padding: '0.5rem' }}>
                                        <span style={{
                                            background: STATUS_COLORS[l.status], color: '#fff',
                                            borderRadius: '4px', padding: '0.15rem 0.5rem', fontSize: '0.8rem',
                                        }}>
                                            {STATUS_LABELS[l.status] || l.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.5rem' }}>{l.last_maintenance_date || '-'}</td>
                                </tr>
                            ))}
                            {lights.length === 0 && (
                                <tr><td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>Nessun impianto semaforico registrato.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {selected && (
                    <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>Impianto #{selected.id}</h3>
                            <button onClick={() => setSelectedId(null)}>✕</button>
                        </div>
                        <p><strong>Ubicazione:</strong> {selected.location_name}</p>
                        <p><strong>Tipo:</strong> {TYPE_LABELS[selected.type] || selected.type}</p>
                        <p><strong>Stato:</strong> {STATUS_LABELS[selected.status] || selected.status}</p>
                        <p><strong>Ultima Manutenzione:</strong> {selected.last_maintenance_date || '-'}</p>
                        <p><strong>Note:</strong> {selected.notes || '-'}</p>
                        <p><strong>Coordinate:</strong> {selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</p>
                        <p>
                            <a href={`https://www.google.com/maps?q=${selected.latitude},${selected.longitude}`} target="_blank" rel="noreferrer">
                                Visualizza su mappa
                            </a>
                        </p>

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

                        <div style={{ marginTop: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h4 style={{ margin: 0 }}>Interventi di Manutenzione</h4>
                                {canManage && (
                                    <button onClick={() => setShowInterventionForm(s => !s)} style={{ fontSize: '0.8rem' }}>
                                        {showInterventionForm ? 'Annulla' : '+ Nuovo Intervento'}
                                    </button>
                                )}
                            </div>

                            {showInterventionForm && (
                                <form onSubmit={handleCreateIntervention} style={{
                                    border: '1px solid var(--gray-200)', borderRadius: '6px', padding: '0.75rem', marginTop: '0.5rem',
                                    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem',
                                }}>
                                    <label style={{ gridColumn: '1 / -1' }}>
                                        Tipo Intervento
                                        <input required value={interventionForm.type}
                                            onChange={e => setInterventionForm(prev => ({ ...prev, type: e.target.value }))}
                                            placeholder="Es. Sostituzione lampade lanterna"
                                            style={{ width: '100%' }} />
                                    </label>
                                    <label>
                                        Data Programmata
                                        <input type="date" value={interventionForm.scheduled_date}
                                            onChange={e => setInterventionForm(prev => ({ ...prev, scheduled_date: e.target.value }))}
                                            style={{ width: '100%' }} />
                                    </label>
                                    <label>
                                        Costo (€)
                                        <input type="number" step="any" min="0" value={interventionForm.cost}
                                            onChange={e => setInterventionForm(prev => ({ ...prev, cost: e.target.value }))}
                                            style={{ width: '100%' }} />
                                    </label>
                                    <label style={{ gridColumn: '1 / -1' }}>
                                        Note
                                        <textarea value={interventionForm.notes}
                                            onChange={e => setInterventionForm(prev => ({ ...prev, notes: e.target.value }))}
                                            style={{ width: '100%' }} />
                                    </label>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <button type="submit">Salva Intervento</button>
                                    </div>
                                </form>
                            )}

                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                                <thead>
                                    <tr style={{ background: 'var(--gray-100)', textAlign: 'left' }}>
                                        <th style={{ padding: '0.4rem' }}>Tipo</th>
                                        <th style={{ padding: '0.4rem' }}>Programmato</th>
                                        <th style={{ padding: '0.4rem' }}>Stato</th>
                                        <th style={{ padding: '0.4rem' }}>Costo</th>
                                        <th style={{ padding: '0.4rem' }}>Azioni</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedInterventions.map(i => (
                                        <tr key={i.id} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                                            <td style={{ padding: '0.4rem' }}>{i.type}</td>
                                            <td style={{ padding: '0.4rem' }}>{i.scheduled_date || '-'}</td>
                                            <td style={{ padding: '0.4rem' }}>{INTERVENTION_STATUS_LABELS[i.status] || i.status}</td>
                                            <td style={{ padding: '0.4rem' }}>{i.cost != null ? `€ ${i.cost.toFixed(2)}` : '-'}</td>
                                            <td style={{ padding: '0.4rem' }}>
                                                {canManage && i.status !== 'completato' && i.status !== 'annullato' && (
                                                    <>
                                                        <button onClick={() => handleInterventionStatusChange(i, 'completato')} style={{ marginRight: '0.25rem', fontSize: '0.75rem' }}>
                                                            Completa
                                                        </button>
                                                        <button onClick={() => handleInterventionStatusChange(i, 'annullato')} style={{ fontSize: '0.75rem' }}>
                                                            Annulla
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {selectedInterventions.length === 0 && (
                                        <tr><td colSpan={5} style={{ padding: '0.75rem', textAlign: 'center', color: '#6b7280' }}>Nessun intervento registrato.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
        </>
    );
}

export default TrafficLightsTab;
