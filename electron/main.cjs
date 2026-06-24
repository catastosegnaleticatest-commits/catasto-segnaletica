const { app, BrowserWindow, utilityProcess, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');

// Abilita GPU rasterization e bypassa la blocklist per hardware non certificato
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

let mainWindow = null;
let serverProcess = null;
const PORT = 3000;

function getResourcePath(...segments) {
    const base = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
    return path.join(base, ...segments);
}

function waitForServer(port, timeoutMs = 30000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        const tryConnect = () => {
            const socket = net.createConnection({ port, host: '127.0.0.1' }, () => {
                socket.end();
                resolve();
            });
            socket.on('error', () => {
                socket.destroy();
                if (Date.now() - start > timeoutMs) {
                    reject(new Error('Timeout avvio server backend'));
                } else {
                    setTimeout(tryConnect, 300);
                }
            });
        };
        tryConnect();
    });
}

function startBackendServer() {
    const serverEntry = getResourcePath('server', 'index.js');
    const userDataDir = app.getPath('userData');
    const dataDir = path.join(userDataDir, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    const logFile = path.join(userDataDir, 'server.log');
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    logStream.write(`\n--- avvio ${new Date().toISOString()} ---\n`);
    logStream.write(`serverEntry=${serverEntry}\n`);
    logStream.write(`exists=${fs.existsSync(serverEntry)}\n`);

    // Termina l'eventuale server precedente rimasto attivo (porta EADDRINUSE)
    const pidFile = path.join(userDataDir, 'server.pid');
    try {
        if (fs.existsSync(pidFile)) {
            const oldPid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
            if (oldPid && !isNaN(oldPid)) {
                try { process.kill(oldPid, 'SIGTERM'); } catch {}
                logStream.write(`[info] terminato processo precedente PID=${oldPid}\n`);
            }
            fs.unlinkSync(pidFile);
        }
    } catch {}

    serverProcess = utilityProcess.fork(serverEntry, [], {
        cwd: path.dirname(serverEntry),
        env: {
            ...process.env,
            PORT: String(PORT),
            CATASTO_DATA_DIR: dataDir,
            CATASTO_DIST_DIR: getResourcePath('dist'),
            CATASTO_MODEL_PATH: getResourcePath('models', 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf'),
        },
        stdio: 'pipe',
    });

    // Salva il PID per il cleanup al prossimo avvio
    if (serverProcess.pid) {
        try { fs.writeFileSync(pidFile, String(serverProcess.pid)); } catch {}
    }

    serverProcess.stdout?.on('data', (chunk) => logStream.write(`[out] ${chunk}`));
    serverProcess.stderr?.on('data', (chunk) => logStream.write(`[err] ${chunk}`));
    serverProcess.on('exit', (code) => {
        logStream.write(`[exit] code=${code}\n`);
        try { if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile); } catch {}
    });
}

function stopBackendServer() {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
}

const SPLASH_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0f1e;display:flex;align-items:center;justify-content:center;height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f8fafc}
.wrap{text-align:center;display:flex;flex-direction:column;align-items:center;gap:1.5rem}
.logo{width:72px;height:72px;border-radius:18px;background:linear-gradient(135deg,#2563eb,#4f46e5);display:flex;align-items:center;justify-content:center;font-size:2rem;box-shadow:0 0 40px rgba(37,99,235,0.4)}
h1{font-size:1.6rem;font-weight:700;letter-spacing:-0.02em}
p{color:#64748b;font-size:0.9rem}
.bar{width:220px;height:3px;background:#1e293b;border-radius:9999px;overflow:hidden}
.bar-fill{height:100%;border-radius:9999px;background:linear-gradient(90deg,#2563eb,#4f46e5);animation:load 1.8s ease-in-out infinite}
@keyframes load{0%{width:0;margin-left:0}50%{width:60%;margin-left:20%}100%{width:0;margin-left:100%}}
</style></head><body><div class="wrap">
<div class="logo">🛣️</div>
<div><h1>Catasto Segnaletica</h1><p style="margin-top:0.3rem">Sistema Gestione Infrastruttura Viaria</p></div>
<div><div class="bar"><div class="bar-fill"></div></div><p style="margin-top:0.75rem">Avvio in corso...</p></div>
</div></body></html>`;

async function createWindow() {
    mainWindow = new BrowserWindow({
        show: false,
        backgroundColor: '#0a0f1e',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs'),
        },
    });
    mainWindow.setMenu(null);

    // Mostra splash immediatamente — l'utente vede qualcosa subito
    await mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(SPLASH_HTML));
    mainWindow.show();
    mainWindow.maximize(); // dopo show() per garantire la massimizzazione su Windows

    // Aspetta il server in background, poi carica l'app reale
    try {
        await waitForServer(PORT);
        await mainWindow.loadURL(`http://localhost:${PORT}`);
    } catch (err) {
        await mainWindow.loadURL(
            'data:text/html;charset=utf-8,' + encodeURIComponent(
                `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#0a0f1e;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.box{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:2rem;max-width:480px;text-align:center}h2{color:#f87171;margin-bottom:1rem}pre{color:#94a3b8;font-size:0.8rem;text-align:left;background:#0f172a;padding:1rem;border-radius:8px;overflow:auto}</style></head><body><div class="box"><h2>⚠️ Errore avvio server</h2><pre>${err.message}</pre></div></body></html>`
            )
        );
    }
}

function setupAutoUpdater() {
    // electron-updater: disponibile solo nell'app pacchettizzata
    if (!app.isPackaged) return;
    let autoUpdater;
    try {
        autoUpdater = require('electron-updater').autoUpdater;
    } catch {
        return; // pacchetto non installato: skip silenzioso
    }

    autoUpdater.autoDownload = false;
    autoUpdater.logger = null;

    autoUpdater.on('update-available', (info) => {
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Aggiornamento disponibile',
            message: `Versione ${info.version} disponibile.\nVuoi scaricarla ora?`,
            buttons: ['Sì, scarica', 'Dopo'],
            defaultId: 0,
        }).then(({ response }) => {
            if (response === 0) autoUpdater.downloadUpdate();
        });
    });

    autoUpdater.on('update-downloaded', () => {
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Aggiornamento pronto',
            message: 'Il nuovo aggiornamento è pronto. Riavvia l\'applicazione per installarlo.',
            buttons: ['Riavvia ora', 'Più tardi'],
            defaultId: 0,
        }).then(({ response }) => {
            if (response === 0) autoUpdater.quitAndInstall(false, true);
        });
    });

    autoUpdater.on('error', (err) => {
        console.error('[AUTO-UPDATE] Errore:', err.message);
    });

    // Controlla aggiornamenti 5 secondi dopo l'avvio (non blocca il lancio)
    setTimeout(() => {
        try { autoUpdater.checkForUpdates(); } catch {}
    }, 5000);
}

app.whenReady().then(() => {
    startBackendServer();
    createWindow().then(() => {
        setupAutoUpdater();
    });
});

app.on('window-all-closed', () => {
    stopBackendServer();
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    stopBackendServer();
});
