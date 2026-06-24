import { useState, useEffect } from 'react';
import apiService from '../services/api';

const MOTIVO_LABELS = {
    non_censito: { label: 'Non censito', badge: 'badge-danger', icon: '🚫' },
    numero_non_corrispondente: { label: 'Numero non corrispondente', badge: 'badge-warning', icon: '⚠️' }
};

const STATUS_LABELS = {
    aperta: { label: 'Aperta', color: '#ef4444' },
    in_verifica: { label: 'In verifica', color: '#f59e0b' },
    chiusa: { label: 'Chiusa', color: '#10b981' }
};

function TaxReportsTab({ user }) {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [updating, setUpdating] = useState(null);

    useEffect(() => {
        loadReports();
    }, []);

    const loadReports = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiService.getTaxReports();
            setReports(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (id, newStatus) => {
        setUpdating(id);
        try {
            await apiService.updateTaxReportStatus(id, newStatus);
            await loadReports();
        } catch (err) {
            alert('Errore aggiornamento: ' + err.message);
        } finally {
            setUpdating(null);
        }
    };

    const filteredReports = reports.filter(r => !statusFilter || r.status === statusFilter);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                        🏛️ Segnalazioni Ufficio Tributi
                    </h2>
                    <p style={{ color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                        Passi carrabili non censiti o con numero di autorizzazione non corrispondente, rilevati dalle pattuglie
                    </p>
                </div>
                <button className="btn btn-secondary" onClick={loadReports}>
                    🔄 Aggiorna
                </button>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="form-group" style={{ margin: 0, maxWidth: '220px' }}>
                    <label className="form-label">Stato</label>
                    <select
                        className="form-input"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">Tutte</option>
                        <option value="aperta">Aperta</option>
                        <option value="in_verifica">In verifica</option>
                        <option value="chiusa">Chiusa</option>
                    </select>
                </div>
            </div>

            <div className="card">
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>
                        Caricamento...
                    </div>
                ) : error ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--danger)' }}>
                        Errore: {error}
                    </div>
                ) : filteredReports.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>
                        Nessuna segnalazione presente
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--gray-200)' }}>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Data</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Segnale</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Motivo</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Numero rilevato</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Numero/Proprietario catasto</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Posizione</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Note</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Stato</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredReports.map((r) => {
                                    const motivo = MOTIVO_LABELS[r.motivo] || { label: r.motivo, badge: 'badge-secondary', icon: '•' };
                                    return (
                                        <tr key={r.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                                            <td style={{ padding: '0.75rem', color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>
                                                {new Date(r.created_at).toLocaleString('it-IT')}
                                            </td>
                                            <td style={{ padding: '0.75rem', fontWeight: '600' }}>
                                                {r.sign_id ? `#${r.sign_id}` : '—'}
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <span className={`badge ${motivo.badge}`}>
                                                    {motivo.icon} {motivo.label}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>
                                                {r.numero_rilevato || '-'}
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                {r.sign_numero_autorizzazione || r.sign_proprietario
                                                    ? <>{r.sign_numero_autorizzazione || '-'} / {r.sign_proprietario || '-'}</>
                                                    : '-'}
                                            </td>
                                            <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                                <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    {r.latitude.toFixed(6)}, {r.longitude.toFixed(6)}
                                                </a>
                                            </td>
                                            <td style={{ padding: '0.75rem', color: 'var(--gray-600)' }}>
                                                {r.note || '-'}
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <select
                                                    value={r.status}
                                                    onChange={(e) => handleStatusChange(r.id, e.target.value)}
                                                    disabled={updating === r.id}
                                                    style={{
                                                        fontSize: '0.8rem', padding: '0.3rem', borderRadius: '4px',
                                                        border: '1px solid var(--gray-300)', cursor: 'pointer',
                                                        color: STATUS_LABELS[r.status]?.color || '#6b7280', fontWeight: '600'
                                                    }}
                                                >
                                                    <option value="aperta">Aperta</option>
                                                    <option value="in_verifica">In verifica</option>
                                                    <option value="chiusa">Chiusa</option>
                                                </select>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default TaxReportsTab;
