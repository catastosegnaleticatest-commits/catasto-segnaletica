import { useState, useEffect } from 'react';

const MODEL_NAME = 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf';
const MODEL_SIZE_GB = 4.7;
const HUGGINGFACE_URL = 'https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf';

// Requisiti minimi
const MIN_RAM_GB  = 8;
const MIN_DISK_GB = 6;

function Row({ ok, children }) {
    const icon = ok === true ? '✅' : ok === false ? '❌' : '⚠️';
    const color = ok === true ? '#16a34a' : ok === false ? '#dc2626' : '#d97706';
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.5rem 0', borderBottom: '1px solid var(--gray-200)', fontSize: '0.9rem' }}>
            <span>{icon}</span>
            <span style={{ color }}>{children}</span>
        </div>
    );
}

// Rileva se siamo dentro Electron
const isElectron = typeof window !== 'undefined' &&
    (window.navigator.userAgent.includes('Electron') || !!window.__ELECTRON__);

export default function AISetupPanel() {
    const [hw, setHw] = useState(null);
    const [aiStatus, setAiStatus] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isElectron) { setLoading(false); return; }

        // Nell'app Electron, il server locale è sempre su localhost:3001
        const base = 'http://localhost:3001';
        Promise.all([
            fetch(`${base}/api/ai/hardware-check`).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(`${base}/api/ai/status`).then(r => r.ok ? r.json() : null).catch(() => null),
        ]).then(([hwData, statusData]) => {
            setHw(hwData);
            setAiStatus(statusData);
        }).finally(() => setLoading(false));
    }, []);

    // ── Browser (non-Electron) ────────────────────────────────────────────────
    if (!isElectron) {
        return (
            <div style={{ padding: '1.5rem', maxWidth: 680 }}>
                <h2 style={{ marginBottom: '0.25rem' }}>🤖 Configurazione AI Locale</h2>
                <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                    Il modello AI gira direttamente sul PC — nessun dato viene inviato a server esterni.
                </p>

                <div className="card" style={{ padding: '1.25rem', background: 'rgba(245,158,11,0.08)', border: '1px solid var(--warning)', marginBottom: '1rem' }}>
                    <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>🖥️ Disponibile solo nell'app desktop</div>
                    <p style={{ fontSize: '0.875rem', margin: 0, color: 'var(--gray-600)' }}>
                        L'AI locale (classificazione segnali, chatbot, analisi conformità) richiede l'applicazione
                        Electron installata sul PC. Nel browser questa sezione mostra solo i requisiti.
                    </p>
                </div>

                <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                    <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>📊 Requisiti Hardware Minimi</div>
                    <Row ok={null}>RAM: almeno {MIN_RAM_GB} GB liberi durante l'utilizzo</Row>
                    <Row ok={null}>Disco: almeno {MIN_DISK_GB} GB liberi per il file modello</Row>
                    <Row ok={null}>CPU: almeno 4 core (consigliati 8+)</Row>
                    <Row ok={null}>File modello: <strong>{MODEL_NAME}</strong> (~{MODEL_SIZE_GB} GB)</Row>
                </div>

                <div className="card" style={{ padding: '1.25rem' }}>
                    <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>📥 Installa il modello AI</div>
                    <ol style={{ margin: '0 0 1rem', paddingLeft: '1.25rem', lineHeight: 1.9, fontSize: '0.875rem' }}>
                        <li>Scarica <strong>{MODEL_NAME}</strong> (~{MODEL_SIZE_GB} GB) da HuggingFace</li>
                        <li>Spostalo nella cartella <code style={{ background: 'var(--gray-100)', padding: '1px 5px', borderRadius: 3 }}>models/</code> della directory dell'applicazione Electron</li>
                        <li>Riavvia l'applicazione desktop</li>
                    </ol>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <a
                            href={HUGGINGFACE_URL}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: 'inline-block', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: 'white', textDecoration: 'none', padding: '0.6rem 1.2rem', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem' }}
                        >
                            ⬇️ Scarica da HuggingFace ({MODEL_SIZE_GB} GB)
                        </a>
                        <button
                            className="btn btn-secondary"
                            onClick={() => { navigator.clipboard?.writeText(HUGGINGFACE_URL); alert('URL copiato!'); }}
                        >
                            📋 Copia link
                        </button>
                    </div>
                    <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(245,158,11,0.08)', border: '1px solid var(--warning)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--gray-600)' }}>
                        <strong>⚠️ PC aziendale:</strong> il download potrebbe essere bloccato dalla rete o dall'antivirus.
                        Scarica da casa e trasferisci con una chiavetta USB nella cartella <code>models/</code>.
                    </div>
                </div>
            </div>
        );
    }

    // ── Electron — caricamento ────────────────────────────────────────────────
    if (loading) {
        return <div style={{ padding: '2rem', color: 'var(--gray-500)' }}>⏳ Verifica hardware in corso...</div>;
    }

    // ── Electron — server locale non risponde ─────────────────────────────────
    if (!hw) {
        return (
            <div style={{ padding: '1.5rem', maxWidth: 680 }}>
                <h2 style={{ marginBottom: '0.25rem' }}>🤖 Configurazione AI Locale</h2>
                <div className="card" style={{ padding: '1.25rem', background: 'rgba(239,68,68,0.07)', border: '1px solid var(--danger)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: '0.5rem' }}>❌ Server locale non raggiungibile</div>
                    <p style={{ fontSize: '0.875rem', margin: 0, color: 'var(--gray-600)' }}>
                        Il backend Electron non risponde su localhost:3001. Riavvia l'applicazione desktop.
                    </p>
                </div>
            </div>
        );
    }

    // ── Electron — dati hardware disponibili ──────────────────────────────────
    const diskLabel = hw.disk?.freeGb != null
        ? `${hw.disk.freeGb} GB liberi (minimo ${hw.disk.minRequired ?? MIN_DISK_GB} GB)`
        : `Non rilevabile — verifica manualmente: servono almeno ${MIN_DISK_GB} GB liberi`;

    return (
        <div style={{ padding: '1.5rem', maxWidth: 680, overflowY: 'auto', height: '100%' }}>
            <h2 style={{ marginBottom: '0.25rem' }}>🤖 Configurazione AI Locale</h2>
            <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                Il modello AI gira direttamente sul tuo PC — nessun dato viene inviato a server esterni.
            </p>

            {/* Stato corrente */}
            <div className="card" style={{ padding: '1rem', marginBottom: '1rem', background: aiStatus?.available ? 'rgba(16,185,129,0.08)' : 'rgba(100,116,139,0.08)', border: `1px solid ${aiStatus?.available ? 'var(--success)' : 'var(--gray-300)'}` }}>
                <strong>{aiStatus?.available ? '✅ AI attiva e funzionante' : '⚫ AI disabilitata'}</strong>
                {!aiStatus?.available && (
                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: 'var(--gray-500)' }}>
                        {hw.modelExists ? 'Il modello è presente ma non è stato caricato correttamente.' : 'Il file modello non è ancora installato.'}
                    </p>
                )}
            </div>

            {/* Verifica hardware */}
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>📊 Verifica Requisiti Hardware</div>
                <Row ok={hw.ram?.ok}>
                    RAM: {hw.ram?.total ?? '?'} GB totali, {hw.ram?.free ?? '?'} GB liberi
                    {hw.ram?.ok ? (hw.ram.good ? ' — ottimo' : ' — sufficiente') : ` — insufficiente (minimo ${hw.ram?.minRequired ?? MIN_RAM_GB} GB)`}
                </Row>
                <Row ok={hw.disk?.ok}>Spazio disco: {diskLabel}</Row>
                <Row ok={(hw.cpu?.cores ?? 0) >= 4 ? true : null}>
                    CPU: {hw.cpu?.model ?? 'N/A'} — {hw.cpu?.cores ?? '?'} core{(hw.cpu?.cores ?? 0) >= 4 ? '' : ' (consigliati almeno 4)'}
                </Row>
                <Row ok={hw.modelExists}>
                    File modello: {hw.modelExists ? 'presente' : 'non installato'}
                    {hw.modelExists && <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginLeft: 8 }}>{hw.modelPath}</span>}
                </Row>
            </div>

            {!hw.ready && (
                <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem', background: 'rgba(239,68,68,0.07)', border: '1px solid var(--danger)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: '0.5rem' }}>❌ Hardware insufficiente</div>
                    <p style={{ fontSize: '0.875rem', margin: 0, color: 'var(--gray-600)' }}>
                        Questo PC non soddisfa i requisiti minimi. Le funzioni AI rimangono disabilitate.
                        {hw.ram?.total < (hw.ram?.minRequired ?? MIN_RAM_GB) && ` RAM disponibile: ${hw.ram.total} GB (minimo ${hw.ram.minRequired ?? MIN_RAM_GB} GB).`}
                    </p>
                </div>
            )}

            {hw.ready && !hw.modelExists && (
                <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                    <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>📥 Hardware OK — Installa il modello AI</div>
                    <ol style={{ margin: '0 0 1rem', paddingLeft: '1.25rem', lineHeight: 1.8, fontSize: '0.875rem' }}>
                        <li>Scarica <strong>{MODEL_NAME}</strong> (~{MODEL_SIZE_GB} GB) da HuggingFace</li>
                        <li>Spostalo nella cartella <code style={{ background: 'var(--gray-100)', padding: '1px 5px', borderRadius: 3 }}>models/</code></li>
                        <li>Riavvia l'applicazione</li>
                    </ol>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <a href={HUGGINGFACE_URL} target="_blank" rel="noreferrer"
                            style={{ display: 'inline-block', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: 'white', textDecoration: 'none', padding: '0.6rem 1.2rem', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem' }}>
                            ⬇️ Scarica da HuggingFace ({MODEL_SIZE_GB} GB)
                        </a>
                        <button className="btn btn-secondary" onClick={() => { navigator.clipboard?.writeText(HUGGINGFACE_URL); alert('URL copiato!'); }}>
                            📋 Copia link
                        </button>
                    </div>
                </div>
            )}

            {hw.ready && hw.modelExists && !aiStatus?.available && (
                <div className="card" style={{ padding: '1.25rem', background: 'rgba(245,158,11,0.08)', border: '1px solid var(--warning)' }}>
                    <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>⚠️ Modello trovato ma AI non attiva</div>
                    <ul style={{ fontSize: '0.875rem', margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8 }}>
                        <li>File corrotto o incompleto (prova a riscaricarlo)</li>
                        <li>RAM insufficiente al momento dell'avvio (chiudi altre app e riavvia)</li>
                        <li>Dipendenza <code>node-llama-cpp</code> non compilata correttamente</li>
                    </ul>
                </div>
            )}

            {hw.ready && hw.modelExists && aiStatus?.available && (
                <div className="card" style={{ padding: '1.25rem', background: 'rgba(16,185,129,0.08)', border: '1px solid var(--success)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--success)' }}>✅ Tutto pronto — AI operativa</div>
                    <p style={{ fontSize: '0.875rem', margin: '0.5rem 0 0', color: 'var(--gray-600)' }}>
                        Il modello è caricato. Usa <kbd>Ctrl+I</kbd> per aprire l'assistente AI.
                    </p>
                </div>
            )}
        </div>
    );
}
