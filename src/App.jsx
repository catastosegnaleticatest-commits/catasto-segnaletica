import { useState, useEffect } from 'react';
import './App.css';
import apiService from './services/api';
import localStorageService from './services/localStorage';
import syncService from './services/sync';
import LoginPage from './components/LoginPage';
import MobileHome from './components/MobileHome';
import MobileSidebar from './components/MobileSidebar';
import DesktopView from './components/DesktopView';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [view, setView] = useState('mobile'); // 'mobile' o 'desktop'
  const [syncStatus, setSyncStatus] = useState({ online: false, syncing: false, lastError: null });
  const [stats, setStats] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    // Verifica se c'è un token salvato
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(savedUser));
      initializeApp();
    }

    // Determina la vista in base alla dimensione dello schermo
    const updateView = () => {
      setView(window.innerWidth >= 768 ? 'desktop' : 'mobile');
    };

    updateView();
    window.addEventListener('resize', updateView);

    return () => window.removeEventListener('resize', updateView);
  }, []);

  const initializeApp = async () => {
    // Connetti WebSocket
    apiService.connectSocket();

    // Listener per eventi di sincronizzazione
    syncService.onSyncEvent((event, data) => {
      console.log('Sync event:', event, data);

      if (event === 'sync:start' || event === 'upload:start' || event === 'download:start') {
        setSyncStatus(prev => ({ ...prev, syncing: true, lastError: null }));
      } else if (event === 'sync:complete') {
        setSyncStatus(prev => ({ ...prev, syncing: false, lastError: null }));
        showToast('✅ Sincronizzazione completata!', 'success');
        loadStats();
      } else if (event === 'upload:partial') {
        setSyncStatus(prev => ({ ...prev, syncing: false }));
        const errorMsg = `⚠️ Sync parziale: ${data.uploaded} ok, ${data.failed} falliti. Errori: ${data.errors[0]}`;
        showToast(errorMsg, 'error');
        loadStats();
      } else if (event === 'sync:error') {
        const errorMsg = data?.message || 'Errore sconosciuto';
        setSyncStatus(prev => ({ ...prev, syncing: false, lastError: errorMsg }));
        showToast(`❌ Errore sync: ${errorMsg}`, 'error');
        loadStats();
      }
    });

    // Listener per stato server
    syncService.onStatusChange((status) => {
      setSyncStatus(prev => ({ ...prev, online: status.online }));
    });

    // Verifica stato server
    await syncService.checkServerStatus();

    // Carica statistiche
    await loadStats();

    // Avvia auto-sync ogni 5 minuti
    syncService.startAutoSync(5);
  };

  const loadStats = async () => {
    const syncStats = await syncService.getSyncStats();
    setStats(syncStats);
  };

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleLogin = async (username, password) => {
    try {
      const data = await apiService.login(username, password);
      setIsAuthenticated(true);
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
      await initializeApp();
    } catch (error) {
      throw error;
    }
  };

  const handleLogout = () => {
    apiService.clearToken();
    localStorage.removeItem('user');
    syncService.stopAutoSync();
    setIsAuthenticated(false);
    setUser(null);
    setSidebarOpen(false);
  };

  const handleSync = async () => {
    try {
      await syncService.fullSync();
    } catch (error) {
      console.error('Errore sincronizzazione:', error);
      // Il toast viene già mostrato dal listener sync:error
    }
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      {/* Mobile Sidebar */}
      {view === 'mobile' && (
        <MobileSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          user={user}
          onLogout={handleLogout}
          syncStatus={syncStatus}
          stats={stats}
        />
      )}

      <header className="header">
        <div className="container">
          <div className="header-content">
            {/* Hamburger Menu (solo mobile) */}
            {view === 'mobile' && (
              <button
                onClick={() => setSidebarOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--primary)'
                }}
              >
                ☰
              </button>
            )}

            <h1 className="header-title">📍 Catasto Segnaletica</h1>

            <div className="header-actions">
              <div className={`sync-status ${syncStatus.syncing ? 'syncing' : syncStatus.online ? 'online' : 'offline'}`}>
                <span className="sync-indicator"></span>
                {syncStatus.syncing ? 'Sync...' : syncStatus.online ? 'Online' : 'Offline'}
              </div>

              {view === 'desktop' && (
                <>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={handleSync}
                    disabled={syncStatus.syncing}
                  >
                    🔄 Sincronizza
                  </button>

                  <button className="btn btn-sm btn-secondary" onClick={handleLogout}>
                    🚪 Esci
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        {view === 'mobile' ? (
          <MobileHome
            user={user}
            syncStatus={syncStatus}
            stats={stats}
            onDataChange={loadStats}
          />
        ) : (
          <DesktopView
            user={user}
            syncStatus={syncStatus}
            stats={stats}
            onDataChange={loadStats}
          />
        )}
      </main>

      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#10b981' : '#3b82f6',
            color: 'white',
            padding: '1rem 1.5rem',
            borderRadius: 'var(--border-radius)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 10000,
            maxWidth: '400px',
            fontWeight: '600',
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default App;
