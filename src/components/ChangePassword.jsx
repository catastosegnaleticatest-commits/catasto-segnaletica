import { useState } from 'react';
import apiService from '../services/api';

function ChangePassword({ user, onPasswordChanged }) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validazione
        if (!currentPassword || !newPassword || !confirmPassword) {
            setError('Tutti i campi sono obbligatori');
            return;
        }

        if (newPassword.length < 6) {
            setError('La nuova password deve essere di almeno 6 caratteri');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Le password non corrispondono');
            return;
        }

        if (currentPassword === newPassword) {
            setError('La nuova password deve essere diversa dalla password corrente');
            return;
        }

        setLoading(true);

        try {
            await apiService.changePassword(currentPassword, newPassword);
            alert('Password cambiata con successo!');
            if (onPasswordChanged) {
                onPasswordChanged();
            }
        } catch (error) {
            console.error('Errore cambio password:', error);
            setError(error.message || 'Errore durante il cambio password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
        }}>
            <div className="card" style={{
                maxWidth: '500px',
                width: '90%',
                padding: '2rem',
                position: 'relative'
            }}>
                <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>
                        Cambio Password Obbligatorio
                    </h2>
                    <p style={{ marginTop: '0.5rem', color: 'var(--gray-600)' }}>
                        Per motivi di sicurezza, devi cambiare la password al primo accesso.
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label className="form-label">Password Corrente</label>
                        <input
                            type="password"
                            className="form-control"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Inserisci la password corrente"
                            required
                            autoFocus
                        />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label className="form-label">Nuova Password</label>
                        <input
                            type="password"
                            className="form-control"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Inserisci la nuova password (min. 6 caratteri)"
                            required
                            minLength={6}
                        />
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label className="form-label">Conferma Nuova Password</label>
                        <input
                            type="password"
                            className="form-control"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Conferma la nuova password"
                            required
                            minLength={6}
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: '0.75rem',
                            background: '#fee2e2',
                            color: '#dc2626',
                            borderRadius: 'var(--border-radius)',
                            marginBottom: '1rem',
                            fontSize: '0.875rem'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                        disabled={loading}
                    >
                        {loading ? '⏳ Cambio password...' : '✅ Cambia Password'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default ChangePassword;

