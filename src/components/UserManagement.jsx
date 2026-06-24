import { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import ImportSigns from './ImportSigns';

function UserManagement({ user }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({ username: '', password: '', role: 'operatore' });
    const [resetPasswordModal, setResetPasswordModal] = useState(null);

    const roles = [
        { value: 'admin', label: '👑 Admin', description: 'Accesso completo, gestione utenti e configurazione' },
        { value: 'tecnico', label: '🔧 Tecnico', description: 'Gestione segnali e interventi (vista desktop)' },
        { value: 'operatore', label: '📱 Operatore', description: 'Rilevamento segnali sul campo (vista mobile)' },
    ];

    useEffect(() => { loadUsers(); }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            setUsers(await authService.listUsers());
        } catch (error) {
            console.error('Errore caricamento utenti:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingUser) {
                await authService.updateUserRole(editingUser.uid, formData.role);
                alert('Ruolo aggiornato con successo!');
            } else {
                await authService.createUser(formData.username, formData.password, formData.role);
                alert('Utente creato con successo!');
            }
            setShowForm(false);
            setEditingUser(null);
            setFormData({ username: '', password: '', role: 'operatore' });
            await loadUsers();
        } catch (error) {
            alert('Errore: ' + error.message);
        }
    };

    const handleEdit = (u) => {
        setEditingUser(u);
        setFormData({ username: u.username, password: '', role: u.role });
        setShowForm(true);
    };

    const handleResetPassword = async (u) => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        const tempPassword = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        if (!confirm(`Generare una password temporanea per "${u.username}"? L'utente dovrà cambiarla al primo accesso.`)) return;
        try {
            await authService.resetUserPassword(u.uid, tempPassword);
            setResetPasswordModal({ username: u.username, tempPassword });
        } catch (err) {
            alert('Errore reset password: ' + err.message);
        }
    };

    const handleDelete = async (u) => {
        if (!confirm(`Eliminare l'utente "${u.username}"? L'account verrà disabilitato.`)) return;
        try {
            await authService.deleteUserProfile(u.uid);
            alert('Utente eliminato con successo!');
            await loadUsers();
        } catch (error) {
            alert('Errore eliminazione utente: ' + error.message);
        }
    };

    const getRoleIcon = (role) => ({ admin: '👑', tecnico: '🔧', operatore: '📱' }[role] || '👤');

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

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.25rem' }}>👥 Gestione Utenti</h2>
                    <p style={{ color: 'var(--gray-600)', fontSize: '0.875rem' }}>Crea e gestisci gli utenti del sistema</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingUser(null); setFormData({ username: '', password: '', role: 'operatore' }); }}>
                    ➕ Nuovo Utente
                </button>
            </div>

            {showForm && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
                        {editingUser ? 'Modifica Ruolo' : 'Nuovo Utente'}
                    </h3>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Username</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.username}
                                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                                required
                                disabled={!!editingUser}
                            />
                        </div>
                        {!editingUser && (
                            <div className="form-group">
                                <label className="form-label">Password</label>
                                <input
                                    type="password"
                                    className="form-input"
                                    value={formData.password}
                                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                    required
                                    minLength={6}
                                />
                                <small style={{ color: 'var(--gray-600)', fontSize: '0.75rem' }}>Minimo 6 caratteri</small>
                            </div>
                        )}
                        <div className="form-group">
                            <label className="form-label">Ruolo</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {roles.map(role => (
                                    <label key={role.value} style={{
                                        display: 'flex', alignItems: 'start', gap: '0.75rem', padding: '0.75rem',
                                        border: `2px solid ${formData.role === role.value ? 'var(--primary)' : 'var(--gray-200)'}`,
                                        borderRadius: 'var(--border-radius-sm)', cursor: 'pointer',
                                        background: formData.role === role.value ? 'rgba(59,130,246,0.15)' : 'var(--gray-100)'
                                    }}>
                                        <input type="radio" name="role" value={role.value}
                                            checked={formData.role === role.value}
                                            onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                                            style={{ marginTop: '0.25rem' }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{role.label}</div>
                                            <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>{role.description}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingUser(null); }}>Annulla</button>
                            <button type="submit" className="btn btn-primary">{editingUser ? 'Aggiorna' : 'Crea'} Utente</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card">
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>Caricamento...</div>
                ) : users.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>Nessun utente trovato</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--gray-200)' }}>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Utente</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Ruolo</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Creato</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>Azioni</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.uid} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                                        <td style={{ padding: '0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ fontSize: '1.25rem' }}>{getRoleIcon(u.role)}</span>
                                                <div>
                                                    <strong>{u.username}</strong>
                                                    {u.requiresPasswordChange && (
                                                        <div style={{ fontSize: '0.72rem', color: '#f59e0b' }}>⚠️ Cambio password richiesto</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <span className="badge badge-secondary">{u.role}</span>
                                        </td>
                                        <td style={{ padding: '0.75rem', color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString('it-IT') : '—'}
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                                <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(u)}>✏️ Modifica</button>
                                                {u.username !== user.username && (
                                                    <>
                                                        <button className="btn btn-sm" onClick={() => handleResetPassword(u)}
                                                            style={{ background: '#d97706', color: 'white' }} title="Genera password temporanea">
                                                            🔑 Reset PWD
                                                        </button>
                                                        <button className="btn btn-sm" onClick={() => handleDelete(u)}
                                                            style={{ background: 'var(--danger)', color: 'white' }}>
                                                            🗑️ Elimina
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <ImportSigns />

            <div className="card" style={{ marginTop: '1.5rem', background: 'var(--gray-50)' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem', color: 'var(--gray-700)' }}>Legenda Ruoli</h4>
                <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
                    {roles.map(role => (
                        <div key={role.value} style={{ display: 'flex', gap: '0.5rem' }}>
                            <strong>{role.label}:</strong>
                            <span style={{ color: 'var(--gray-600)' }}>{role.description}</span>
                        </div>
                    ))}
                </div>
            </div>

            {resetPasswordModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--gray-50)', borderRadius: '12px', padding: '1.5rem', maxWidth: '400px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '2px solid #d97706' }}>
                        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#d97706' }}>🔑 Password Temporanea Generata</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: '1rem' }}>
                            Comunica questa password a <strong>{resetPasswordModal.username}</strong>. L'utente dovrà cambiarla al primo accesso.
                        </p>
                        <div style={{ background: 'var(--gray-900, #111)', border: '1px solid #d97706', borderRadius: '8px', padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '1.3rem', fontWeight: '700', color: '#fbbf24', letterSpacing: '0.1em', textAlign: 'center', marginBottom: '0.75rem' }}>
                            {resetPasswordModal.tempPassword}
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#f87171', marginBottom: '1rem' }}>
                            ⚠️ Questa password viene mostrata una sola volta. Annotarla adesso.
                        </p>
                        <button className="btn btn-primary" style={{ width: '100%' }}
                            onClick={() => { navigator.clipboard?.writeText(resetPasswordModal.tempPassword); setResetPasswordModal(null); }}>
                            📋 Copia e Chiudi
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UserManagement;
