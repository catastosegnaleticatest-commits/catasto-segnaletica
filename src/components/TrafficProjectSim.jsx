import { useState, useEffect } from 'react';
import apiService from '../services/api';
import { useContractsData } from '../hooks/useContractsData';

function TrafficProjectSim({ user }) {
    const { commitments, loading: loadingContracts } = useContractsData();

    const [aiAvailable, setAiAvailable] = useState(null);
    const [projectName, setProjectName] = useState('');
    const [targetStreets, setTargetStreets] = useState('');
    const [modificationRequest, setModificationRequest] = useState('');
    const [project, setProject] = useState(null);
    const [items, setItems] = useState([]);
    const [simulating, setSimulating] = useState(false);
    const [executing, setExecuting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [auditing, setAuditing] = useState(false);
    const [complianceResult, setComplianceResult] = useState(null);
    const [wazePublishing, setWazePublishing] = useState(false);
    const [wazeResult, setWazeResult] = useState(null);

    useEffect(() => {
        let cancelled = false;
        let timer = null;

        const check = () => {
            apiService.getAiStatus()
                .then(status => {
                    if (cancelled) return;
                    setAiAvailable(status.available);
                    // Se non ancora disponibile, riprova ogni 8s (modello in caricamento)
                    if (!status.available) timer = setTimeout(check, 8000);
                })
                .catch(() => {
                    if (!cancelled) timer = setTimeout(check, 8000);
                });
        };

        check();
        return () => { cancelled = true; clearTimeout(timer); };
    }, []);

    const handleSimulate = async (e) => {
        e.preventDefault();
        if (!targetStreets.trim() || !modificationRequest.trim()) {
            alert('Indicare via/zona target e descrizione della modifica');
            return;
        }
        setSimulating(true);
        setError(null);
        setSuccess(null);
        try {
            const payload = project
                ? { project_id: project.id, modification_request: modificationRequest }
                : {
                    project_name: projectName.trim() || `Variante ${targetStreets}`,
                    target_streets: targetStreets,
                    modification_request: modificationRequest,
                };
            const result = await apiService.simulateViability(payload);
            setProject(result.project);
            setItems(result.items);
        } catch (err) {
            setError(err.message);
        } finally {
            setSimulating(false);
        }
    };

    const handleWazePublish = async () => {
        if (!project) return;
        setWazePublishing(true);
        setWazeResult(null);
        try {
            const result = await apiService.publishWazeDisruption(project.id);
            setWazeResult(result);
        } catch (err) {
            setWazeResult({ success: false, message: err.message });
        } finally {
            setWazePublishing(false);
        }
    };

    const handleAudit = async () => {
        if (!project) return;
        setAuditing(true);
        setComplianceResult(null);
        try {
            const result = await apiService.verifyCompliance(project.id);
            setComplianceResult(result);
        } catch (err) {
            setComplianceResult({ error: err.message });
        } finally {
            setAuditing(false);
        }
    };

    const handleExecute = async () => {
        if (!project) return;
        if (!window.confirm('Confermi l\'invio al fornitore? Verranno creati gli interventi di manutenzione corrispondenti.')) return;
        setExecuting(true);
        setError(null);
        setSuccess(null);
        try {
            const result = await apiService.executeTrafficProject(project.id);
            setProject(result.project);
            setSuccess(`Creati ${result.created} interventi di manutenzione collegati al progetto.`);
        } catch (err) {
            setError(err.message);
        } finally {
            setExecuting(false);
        }
    };

    const removals = items.filter(i => i.action === 'rimuovi');
    const installations = items.filter(i => i.action === 'aggiungi' || i.action === 'sostituisci');

    const totalCost = items.reduce((sum, item) => sum + (item.unit_price || 0), 0);

    const totalResidual = commitments.reduce((sum, c) => sum + (c.residual_amount || 0), 0);
    const overBudget = !loadingContracts && commitments.length > 0 && totalCost > totalResidual;

    return (
        <div>
            <h3 style={{ marginBottom: '1rem' }}>🚦 Progetti e Varianti di Viabilità</h3>

            {aiAvailable === false && (
                <div className="card" style={{ marginBottom: '1rem', border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.08)' }}>
                    <p style={{ fontSize: '0.85rem', color: '#fbbf24', margin: 0 }}>
                        ⚠️ Motore AI locale non disponibile: nessun modello (.gguf) trovato nella cartella <code>/models</code>.
                        La simulazione automatica non può essere eseguita finché non viene installato un modello compatibile.
                    </p>
                </div>
            )}

            {error && (
                <div className="card" style={{ marginBottom: '1rem', border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)' }}>
                    <p style={{ fontSize: '0.85rem', color: '#f87171', margin: 0 }}>❌ {error}</p>
                </div>
            )}

            {success && (
                <div className="card" style={{ marginBottom: '1rem', border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.08)' }}>
                    <p style={{ fontSize: '0.85rem', color: '#4ade80', margin: 0 }}>✅ {success}</p>
                </div>
            )}

            <div className="card" style={{ marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '0.75rem' }}>Workspace Simulazione</h4>
                <form onSubmit={handleSimulate} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {!project && (
                        <>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.25rem' }}>Nome Progetto</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Es. Variante Via del Fornasino"
                                    value={projectName}
                                    onChange={e => setProjectName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.25rem' }}>Via / Zona Target *</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Es. Via del Fornasino"
                                    value={targetStreets}
                                    onChange={e => setTargetStreets(e.target.value)}
                                    required
                                />
                            </div>
                        </>
                    )}
                    {project && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--gray-700)' }}>
                            Progetto attivo: <strong>{project.project_name}</strong> — {project.target_streets} (stato: {project.status})
                        </p>
                    )}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.25rem' }}>Modifica Stradale Richiesta *</label>
                        <textarea
                            className="input"
                            rows={3}
                            placeholder="Es. Invertire senso unico Via del Fornasino"
                            value={modificationRequest}
                            onChange={e => setModificationRequest(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={simulating}>
                        {simulating ? '⏳ Simulazione in corso...' : '🤖 Avvia Simulazione AI Interna'}
                    </button>
                </form>
            </div>

            {items.length > 0 && (
                <>
                    <div className="card" style={{ marginBottom: '1rem' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '0.75rem' }}>Computo Metrico — Rimovibili</h4>
                        {removals.length === 0 ? (
                            <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>Nessuna rimozione prevista.</p>
                        ) : (
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Codice</th>
                                        <th>Descrizione Tariffario</th>
                                        <th>Motivo</th>
                                        <th>Prezzo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {removals.map(item => (
                                        <tr key={item.id}>
                                            <td>{item.sign_code}</td>
                                            <td>{item.price_description || '—'}</td>
                                            <td>{item.reason || '—'}</td>
                                            <td>{item.unit_price != null ? `€ ${item.unit_price.toFixed(2)}` : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="card" style={{ marginBottom: '1rem' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '0.75rem' }}>Computo Metrico — Nuove Installazioni</h4>
                        {installations.length === 0 ? (
                            <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>Nessuna nuova installazione prevista.</p>
                        ) : (
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Azione</th>
                                        <th>Codice</th>
                                        <th>Descrizione Tariffario</th>
                                        <th>Motivo</th>
                                        <th>Prezzo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {installations.map(item => (
                                        <tr key={item.id}>
                                            <td>{item.action === 'sostituisci' ? 'Sostituisci' : 'Aggiungi'}</td>
                                            <td>{item.sign_code}</td>
                                            <td>{item.price_description || '—'}</td>
                                            <td>{item.reason || '—'}</td>
                                            <td>{item.unit_price != null ? `€ ${item.unit_price.toFixed(2)}` : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="card" style={{ marginBottom: '1rem', border: overBudget ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(14,165,233,0.3)', background: overBudget ? 'rgba(239,68,68,0.08)' : 'rgba(14,165,233,0.06)' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '0.5rem' }}>Aggregatore Finanziario</h4>
                        <p style={{ fontSize: '1rem', fontWeight: '700', margin: '0.25rem 0' }}>
                            Costo Totale Progetto: € {totalCost.toFixed(2)}
                        </p>
                        {!loadingContracts && (
                            <p style={{ fontSize: '0.85rem', margin: '0.25rem 0', color: 'var(--gray-700)' }}>
                                Residuo disponibile sugli impegni di spesa attivi: € {totalResidual.toFixed(2)}
                            </p>
                        )}
                        {overBudget && (
                            <p style={{ fontSize: '0.85rem', fontWeight: '700', color: '#b91c1c', margin: '0.5rem 0 0' }}>
                                ⚠️ Il costo del progetto supera il residuo disponibile sugli impegni di spesa attivi!
                            </p>
                        )}
                        <button
                            className="btn btn-primary"
                            style={{ marginTop: '0.75rem' }}
                            disabled={executing || project?.status === 'approvato'}
                            onClick={handleExecute}
                        >
                            {executing ? '⏳ Invio in corso...' : project?.status === 'approvato' ? '✅ Già Inviato' : '📤 Invia al Fornitore (Esegui)'}
                        </button>
                    </div>

                    {/* Modulo 14 — Audit di Conformità Normativa AI */}
                    <div className="card" style={{ marginBottom: '1rem', border: '2px solid #7c3aed', background: '#faf5ff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <div>
                                <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#6d28d9', margin: 0 }}>🛡️ Verifica di Conformità Tecnica e Normativa</h4>
                                <p style={{ fontSize: '0.78rem', color: 'var(--gray-500)', margin: '0.2rem 0 0' }}>
                                    L'AI incrocia il progetto con le normative caricate nella Knowledge Base (D.M. Geometria Carreggiate, CdS…)
                                </p>
                            </div>
                            <button
                                className="btn btn-sm"
                                style={{ background: '#7c3aed', color: 'white', whiteSpace: 'nowrap' }}
                                disabled={auditing || !aiAvailable}
                                onClick={handleAudit}
                            >
                                {auditing ? '⏳ Analisi...' : '🔍 Lancia Audit AI'}
                            </button>
                        </div>
                        {!aiAvailable && <p style={{ fontSize: '0.78rem', color: '#dc2626' }}>⚠️ Modello AI non disponibile. Verifica che il file .gguf sia in /models/.</p>}
                        {complianceResult && !complianceResult.error && (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                    <div style={{
                                        fontSize: '1.5rem', fontWeight: '800',
                                        color: complianceResult.score >= 70 ? '#10b981' : complianceResult.score >= 40 ? '#f59e0b' : '#ef4444'
                                    }}>
                                        {complianceResult.score ?? '—'}%
                                    </div>
                                    <span style={{
                                        fontSize: '0.78rem', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontWeight: '700',
                                        background: complianceResult.compliant ? '#dcfce7' : '#fef2f2',
                                        color: complianceResult.compliant ? '#166534' : '#991b1b'
                                    }}>
                                        {complianceResult.compliant ? '✅ Conforme' : '❌ Non Conforme'}
                                    </span>
                                </div>
                                {complianceResult.summary && <p style={{ fontSize: '0.85rem', color: 'var(--gray-700)', marginBottom: '0.5rem' }}>{complianceResult.summary}</p>}
                                {complianceResult.issues?.length > 0 && (
                                    <div style={{ marginBottom: '0.5rem' }}>
                                        <strong style={{ fontSize: '0.8rem', color: '#dc2626' }}>Problemi rilevati:</strong>
                                        {complianceResult.issues.map((issue, i) => (
                                            <div key={i} style={{ borderLeft: '4px solid #ef4444', background: '#fef2f2', padding: '0.35rem 0.6rem', marginTop: '0.25rem', borderRadius: '0 6px 6px 0', fontSize: '0.8rem', color: '#7f1d1d' }}>
                                                {issue}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {complianceResult.suggestions?.length > 0 && (
                                    <div>
                                        <strong style={{ fontSize: '0.8rem', color: '#059669' }}>Suggerimenti:</strong>
                                        {complianceResult.suggestions.map((s, i) => (
                                            <div key={i} style={{ borderLeft: '4px solid #10b981', background: 'rgba(16,185,129,0.08)', padding: '0.35rem 0.6rem', marginTop: '0.25rem', borderRadius: '0 6px 6px 0', fontSize: '0.8rem', color: '#4ade80' }}>
                                                {s}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {complianceResult?.error && (
                            <p style={{ fontSize: '0.8rem', color: '#dc2626' }}>❌ {complianceResult.error}</p>
                        )}
                    </div>

                    {/* Modulo 6 — Distribuzione Canali Infomobilità (Waze) */}
                    <div className="card" style={{ marginBottom: '1rem', border: '1px solid rgba(37,99,235,0.3)', background: 'rgba(37,99,235,0.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <div>
                                <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#60a5fa', margin: 0 }}>📡 Distribuzione Canali Infomobilità</h4>
                                <p style={{ fontSize: '0.78rem', color: 'var(--gray-500)', margin: '0.2rem 0 0' }}>
                                    Pubblica questa variante di viabilità verso i navigatori satellitari (Waze for Cities – formato CIFS)
                                </p>
                            </div>
                            <button
                                className="btn btn-sm"
                                style={{ background: '#2563eb', color: 'white', whiteSpace: 'nowrap' }}
                                disabled={wazePublishing}
                                onClick={handleWazePublish}
                            >
                                {wazePublishing ? '⏳ Invio...' : '📡 Notifica Navigatori (Waze)'}
                            </button>
                        </div>
                        {wazeResult && (
                            <div style={{
                                marginTop: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.82rem',
                                background: wazeResult.success ? '#dbeafe' : '#fef2f2',
                                color: wazeResult.success ? '#1e40af' : '#991b1b'
                            }}>
                                {wazeResult.success ? '✅' : '⚠️'} {wazeResult.message}
                                {wazeResult.incident_id && (
                                    <div style={{ marginTop: '0.25rem', fontFamily: 'monospace', fontSize: '0.75rem', opacity: 0.7 }}>
                                        ID Incident CIFS: {wazeResult.incident_id}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default TrafficProjectSim;
