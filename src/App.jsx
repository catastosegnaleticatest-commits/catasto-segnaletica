import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import './App.css';
import { authService } from './services/authService';
import { getStats } from './services/firestoreService';
import LoginPage from './components/LoginPage';
import ChangePasswordPage from './components/ChangePasswordPage';
import { Capacitor } from '@capacitor/core';

const MobileHome    = lazy(() => import('./components/MobileHome'));
const MobileSidebar = lazy(() => import('./components/MobileSidebar'));
const DesktopView   = lazy(() => import('./components/DesktopView'));
const CommandBar    = lazy(() => import('./components/CommandBar'));
const AIBar         = lazy(() => import('./components/AIBar'));

function App() {
  const [isAuthenticated, setIsAuthenticated]       = useState(false);
  const [user, setUser]                             = useState(null);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [authLoading, setAuthLoading]               = useState(true);
  const [view, setView]                             = useState('mobile');
  const [syncStatus, setSyncStatus]                 = useState({ online: navigator.onLine, syncing: false, lastError: null });
  const [stats, setStats]                           = useState(null);
  const [sidebarOpen, setSidebarOpen]               = useState(false);
  const [toast, setToast]                           = useState(null);
  const [darkMode, setDarkMode]                     = useState(() => localStorage.getItem('darkMode') !== 'false');
  const [aiBarOpen, setAiBarOpen]                   = useState(false);

  // Ascolta lo stato auth Firebase — si ripristina automaticamente dopo refresh
  useEffect(() => {
    const unsub = authService.onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await authService.getUserProfile(firebaseUser.uid);
        if (profile) {
          setUser(profile);
          setIsAuthenticated(true);
          setRequiresPasswordChange(profile.requiresPasswordChange || false);
          if (!profile.requiresPasswordChange) loadStats();
        } else {
          // Profilo non trovato (account eliminato) → logout
          await authService.logout();
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Online/offline detector
  useEffect(() => {
    const setOnline  = () => setSyncStatus(s => ({ ...s, online: true }));
    const setOffline = () => setSyncStatus(s => ({ ...s, online: false }));
    window.addEventListener('online',  setOnline);
    window.addEventListener('offline', setOffline);
    return () => { window.removeEventListener('online', setOnline); window.removeEventListener('offline', setOffline); };
  }, []);

  // Responsive view
  useEffect(() => {
    const update = () => setView(window.innerWidth >= 768 ? 'desktop' : 'mobile');
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Shortcut Ctrl+I per AI Bar
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 'i' && isAuthenticated) { e.preventDefault(); setAiBarOpen(p => !p); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isAuthenticated]);

  const loadStats = async () => {
    try { setStats(await getStats()); } catch { /* ignora offline */ }
  };

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleLogin = async (username, password) => {
    const profile = await authService.login(username, password);
    // onAuthChange gestisce il resto — qui gestiamo solo l'errore via throw
    return profile;
  };

  const handlePasswordChanged = async () => {
    const updatedUser = { ...user, requiresPasswordChange: false };
    setUser(updatedUser);
    setRequiresPasswordChange(false);
    await loadStats();
  };

  const handleLogout = async () => {
    await authService.logout();
    setIsAuthenticated(false);
    setUser(null);
    setRequiresPasswordChange(false);
    setSidebarOpen(false);
    setStats(null);
    if (window.desktopApi) window.close();
  };

  const handleSync = async () => {
    setSyncStatus(s => ({ ...s, syncing: true }));
    try { await loadStats(); } finally { setSyncStatus(s => ({ ...s, syncing: false })); }
  };

  // Schermata di caricamento mentre Firebase ripristina la sessione
  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0f1e', color: '#64748b', fontSize: '0.9rem' }}>
        Caricamento...
      </div>
    );
  }

  if (!isAuthenticated) return <LoginPage onLogin={handleLogin} />;
  if (requiresPasswordChange) return <ChangePasswordPage onPasswordChanged={handlePasswordChanged} onLogout={handleLogout} />;

  const toggleDarkMode = () => {
    setDarkMode(prev => { const next = !prev; localStorage.setItem('darkMode', String(next)); return next; });
  };

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
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', color: 'var(--primary)' }}
              >☰</button>
              <h1 className="header-title">📍 Catasto Segnaletica</h1>
              <div className="header-actions">
                <div className={`sync-status ${syncStatus.syncing ? 'syncing' : syncStatus.online ? 'online' : 'offline'}`}>
                  <span className="sync-indicator"></span>
                  {syncStatus.syncing ? 'Sync...' : syncStatus.online ? 'Online' : 'Offline'}
                </div>
                <button className="btn btn-sm btn-secondary" onClick={toggleDarkMode} title={darkMode ? 'Modalità chiara' : 'Modalità scura'} style={{ fontSize: '1rem', padding: '0.4rem 0.6rem' }}>
                  {darkMode ? '☀️' : '🌙'}
                </button>
              </div>
            </div>
          </div>
        </header>
      )}

      <main className="main">
        {view === 'mobile' ? (
          <MobileHome user={user} syncStatus={syncStatus} stats={stats} onDataChange={loadStats} />
        ) : (
          <DesktopView user={user} syncStatus={syncStatus} stats={stats} onDataChange={loadStats} onLogout={handleLogout} onSync={handleSync} darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />
        )}
      </main>

      {toast && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', background: toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#10b981' : '#3b82f6', color: 'white', padding: '1rem 1.5rem', borderRadius: 'var(--border-radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 10000, maxWidth: '400px', fontWeight: '600' }}>
          {toast.message}
        </div>
      )}
      </Suspense>
    </div>
  );
}

export default App;
