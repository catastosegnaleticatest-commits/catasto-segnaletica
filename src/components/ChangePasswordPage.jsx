import { useState } from 'react';
import { authService } from '../services/authService';

function ChangePasswordPage({ onPasswordChanged, onLogout }) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 6) {
            setError('La nuova password deve avere almeno 6 caratteri');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Le password non coincidono');
            return;
        }

        setLoading(true);
        try {
            await authService.changePassword(currentPassword, newPassword);
            onPasswordChanged();
        } catch (err) {
            setError(err.message || 'Errore cambio password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '1rem'
        }}>
            <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</h1>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>
                        Cambio Password Obbligatorio
                    </h2>
                    <p style={{ color: 'var(--gray-600)', marginTop: '0.5rem' }}>
                        Per motivi di sicurezza devi impostare una nuova password prima di continuare.
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Password attuale</label>
                        <input
                            type="password"
                            className="form-input"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Inserisci la password attuale"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Nuova password</label>
                        <input
                            type="password"
                            className="form-input"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Almeno 6 caratteri"
                            required
                            minLength={6}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Conferma nuova password</label>
                        <input
                            type="password"
                            className="form-input"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Ripeti la nuova password"
                            required
                            minLength={6}
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: '0.75rem',
                            background: '#fee2e2',
                            color: '#991b1b',
                            borderRadius: 'var(--border-radius-sm)',
                            marginBottom: '1rem',
                            fontSize: '0.875rem'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', marginBottom: '0.75rem' }}
                        disabled={loading}
                    >
                        {loading ? 'Aggiornamento...' : 'Aggiorna password'}
                    </button>

                    <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ width: '100%' }}
                        onClick={onLogout}
                        disabled={loading}
                    >
                        Esci
                    </button>
                </form>
            </div>
        </div>
    );
}

export default ChangePasswordPage;
