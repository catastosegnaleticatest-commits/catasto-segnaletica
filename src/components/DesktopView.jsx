import { useState, useEffect, lazy, Suspense } from 'react';
import localStorageService from '../services/localStorage';
import { signsService, interventionsService } from '../services/firestoreService';
import { useContractsData } from '../hooks/useContractsData';
import DesktopSignDetails from './DesktopSignDetails';
import Dashboard from './Dashboard';
import AddSignModal from './AddSignModal';
import { getSignAgeYears, isSignExpired, MAX_SIGN_LIFESPAN_YEARS } from '../utils/signLifespan';

// Lazy: caricati solo quando la scheda corrispondente viene aperta
const MapView          = lazy(() => import('./MapView'));
const UserManagement   = lazy(() => import('./UserManagement'));
const AuditLog         = lazy(() => import('./AuditLog'));
const ContractsTab     = lazy(() => import('./ContractsTab'));
const TrafficProjectSim= lazy(() => import('./TrafficProjectSim'));
const TaxReportsTab    = lazy(() => import('./TaxReportsTab'));
const VirtualCensusTab = lazy(() => import('./VirtualCensusTab'));
const PavementManager  = lazy(() => import('./PavementManager'));
const RoadMarkingsTab  = lazy(() => import('./RoadMarkingsTab'));
const TrafficLightsTab = lazy(() => import('./TrafficLightsTab'));
const UserManual       = lazy(() => import('./UserManual'));
const ARValidationPanel = lazy(() => import('./ARValidationPanel'));
const MobileImportPanel = lazy(() => import('./MobileImportPanel'));
const AISetupPanel      = lazy(() => import('./AISetupPanel'));

const INTERVENTION_TYPES = ['Sostituzione', 'Riparazione', 'Pulizia', 'Ispezione', 'Rimozione', 'Nuova installazione', 'Altro'];

const SIGN_TYPES = ['divieto', 'obbligo', 'pericolo', 'indicazione', 'precedenza', 'passo_carrabile'];

const SIGN_STATUSES = ['buono', 'danneggiato', 'da_sostituire', 'rimosso'];

const STATUS_COLOR = {
    programmato: '#f59e0b',
    in_corso: '#3b82f6',
    completato: '#10b981',
    verificato_pattuglia: '#8b5cf6',
    liquidato: '#0d9488',
    annullato: '#6b7280'
};

