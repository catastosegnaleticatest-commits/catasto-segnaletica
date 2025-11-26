import { useState, useEffect } from 'react';
import apiService from '../services/api';

function UserManagement({ user }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role: 'viewer'
    });

    const roles = [
        { value: 'admin', label: '👑 Admin', description: 'Accesso completo, gestione utenti' },
        { value: 'editor', label: '✏️ Editor', description: 'Visualizzazione e rilevamento segnali' },
        { value: 'viewer', label: '👁️ Viewer', description: 'Solo visualizzazione' }
    ];

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            console.log('Fetching users from:', `${import.meta.env.VITE_API_URL}/api/users`);
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/users`, {
                headers: apiService.getHeaders()
            });
            console.log('Response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('Users data received:', data);
                setUsers(data);
            } else {
                console.error('Failed to load users:', response.statusText);
                const errorText = await response.text();
                console.error('Error details:', errorText);
            }
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
                // Update user
                const response = await fetch(`${import.meta.env.VITE_API_URL}/api/users/${editingUser.id}`, {
                    method: 'PUT',
                    headers: apiService.getHeaders(),
                    body: JSON.stringify({
                        role: formData.role
                    })
                });

                if (response.ok) {
                    alert('Utente aggiornato con successo!');
                }
            } else {
                // Create new user
                await apiService.register(formData.username, formData.password, formData.role);
                alert('Utente creato con successo!');
            }

            setShowForm(false);
            setEditingUser(null);
            setFormData({ username: '', password: '', role: 'viewer' });
            loadUsers();
        } catch (error) {
            alert('Errore: ' + error.message);
        }
    };

    const handleEdit = (user) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            password: '',
            role: user.role
        });
        setShowForm(true);
    };

    const handleDelete = async (userId) => {
        console.log('=== DELETE USER START ===');
        console.log('User ID:', userId);
        console.log('API URL:', import.meta.env.VITE_API_URL);

        // TEMPORANEAMENTE DISABILITATO PER TEST
        // if (!confirm('Sei sicuro di voler eliminare questo utente?')) {
        //     console.log('Delete cancelled by user');
        //     return;
        // }

        try {
            const url = `${import.meta.env.VITE_API_URL}/api/users/${userId}`;
            console.log('Fetching URL:', url);
            console.log('Headers:', apiService.getHeaders());

            const response = await fetch(url, {
                method: 'DELETE',
                headers: apiService.getHeaders()
            });

            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);

            if (response.ok) {
                const data = await response.json();
                console.log('Success response:', data);
                alert('Utente eliminato con successo!');
                loadUsers();
            } else {
                const errText = await response.text();
                console.error('Delete failed with status:', response.status);
                console.error('Error response:', errText);
                alert(`Errore eliminazione utente (${response.status}): ${errText}`);
            }
        } catch (error) {
            console.error('Delete error (exception):', error);
            console.error('Error stack:', error.stack);
            alert('Errore eliminazione utente: ' + error.message);
        }
        console.log('=== DELETE USER END ===');
    };

    const getRoleBadge = (role) => {
        const badges = {
            admin: 'badge-danger',
            editor: 'badge-primary',
            viewer: 'badge-info'
        };
        return badges[role] || 'badge-secondary';
    };

    const getRoleIcon = (role) => {
        const icons = {
            admin: '👑',
            editor: '✏️',
            viewer: '👁️'
        };
        return icons[role] || '👤';
    };

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
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                        👥 Gestione Utenti
                    </h2>
                    <p style={{ color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                        Crea e gestisci gli utenti del sistema
                    </p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => {
                        setShowForm(true);
                        setEditingUser(null);
                        setFormData({ username: '', password: '', role: 'viewer' });
                    }}
                >
                    ➕ Nuovo Utente
                </button>
            </div>

            {/* Form Create/Edit */}
            {showForm && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
                        {editingUser ? 'Modifica Utente' : 'Nuovo Utente'}
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
                                disabled={editingUser}
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
                                <small style={{ color: 'var(--gray-600)', fontSize: '0.75rem' }}>
                                    Minimo 6 caratteri
                                </small>
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Ruolo</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {roles.map(role => (
                                    <label
                                        key={role.value}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'start',
                                            gap: '0.75rem',
                                            padding: '0.75rem',
                                            border: `2px solid ${formData.role === role.value ? 'var(--primary)' : 'var(--gray-200)'}`,
                                            borderRadius: 'var(--border-radius-sm)',
                                            cursor: 'pointer',
                                            background: formData.role === role.value ? 'var(--primary-light)' : 'white'
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            name="role"
                                            value={role.value}
                                            checked={formData.role === role.value}
                                            onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                                            style={{ marginTop: '0.25rem' }}
                                        />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                                                {role.label}
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                                                {role.description}
                                            </div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => {
                                    setShowForm(false);
                                    setEditingUser(null);
                                }}
                            >
                                Annulla
                            </button>
                            <button type="submit" className="btn btn-primary">
                                {editingUser ? 'Aggiorna' : 'Crea'} Utente
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Users Table */}
            <div className="card">
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>
                        Caricamento...
                    </div>
                ) : users.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>
                        Nessun utente trovato
                    </div>
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
                                    <tr key={u.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                                        <td style={{ padding: '0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ fontSize: '1.25rem' }}>{getRoleIcon(u.role)}</span>
                                                <strong>{u.username}</strong>
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <span className={`badge ${getRoleBadge(u.role)}`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem', color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                                            {new Date(u.created_at).toLocaleDateString('it-IT')}
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                <button
                                                    className="btn btn-sm btn-secondary"
                                                    onClick={() => handleEdit(u)}
                                                >
                                                    ✏️ Modifica
                                                </button>
                                                {u.username !== user.username && (
                                                    <button
                                                        className="btn btn-sm"
                                                        onClick={() => handleDelete(u.id)}
                                                        style={{ background: 'var(--danger)', color: 'white' }}
                                                    >
                                                        🗑️ Elimina
                                                    </button>
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

            {/* Role Legend */}
            <div className="card" style={{ marginTop: '1.5rem', background: 'var(--gray-50)' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem', color: 'var(--gray-700)' }}>
                    Legenda Ruoli
                </h4>
                <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
                    {roles.map(role => (
                        <div key={role.value} style={{ display: 'flex', gap: '0.5rem' }}>
                            <strong>{role.label}:</strong>
                            <span style={{ color: 'var(--gray-600)' }}>{role.description}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default UserManagement;
