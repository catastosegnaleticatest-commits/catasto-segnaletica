import { useState, useRef, useEffect } from 'react';
import lmStudioService from '../services/lmStudioService';
import { signsService } from '../services/firestoreService';

const SPATIAL_KEYWORDS = ['disegna', 'posiziona', 'stalli', 'stallo', 'parcheggio', 'parcheggi', 'layout parcheggio', 'apri la mappa', 'apri mappa', 'genera stalli'];

const SQL_EXAMPLES = [
    'Quanti segnali sono danneggiati?',
    'Quali interventi sono programmati questa settimana?',
    'Mostra i segnali di precedenza rimossi',
    'Qual è il costo totale degli interventi completati?',
    'Quante buche sono ancora aperte?',
    'Disegna 5 stalli perpendicolari in Via Roma',
];

const RAG_EXAMPLES = [
    'Quali sono i tempi di manutenzione previsti dal contratto?',
    'Chi è responsabile della sostituzione dei segnali?',
    'Quali sono le penali per ritardi negli interventi?',
    'Come si gestisce una variante stradale?',
];

function ResultTable({ rows }) {
    if (!rows || rows.length === 0) return <p style={{ color: 'var(--gray-500)', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>Nessun risultato trovato.</p>;
    const cols = Object.keys(rows[0]);
    return (
        <div style={{ overflowX: 'auto', marginTop: '0.5rem', maxHeight: '200px', overflowY: 'auto', borderRadius: '6px', border: '1px solid var(--gray-200)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--gray-100)' }}>
                    <tr>
                        {cols.map(c => <th key={c} style={{ padding: '0.35rem 0.6rem', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid var(--gray-200)', whiteSpace: 'nowrap' }}>{c}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                            {cols.map(c => <td key={c} style={{ padding: '0.3rem 0.6rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row[c] == null ? '—' : String(row[c])}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Message({ msg }) {
    const [sqlOpen, setSqlOpen] = useState(false);
    const [tableOpen, setTableOpen] = useState(false);
    const [sourcesOpen, setSourcesOpen] = useState(false);

    if (msg.role === 'user') {
        return (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                <div style={{
                    background: 'var(--primary)', color: 'white', padding: '0.5rem 0.85rem',
                    borderRadius: '14px 14px 2px 14px', maxWidth: '80%', fontSize: '0.88rem', lineHeight: 1.5
                }}>
                    {msg.text}
                </div>
            </div>
        );
    }

    if (msg.role === 'error') {
        return (
            <div style={{ marginBottom: '0.75rem' }}>
                <div style={{
                    background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
                    padding: '0.5rem 0.85rem', borderRadius: '14px 14px 14px 2px', fontSize: '0.85rem'
                }}>
                    ❌ {msg.text}
                </div>
            </div>
        );
    }

    // RAG answer
    if (msg.type === 'rag') {
        return (
            <div style={{ marginBottom: '0.75rem' }}>
                <div style={{
                    background: '#f0fdf4', border: '1px solid #bbf7d0',
                    padding: '0.6rem 0.85rem', borderRadius: '14px 14px 14px 2px', fontSize: '0.88rem', lineHeight: 1.6
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#16a34a' }}>📄 AI — Documenti</span>
                        {msg.sources?.length > 0 && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>· {msg.sources.length} fonti</span>
                        )}
                    </div>
                    <p style={{ margin: 0, color: 'var(--gray-800)', whiteSpace: 'pre-wrap' }}>{msg.answer}</p>
                    {msg.sources?.length > 0 && (
                        <div style={{ marginTop: '0.5rem' }}>
                            <button
                                onClick={() => setSourcesOpen(p => !p)}
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: '9999px', border: '1px solid #bbf7d0', background: 'var(--gray-100)', cursor: 'pointer', color: '#16a34a' }}
                            >
                                {sourcesOpen ? '▲ Nascondi fonti' : `▼ Mostra ${msg.sources.length} fonti`}
                            </button>
                            {sourcesOpen && (
                                <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                    {msg.sources.map((s, i) => (
                                        <div key={i} style={{ fontSize: '0.75rem', background: 'var(--gray-100)', borderRadius: '6px', padding: '0.35rem 0.5rem', border: '1px solid rgba(16,185,129,0.3)' }}>
                                            <strong>{s.original_name}</strong> (chunk {s.chunk_index + 1})<br />
                                            <span style={{ color: 'var(--gray-500)' }}>{s.excerpt}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Spatial answer
    if (msg.type === 'spatial') {
        return (
            <div style={{ marginBottom: '0.75rem' }}>
                <div style={{
                    background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)',
                    padding: '0.6rem 0.85rem', borderRadius: '14px 14px 14px 2px', fontSize: '0.88rem', lineHeight: 1.6
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#7c3aed' }}>🗺️ AI — Mappa Spaziale</span>
                    </div>
                    <p style={{ margin: 0, color: 'var(--gray-800)', whiteSpace: 'pre-wrap' }}>{msg.explanation}</p>
                </div>
            </div>
        );
    }

    // SQL answer
    return (
        <div style={{ marginBottom: '0.75rem' }}>
            <div style={{
                background: 'var(--gray-50)', border: '1px solid var(--gray-200)',
                padding: '0.6rem 0.85rem', borderRadius: '14px 14px 14px 2px', fontSize: '0.88rem', lineHeight: 1.5
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--primary)' }}>🗄️ AI — Database</span>
                    {msg.rowCount !== undefined && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>· {msg.rowCount} righe</span>
                    )}
                </div>
                <p style={{ margin: 0, color: 'var(--gray-800)' }}>{msg.explanation || 'Query eseguita.'}</p>
                {msg.rowCount !== undefined && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {msg.sql && (
                            <button onClick={() => setSqlOpen(p => !p)} style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: '9999px', border: '1px solid var(--gray-300)', background: 'var(--gray-100)', cursor: 'pointer', color: 'var(--gray-600)' }}>
                                {sqlOpen ? '▲ Nascondi SQL' : '▼ Mostra SQL'}
                            </button>
                        )}
                        {msg.rows?.length > 0 && (
                            <button onClick={() => setTableOpen(p => !p)} style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: '9999px', border: '1px solid var(--primary)', background: tableOpen ? 'var(--primary)' : 'var(--gray-100)', cursor: 'pointer', color: tableOpen ? 'white' : 'var(--primary)' }}>
                                {tableOpen ? '▲ Nascondi tabella' : `▼ Mostra ${msg.rowCount} righe`}
                            </button>
                        )}
                    </div>
                )}
                {sqlOpen && msg.sql && (
                    <pre style={{ marginTop: '0.4rem', padding: '0.5rem', background: '#1e1e2e', color: '#cdd6f4', borderRadius: '6px', fontSize: '0.75rem', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {msg.sql}
                    </pre>
                )}
                {tableOpen && <ResultTable rows={msg.rows} />}
            </div>
        </div>
    );
}

function AIBar({ onClose }) {
    const [mode, setMode] = useState('sql'); // 'sql' | 'rag'
    const [messages, setMessages] = useState([
        { role: 'ai', type: 'sql', explanation: 'Ciao! Sono il tuo assistente AI. Usa la modalità 🗄️ Database per interrogare i dati del catasto in italiano naturale, oppure 📄 Documenti per cercare informazioni nei PDF caricati (circolari, contratti, normative).', rowCount: undefined }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [aiAvailable, setAiAvailable] = useState(null);
    const endRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        lmStudioService.ping()
            .then(() => setAiAvailable(true))
            .catch(() => setAiAvailable(false));
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 50);
    }, [mode]);

    const handleSend = async (question) => {
        const q = (question || input).trim();
        if (!q || loading) return;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: q }]);
        setLoading(true);
        try {
            const isSpatial = mode === 'sql' && SPATIAL_KEYWORDS.some(kw => q.toLowerCase().includes(kw));
            if (isSpatial) {
                // Comandi spaziali richiedono il server Electron — informa l'utente
                setMessages(prev => [...prev, {
                    role: 'error',
                    text: 'I comandi spaziali (disegno stalli) sono disponibili solo nell\'app desktop Electron. Per il browser usa la modalità 🗄️ Database o 📄 Documenti.'
                }]);
            } else if (mode === 'sql') {
                // Carica i segnali da Firestore e passa al modello locale
                const signs = await signsService.getAll().catch(() => []);
                const result = await lmStudioService.askSql(q, signs);
                setMessages(prev => [...prev, { role: 'ai', type: 'sql', explanation: result.explanation, rows: result.rows, rowCount: result.rowCount }]);
            } else {
                const result = await lmStudioService.askRag(q);
                setMessages(prev => [...prev, { role: 'ai', type: 'rag', answer: result.answer, sources: result.sources }]);
            }
        } catch (err) {
            const isConnErr = err.message.includes('Failed to fetch') || err.message.includes('NetworkError');
            setMessages(prev => [...prev, {
                role: 'error',
                text: isConnErr
                    ? 'LM Studio non raggiungibile. Avvia LM Studio, carica un modello e attiva il server locale (porta 1234). Poi configura l\'URL in Impostazioni → Configurazione AI.'
                    : err.message
            }]);
        } finally {
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const examples = mode === 'sql' ? SQL_EXAMPLES : RAG_EXAMPLES;
    const isFirstMessage = messages.length === 1;

    return (
        <div style={{
            position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 9000,
            width: '440px', maxWidth: 'calc(100vw - 2rem)',
            background: 'var(--gray-50)', borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)',
            display: 'flex', flexDirection: 'column', maxHeight: '72vh',
            border: '1px solid var(--gray-200)'
        }}>
            {/* Header */}
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--gray-200)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.1rem' }}>🤖</span>
                        <div>
                            <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>AI Bar</div>
                            <div style={{ fontSize: '0.7rem', color: aiAvailable === null ? 'var(--gray-400)' : aiAvailable ? '#10b981' : '#ef4444' }}>
                                {aiAvailable === null ? 'Verifica stato...' : aiAvailable ? '● Modello pronto' : '● Modello non disponibile'}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', fontFamily: 'monospace' }}>Ctrl+I</span>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--gray-400)', padding: '0.15rem', lineHeight: 1 }} title="Chiudi (Esc)">✕</button>
                    </div>
                </div>
                {/* Mode toggle */}
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                    {[['sql', '🗄️ Database'], ['rag', '📄 Documenti']].map(([m, label]) => (
                        <button
                            key={m}
                            onClick={() => setMode(m)}
                            style={{
                                flex: 1, padding: '0.35rem 0.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                fontSize: '0.8rem', fontWeight: mode === m ? '700' : '400',
                                background: mode === m ? 'var(--primary)' : 'var(--gray-100)',
                                color: mode === m ? 'white' : 'var(--gray-600)'
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem', minHeight: 0 }}>
                {messages.map((msg, i) => <Message key={i} msg={msg} />)}
                {loading && (
                    <div style={{ display: 'flex', gap: '0.3rem', padding: '0.4rem 0', marginBottom: '0.75rem', alignItems: 'center' }}>
                        {[0, 1, 2].map(i => (
                            <div key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', background: mode === 'rag' ? '#16a34a' : 'var(--primary)', animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                        ))}
                        <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginLeft: '0.25rem' }}>
                            {mode === 'rag' ? 'Ricerca nei documenti...' : 'Generazione SQL...'}
                        </span>
                    </div>
                )}
                <div ref={endRef} />
            </div>

            {/* Esempi */}
            {isFirstMessage && !loading && (
                <div style={{ padding: '0 1rem 0.5rem', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginBottom: '0.35rem' }}>Esempi ({mode === 'sql' ? 'database' : 'documenti'}):</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {examples.map(ex => (
                            <button key={ex} onClick={() => handleSend(ex)} style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem', borderRadius: '9999px', border: '1px solid var(--gray-300)', background: 'var(--gray-50)', cursor: 'pointer', color: 'var(--gray-700)' }}>
                                {ex}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input */}
            <div style={{ padding: '0.6rem 1rem', borderTop: '1px solid var(--gray-200)', flexShrink: 0, display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                        if (e.key === 'Escape') onClose();
                    }}
                    placeholder={mode === 'sql' ? 'Chiedi al database... (Invio per inviare)' : 'Cerca nei documenti caricati... (Invio)'}
                    disabled={loading || aiAvailable === false}
                    rows={2}
                    style={{ flex: 1, resize: 'none', padding: '0.5rem 0.75rem', borderRadius: '10px', border: '1px solid var(--gray-300)', fontSize: '0.875rem', fontFamily: 'inherit', lineHeight: 1.5, outline: 'none' }}
                />
                <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || loading || aiAvailable === false}
                    style={{
                        padding: '0.5rem 0.75rem', borderRadius: '10px', border: 'none',
                        background: !input.trim() || loading || aiAvailable === false ? 'var(--gray-200)' : mode === 'rag' ? '#16a34a' : 'var(--primary)',
                        color: !input.trim() || loading || aiAvailable === false ? 'var(--gray-400)' : 'white',
                        cursor: !input.trim() || loading || aiAvailable === false ? 'default' : 'pointer',
                        fontSize: '1.1rem', lineHeight: 1, flexShrink: 0
                    }}
                >
                    ➤
                </button>
            </div>
            <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }`}</style>
        </div>
    );
}

export default AIBar;
