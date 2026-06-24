import { useState, useRef } from 'react';
import apiService from '../services/api';

function MobileImportPanel({ user }) {
    const [data, setData] = useState(null);
    const [fileName, setFileName] = useState('');
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);
    const [importAll, setImportAll] = useState(false);
    const fileRef = useRef();

    const handleFileChange = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        setFileName(f.name);
        setResult(null);
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parsed = JSON.parse(ev.target.result);
                if (!parsed.signs) throw new Error('File non valido: manca il campo "signs"');
                setData(parsed);
            } catch (err) {
                alert('Errore lettura file: ' + err.message);
                setData(null);
                setFileName('');
                if (fileRef.current) fileRef.current.value = '';
            }
        };
        reader.readAsText(f);
    };

    const newSigns = data ? data.signs.filter(s => !s.synced) : [];
    const allSigns = data ? data.signs : [];
    const interventions = data ? (data.interventions || []).filter(i => !i.synced) : [];
    const signsToImport = importAll ? allSigns : newSigns;

    const handleImport = async () => {
        if (!data || signsToImport.length === 0) return;
        setImporting(true);
        setResult(null);
        const errors = [];
        let signsOk = 0;
        let interventionsOk = 0;

        try {
            // Import segnali via bulk-import
            const signsPayload = signsToImport.map(s => ({
                type: s.type,
                latitude: s.latitude,
                longitude: s.longitude,
                status: s.status || 'buono',
                installation_date: s.installation_date || null,
                notes: s.notes || null,
                ordinanza_rif: s.ordinanza_rif || null,
                numero_autorizzazione: s.numero_autorizzazione || null,
                proprietario: s.proprietario || null,
                photo: s._photo || null,
            }));

            const res = await apiService.bulkImportSigns(signsPayload);
            signsOk = res.count;
        } catch (e) {
            errors.push('Segnali: ' + e.message);
        }

        // Import interventi uno per uno (non ci sono API bulk per gli interventi)
        for (const iv of interventions) {
            try {
                await apiService.createIntervention({
                    sign_id: iv.sign_id,
                    type: iv.type,
                    scheduled_date: iv.scheduled_date || null,
                    status: iv.status || 'programmato',
                    notes: iv.notes || null,
                    cost: iv.cost || null,
                });
                interventionsOk++;
            } catch (e) {
                errors.push(`Intervento ${iv.id}: ${e.message}`);
            }
        }

        setResult({ signsOk, interventionsOk, errors });
        setImporting(false);
    };

    const rowStyle = { padding: '0.5rem 0', borderBottom: '1px solid var(--gray-200)', fontSize: '0.875rem' };
    const labelStyle = { color: 'var(--gray-500)', width: '180px', display: 'inline-block' };

    return (
        <div style={{ padding: '1.5rem', overflowY: 'auto', height: '100%' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>📥 Importa Dati da Mobile</h2>
            <p style={{ color: 'var(--gray-500)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Carica il file JSON esportato dall'app mobile sul telefono (pulsante <strong>📦 Esporta Dati per Desktop</strong>)
                per importare i nuovi segnali rilevati in campo direttamente nel database.
            </p>

            {/* Step 1 – Carica file */}
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                <div style={{ fontWeight: '700', marginBottom: '0.75rem' }}>1. Seleziona il file JSON del telefono</div>
                <input
                    ref={fileRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                />
                <button
                    className="btn btn-secondary"
                    onClick={() => fileRef.current?.click()}
                    style={{ marginRight: '0.75rem' }}
                >
                    📂 Sfoglia...
                </button>
                {fileName && (
                    <span style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                        {fileName}
                    </span>
                )}
            </div>

            {/* Step 2 – Anteprima */}
            {data && (
                <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                    <div style={{ fontWeight: '700', marginBottom: '0.75rem' }}>2. Anteprima dati</div>

                    <div style={rowStyle}>
                        <span style={labelStyle}>Esportato il:</span>
                        <strong>{new Date(data._exported_at).toLocaleString('it-IT')}</strong>
                    </div>
                    <div style={rowStyle}>
                        <span style={labelStyle}>Totale segnali nel file:</span>
                        <strong>{allSigns.length}</strong>
                    </div>
                    <div style={rowStyle}>
                        <span style={labelStyle}>🆕 Nuovi (non sincronizzati):</span>
                        <strong style={{ color: newSigns.length > 0 ? 'var(--primary)' : 'var(--gray-400)' }}>
                            {newSigns.length}
                        </strong>
                    </div>
                    <div style={{ ...rowStyle, borderBottom: 'none' }}>
                        <span style={labelStyle}>Interventi nuovi:</span>
                        <strong>{interventions.length}</strong>
                    </div>

                    {allSigns.length > newSigns.length && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={importAll}
                                onChange={e => setImportAll(e.target.checked)}
                            />
                            Importa anche i {allSigns.length - newSigns.length} segnali già sincronizzati (crea duplicati)
                        </label>
                    )}

                    {newSigns.length > 0 && (
                        <div style={{ marginTop: '1rem', maxHeight: '220px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'var(--gray-100)' }}>
                                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>#</th>
                                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>Tipo</th>
                                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>Stato</th>
                                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>Lat/Lng</th>
                                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>Foto</th>
                                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>Data</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {newSigns.map((s, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                                            <td style={{ padding: '0.35rem 0.6rem', color: 'var(--gray-500)' }}>{i + 1}</td>
                                            <td style={{ padding: '0.35rem 0.6rem', fontWeight: '600' }}>{s.type}</td>
                                            <td style={{ padding: '0.35rem 0.6rem' }}>{s.status}</td>
                                            <td style={{ padding: '0.35rem 0.6rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                {parseFloat(s.latitude).toFixed(5)}, {parseFloat(s.longitude).toFixed(5)}
                                            </td>
                                            <td style={{ padding: '0.35rem 0.6rem' }}>
                                                {s._photo ? (
                                                    <img src={s._photo} alt="" style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px' }} />
                                                ) : '—'}
                                            </td>
                                            <td style={{ padding: '0.35rem 0.6rem', color: 'var(--gray-500)', fontSize: '0.75rem' }}>
                                                {s.created_at ? new Date(s.created_at).toLocaleDateString('it-IT') : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Step 3 – Importa */}
            {data && signsToImport.length > 0 && (
                <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                    <div style={{ fontWeight: '700', marginBottom: '0.75rem' }}>3. Importa nel database</div>
                    <button
                        className="btn btn-primary"
                        onClick={handleImport}
                        disabled={importing}
                        style={{ minWidth: '200px' }}
                    >
                        {importing ? '⏳ Importazione in corso...' : `📥 Importa ${signsToImport.length} segnali`}
                    </button>
                </div>
            )}

            {data && signsToImport.length === 0 && !importAll && (
                <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.1)', border: '1px solid var(--success)', borderRadius: '8px', color: 'var(--success)', marginBottom: '1rem' }}>
                    ✅ Tutti i segnali nel file risultano già sincronizzati. Nessun dato da importare.
                </div>
            )}

            {/* Risultato */}
            {result && (
                <div className="card" style={{
                    padding: '1.25rem',
                    background: result.errors.length === 0 ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                    border: `1px solid ${result.errors.length === 0 ? 'var(--success)' : 'var(--warning)'}`,
                }}>
                    <div style={{ fontWeight: '700', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
                        {result.errors.length === 0 ? '✅ Importazione completata!' : '⚠️ Importazione con avvisi'}
                    </div>
                    <div style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                        Segnali importati: <strong>{result.signsOk}</strong>
                    </div>
                    {result.interventionsOk > 0 && (
                        <div style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                            Interventi importati: <strong>{result.interventionsOk}</strong>
                        </div>
                    )}
                    {result.errors.length > 0 && (
                        <div style={{ marginTop: '0.75rem' }}>
                            <div style={{ fontWeight: '600', color: 'var(--danger)', marginBottom: '0.25rem' }}>Errori:</div>
                            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--danger)' }}>
                                {result.errors.map((err, i) => <li key={i}>{err}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default MobileImportPanel;