function InterventionsTab({ interventions, signs, user, onDataChange, prefillSignId, onPrefillConsumed }) {
    const [showForm, setShowForm] = useState(false);
    const [filterStatus, setFilterStatus] = useState('tutti');
    const [form, setForm] = useState({ sign_id: '', type: INTERVENTION_TYPES[0], scheduled_date: '', contract_id: '', price_list_id: '', commitment_id: '', quantity: '', notes: '' });
    const [saving, setSaving] = useState(false);
    const { contracts, priceList, commitments, loading: loadingBudgetData } = useContractsData();

    useEffect(() => {
        if (prefillSignId) {
            setForm(p => ({ ...p, sign_id: String(prefillSignId) }));
            setShowForm(true);
            if (onPrefillConsumed) onPrefillConsumed();
        }
    }, [prefillSignId]);

    const priceListForContract = form.contract_id
        ? priceList.filter(p => p.contract_id === parseInt(form.contract_id))
        : [];

    const commitmentsForContract = form.contract_id
        ? commitments.filter(c => c.contract_id === parseInt(form.contract_id) && parseFloat(c.residual_amount) > 0)
        : [];

    const selectedPriceItem = priceList.find(p => p.id === parseInt(form.price_list_id));
    const estimatedCost = selectedPriceItem && form.quantity
        ? selectedPriceItem.unit_price * parseFloat(form.quantity)
        : null;

    const filtered = filterStatus === 'tutti'
        ? interventions
        : interventions.filter(i => i.status === filterStatus);

    const spentTotal = interventions
        .filter(i => ['completato', 'verificato_pattuglia', 'liquidato'].includes(i.status) && i.cost)
        .reduce((sum, i) => sum + parseFloat(i.cost), 0);
    const committedTotal = interventions
        .filter(i => (i.status === 'programmato' || i.status === 'in_corso') && i.cost)
        .reduce((sum, i) => sum + parseFloat(i.cost), 0);

    const getSignLabel = (signId) => {
        const s = signs.find(s => s.id === signId || s.id === parseInt(signId));
        return s ? `#${s.id} ${s.type} (${parseFloat(s.latitude).toFixed(4)}, ${parseFloat(s.longitude).toFixed(4)})` : `#${signId}`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.sign_id) { alert('Selezionare un segnale'); return; }
        if (!form.scheduled_date) { alert('Inserire la data programmata'); return; }
        if (!form.contract_id) { alert('Selezionare un Accordo Quadro/Impresa'); return; }
        if (!form.price_list_id) { alert('Selezionare una voce di tariffario'); return; }
        if (!form.commitment_id) { alert('Selezionare un impegno di spesa'); return; }
        if (!form.quantity || parseFloat(form.quantity) <= 0) { alert('Inserire una quantità maggiore di zero'); return; }
        setSaving(true);
        try {
            await interventionsService.create({
                sign_id: String(form.sign_id),
                type: form.type,
                scheduled_date: form.scheduled_date,
                completed_date: null,
                status: 'programmato',
                price_list_id: parseInt(form.price_list_id),
                quantity: parseFloat(form.quantity),
                commitment_id: parseInt(form.commitment_id),
                notes: form.notes
            });
            setForm({ sign_id: '', type: INTERVENTION_TYPES[0], scheduled_date: '', contract_id: '', price_list_id: '', commitment_id: '', quantity: '', notes: '' });
            setShowForm(false);
            onDataChange();
        } catch (err) {
            alert('Errore: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (intervention, newStatus) => {
        try {
            await interventionsService.update(intervention.id, {
                ...intervention,
                status: newStatus,
                completed_date: newStatus === 'completato' ? new Date().toISOString().split('T')[0] : intervention.completed_date
            });
            onDataChange();
        } catch (err) {
            alert('Errore aggiornamento: ' + err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Eliminare questo intervento?')) return;
        try {
            await interventionsService.delete(id);
            onDataChange();
        } catch (err) {
            alert('Errore eliminazione: ' + err.message);
        }
    };

    return (
        <div className="card">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <h3 className="card-title" style={{ margin: 0 }}>
                    Interventi ({filtered.length}{filterStatus !== 'tutti' ? ` / ${interventions.length} tot.` : ''})
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        style={{ fontSize: '0.875rem', padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid var(--gray-300)' }}
                    >
                        <option value="tutti">Tutti gli stati</option>
                        <option value="programmato">Programmato</option>
                        <option value="in_corso">In corso</option>
                        <option value="completato">Completato</option>
                        <option value="verificato_pattuglia">Verificato Pattuglia</option>
                        <option value="liquidato">Liquidato</option>
                        <option value="annullato">Annullato</option>
                    </select>
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowForm(f => !f)}
                        style={{ fontSize: '0.875rem', padding: '0.4rem 0.9rem' }}
                    >
                        {showForm ? '✕ Annulla' : '+ Nuovo Intervento'}
                    </button>
                </div>
            </div>

            {/* Riepilogo Budget */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 'var(--border-radius)', padding: '0.9rem 1.1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>💰 SPESA TOTALE SOSTENUTA</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#4ade80' }}>€ {spentTotal.toFixed(2)}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Interventi completati</div>
                </div>
                <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--border-radius)', padding: '0.9rem 1.1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>📅 BUDGET IMPEGNATO FUTURO</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#fbbf24' }}>€ {committedTotal.toFixed(2)}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Programmati / in corso</div>
                </div>
            </div>

            {/* Form creazione */}
            {showForm && (
                <form onSubmit={handleSubmit} style={{ background: 'rgba(59,130,246,0.06)', padding: '1.25rem', borderRadius: 'var(--border-radius)', border: '1px solid rgba(59,130,246,0.2)', marginBottom: '1.5rem' }}>
                    <h4 style={{ margin: '0 0 1rem', color: '#93c5fd', fontSize: '0.95rem' }}>Nuovo Intervento</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem', alignItems: 'end' }}>
                        <div>
                            <label className="field-label">Segnale *</label>
                            <select
                                className="form-select"
                                value={form.sign_id}
                                onChange={e => setForm(p => ({ ...p, sign_id: e.target.value }))}
                                style={{ fontSize: '0.875rem' }}
                                required
                            >
                                <option value="">Seleziona segnale...</option>
                                {signs.map(s => (
                                    <option key={s.id} value={s.id}>
                                        #{s.id} {s.type} — {s.notes || `${parseFloat(s.latitude).toFixed(4)}, ${parseFloat(s.longitude).toFixed(4)}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="field-label">Tipo *</label>
                            <select className="form-select" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={{ fontSize: '0.875rem' }}>
                                {INTERVENTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="field-label">Data programmata *</label>
                            <input type="date" className="form-input" value={form.scheduled_date} onChange={e => setForm(p => ({ ...p, scheduled_date: e.target.value }))} style={{ fontSize: '0.875rem' }} required />
                        </div>
                    </div>

                    {loadingBudgetData ? (
                        <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--gray-500)' }}>⏳ Caricamento dati appalti...</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1.5fr 0.8fr', gap: '0.75rem', alignItems: 'end', marginTop: '0.75rem' }}>
                            <div>
                                <label className="field-label">Accordo Quadro/Impresa *</label>
                                <select
                                    className="form-select"
                                    value={form.contract_id}
                                    onChange={e => setForm(p => ({ ...p, contract_id: e.target.value, price_list_id: '', commitment_id: '' }))}
                                    style={{ fontSize: '0.875rem' }}
                                    required
                                >
                                    <option value="">Seleziona accordo quadro...</option>
                                    {contracts.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.company}{c.cig ? ` — CIG ${c.cig}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="field-label">Voce di Tariffario *</label>
                                <select
                                    className="form-select"
                                    value={form.price_list_id}
                                    onChange={e => setForm(p => ({ ...p, price_list_id: e.target.value }))}
                                    style={{ fontSize: '0.875rem' }}
                                    disabled={!form.contract_id}
                                    required
                                >
                                    <option value="">Seleziona voce...</option>
                                    {priceListForContract.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.item_code ? `[${p.item_code}] ` : ''}{p.description} — € {parseFloat(p.unit_price).toFixed(2)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="field-label">Impegno di Spesa *</label>
                                <select
                                    className="form-select"
                                    value={form.commitment_id}
                                    onChange={e => setForm(p => ({ ...p, commitment_id: e.target.value }))}
                                    style={{ fontSize: '0.875rem' }}
                                    disabled={!form.contract_id}
                                    required
                                >
                                    <option value="">Seleziona impegno...</option>
                                    {commitmentsForContract.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.resolution_number ? `Determina ${c.resolution_number}` : `Impegno #${c.id}`} — Residuo € {parseFloat(c.residual_amount).toFixed(2)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="field-label">Quantità *</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="form-input"
                                    value={form.quantity}
                                    onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                                    style={{ fontSize: '0.875rem' }}
                                    required
                                />
                            </div>
                        </div>
                    )}

                    {estimatedCost !== null && (
                        <div className="info-banner info-banner-success">
                            💰 Costo stimato: € {estimatedCost.toFixed(2)}
                        </div>
                    )}

                    <div style={{ marginTop: '0.75rem' }}>
                        <label className="field-label">Note</label>
                        <input type="text" className="form-input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Descrizione o informazioni aggiuntive..." style={{ fontSize: '0.875rem', width: '100%' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)} style={{ fontSize: '0.875rem' }}>Annulla</button>
                        <button type="submit" className="btn btn-primary" disabled={saving} style={{ fontSize: '0.875rem' }}>
                            {saving ? '💾 Salvataggio...' : '💾 Salva Intervento'}
                        </button>
                    </div>
                </form>
            )}

            {/* Tabella interventi */}
            {filtered.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-500)' }}>
                    {filterStatus === 'tutti' ? 'Nessun intervento registrato' : `Nessun intervento con stato "${filterStatus}"`}
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--gray-200)', textAlign: 'left' }}>
                                <th style={{ padding: '0.75rem', fontSize: '0.875rem' }}>Tipo</th>
                                <th style={{ padding: '0.75rem', fontSize: '0.875rem' }}>Segnale</th>
                                <th style={{ padding: '0.75rem', fontSize: '0.875rem' }}>Data</th>
                                <th style={{ padding: '0.75rem', fontSize: '0.875rem' }}>Costo</th>
                                <th style={{ padding: '0.75rem', fontSize: '0.875rem' }}>Note</th>
                                <th style={{ padding: '0.75rem', fontSize: '0.875rem' }}>Stato</th>
                                {user?.role === 'admin' && <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem' }}>Azioni</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(i => (
                                <tr key={i.id} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                                    <td style={{ padding: '0.75rem', fontWeight: '600', fontSize: '0.875rem' }}>🔧 {i.type}</td>
                                    <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--gray-600)' }}>{getSignLabel(i.sign_id)}</td>
                                    <td style={{ padding: '0.75rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                                        {i.scheduled_date ? new Date(i.scheduled_date).toLocaleDateString('it-IT') : '-'}
                                        {i.completed_date && (
                                            <div style={{ fontSize: '0.75rem', color: '#10b981' }}>✅ {new Date(i.completed_date).toLocaleDateString('it-IT')}</div>
                                        )}
                                    </td>
                                    <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{i.cost ? `€ ${parseFloat(i.cost).toFixed(2)}` : '-'}</td>
                                    <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--gray-600)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.notes || '-'}</td>
                                    <td style={{ padding: '0.75rem' }}>
                                        <select
                                            value={i.status || 'programmato'}
                                            onChange={e => handleStatusChange(i, e.target.value)}
                                            style={{
                                                fontSize: '0.8rem',
                                                padding: '0.25rem 0.4rem',
                                                borderRadius: '9999px',
                                                border: 'none',
                                                background: STATUS_COLOR[i.status] || '#6b7280',
                                                color: 'white',
                                                fontWeight: '600',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="programmato">📅 Programmato</option>
                                            <option value="in_corso">🔧 In corso</option>
                                            <option value="completato">✅ Completato</option>
                                            <option value="verificato_pattuglia">👮 Verificato Pattuglia</option>
                                            <option value="liquidato">💶 Liquidato</option>
                                            <option value="annullato">❌ Annullato</option>
                                        </select>
                                    </td>
                                    {user?.role === 'admin' && (
                                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                            <button
                                                onClick={() => handleDelete(i.id)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--danger)' }}
                                                title="Elimina"
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function DesktopView({ user, syncStatus, stats, onDataChange, onLogout, onChangePassword, onSync, darkMode, onToggleDarkMode }) {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [signs, setSigns] = useState([]);
    const [interventions, setInterventions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSign, setSelectedSign] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [archiveTypeFilter, setArchiveTypeFilter] = useState('tutti');
    const [archiveStatusFilter, setArchiveStatusFilter] = useState('tutti');
    const [archiveSearch, setArchiveSearch] = useState('');
    const [archiveExpiredOnly, setArchiveExpiredOnly] = useState(false);
    const [archivePage, setArchivePage] = useState(1);
    const ARCHIVE_PAGE_SIZE = 10;
    const [selectedSignIds, setSelectedSignIds] = useState([]);
    const [prefillInterventionSignId, setPrefillInterventionSignId] = useState(null);
    const [showEmptyHint, setShowEmptyHint] = useState(true);

    useEffect(() => {
        if (signs.length === 0) {
            setShowEmptyHint(true);
            const t = setTimeout(() => setShowEmptyHint(false), 10000);
            return () => clearTimeout(t);
        }
    }, [signs.length]);

    useEffect(() => {
        loadData();
    }, [stats]);

    // Refresh automatico quando un'altra scheda (es. Censimento Virtuale) importa un segnale
    useEffect(() => {
        const handler = () => loadData();
        window.addEventListener('catasto:signs-updated', handler);
        return () => window.removeEventListener('catasto:signs-updated', handler);
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [signsData, interventionsData] = await Promise.all([
                signsService.getAll(),
                interventionsService.getAll(),
            ]);
            setSigns(signsData);
            setInterventions(interventionsData);
        } catch (error) {
            console.error('Errore caricamento dati:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSign = async (signId) => {
        if (!confirm('Sei sicuro di voler eliminare questo segnale?')) return;

        try {
            await signsService.delete(signId);
            alert('Segnale eliminato con successo!');
            loadData();
            if (onDataChange) onDataChange();
        } catch (error) {
            console.error('Errore eliminazione segnale:', error);
            alert('Errore eliminazione segnale: ' + error.message);
        }
    };

    const handleOpenDetails = (sign) => {
        setSelectedSign(sign);
        setActiveTab('details');
    };

    const handlePlanIntervention = (sign) => {
        setPrefillInterventionSignId(sign.id);
        setActiveTab('interventions');
    };

    const getSignIcon = (type) => {
        const icons = {
            divieto: '🚫',
            obbligo: '🔵',
            pericolo: '⚠️',
            indicazione: 'ℹ️',
            precedenza: '🔺'
        };
        return icons[type] || '📍';
    };

    const handleExportGeoJSON = () => {
        const geojson = {
            type: 'FeatureCollection',
            features: signs
                .filter(sign => sign && sign.latitude != null && sign.longitude != null)
                .map(sign => ({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(sign.longitude), parseFloat(sign.latitude)]
                    },
                    properties: {
                        id: sign.id,
                        type: sign.type,
                        status: sign.status,
                        notes: sign.notes || null,
                        installation_date: sign.installation_date || null,
                        created_at: sign.created_at || null,
                        updated_at: sign.updated_at || null,
                        creator_username: sign.creator_username || null,
                        synced: !!sign.synced
                    }
                }))
        };

        const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `catasto-segnaletica-${new Date().toISOString().split('T')[0]}.geojson`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const toggleSelectSign = (signId) => {
        setSelectedSignIds(prev => prev.includes(signId) ? prev.filter(id => id !== signId) : [...prev, signId]);
    };

    const toggleSelectAll = (signsToToggle) => {
        const ids = signsToToggle.map(s => s.id);
        const allSelected = ids.every(id => selectedSignIds.includes(id));
        if (allSelected) {
            setSelectedSignIds(prev => prev.filter(id => !ids.includes(id)));
        } else {
            setSelectedSignIds(prev => [...new Set([...prev, ...ids])]);
        }
    };

    const handleGenerateRegister = () => {
        const selectedSigns = signs.filter(s => selectedSignIds.includes(s.id));
        if (selectedSigns.length === 0) {
            alert('Seleziona almeno un segnale per generare il registro.');
            return;
        }

        const rows = selectedSigns.map(sign => {
            const signInterventions = interventions.filter(i => i.sign_id === sign.id);
            const age = getSignAgeYears(sign.installation_date);
            const expired = isSignExpired(sign.installation_date);
            const interventionsHtml = signInterventions.length > 0
                ? `<ul style="margin: 0.25rem 0 0; padding-left: 1.2rem;">${signInterventions.map(i => `
                    <li>${i.type} — ${i.status}${i.scheduled_date ? ` (prog. ${new Date(i.scheduled_date).toLocaleDateString('it-IT')})` : ''}${i.completed_date ? ` — completato ${new Date(i.completed_date).toLocaleDateString('it-IT')}` : ''}${i.cost ? ` — € ${parseFloat(i.cost).toFixed(2)}` : ''}</li>
                `).join('')}</ul>`
                : '<span style="color:#6b7280;">Nessun intervento registrato</span>';

            return `
                <tr>
                    <td>#${sign.id}</td>
                    <td style="text-transform:capitalize;">${getSignIcon(sign.type)} ${sign.type}</td>
                    <td style="text-transform:capitalize;">${sign.status}</td>
                    <td>${parseFloat(sign.latitude).toFixed(6)}, ${parseFloat(sign.longitude).toFixed(6)}</td>
                    <td>${sign.installation_date ? new Date(sign.installation_date).toLocaleDateString('it-IT') : '-'}${age !== null ? ` (${age.toFixed(1)} anni${expired ? ' ⚠️ scaduto' : ''})` : ''}</td>
                    <td>${sign.ordinanza_rif ? `📄 ${sign.ordinanza_rif}` : '<span style="color:#dc2626; font-weight:700;">⚠️ Non Regolarizzato</span>'}</td>
                    <td>${sign.notes || '-'}</td>
                    <td>${interventionsHtml}</td>
                </tr>
            `;
        }).join('');

        const html = `
            <!DOCTYPE html>
            <html lang="it">
            <head>
                <meta charset="UTF-8">
                <title>Verbale di Consistenza della Segnaletica Stradale</title>
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; padding: 2rem; }
                    h1 { font-size: 1.4rem; margin: 0 0 0.25rem; }
                    .subtitle { color: #6b7280; font-size: 0.875rem; margin-bottom: 1.5rem; }
                    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
                    th, td { border: 1px solid #e5e7eb; padding: 0.5rem; text-align: left; vertical-align: top; }
                    th { background: #f3f4f6; }
                    .signature { margin-top: 3rem; display: flex; justify-content: space-between; }
                    .signature div { width: 45%; border-top: 1px solid #1f2937; padding-top: 0.25rem; font-size: 0.8rem; color: #6b7280; }
                    .footer-note { margin-top: 2rem; font-size: 0.75rem; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 0.75rem; }
                    @media print {
                        body { padding: 1cm; }
                    }
                </style>
            </head>
            <body>
                <h1>📋 Verbale di Consistenza della Segnaletica Stradale</h1>
                <div class="subtitle">
                    Documento generato il ${new Date().toLocaleString('it-IT')} — ${selectedSigns.length} segnal${selectedSigns.length === 1 ? 'e' : 'i'} censit${selectedSigns.length === 1 ? 'o' : 'i'}
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Tipo</th>
                            <th>Stato</th>
                            <th>Coordinate GPS</th>
                            <th>Installazione</th>
                            <th>Ordinanza</th>
                            <th>Note</th>
                            <th>Interventi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>

                <div class="footer-note">
                    Il presente verbale attesta la consistenza, lo stato di conservazione e la regolarità amministrativa (riferimento ordinanza) della segnaletica stradale sopra elencata alla data di generazione. Documento valido per la documentazione di contenziosi legali o sinistri derivanti da presunta omessa manutenzione.
                </div>

                <div class="signature">
                    <div>Firma del Responsabile del Procedimento</div>
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
        setTimeout(() => {
            reportWindow.focus();
            reportWindow.print();
        }, 300);
    };

    const filteredSigns = signs.filter(sign => {
        if (!sign) return false;
        if (archiveTypeFilter !== 'tutti' && sign.type !== archiveTypeFilter) return false;
        if (archiveStatusFilter !== 'tutti' && sign.status !== archiveStatusFilter) return false;
        if (archiveExpiredOnly && !isSignExpired(sign.installation_date)) return false;
        if (archiveSearch.trim()) {
            const term = archiveSearch.trim().toLowerCase();
            const haystack = `${sign.notes || ''} ${sign.type || ''}`.toLowerCase();
            if (!haystack.includes(term)) return false;
        }
        return true;
    });

    const getStatusBadge = (status) => {
        const badges = {
            ottimo: 'badge-success',
            buono: 'badge-success',
            discreto: 'badge-warning',
            danneggiato: 'badge-danger'
        };
        return badges[status] || 'badge-info';
    };

    // Helper: voce di navigazione nella sidebar
    const NavItem = ({ id, icon, label }) => {
        const isActive = activeTab === id;
        return (
            <button
                onClick={() => setActiveTab(id)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    width: '100%', padding: '0.45rem 0.9rem 0.45rem 1rem',
                    background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent',
                    border: 'none',
                    borderLeft: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                    color: isActive ? '#60a5fa' : '#b0bcd0',
                    cursor: 'pointer',
                    fontSize: '0.83rem',
                    fontWeight: isActive ? 600 : 400,
                    textAlign: 'left',
                    transition: 'all 0.12s ease',
                    borderRadius: '0 6px 6px 0'
                }}
            >
                <span style={{ fontSize: '0.85rem', opacity: isActive ? 1 : 0.85, flexShrink: 0 }}>{icon}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
            </button>
        );
    };

    // Helper: intestazione di gruppo nella sidebar
    const NavSection = ({ label }) => (
        <div style={{
            padding: '0.85rem 1rem 0.2rem',
            fontSize: '0.6rem', fontWeight: 700,
            color: '#4e6a8a', letterSpacing: '0.1em',
            textTransform: 'uppercase'
        }}>
            {label}
        </div>
    );

    const sbBtn = {
        background: 'transparent', border: '1px solid #1e293b',
        borderRadius: 6, color: '#8899b0', cursor: 'pointer',
        padding: '0.3rem 0.5rem', fontSize: '0.8rem', transition: 'all 0.15s'
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', background: '#0a0f1e' }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#0a0f1e' }}>
            {showAddModal && (
                <AddSignModal
                    onSaved={() => { setShowAddModal(false); loadData(); if (onDataChange) onDataChange(); }}
                    onClose={() => setShowAddModal(false)}
                />
            )}

            {/* ══════════════ SIDEBAR ══════════════ */}
            <aside style={{
                width: 230, flexShrink: 0,
                background: '#060b14',
                borderRight: '1px solid #111d2e',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Brand */}
                <div style={{ padding: '1.1rem 1rem 0.9rem', borderBottom: '1px solid #111d2e', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                        <div style={{
                            width: 34, height: 34, flexShrink: 0,
                            background: 'linear-gradient(135deg, #2563eb 0%, #6366f1 100%)',
                            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
                            boxShadow: '0 2px 10px rgba(37,99,235,0.35)'
                        }}>📍</div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.2 }}>Catasto</div>
                            <div style={{ color: '#2d3f58', fontSize: '0.65rem', lineHeight: 1.3 }}>Segnaletica Stradale</div>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav style={{ flex: 1, overflowY: 'auto', padding: '0.4rem 0 0.5rem' }}>
                    <NavSection label="Panoramica" />
                    <NavItem id="dashboard" icon="📊" label="Dashboard" />

                    <NavSection label="Catasto" />
                    <NavItem id="map" icon="🗺️" label="Mappa GIS" />
                    <NavItem id="archive" icon="📋" label="Archivio Segnali" />
                    <NavItem id="virtual-census" icon="🛰️" label="Censimento Virtuale" />

                    <NavSection label="Manutenzione" />
                    <NavItem id="interventions" icon="🔧" label="Interventi" />
                    <NavItem id="pavement" icon="🕳️" label="Dissesti" />
                    <NavItem id="road-markings" icon="🛣️" label="Segnaletica Orizz." />
                    <NavItem id="traffic-lights" icon="🚥" label="Impianti Semaforici" />

                    {(user?.role === 'admin' || user?.role === 'tecnico') && (<>
                        <NavSection label="Pianificazione" />
                        <NavItem id="traffic-projects" icon="🚦" label="Progetti e Varianti" />
                    </>)}

                    {(user?.role === 'admin' || user?.role === 'tecnico') && (<>
                        <NavSection label="Amministrazione" />
                        <NavItem id="contracts" icon="📑" label="Appalti e Bilancio" />
                        <NavItem id="tax-reports" icon="🏛️" label="Passi Carrai e Segnalazioni" />
                        {user?.role === 'admin' && <NavItem id="users" icon="👥" label="Gestione Utenti" />}
                        {user?.role === 'admin' && <NavItem id="audit" icon="📜" label="Registro Attività" />}
                    </>)}

                    {(user?.role === 'admin' || user?.role === 'tecnico') && (<>
                        <NavSection label="Campo" />
                        <NavItem id="ar-review" icon="📡" label="Revisione AR/AI" />
                        <NavItem id="mobile-import" icon="📥" label="Importa da Mobile" />
                    </>)}

                    <NavSection label="Sistema" />
                    <NavItem id="ai-setup" icon="🤖" label="Configurazione AI" />
                    <NavItem id="manual" icon="📚" label="Manuale" />
                </nav>

                {/* Bottom panel */}
                <div style={{ borderTop: '1px solid #111d2e', padding: '0.75rem', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {/* + Nuovo Segnale */}
                    <button
                        onClick={() => setShowAddModal(true)}
                        style={{
                            width: '100%', background: '#1d4ed8', color: 'white',
                            border: 'none', borderRadius: 7, padding: '0.5rem 0.75rem',
                            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(29,78,216,0.4)'
                        }}
                    >
                        + Nuovo Segnale
                    </button>

                    {/* Azioni contestuali */}
                    {(activeTab === 'map' || activeTab === 'archive') && (
                        <button
                            onClick={handleExportGeoJSON}
                            disabled={signs.length === 0}
                            style={{ ...sbBtn, width: '100%', textAlign: 'left' }}
                            title="Esporta GeoJSON"
                        >
                            ⬇️ Esporta GeoJSON
                        </button>
                    )}
                    {activeTab === 'archive' && selectedSignIds.length > 0 && (
                        <button
                            onClick={handleGenerateRegister}
                            style={{ ...sbBtn, width: '100%', textAlign: 'left' }}
                            title="Genera verbale stampabile"
                        >
                            🖨️ Registro ({selectedSignIds.length})
                        </button>
                    )}

                    {/* Stats */}
                    {stats && (
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <div style={{ flex: 1, background: '#0a0f1e', borderRadius: 6, padding: '0.35rem', textAlign: 'center' }}>
                                <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1 }}>{stats.local?.totalSigns || 0}</div>
                                <div style={{ color: '#2d3f58', fontSize: '0.6rem', marginTop: '0.1rem' }}>Segnali</div>
                            </div>
                        </div>
                    )}

                    {/* Dark mode */}
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {onToggleDarkMode && (
                            <button
                                onClick={onToggleDarkMode}
                                title={darkMode ? 'Modalità chiara' : 'Modalità scura'}
                                style={{ ...sbBtn }}
                            >
                                {darkMode ? '☀️' : '🌙'}
                            </button>
                        )}
                    </div>

                    {/* User + Logout */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.1rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: '#cbd5e1', fontWeight: 600, fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {user?.username || 'Utente'}
                            </div>
                            <div style={{ color: '#2d3f58', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {user?.role}
                            </div>
                        </div>
                        {onChangePassword && (
                            <button
                                onClick={onChangePassword}
                                title="Cambia Password"
                                style={{ ...sbBtn, color: '#475569', padding: '0.3rem 0.4rem' }}
                            >
                                🔑
                            </button>
                        )}
                        <button
                            onClick={onLogout}
                            title="Esci"
                            style={{ ...sbBtn, color: '#475569', padding: '0.3rem 0.4rem' }}
                        >
                            🚪
                        </button>
                    </div>
                </div>
            </aside>

            {/* ══════════════ AREA PRINCIPALE ══════════════ */}
            <div style={{
                flex: 1, minWidth: 0,
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
                background: '#0f172a'
            }}>
                <Suspense fallback={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#475569', fontSize: '0.9rem' }}>
                        Caricamento...
                    </div>
                }>
                <div style={{
                    flex: 1, minHeight: 0,
                    display: 'flex', flexDirection: 'column',
                    overflowY: activeTab === 'map' ? 'hidden' : 'auto',
                    padding: activeTab === 'map' || activeTab === 'details' ? 0 : '1rem'
                }}>

                {/* Details */}
                {activeTab === 'details' && selectedSign && (
                    <DesktopSignDetails
                        sign={selectedSign}
                        user={user}
                        onBack={() => setActiveTab('map')}
                    />
                )}

                {/* Mappa */}
                {activeTab === 'map' && (
                    <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
                        <MapView
                            signs={signs}
                            user={user}
                            onSignClick={(sign) => console.log('Selected sign:', sign)}
                            onOpenDetails={handleOpenDetails}
                            onPlanIntervention={handlePlanIntervention}
                        />
                        {signs.length === 0 && showEmptyHint && (
                            <div style={{
                                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                background: 'rgba(15,23,42,0.92)', border: '1px solid #1e293b',
                                padding: '1.5rem 2rem', borderRadius: 12,
                                boxShadow: '0 4px 24px rgba(0,0,0,0.5)', textAlign: 'center', zIndex: 1000, pointerEvents: 'none'
                            }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📍</div>
                                <div style={{ fontWeight: 600, color: '#e2e8f0' }}>Nessun segnale presente</div>
                                <div style={{ fontSize: '0.875rem', color: '#475569', marginTop: '0.25rem' }}>
                                    Aggiungi il primo segnale con "+ Nuovo Segnale"
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Archivio */}
                {activeTab === 'archive' && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">
                                Archivio Segnali ({filteredSigns.length}{filteredSigns.length !== signs.length ? ` / ${signs.length} tot.` : ''})
                            </h3>
                        </div>
                        <div className="toolbar">
                            <select className="form-select" value={archiveTypeFilter} onChange={e => { setArchiveTypeFilter(e.target.value); setArchivePage(1); }}>
                                <option value="tutti">Tutte le tipologie</option>
                                {SIGN_TYPES.map(t => <option key={t} value={t}>{getSignIcon(t)} {t}</option>)}
                            </select>
                            <select className="form-select" value={archiveStatusFilter} onChange={e => { setArchiveStatusFilter(e.target.value); setArchivePage(1); }}>
                                <option value="tutti">Tutti gli stati</option>
                                {SIGN_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <input
                                type="text" className="form-input"
                                value={archiveSearch} onChange={e => { setArchiveSearch(e.target.value); setArchivePage(1); }}
                                placeholder="🔎 Cerca per via, toponimo o note..."
                                style={{ flex: '1 1 240px', minWidth: '200px' }}
                            />
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', color: '#ef4444', fontWeight: 600, cursor: 'pointer' }}>
                                <input type="checkbox" checked={archiveExpiredOnly} onChange={e => { setArchiveExpiredOnly(e.target.checked); setArchivePage(1); }} />
                                ⚠️ Solo scaduti (&gt;{MAX_SIGN_LIFESPAN_YEARS}aa)
                            </label>
                        </div>
                        {filteredSigns.length > 0 ? (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--gray-200)', textAlign: 'left' }}>
                                            <th style={{ padding: '0.75rem' }}>
                                                <input type="checkbox"
                                                    checked={filteredSigns.length > 0 && filteredSigns.every(s => selectedSignIds.includes(s.id))}
                                                    onChange={() => toggleSelectAll(filteredSigns)} title="Seleziona/Deseleziona tutti" />
                                            </th>
                                            <th style={{ padding: '0.75rem' }}>Tipo</th>
                                            <th style={{ padding: '0.75rem' }}>Stato</th>
                                            <th style={{ padding: '0.75rem' }}>Utente</th>
                                            <th style={{ padding: '0.75rem' }}>Posizione</th>
                                            <th style={{ padding: '0.75rem' }}>Data</th>
                                            <th style={{ padding: '0.75rem' }}>Età</th>
                                            <th style={{ padding: '0.75rem' }}>Note</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Azioni</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSigns.slice((archivePage - 1) * ARCHIVE_PAGE_SIZE, archivePage * ARCHIVE_PAGE_SIZE).map((sign) => {
                                            if (!sign || !sign.id) return null;
                                            try {
                                                return (
                                                    <tr key={sign.id} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                                                        <td style={{ padding: '0.75rem' }}>
                                                            <input type="checkbox" checked={selectedSignIds.includes(sign.id)} onChange={() => toggleSelectSign(sign.id)} />
                                                        </td>
                                                        <td style={{ padding: '0.75rem' }}>{getSignIcon(sign.type)} {sign.type || 'Sconosciuto'}</td>
                                                        <td style={{ padding: '0.75rem' }}>
                                                            <span className={`badge ${getStatusBadge(sign.status)}`}>{sign.status || 'N/D'}</span>
                                                        </td>
                                                        <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>👤 {sign.creator_username || 'N/D'}</td>
                                                        <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                                                            {parseFloat(sign.latitude)?.toFixed(4) || 0}, {parseFloat(sign.longitude)?.toFixed(4) || 0}
                                                        </td>
                                                        <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                                                            {sign.created_at ? new Date(sign.created_at).toLocaleDateString('it-IT') : '-'}
                                                        </td>
                                                        <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                                                            {(() => {
                                                                const age = getSignAgeYears(sign.installation_date);
                                                                if (age === null) return '-';
                                                                return isSignExpired(sign.installation_date) ? (
                                                                    <span className="badge badge-danger" title="Pellicola rifrangente oltre la durata legale">⚠️ Scaduto ({age.toFixed(1)}aa)</span>
                                                                ) : (
                                                                    <span>{age.toFixed(1)} anni</span>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td style={{ padding: '0.75rem', fontSize: '0.875rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sign.notes || '-'}</td>
                                                        <td style={{ padding: '0.75rem', textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                            <button className="btn btn-sm btn-primary" onClick={() => handleOpenDetails(sign)} title="Vedi Dettagli">👁️</button>
                                                            <button className="btn btn-sm" onClick={() => handleDeleteSign(sign.id)} style={{ background: 'var(--danger)', color: 'white' }} title="Elimina">🗑️</button>
                                                        </td>
                                                    </tr>
                                                );
                                            } catch (err) {
                                                console.error('Errore rendering riga:', err, sign);
                                                return null;
                                            }
                                        })}
                                    </tbody>
                                </table>
                                {/* Paginazione */}
                                {filteredSigns.length > ARCHIVE_PAGE_SIZE && (() => {
                                    const totalPages = Math.ceil(filteredSigns.length / ARCHIVE_PAGE_SIZE);
                                    return (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem', borderTop: '1px solid var(--gray-200)' }}>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => setArchivePage(1)}
                                                disabled={archivePage === 1}
                                            >««</button>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => setArchivePage(p => Math.max(1, p - 1))}
                                                disabled={archivePage === 1}
                                            >‹ Prec</button>
                                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                                .filter(p => p === 1 || p === totalPages || Math.abs(p - archivePage) <= 2)
                                                .reduce((acc, p, idx, arr) => {
                                                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                                                    acc.push(p);
                                                    return acc;
                                                }, [])
                                                .map((item, idx) => item === '...'
                                                    ? <span key={`ellipsis-${idx}`} style={{ padding: '0 0.25rem', color: 'var(--gray-500)' }}>…</span>
                                                    : <button
                                                        key={item}
                                                        className="btn btn-sm"
                                                        onClick={() => setArchivePage(item)}
                                                        style={{
                                                            background: archivePage === item ? 'var(--primary)' : 'var(--gray-100)',
                                                            color: archivePage === item ? 'white' : 'var(--gray-700)',
                                                            fontWeight: archivePage === item ? 700 : 400,
                                                            minWidth: '2rem',
                                                        }}
                                                    >{item}</button>
                                                )
                                            }
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => setArchivePage(p => Math.min(totalPages, p + 1))}
                                                disabled={archivePage === totalPages}
                                            >Succ ›</button>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => setArchivePage(totalPages)}
                                                disabled={archivePage === totalPages}
                                            >»»</button>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginLeft: '0.5rem' }}>
                                                {(archivePage - 1) * ARCHIVE_PAGE_SIZE + 1}–{Math.min(archivePage * ARCHIVE_PAGE_SIZE, filteredSigns.length)} di {filteredSigns.length}
                                            </span>
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-500)' }}>
                                {signs.length === 0 ? 'Nessun segnale presente' : 'Nessun segnale corrisponde ai filtri selezionati'}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'interventions' && (
                    <InterventionsTab
                        interventions={interventions} signs={signs} user={user}
                        onDataChange={() => { loadData(); if (onDataChange) onDataChange(); }}
                        prefillSignId={prefillInterventionSignId}
                        onPrefillConsumed={() => setPrefillInterventionSignId(null)}
                    />
                )}

                {activeTab === 'dashboard' && <Dashboard signs={signs} interventions={interventions} />}
                {activeTab === 'virtual-census' && <VirtualCensusTab />}
                {activeTab === 'pavement' && <PavementManager user={user} />}
                {activeTab === 'road-markings' && <RoadMarkingsTab user={user} />}
                {activeTab === 'traffic-lights' && <TrafficLightsTab user={user} />}

                {activeTab === 'contracts' && (user?.role === 'admin' || user?.role === 'tecnico') && <ContractsTab user={user} />}
                {activeTab === 'traffic-projects' && (user?.role === 'admin' || user?.role === 'tecnico') && <TrafficProjectSim user={user} />}
                {activeTab === 'users' && user?.role === 'admin' && <UserManagement user={user} />}
                {activeTab === 'tax-reports' && (user?.role === 'admin' || user?.role === 'tecnico') && <TaxReportsTab user={user} />}
                {activeTab === 'audit' && user?.role === 'admin' && <AuditLog user={user} />}

                {activeTab === 'manual' && (
                    <div className="card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                        <UserManual />
                    </div>
                )}

                {activeTab === 'ar-review' && (user?.role === 'admin' || user?.role === 'tecnico') && (
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <ARValidationPanel user={user} />
                    </div>
                )}

                {activeTab === 'mobile-import' && (user?.role === 'admin' || user?.role === 'tecnico') && (
                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                        <MobileImportPanel user={user} />
                    </div>
                )}

                {activeTab === 'ai-setup' && user?.role === 'admin' && (
                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                        <AISetupPanel />
                    </div>
                )}

                </div>
                </Suspense>
            </div>
        </div>
    );
}

export default DesktopView;
