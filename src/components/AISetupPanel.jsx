import { useState, useEffect } from 'react';
import apiService from '../services/api';

const MODEL_NAME = 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf';
const MODEL_SIZE_GB = 4.7;
const HUGGINGFACE_URL = 'https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf';

function Check({ ok, children }) {
    const color = ok === true ? 'var(--success)' : ok === false ? 'var(--danger)' : 'var(--warning)';
    const icon  = ok === true ? '✅' : ok === false ? '❌' : '⚠️';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0', borderBottom: '1px solid var(--gray-200)', fontSize: '0.9rem' }}>
            <span style={{ fontSize: '1rem' }}>{icon}</span>
            <span style={{ color }}>{children}</span>
        </div>
    );
}

export default function AISetupPanel() {
    const [hw, setHw]         = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]    = useState(null);
    const [aiStatus, setAiStatus] = useState(null);

    useEffect(() => {
        Promise.all([
            apiService.request('/api/ai/hardware-check'),
            apiService.request('/api/ai/status'),
        ]).then(([hwData, statusData]) => {
            setHw(hwData);
            setAiStatus(statusData);
        }).catch(e => setError(e.message))
          .finally(() => setLoading(false));
    }, []);

    if (loading) return <div style={{ padding: '2rem', color: 'var(--gray-500)' }}>⏳ Verifica hardware in corso...</div>;
    if (error)   return <div style={{ padding: '2rem', color: 'var(--danger)' }}>❌ Errore: {error}</div>;

    const diskLabel = hw.disk.freeGb !== null
        ? `${hw.disk.freeGb} GB liberi (minimo ${hw.disk.minRequired} GB)`
        : 'Non rilevabile su questo sistema (verifica manualmente: servono almeno 6 GB liberi)';

    return (
        <div style={{ padding: '1.5rem', maxWidth: 680, overflowY: 'auto', height: '100%' }}>
            <h2 style={{ marginBottom: '0.25rem' }}>🤖 Configurazione AI Locale</h2>
            <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                Il modello AI gira direttamente sul tuo PC — nessun dato viene inviato a server esterni.
                Le funzioni AI (classificazione segnali, chatbot, analisi conformità) richiedono hardware sufficiente.
            </p>

            {/* Stato attuale */}
            <div className="card" style={{ padding: '1rem', marginBottom: '1rem', background: aiStatus?.available ? 'rgba(16,185,129,0.08)' : 'rgba(100,116,139,0.08)', border: `1px solid ${aiStatus?.available ? 'var(--success)' : 'var(--gray-300)'}` }}>
                <strong>{aiStatus?.available ? '✅ AI attiva e funzionante' : '⚫ AI disabilitata'}</strong>
                {!aiStatus?.available && (
                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: 'var(--gray-500)' }}>
                        {hw.modelExists ? 'Il modello è presente ma non è stato caricato correttamente.' : 'Il file modello non è ancora installato.'}
                    </p>
                )}
            </div>

            {/* Verifica Hardware */}
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>📊 Verifica Requisiti Hardware</div>

                <Check ok={hw.ram.ok}>
                    RAM: {hw.ram.total} GB totali, {hw.ram.free} GB liberi
                    {hw.ram.ok
                        ? hw.ram.good ? ' — ottimo' : ' — sufficiente (minimo soddisfatto)'
                        : ` — insufficiente (minimo ${hw.ram.minRequired} GB)`}
                </Check>

                <Check ok={hw.disk.ok}>
                    Spazio disco: {diskLabel}
                </Check>

                <Check ok={hw.cpu.cores >= 4 ? true : null}>
                    CPU: {hw.cpu.model} — {hw.cpu.cores} core{hw.cpu.cores >= 4 ? '' : ' (consigliati almeno 4)'}
                </Check>

                <Check ok={hw.modelExists}>
                    File modello: {hw.modelExists ? 'presente' : 'non installato'}
                    {hw.modelExists && <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginLeft: 8 }}>{hw.modelPath}</span>}
                </Check>
            </div>

            {/* Risultato */}
            {!hw.ready && (
                <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem', background: 'rgba(239,68,68,0.07)', border: '1px solid var(--danger)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: '0.5rem' }}>❌ Hardware insufficiente per l'AI locale</div>
                    <p style={{ fontSize: '0.875rem', margin: 0, color: 'var(--gray-600)' }}>
                        Questo PC non soddisfa i requisiti minimi. Le funzioni AI rimangono disabilitate automaticamente.
                        {hw.ram.total < hw.ram.minRequired && ` La RAM disponibile (${hw.ram.total} GB) è inferiore al minimo richiesto (${hw.ram.minRequired} GB).`}
                    </p>
                </div>
            )}

            {hw.ready && !hw.modelExists && (
                <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                    <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>📥 Hardware OK — Installa il modello AI</div>

                    <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 8, padding: '1rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Istruzioni di installazione:</div>
                        <ol style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8 }}>
                            <li>Scarica il file <strong>{MODEL_NAME}</strong> (~{MODEL_SIZE_GB} GB) da HuggingFace</li>
                            <li>Spostalo nella cartella <code style={{ background: 'var(--gray-200)', padding: '1px 5px', borderRadius: 3 }}>models/</code> nella directory dell'applicazione</li>
                            <li>Riavvia l'applicazione</li>
                        </ol>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <a
                            href={HUGGINGFACE_URL}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                                display: 'inline-block',
                                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                                color: 'white', textDecoration: 'none',
                                padding: '0.6rem 1.2rem', borderRadius: 8,
                                fontWeight: 600, fontSize: '0.875rem',
                                boxShadow: '0 2px 8px rgba(37,99,235,0.3)'
                            }}
                        >
                            ⬇️ Scarica da HuggingFace ({MODEL_SIZE_GB} GB)
                        </a>
                        <button
                            className="btn btn-secondary"
                            onClick={() => {
                                navigator.clipboard?.writeText(HUGGINGFACE_URL);
                                alert('URL copiato negli appunti!');
                            }}
                        >
                            📋 Copia link
                        </button>
                    </div>

                    <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(245,158,11,0.08)', border: '1px solid var(--warning)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--gray-600)' }}>
                        <strong>⚠️ Nota sul PC aziendale:</strong> il download potrebbe essere bloccato dalla rete o dall'antivirus.
                        Scarica il file da casa e trasferiscilo con una chiavetta USB nella cartella <code>models/</code>.
                    </div>
                </div>
            )}

            {hw.ready && hw.modelExists && !aiStatus?.available && (
                <div className="card" style={{ padding: '1.25rem', background: 'rgba(245,158,11,0.08)', border: '1px solid var(--warning)' }}>
                    <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>⚠️ Modello trovato ma AI non attiva</div>
                    <p style={{ fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
                        Il file è presente ma il motore AI non si è avviato. Possibili cause:
                    </p>
                    <ul style={{ fontSize: '0.875rem', margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8 }}>
                        <li>Il file è corrotto o incompleto (prova a riscaricarlo)</li>
                        <li>RAM insufficiente al momento dell'avvio (chiudi altre applicazioni e riavvia)</li>
                        <li>Dipendenza <code>node-llama-cpp</code> non compilata correttamente</li>
                    </ul>
                </div>
            )}

            {hw.ready && hw.modelExists && aiStatus?.available && (
                <div className="card" style={{ padding: '1.25rem', background: 'rgba(16,185,129,0.08)', border: '1px solid var(--success)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--success)' }}>✅ Tutto pronto — AI operativa</div>
                    <p style={{ fontSize: '0.875rem', margin: '0.5rem 0 0', color: 'var(--gray-600)' }}>
                        Il modello è caricato e le funzioni AI sono disponibili. Usa <kbd>Ctrl+I</kbd> per aprire l'assistente.
                    </p>
                </div>
            )}
        </div>
    );
}
