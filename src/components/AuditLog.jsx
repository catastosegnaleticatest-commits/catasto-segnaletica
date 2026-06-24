import { useState, useEffect } from 'react';
import apiService from '../services/api';

const OPERATION_LABELS = {
    insert: { label: 'Creazione', icon: '➕', badge: 'badge-success' },
    update: { label: 'Modifica', icon: '✏️', badge: 'badge-warning' },
    delete: { label: 'Eliminazione', icon: '🗑️', badge: 'badge-danger' }
};

const TABLE_LABELS = {
    signs: '🚧 Segnali',
    interventions: '🔧 Interventi',
    users: '👥 Utenti'
};

function formatDetails(details) {
    if (!details) return '-';
    try {
        const parsed = typeof details === 'string' ? JSON.parse(details) : details;
        return Object.entries(parsed)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
    } catch {
        return String(details);
    }
}

function AuditLog({ user }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [operationFilter, setOperationFilter] = useState('');
    const [tableFilter, setTableFilter] = useState('');

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiService.getAuditLog();
            setLogs(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (user?.role !== 'admin') {
        return (
            <div className="card">
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
                    <h3>Accesso Negato</h3>
                    <p>Solo gli amministratori possono accedere a questa sezione.</p>
                </div>
            </div>
        );
    }

    const filteredLogs = logs.filter(l => {
        if (operationFilter && l.operation !== operationFilter) return false;
        if (tableFilter && l.table_name !== tableFilter) return false;
        return true;
    });

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                        📜 Registro Attività
                    </h2>
                    <p style={{ color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                        Cronologia delle operazioni su segnali e interventi
                    </p>
                </div>
                <button className="btn btn-secondary" onClick={loadLogs}>
                    🔄 Aggiorna
                </button>
            </div>

            {/* Filtri */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ margin: 0, minWidth: '180px' }}>
                        <label className="form-label">Operazione</label>
                        <select
                            className="form-input"
                            value={operationFilter}
                            onChange={(e) => setOperationFilter(e.target.value)}
                        >
                            <option value="">Tutte</option>
                            <option value="insert">➕ Creazione</option>
                            <option value="update">✏️ Modifica</option>
                            <option value="delete">🗑️ Eliminazione</option>
                        </select>
                    </div>
                    <div className="form-group" style={{ margin: 0, minWidth: '180px' }}>
                        <label className="form-label">Tabella</label>
                        <select
                            className="form-input"
                            value={tableFilter}
                            onChange={(e) => setTableFilter(e.target.value)}
                        >
                            <option value="">Tutte</option>
                            <option value="signs">🚧 Segnali</option>
                            <option value="interventions">🔧 Interventi</option>
                            <option value="users">👥 Utenti</option>
                        </select>
                    </div>
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
                ) : filteredLogs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>
                        Nessuna attività registrata
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--gray-200)' }}>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Data/Ora</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Utente</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Operazione</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Tabella</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>ID Record</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>IP Client</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>User Agent</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Dettagli</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLogs.map((log) => {
                                    const op = OPERATION_LABELS[log.operation] || { label: log.operation, icon: '•', badge: 'badge-secondary' };
                                    return (
                                        <tr key={log.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                                            <td style={{ padding: '0.75rem', color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>
                                                {new Date(log.created_at).toLocaleString('it-IT')}
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <strong>{log.username || '—'}</strong>
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <span className={`badge ${op.badge}`}>
                                                    {op.icon} {op.label}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                {TABLE_LABELS[log.table_name] || log.table_name}
                                            </td>
                                            <td style={{ padding: '0.75rem', fontWeight: '600' }}>
                                                #{log.record_id ?? '-'}
                                            </td>
                                            <td style={{ padding: '0.75rem', color: 'var(--gray-600)', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                                                {log.client_ip || '—'}
                                            </td>
                                            <td style={{ padding: '0.75rem', color: 'var(--gray-600)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.user_agent || ''}>
                                                {log.user_agent || '—'}
                                            </td>
                                            <td style={{ padding: '0.75rem', color: 'var(--gray-600)' }}>
                                                {formatDetails(log.details)}
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

export default AuditLog;
