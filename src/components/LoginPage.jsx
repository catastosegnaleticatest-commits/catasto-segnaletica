import { useState } from 'react';
import { Capacitor } from '@capacitor/core';

function LoginPage({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showForgot, setShowForgot] = useState(false);
    const isNative = Capacitor.isNativePlatform();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await onLogin(username, password);
        } catch (err) {
            setError(err.message || 'Credenziali non valide');
        } finally {
            setLoading(false);
        }
    };


    const inputStyle = {
        width: '100%',
        background: '#0a0f1e',
        border: '1px solid #1e293b',
        borderRadius: 8,
        padding: '0.7rem 0.9rem',
        color: '#f1f5f9',
        fontSize: '0.9rem',
        outline: 'none',
        transition: 'border-color 0.2s',
        display: 'block',
        boxSizing: 'border-box'
    };

    const labelStyle = {
        display: 'block',
        color: '#64748b',
        fontSize: '0.7rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: '0.4rem'
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0a0f1e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Dot grid background */}
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                backgroundImage: 'radial-gradient(circle, rgba(59,130,246,0.06) 1px, transparent 1px)',
                backgroundSize: '32px 32px'
            }} />
            {/* Glow blobs */}
            <div style={{
                position: 'absolute', width: 400, height: 400, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
                top: '10%', left: '5%', pointerEvents: 'none'
            }} />
            <div style={{
                position: 'absolute', width: 300, height: 300, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)',
                bottom: '15%', right: '10%', pointerEvents: 'none'
            }} />

            {/* Card */}
            <div style={{
                width: '100%', maxWidth: 380,
                background: '#111827',
                border: '1px solid #1f2937',
                borderRadius: 16,
                padding: '2rem',
                position: 'relative',
                boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(59,130,246,0.05)'
            }}>
                {/* Logo + title */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: 52, height: 52, margin: '0 auto 1rem',
                        background: 'linear-gradient(135deg, #2563eb 0%, #6366f1 100%)',
                        borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.6rem', boxShadow: '0 4px 20px rgba(37,99,235,0.4)'
                    }}>
                        📍
                    </div>
                    <h1 style={{ color: '#f1f5f9', fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.3rem' }}>
                        Catasto Segnaletica
                    </h1>
                    <p style={{ color: '#475569', fontSize: '0.8rem', margin: 0 }}>
                        Sistema Gestione Infrastruttura Viaria
                    </p>
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px solid #1f2937', marginBottom: '1.5rem' }} />

                <form onSubmit={handleSubmit} autoComplete="off">
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={labelStyle}>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="Inserisci username"
                            required
                            autoFocus
                            autoComplete="off"
                            style={inputStyle}
                            onFocus={e => e.target.style.borderColor = '#3b82f6'}
                            onBlur={e => e.target.style.borderColor = '#1e293b'}
                        />
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={labelStyle}>Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Inserisci password"
                                required
                                autoComplete="new-password"
                                style={{ ...inputStyle, paddingRight: '2.75rem' }}
                                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                                onBlur={e => e.target.style.borderColor = '#1e293b'}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                                style={{
                                    position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: '#475569', fontSize: '1rem', padding: '0.2rem', lineHeight: 1
                                }}
                            >
                                {showPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div style={{
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            color: '#fca5a5',
                            borderRadius: 8, padding: '0.65rem 0.9rem',
                            marginBottom: '1rem', fontSize: '0.85rem'
                        }}>
                            ⚠️ {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            background: loading ? '#1e3a5f' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                            color: loading ? '#64748b' : 'white',
                            border: 'none', borderRadius: 8,
                            padding: '0.75rem',
                            fontSize: '0.9rem', fontWeight: 600,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: loading ? 'none' : '0 4px 14px rgba(37,99,235,0.35)'
                        }}
                    >
                        {loading ? '⏳ Accesso in corso...' : 'Accedi →'}
                    </button>
                </form>


                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                    <button
                        type="button"
                        onClick={() => setShowForgot(v => !v)}
                        style={{ background: 'none', border: 'none', color: '#475569', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                        Password dimenticata?
                    </button>
                </div>

                {showForgot && (
                    <div style={{
                        marginTop: '0.75rem', background: 'rgba(59,130,246,0.08)',
                        border: '1px solid rgba(59,130,246,0.25)', borderRadius: '8px',
                        padding: '0.85rem 1rem', fontSize: '0.82rem', color: '#94a3b8'
                    }}>
                        <strong style={{ color: '#93c5fd', display: 'block', marginBottom: '0.35rem' }}>🔑 Recupero accesso</strong>
                        Contatta il tuo <strong style={{ color: '#f1f5f9' }}>amministratore di sistema</strong> e chiedi di generare una password temporanea dal pannello
                        <em> Gestione Utenti → 🔑 Reset PWD</em>.<br />
                        <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.3rem', display: 'block' }}>
                            L'amministratore potrà impostare anche la tua email di recupero per future notifiche.
                        </span>
                    </div>
                )}

                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: '#1f2937' }}>
                        Premi <kbd style={{ background: '#1e293b', color: '#475569', border: '1px solid #334155', borderRadius: 4, padding: '0 4px', fontSize: '0.65rem' }}>Ctrl+F</kbd> per la barra comandi
                    </span>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
