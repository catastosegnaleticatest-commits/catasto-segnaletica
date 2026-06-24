import { useState, useEffect } from 'react';
import apiService from '../services/api';
import localStorageService from '../services/localStorage';
import ImportSigns from './ImportSigns';

function UserManagement({ user }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role: 'operatore'
    });
    const [resetConfirmText, setResetConfirmText] = useState('');
    const [resetting, setResetting] = useState(false);
    const [backingUp, setBackingUp] = useState(false);
    const [snapshotting, setSnapshotting] = useState(false);
    const [backupList, setBackupList] = useState([]);
    const [backupListLoading, setBackupListLoading] = useState(false);
    const [knowledgeDocs, setKnowledgeDocs] = useState([]);
    const [knowledgeLoading, setKnowledgeLoading] = useState(false);
    const [knowledgeUploading, setKnowledgeUploading] = useState(false);
    const [resetPasswordModal, setResetPasswordModal] = useState(null); // { username, tempPassword }

    const roles = [
        { value: 'admin', label: '👑 Admin', description: 'Accesso completo, gestione utenti e configurazione' },
        { value: 'tecnico', label: '🔧 Tecnico', description: 'Gestione segnali e interventi (vista desktop)' },
        { value: 'operatore', label: '📱 Operatore', description: 'Rilevamento segnali sul campo (vista mobile)' }
    ];

    useEffect(() => {
        loadUsers();
        loadBackupList();
        loadKnowledgeDocs();
    }, []);

    const loadKnowledgeDocs = async () => {
        setKnowledgeLoading(true);
        try { setKnowledgeDocs(await apiService.listKnowledge()); }
        catch { setKnowledgeDocs([]); }
        finally { setKnowledgeLoading(false); }
    };

    const handleKnowledgeUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        setKnowledgeUploading(true);
        try {
            const result = await apiService.uploadKnowledge(file);
            alert(`✅ "${result.original_name}" caricato: ${result.page_count} pagine, ${result.chunk_count} segmenti indicizzati.`);
            await loadKnowledgeDocs();
        } catch (err) {
            alert('Errore upload: ' + err.message);
        } finally {
            setKnowledgeUploading(false);
        }
    };

    const handleKnowledgeDelete = async (doc) => {
        if (!confirm(`Eliminare "${doc.original_name}" dalla knowledge base?`)) return;
        try {
            await apiService.deleteKnowledge(doc.id);
            await loadKnowledgeDocs();
        } catch (err) {
            alert('Errore eliminazione: ' + err.message);
        }
    };

    const loadBackupList = async () => {
        setBackupListLoading(true);
        try {
            const list = await apiService.getBackupList();
            setBackupList(list);
        } catch {
            setBackupList([]);
        } finally {
            setBackupListLoading(false);
        }
    };

    const handleSnapshot = async () => {
        setSnapshotting(true);
        try {
            await apiService.createSnapshot();
            await loadBackupList();
        } catch (error) {
            alert('Errore snapshot: ' + error.message);
        } finally {
            setSnapshotting(false);
        }
    };

    const loadUsers = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${apiService.getApiUrl()}/api/users`, {
                headers: apiService.getHeaders()
            });
            if (response.ok) {
                setUsers(await response.json());
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
                const response = await fetch(`${apiService.getApiUrl()}/api/users/${editingUser.id}`, {
                    method: 'PUT',
                    headers: apiService.getHeaders(),
                    body: JSON.stringify({ role: formData.role })
                });
                if (response.ok) {
                    // salva email separatamente
                    await handleSaveEmail(editingUser.id, formData.email || '');
                    alert('Utente aggiornato con successo!');
                }
            } else {
                const newUser = await apiService.register(formData.username, formData.password, formData.role);
                if (formData.email && newUser?.id) {
                    await handleSaveEmail(newUser.id, formData.email);
                }
                alert('Utente creato con successo!');
            }
            setShowForm(false);
            setEditingUser(null);
            setFormData({ username: '', password: '', role: 'operatore', email: '' });
            await loadUsers();
        } catch (error) {
            alert('Errore: ' + error.message);
        }
    };

    const handleEdit = (user) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            password: '',
            role: user.role,
            email: user.email || '',
        });
        setShowForm(true);
    };

    const handleResetPassword = async (u) => {
        if (!confirm(`Generare una password temporanea per "${u.username}"? L'utente dovrà cambiarla al primo accesso.`)) return;
        try {
            const res = await fetch(`${apiService.getApiUrl()}/api/users/${u.id}/reset-password`, {
                method: 'POST',
                headers: apiService.getHeaders(),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Errore reset');
            setResetPasswordModal({ username: data.username, tempPassword: data.tempPassword });
        } catch (err) {
            alert('Errore reset password: ' + err.message);
        }
    };

    const handleSaveEmail = async (userId, email) => {
        try {
            await fetch(`${apiService.getApiUrl()}/api/users/${userId}/email`, {
                method: 'PUT',
                headers: apiService.getHeaders(),
                body: JSON.stringify({ email }),
            });
        } catch { /* silenzioso */ }
    };

    const handleDelete = async (userId) => {
        if (!confirm('Sei sicuro di voler eliminare questo utente?')) return;
        try {
            const response = await fetch(`${apiService.getApiUrl()}/api/users/${userId}`, {
                method: 'DELETE',
                headers: apiService.getHeaders()
            });
            if (response.ok) {
                alert('Utente eliminato con successo!');
                await loadUsers();
            } else {
                const errText = await response.text();
                alert(`Errore eliminazione utente (${response.status}): ${errText}`);
            }
        } catch (error) {
            alert('Errore eliminazione utente: ' + error.message);
        }
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

    const handleBackup = async () => {
        setBackingUp(true);
        try {
            const response = await fetch(`${apiService.getApiUrl()}/api/admin/backup`, {
                headers: apiService.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Errore generazione backup (${response.status})`);
            }

            const blob = await response.blob();
            const disposition = response.headers.get('Content-Disposition');
            const match = disposition && disposition.match(/filename="(.+)"/);
            const filename = match ? match[1] : `catasto-backup-${Date.now()}.zip`;

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            alert('Errore durante il backup: ' + error.message);
        } finally {
            setBackingUp(false);
        }
    };

    const handleResetDatabase = async () => {
        if (resetConfirmText !== 'RESET') return;

        setResetting(true);
        try {
            await apiService.resetDatabase();
            await localStorageService.clearAll();
            alert('Database resettato con successo. La pagina verrà ricaricata.');
            window.location.reload();
        } catch (error) {
            alert('Errore durante il reset: ' + error.message);
            setResetting(false);
        }
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
                            <label className="form-label">Email di recupero (opzionale)</label>
                            <input
                                type="email"
                                className="form-input"
                                value={formData.email || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                placeholder="utente@comune.it"
                            />
                            <small style={{ color: 'var(--gray-600)', fontSize: '0.75rem' }}>
                                Usata dall'amministratore per comunicare la password di recupero
                            </small>
                        </div>

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
                                            background: formData.role === role.value ? 'rgba(59,130,246,0.15)' : 'var(--gray-100)'
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
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Email</th>
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
                                                <div>
                                                    <strong>{u.username}</strong>
                                                    {u.must_change_password ? <div style={{ fontSize: '0.72rem', color: '#f59e0b' }}>⚠️ Cambio password richiesto</div> : null}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <span className={`badge ${getRoleBadge(u.role)}`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem', color: 'var(--gray-600)', fontSize: '0.8rem' }}>
                                            {u.email || <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>—</span>}
                                        </td>
                                        <td style={{ padding: '0.75rem', color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                                            {new Date(u.created_at).toLocaleDateString('it-IT')}
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                                <button
                                                    className="btn btn-sm btn-secondary"
                                                    onClick={() => handleEdit(u)}
                                                >
                                                    ✏️ Modifica
                                                </button>
                                                {u.username !== user.username && (
                                                    <>
                                                        <button
                                                            className="btn btn-sm"
                                                            onClick={() => handleResetPassword(u)}
                                                            style={{ background: '#d97706', color: 'white' }}
                                                            title="Genera password temporanea"
                                                        >
                                                            🔑 Reset PWD
                                                        </button>
                                                        <button
                                                            className="btn btn-sm"
                                                            onClick={() => handleDelete(u.id)}
                                                            style={{ background: 'var(--danger)', color: 'white' }}
                                                        >
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

            {/* Importazione massiva segnali */}
            <ImportSigns />

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

            {/* Modale password temporanea */}
            {resetPasswordModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: 'var(--gray-50)', borderRadius: '12px', padding: '1.5rem',
                        maxWidth: '400px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                        border: '2px solid #d97706'
                    }}>
                        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#d97706' }}>
                            🔑 Password Temporanea Generata
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: '1rem' }}>
                            Comunica questa password a <strong>{resetPasswordModal.username}</strong>. L'utente dovrà cambiarla al primo accesso.
                        </p>
                        <div style={{
                            background: 'var(--gray-900, #111)', border: '1px solid #d97706',
                            borderRadius: '8px', padding: '0.75rem 1rem',
                            fontFamily: 'monospace', fontSize: '1.3rem', fontWeight: '700',
                            color: '#fbbf24', letterSpacing: '0.1em', textAlign: 'center',
                            marginBottom: '0.75rem'
                        }}>
                            {resetPasswordModal.tempPassword}
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#f87171', marginBottom: '1rem' }}>
                            ⚠️ Questa password viene mostrata una sola volta. Annotarla adesso.
                        </p>
                        <button
                            className="btn btn-primary"
                            style={{ width: '100%' }}
                            onClick={() => {
                                navigator.clipboard?.writeText(resetPasswordModal.tempPassword);
                                setResetPasswordModal(null);
                            }}
                        >
                            📋 Copia e Chiudi
                        </button>
                    </div>
                </div>
            )}

            {/* Backup Automatici */}
            <div className="card" style={{ marginTop: '1.5rem', border: '2px solid #6366f1', background: 'rgba(99,102,241,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#818cf8', marginBottom: '0.25rem' }}>
                            🗄️ Backup Automatici (ultimi 7 giorni)
                        </h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>
                            Snapshot giornalieri del database salvati automaticamente in AppData.
                        </p>
                    </div>
                    <button
                        className="btn btn-sm"
                        style={{ background: '#6366f1', color: 'white', whiteSpace: 'nowrap' }}
                        disabled={snapshotting}
                        onClick={handleSnapshot}
                    >
                        {snapshotting ? '⏳ Salvataggio...' : '📸 Snapshot ora'}
                    </button>
                </div>
                {backupListLoading ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Caricamento...</p>
                ) : backupList.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Nessun backup trovato.</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(99,102,241,0.3)' }}>
                                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', fontWeight: '600', color: '#818cf8' }}>File</th>
                                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: '600', color: '#818cf8' }}>Dimensione</th>
                                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: '600', color: '#818cf8' }}>Data</th>
                            </tr>
                        </thead>
                        <tbody>
                            {backupList.map(b => (
                                <tr key={b.name} style={{ borderBottom: '1px solid rgba(99,102,241,0.15)' }}>
                                    <td style={{ padding: '0.4rem 0.5rem', fontFamily: 'monospace' }}>{b.name}</td>
                                    <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: 'var(--gray-600)' }}>
                                        {(b.size / 1024).toFixed(0)} KB
                                    </td>
                                    <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: 'var(--gray-600)' }}>
                                        {new Date(b.created).toLocaleString('it-IT')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Backup Completo: database + codice sorgente */}
            <div className="card" style={{ marginTop: '1.5rem', border: '1px solid rgba(14,165,233,0.3)', background: 'rgba(14,165,233,0.06)' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.5rem', color: '#38bdf8' }}>
                    💾 Backup Completo del Sistema
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--gray-700)', marginBottom: '1rem' }}>
                    Scarica un archivio ZIP contenente uno snapshot consistente del database (segnali, interventi, utenti, storico, ecc.),
                    le foto allegate e il codice sorgente completo dell'applicativo, per permettere un eventuale ripristino completo del sistema.
                </p>
                <button
                    className="btn btn-primary"
                    disabled={backingUp}
                    onClick={handleBackup}
                >
                    {backingUp ? '⏳ Generazione backup in corso...' : '💾 Scarica Backup Completo'}
                </button>
            </div>

            {/* Knowledge Base RAG */}
            <div className="card" style={{ marginTop: '1.5rem', border: '1px solid rgba(5,150,105,0.3)', background: 'rgba(5,150,105,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#34d399', marginBottom: '0.25rem' }}>
                            📚 Knowledge Base AI (RAG)
                        </h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)', margin: 0 }}>
                            Carica PDF (contratti, circolari, normative) per permettere all'AI Bar (Ctrl+I → 📄 Documenti) di rispondere in italiano naturale.
                        </p>
                    </div>
                    <label style={{ cursor: knowledgeUploading ? 'wait' : 'pointer' }}>
                        <input type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={handleKnowledgeUpload} disabled={knowledgeUploading} />
                        <span className="btn btn-sm" style={{ background: '#059669', color: 'white', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                            {knowledgeUploading ? '⏳ Indicizzazione...' : '📤 Carica PDF'}
                        </span>
                    </label>
                </div>
                {knowledgeLoading ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Caricamento...</p>
                ) : knowledgeDocs.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Nessun documento caricato. Aggiungi PDF per abilitare le risposte contestuali.</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(52,211,153,0.25)' }}>
                                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', color: '#6ee7b7' }}>Documento</th>
                                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: '#6ee7b7' }}>Pagine</th>
                                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: '#6ee7b7' }}>Segmenti</th>
                                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: '#6ee7b7' }}>Caricato il</th>
                                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: '#6ee7b7' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {knowledgeDocs.map(doc => (
                                <tr key={doc.id} style={{ borderBottom: '1px solid rgba(52,211,153,0.1)' }}>
                                    <td style={{ padding: '0.4rem 0.5rem', fontWeight: '500' }}>📄 {doc.original_name}</td>
                                    <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: 'var(--gray-600)' }}>{doc.page_count}</td>
                                    <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: 'var(--gray-600)' }}>{doc.chunk_count}</td>
                                    <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: 'var(--gray-600)' }}>
                                        {new Date(doc.created_at).toLocaleDateString('it-IT')}
                                    </td>
                                    <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>
                                        <button onClick={() => handleKnowledgeDelete(doc)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '0.9rem' }} title="Elimina">🗑️</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Zona Pericolosa: reset totale del database */}
            <div className="card" style={{ marginTop: '1.5rem', border: '2px solid #ef4444', background: 'rgba(239,68,68,0.08)' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.5rem', color: '#ef4444' }}>
                    ⚠️ Zona Pericolosa — Reset Totale Database
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--gray-700)', marginBottom: '1rem' }}>
                    Questa operazione elimina <strong>definitivamente</strong> tutti i segnali, gli interventi, gli accordi quadro/listino/impegni di spesa,
                    le foto e il registro attività, per permettere un inserimento dati pulito da zero.
                    Gli account utente <strong>non</strong> vengono eliminati. L'operazione non è reversibile.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label className="field-label" style={{ margin: 0 }}>
                        Digita <strong>RESET</strong> per confermare:
                    </label>
                    <input
                        type="text"
                        className="form-input"
                        value={resetConfirmText}
                        onChange={e => setResetConfirmText(e.target.value)}
                        placeholder="RESET"
                        style={{ width: '140px' }}
                    />
                    <button
                        className="btn btn-danger"
                        disabled={resetConfirmText !== 'RESET' || resetting}
                        onClick={handleResetDatabase}
                    >
                        {resetting ? '⏳ Reset in corso...' : '🗑️ Resetta Database'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default UserManagement;
