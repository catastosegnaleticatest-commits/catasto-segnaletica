import { useState, useEffect, useRef } from 'react';

export default function CommandBar() {
    const [isOpen, setIsOpen] = useState(false);
    const [feedbackText, setFeedbackText] = useState('');
    const textareaRef = useRef(null);
    const overlayRef = useRef(null);

    useEffect(() => {
        const onKey = (e) => {
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setFeedbackText('');
            setTimeout(() => textareaRef.current?.focus(), 50);
        }
    }, [isOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const text = feedbackText.trim();
        if (!text) return;
        setFeedbackText('');
        setIsOpen(false);
        // Salva feedback in localStorage per consultazione futura
        try {
            const feedbacks = JSON.parse(localStorage.getItem('feedbacks') || '[]');
            feedbacks.push({ text, date: new Date().toISOString() });
            localStorage.setItem('feedbacks', JSON.stringify(feedbacks.slice(-50)));
        } catch { /* ignore */ }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                ref={overlayRef}
                onClick={() => setIsOpen(false)}
                style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.55)',
                    zIndex: 9998,
                    backdropFilter: 'blur(2px)',
                }}
            />

            {/* Panel */}
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    position: 'fixed',
                    top: '22%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 'min(500px, 92vw)',
                    zIndex: 9999,
                    background: '#0f172a',
                    color: '#f1f5f9',
                    borderRadius: '14px',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.55)',
                    border: '1px solid #334155',
                    padding: '1.25rem',
                    animation: 'commandBarIn 0.15s ease-out',
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        🤖 Feedback AI — <kbd style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '4px', padding: '1px 5px', fontSize: '0.7rem' }}>Ctrl+F</kbd>
                    </span>
                    <button
                        onClick={() => setIsOpen(false)}
                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, padding: '2px 6px' }}
                        aria-label="Chiudi"
                    >✕</button>
                </div>

                {/* Textarea */}
                <form onSubmit={handleSubmit}>
                    <textarea
                        ref={textareaRef}
                        value={feedbackText}
                        onChange={e => setFeedbackText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(e); }}
                        placeholder="Inserisci un feedback, un problema riscontrato o un suggerimento per l'applicazione (l'AI lo analizzerà)..."
                        rows={4}
                        style={{
                            width: '100%',
                            background: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            color: '#f1f5f9',
                            padding: '0.75rem',
                            fontSize: '0.9rem',
                            resize: 'vertical',
                            outline: 'none',
                            fontFamily: 'inherit',
                            lineHeight: '1.5',
                            transition: 'border-color 0.15s',
                        }}
                        onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                        onBlur={e => (e.target.style.borderColor = '#334155')}
                    />

                    {/* Footer */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.65rem', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {feedbackText.length} caratteri
                        </span>
                        <button
                            type="submit"
                            disabled={!feedbackText.trim()}
                            style={{
                                background: !feedbackText.trim() ? '#334155' : '#3b82f6',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '7px',
                                padding: '0.45rem 1.1rem',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: !feedbackText.trim() ? 'not-allowed' : 'pointer',
                                transition: 'background 0.15s',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            Invia ↵
                        </button>
                    </div>
                </form>
            </div>

            <style>{`
                @keyframes commandBarIn {
                    from { opacity: 0; transform: translateX(-50%) scale(0.96); }
                    to   { opacity: 1; transform: translateX(-50%) scale(1); }
                }
            `}</style>
        </>
    );
}
