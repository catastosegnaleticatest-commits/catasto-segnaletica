import { useState } from 'react';

function MobileSidebar({ isOpen, onClose, user, onLogout, onChangePassword, syncStatus, stats }) {
    const menuItems = [
        { icon: '🏠', label: 'Home', action: 'home' },
        { icon: '📊', label: 'Statistiche', action: 'stats' },
        { icon: '🔄', label: 'Sincronizza Ora', action: 'sync' },
        { icon: '🔑', label: 'Cambia Password', action: 'changePassword' },
        { icon: 'ℹ️', label: 'Informazioni', action: 'info' },
        { icon: '🚪', label: 'Esci', action: 'logout' }
    ];

    const handleAction = (action) => {
        switch (action) {
            case 'home':
                onClose();
                break;
            case 'sync':
                alert('Sincronizzazione avviata...');
                onClose();
                break;
            case 'stats':
                alert('Funzionalità in sviluppo');
                break;
            case 'changePassword':
                onClose();
                if (onChangePassword) onChangePassword();
                break;
            case 'info':
                alert('Catasto Segnaletica v1.0\n\nApplicazione per la gestione del catasto della segnaletica stradale.');
                break;
            case 'logout':
                if (confirm('Sei sicuro di voler uscire?')) {
                    onLogout();
                }
                break;
            default:
                break;
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Overlay */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 998,
                    animation: 'fadeIn 0.3s ease-out'
                }}
            />

            {/* Sidebar */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: '280px',
                    maxWidth: '80vw',
                    background: 'white',
                    zIndex: 999,
                    boxShadow: '2px 0 10px rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'slideInLeft 0.3s ease-out'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>Menu</h2>
                        <button
                            onClick={onClose}
                            style={{
                                background: 'rgba(255, 255, 255, 0.2)',
                                border: 'none',
                                color: 'white',
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                cursor: 'pointer',
                                fontSize: '1.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            ✕
                        </button>
                    </div>
                    <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                        👤 {user?.username}
                    </div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.25rem' }}>
                        {syncStatus.online ? '🟢 Online' : '🔴 Offline'}
                    </div>
                </div>

                {/* Stats Summary */}
                {stats && (
                    <div style={{
                        padding: '1rem 1.5rem',
                        borderBottom: '1px solid var(--gray-200)',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '1rem'
                    }}>
                        <div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>
                                {stats.local?.totalSigns || 0}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)' }}>Segnali</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: stats.local?.pendingSync > 0 ? 'var(--warning)' : 'var(--success)' }}>
                                {stats.local?.pendingSync || 0}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)' }}>Da Sync</div>
                        </div>
                    </div>
                )}

                {/* Menu Items */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {menuItems.map((item, index) => (
                        <button
                            key={index}
                            onClick={() => handleAction(item.action)}
                            style={{
                                width: '100%',
                                padding: '1rem 1.5rem',
                                border: 'none',
                                borderBottom: '1px solid #f3f4f6',
                                background: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                fontSize: '1rem',
                                color: item.action === 'logout' ? '#ef4444' : '#111827',
                                transition: 'background 0.2s',
                                textAlign: 'left'
                            }}
                            onMouseEnter={(e) => e.target.style.background = '#f9fafb'}
                            onMouseLeave={(e) => e.target.style.background = 'white'}
                        >
                            <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
                            <span style={{ fontWeight: '500' }}>{item.label}</span>
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid var(--gray-200)',
                    fontSize: '0.75rem',
                    color: 'var(--gray-500)',
                    textAlign: 'center'
                }}>
                    Catasto Segnaletica v1.0
                </div>
            </div>

            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
        </>
    );
}

export default MobileSidebar;
