import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import './App.css';
import apiService from './services/api';
import localStorageService from './services/localStorage';
import syncService from './services/sync';
import LoginPage from './components/LoginPage';
import ChangePasswordPage from './components/ChangePasswordPage';
import { Capacitor } from '@capacitor/core';

// Hash credenziali con Web Crypto API (nessuna dipendenza esterna)
async function hashCredentials(username, password) {
  const data = new TextEncoder().encode(`${username}:${password}:catasto-offline-v1`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Lazy: caricati solo dopo il login, riducono il bundle iniziale
const MobileHome    = lazy(() => import('./components/MobileHome'));
const MobileSidebar = lazy(() => import('./components/MobileSidebar'));
const DesktopView   = lazy(() => import('./components/DesktopView'));
const CommandBar    = lazy(() => import('./components/CommandBar'));
const AIBar         = lazy(() => import('./components/AIBar'));

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [view, setView] = useState('mobile');
  const [syncStatus, setSyncStatus] = useState({ online: false, syncing: false, lastError: null });
  const [stats, setStats] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') !== 'false');
  const [aiBarOpen, setAiBarOpen] = useState(false);

  // Ref per tracciare se initializeApp è già stato chiamato e per cleanup listener
  const initialized = useRef(false);
  const syncCleanupRef = useRef(null);
  const statusCleanupRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    const offlineUser = localStorage.getItem('offlineUser');
    const isNative = Capacitor.isNativePlatform();

    if (token && savedUser && !apiService.isTokenExpired()) {
      // Token valido: accesso automatico normale
      const parsedUser = JSON.parse(savedUser);
      setIsAuthenticated(true);
      setUser(parsedUser);
      if (parsedUser.requiresPasswordChange) {
        setRequiresPasswordChange(true);
      } else {
        initializeApp();
      }
    } else if (isNative && offlineUser) {
      // APK: token scaduto o assente, ma esiste una sessione offline salvata
      // → ripristina automaticamente senza chiedere la password
      const parsedUser = JSON.parse(offlineUser);
      setIsAuthenticated(true);
      setUser(parsedUser);
      initializeApp();
    } else if (!isNative && token && savedUser && apiService.isTokenExpired()) {
      // Desktop: token scaduto → forza logout per sicurezza
      handleLogout();
    }

    const updateView = () => {
      setView(window.innerWidth >= 768 ? 'desktop' : 'mobile');
    };

    updateView();
    window.addEventListener('resize', updateView);

    return () => window.removeEventListener('resize', updateView);
  }, []);

  const initializeApp = async () => {
    // Evita inizializzazioni multiple
    if (initialized.current) return;
    initialized.current = true;

    // Rimuovi listener precedenti prima di aggiungerne di nuovi
    if (syncCleanupRef.current) syncCleanupRef.current();
    if (statusCleanupRef.current) statusCleanupRef.current();

    apiService.connectSocket();

    syncCleanupRef.current = syncService.onSyncEvent((event, data) => {
      if (event === 'sync:start' || event === 'upload:start' || event === 'download:start') {
        setSyncStatus(prev => ({ ...prev, syncing: true, lastError: null }));
      } else if (event === 'sync:complete') {
        setSyncStatus(prev => ({ ...prev, syncing: false, lastError: null }));
        loadStats();
      } else if (event === 'upload:partial') {
        setSyncStatus(prev => ({ ...prev, syncing: false }));
        const errorMsg = `⚠️ Sync parziale: ${data.uploaded} ok, ${data.failed} falliti`;
        showToast(errorMsg, 'error');
        loadStats();
      } else if (event === 'sync:error') {
        const errorMsg = data?.message || 'Errore sconosciuto';
        setSyncStatus(prev => ({ ...prev, syncing: false, lastError: errorMsg }));
        showToast(`❌ Errore sync: ${errorMsg}`, 'error');
        loadStats();
      }
    });

    statusCleanupRef.current = syncService.onStatusChange((status) => {
      setSyncStatus(prev => ({ ...prev, online: status.online }));
    });

    await syncService.checkServerStatus();

    try {
      await syncService.fullSync();
    } catch (error) {
      console.error('Errore sync iniziale:', error);
    }

    await loadStats();
  };

  // Toast globale per database occupato (SQLITE_BUSY → HTTP 423)
  useEffect(() => {
    const handler = () => showToast('⏳ Database temporaneamente occupato, riprova tra poco.', 'error');
    window.addEventListener('api:db-busy', handler);
    return () => window.removeEventListener('api:db-busy', handler);
  }, []);

  // Shortcut Ctrl+I per aprire/chiudere AI Bar
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 'i' && isAuthenticated) {
        e.preventDefault();
        setAiBarOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isAuthenticated]);

  // Logout automatico allo scadere del token (solo desktop/Electron, non APK)
  useEffect(() => {
    if (!isAuthenticated || Capacitor.isNativePlatform()) return;

    const checkTokenExpiry = () => {
      if (apiService.isTokenExpired()) {
        showToast('⏱️ Sessione scaduta per motivi di sicurezza. Effettua nuovamente il login.', 'error');
        handleLogout();
      }
    };

    checkTokenExpiry();
    const interval = setInterval(checkTokenExpiry, 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

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

      // Salva sessione offline per l'APK (hash credenziali + dati utente)
      if (Capacitor.isNativePlatform()) {
        const hash = await hashCredentials(username, password);
        localStorage.setItem('offlineCredHash', hash);
        localStorage.setItem('offlineUser', JSON.stringify(data.user));
      }

      if (data.user.requiresPasswordChange) {
        setRequiresPasswordChange(true);
        return;
      }

      await initializeApp();
    } catch (error) {
      // Password scaduta (>90 giorni): blocca l'app sulla schermata di cambio password forzato
      if (error.code === 'PASSWORD_EXPIRED') {
        const expiredUser = { username, requiresPasswordChange: true };
        setIsAuthenticated(true);
        setUser(expiredUser);
        localStorage.setItem('user', JSON.stringify(expiredUser));
        setRequiresPasswordChange(true);
        return;
      }

      // APK: server non raggiungibile → verifica credenziali contro hash locale
      if (Capacitor.isNativePlatform()) {
        const savedHash = localStorage.getItem('offlineCredHash');
        const savedOfflineUser = localStorage.getItem('offlineUser');
        if (savedHash && savedOfflineUser) {
          const hash = await hashCredentials(username, password);
          if (hash === savedHash) {
            const offlineUser = JSON.parse(savedOfflineUser);
            setIsAuthenticated(true);
            setUser(offlineUser);
            localStorage.setItem('offlineUser', JSON.stringify(offlineUser));
            await initializeApp();
            return;
          }
        }
        throw new Error('Credenziali non valide. Connettiti al server almeno una volta per salvare la sessione offline.');
      }

      throw error;
    }
  };

  const handlePasswordChanged = async () => {
    // Il token usato per il cambio password forzato (scaduta da >90gg) ha validità breve:
    // forza un nuovo login pulito invece di proseguire la sessione con quel token
    if (!user?.id) {
      handleLogout();
      showToast('✅ Password aggiornata. Accedi nuovamente.', 'success');
      return;
    }

    const updatedUser = { ...user, requiresPasswordChange: false };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setRequiresPasswordChange(false);
    await initializeApp();
  };

  const handleLogout = () => {
    // Cleanup listeners
    if (syncCleanupRef.current) syncCleanupRef.current();
    if (statusCleanupRef.current) statusCleanupRef.current();
    syncCleanupRef.current = null;
    statusCleanupRef.current = null;
    initialized.current = false;

    apiService.clearToken();
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    setRequiresPasswordChange(false);
    setSidebarOpen(false);
    setStats(null);

    // In Electron, chiude la finestra invece di tornare al login
    if (window.desktopApi) window.close();
  };

  const handleSync = async () => {
    try {
      await syncService.fullSync();
    } catch (error) {
      console.error('Errore sincronizzazione:', error);
    }
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (requiresPasswordChange) {
    return <ChangePasswordPage onPasswordChanged={handlePasswordChanged} onLogout={handleLogout} />;
  }

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('darkMode', String(next));
      return next;
    });
  };

  const lazyFallback = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0f1e', color: '#64748b', fontSize: '0.9rem' }}>
      Caricamento...
    </div>
  );

  return (
    <div className="app" data-theme={darkMode ? 'dark' : 'light'}>
      <Suspense fallback={null}>
      <CommandBar />
      {aiBarOpen && isAuthenticated && <AIBar onClose={() => setAiBarOpen(false)} />}
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

      {view === 'mobile' && (
        <header className="header">
          <div className="container">
            <div className="header-content">
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

              <h1 className="header-title">📍 Catasto Segnaletica</h1>

              <div className="header-actions">
                <div className={`sync-status ${syncStatus.syncing ? 'syncing' : syncStatus.online ? 'online' : 'offline'}`}>
                  <span className="sync-indicator"></span>
                  {syncStatus.syncing ? 'Sync...' : syncStatus.online ? 'Online' : 'Offline'}
                </div>

                <button
                  className="btn btn-sm btn-secondary"
                  onClick={toggleDarkMode}
                  title={darkMode ? 'Modalità chiara' : 'Modalità scura'}
                  style={{ fontSize: '1rem', padding: '0.4rem 0.6rem' }}
                >
                  {darkMode ? '☀️' : '🌙'}
                </button>
              </div>
            </div>
          </div>
        </header>
      )}

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
            onLogout={handleLogout}
            onSync={handleSync}
            darkMode={darkMode}
            onToggleDarkMode={toggleDarkMode}
          />
        )}
      </main>

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
      </Suspense>
    </div>
  );
}

export default App;
