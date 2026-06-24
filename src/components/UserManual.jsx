import { useState, useRef } from 'react';

const SECTIONS = [
    {
        id: 'intro',
        title: '1. Introduzione',
        icon: '📖',
        content: `
**Catasto Segnaletica** è un'applicazione desktop nativa (Electron) per la gestione integrata della segnaletica stradale, dei dissesti, degli interventi di manutenzione e dei contratti d'appalto comunali.

**Architettura:**
- **Frontend**: React + Vite, eseguito dentro Electron
- **Backend**: Node.js + Express, avviato automaticamente all'apertura dell'app
- **Database**: SQLite in modalità WAL (Write-Ahead Logging) per accesso multi-utente sicuro
- **Dati**: salvati in %APPDATA%\\catastosegnaletica\\data\\

**Multi-utente su rete condivisa:**
La modalità WAL permette a più operatori di leggere il database contemporaneamente anche mentre un altro sta scrivendo. Se il DB è occupato, l'app mostra un toast arancione e riprova automaticamente.

**Avvio:**
Fare doppio clic su *Catasto Segnaletica.exe* oppure usare il collegamento sul desktop. Il backend si avvia in background; attendere il messaggio "Online" nella barra in alto.
        `.trim()
    },
    {
        id: 'shortcuts',
        title: '2. Scorciatoie da Tastiera',
        icon: '⌨️',
        content: `
| Scorciatoia | Funzione |
|---|---|
| **Ctrl + F** | Apri/chiudi la Command Bar (feedback e segnalazioni QA) |
| **Ctrl + I** | Apri/chiudi la AI Bar (domande in linguaggio naturale sul DB) |
| **Esc** | Chiudi qualsiasi overlay/modal aperto |
| **F5** | Aggiorna la pagina (non consigliato durante operazioni) |

**Command Bar (Ctrl+F):**
Permette di inviare feedback, bug report o suggerimenti. Il testo viene analizzato dall'AI locale e categorizzato automaticamente (bug / suggerimento / apprezzamento) e salvato in formato JSON nella cartella feedback/.

**AI Bar (Ctrl+I):**
Permette di interrogare il database in italiano naturale. Esempi:
- "Quanti cartelli sono danneggiati in Via Roma?"
- "Qual è il costo stimato per sostituire i segnali di precedenza?"
- "Mostra gli interventi programmati per questa settimana"

Richiede il modello AI (.gguf) installato in resources/models/.
        `.trim()
    },
    {
        id: 'desktop-nav',
        title: '3. Navigazione Desktop',
        icon: '🖥️',
        content: `
La vista desktop si divide in **tab** nella barra superiore:

| Tab | Ruolo | Descrizione |
|---|---|---|
| 📊 Dashboard | Tutti | KPI, bento grid, matrice urgenza interventi, alert scadenze |
| 🗺️ Mappa | Tutti | Mappa Leaflet con marker, clustering, filtri e popup |
| 📋 Archivio | Tutti | Tabella segnali con filtri, ordinamento, esportazione CSV |
| 🔧 Interventi | Tutti | Gestione interventi, stato, costi, collegamento appalto |
| 🏗️ Censimento Virtuale | Tutti | Import masse da file CSV/shapefile |
| 🕳️ Dissesti | Tutti | Gestione buche e dissesti stradali con priorità |
| ➡️ Segnaletica Orizz. | Tutti | Gestione strisce e segnaletica orizzontale |
| 🚦 Semafori | Tutti | Impianti semaforici e manutenzione |
| 📑 Appalti | Admin/Tecnico | Contratti, listino prezzi, impegni di spesa |
| 🚧 Varianti Traffico | Admin/Tecnico | Simulazione deviazioni e varianti viabilistiche |
| 👥 Utenti | Solo Admin | Gestione utenti, ruoli, backup DB, reset |
| 🏛️ Tributi | Admin/Tecnico | Segnalazioni ufficio tributi (passi carrabili) |
| 📋 Audit Log | Solo Admin | Registro completo di tutte le operazioni |
| 📚 Manuale | Tutti | Questo manuale |

**Aggiunta segnale:**
1. Cliccare "➕ Nuovo Segnale" in qualsiasi tab
2. Selezionare il tipo e lo stato
3. Premere "📍 Rileva GPS" (il bottone "🔍 Indirizzo" popola automaticamente il campo via via Nominatim OpenStreetMap)
4. Caricare la foto (opzionale)
5. Salvare
        `.trim()
    },
    {
        id: 'mobile',
        title: '4. Vista Mobile (Campo)',
        icon: '📱',
        content: `
La vista mobile si attiva automaticamente su schermi < 768px (smartphone/tablet).

**Flusso tipico operatore sul campo:**
1. Aprire l'app sul telefono collegato via **cavo USB** al PC con il server
2. Configurare l'IP del server (sezione "Impostazioni Connessione" nella home mobile)
3. Inserire il nuovo segnale con foto e GPS
4. Il segnale viene salvato localmente in **IndexedDB** (crittografato, offline-first)
5. Premere "Sincronizza via USB" per inviare al server centrale

**Archiviazione offline:**
Tutti i dati mobili vengono salvati nell'IndexedDB del browser con crittografia AES-256. Se lo spazio disponibile scende sotto 100 MB appare un avviso arancione.

**Risoluzione conflitti (Last-Write-Wins):**
Se lo stesso segnale viene modificato sia dal mobile che dal desktop tra due sync, vince la versione più recente (timestamp). I conflitti vengono marcati per revisione manuale.

**Avviso GPS:**
Il GPS deve avere precisione ≤ 15 metri. Se la precisione è maggiore, il salvataggio è bloccato finché il segnale migliora.
        `.trim()
    },
    {
        id: 'wal',
        title: '5. Database WAL e Multi-Accesso',
        icon: '🗄️',
        content: `
Il database SQLite usa la modalità **WAL (Write-Ahead Logging)**:

**Vantaggi:**
- Più lettori contemporanei senza blocchi
- Un solo scrittore alla volta (con retry automatico fino a 10 secondi)
- Maggiore velocità su SSD/NAS

**Backup automatici:**
- All'avvio del server viene creato uno snapshot giornaliero in %APPDATA%\\catastosegnaletica\\data\\backups\\
- Vengono mantenuti gli ultimi 7 backup (rotazione automatica)
- Da "👥 Utenti → Backup Automatici" si può creare uno snapshot manuale immediato
- Il pulsante "💾 Scarica Backup Completo" genera uno ZIP con DB + foto + codice sorgente

**Cosa fare in caso di errore "Database occupato":**
1. Attendere il toast arancione "Database temporaneamente occupato"
2. Riprovare dopo qualche secondo
3. Se persiste, verificare che non ci siano altri processi che tengono il file aperto

**Percorso database:**
%APPDATA%\\catastosegnaletica\\data\\catasto.db

**Percorso log server:**
%APPDATA%\\catastosegnaletica\\server.log
        `.trim()
    },
    {
        id: 'sync',
        title: '6. Sincronizzazione USB',
        icon: '🔌',
        content: `
La sincronizzazione è pensata per scenari senza Wi-Fi (campo aperto, zone industriali).

**Procedura sync via cavo USB:**
1. Collegare lo smartphone al PC tramite cavo USB
2. Abilitare il **tethering USB** sullo smartphone (Impostazioni > Connessione > Hotspot > Tethering USB)
3. Nell'app mobile, configurare l'IP del PC (es. 192.168.42.129:3000) in "Impostazioni Connessione"
4. Premere "🔌 Sincronizza via USB"

**Trovare l'IP del PC:**
Aprire il Prompt dei comandi e digitare ipconfig. Cercare "Indirizzo IPv4" sotto "Scheda Ethernet USB" o simile.

**Ordine di sync (full sync bidirezionale):**
1. Upload: dati locali del mobile → server centrale
2. Download: aggiornamenti dal server → mobile
3. Risoluzione conflitti: Last-Write-Wins su ogni record

**Force Resync:**
Il pulsante "🔄 Forza Ricaricamento" azzera i flag di sync locale e ricarica tutto dal server (utile dopo un ripristino DB).
        `.trim()
    },
    {
        id: 'priority',
        title: '7. Matrice di Urgenza',
        icon: '🚨',
        content: `
La **Matrice di Urgenza Interventi** (tab Dashboard) ordina automaticamente i lavori programmati per priorità.

**Formula PriorityScore:**
PriorityScore = (Peso Tipo Segnale × Peso Gravità) + Peso Strada

**Pesi Tipo Segnale:**
- Precedenza/STOP: 10
- Pericolo: 8
- Divieto: 7
- Obbligo: 5
- Indicazione: 3
- Passo Carrabile: 2

**Pesi Gravità (stato segnale):**
- Rimosso: 5
- Danneggiato: 4
- Da Sostituire: 3
- Discreto/Buono: 1-2

**Peso Strada:**
- Via principale/statale/provinciale/corso/viale: 4
- Altre vie: 2

**Colori di urgenza:**
- 🔴 Rosso (Score ≥ 20): intervento urgente
- 🟡 Giallo (Score 10-19): media priorità
- 🟢 Verde (Score < 10): bassa priorità

**Storico Sinistri:**
Dal tab "Utenti" (o via API) è possibile inserire incidenti stradali. Il sistema calcola automaticamente la correlazione spaziale (entro 50 metri) con segnali danneggiati o rimossi alla data dell'incidente, per supportare la difesa legale del Comune.
        `.trim()
    },
    {
        id: 'geocoding',
        title: '8. Geocoding OpenStreetMap',
        icon: '📍',
        content: `
Il sistema usa **Nominatim (OpenStreetMap)** per il reverse geocoding: converte le coordinate GPS in indirizzo stradale.

**Come funziona:**
1. Premere "📍 Rileva GPS" → le coordinate vengono acquisite
2. Automaticamente viene chiamato Nominatim in background
3. Il campo "Tratto stradale (via)" si popola con l'indirizzo trovato (es. "Via Roma 14 — Comune")
4. Se il GPS è già noto, premere "🔍 Indirizzo" per ricercare l'indirizzo manualmente

**Note:**
- Richiede connessione internet
- Se offline, il campo rimane vuoto ma il salvataggio avviene comunque
- L'indirizzo trovato è modificabile manualmente prima di salvare
- La precisione dipende dalla qualità dei dati OSM nella zona
        `.trim()
    },
    {
        id: 'backup-update',
        title: '9. Backup e Aggiornamenti',
        icon: '💾',
        content: `
**Backup automatici (sempre attivi):**
- Ogni giorno all'avvio del server viene creato uno snapshot del DB
- Massimo 7 file mantenuti (rotazione automatica)
- Posizione: %APPDATA%\\catastosegnaletica\\data\\backups\\

**Backup manuale:**
- Da "👥 Utenti → 📸 Snapshot ora": crea subito un backup on-demand
- Da "👥 Utenti → 💾 Scarica Backup Completo": genera ZIP con tutto (DB + foto + sorgente)

**Aggiornamenti automatici (electron-updater):**
Se configurato con un server di aggiornamento (variabile UPDATE_SERVER_URL), l'app controlla automaticamente nuove versioni all'avvio.
- Al rilevamento → dialog "Versione X.Y disponibile, scaricare?"
- Dopo download → dialog "Riavvia per installare"
- Il riavvio installa silenziosamente la nuova versione

**Versione attuale:** v1.0.0

**Installazione da zero (NSIS Installer):**
Usare il file *Catasto Segnaletica-X.X.X-Setup-x64.exe* per installare con collegamento desktop e menu Start.
Per la versione portabile, usare *Catasto Segnaletica-X.X.X-x64.exe* (non richiede installazione).
        `.trim()
    },
];

function renderContent(text) {
    const lines = text.split('\n');
    const result = [];
    let inTable = false;
    let tableRows = [];
    let i = 0;

    const flushTable = () => {
        if (tableRows.length > 0) {
            const [header, , ...body] = tableRows;
            const cols = header.split('|').filter(c => c.trim());
            result.push(
                <div key={`table-${result.length}`} style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ background: 'var(--gray-100)', borderBottom: '2px solid var(--gray-200)' }}>
                                {cols.map((c, j) => <th key={j} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: '600' }}>{c.trim()}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {body.map((row, ri) => {
                                const cells = row.split('|').filter(c => c.trim() !== undefined).slice(1, -1);
                                return (
                                    <tr key={ri} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                                        {cells.map((c, ci) => <td key={ci} style={{ padding: '0.5rem 0.75rem' }} dangerouslySetInnerHTML={{ __html: c.trim().replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />)}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            );
            tableRows = [];
            inTable = false;
        }
    };

    while (i < lines.length) {
        const line = lines[i];
        if (line.startsWith('|')) {
            inTable = true;
            tableRows.push(line);
            i++;
            continue;
        }
        if (inTable) flushTable();

        if (!line.trim()) { result.push(<br key={i} />); i++; continue; }

        if (line.startsWith('**') && line.endsWith('**')) {
            result.push(<h4 key={i} style={{ fontWeight: '700', marginTop: '1rem', marginBottom: '0.25rem', color: 'var(--gray-800)' }}>{line.slice(2, -2)}</h4>);
        } else if (line.startsWith('- ')) {
            result.push(<li key={i} style={{ marginLeft: '1.25rem', marginBottom: '0.2rem' }} dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />);
        } else {
            result.push(<p key={i} style={{ marginBottom: '0.5rem' }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />);
        }
        i++;
    }
    if (inTable) flushTable();
    return result;
}

function UserManual() {
    const [search, setSearch] = useState('');
    const [activeSection, setActiveSection] = useState('intro');
    const contentRef = useRef(null);

    const filtered = search.trim()
        ? SECTIONS.filter(s =>
            s.title.toLowerCase().includes(search.toLowerCase()) ||
            s.content.toLowerCase().includes(search.toLowerCase())
        )
        : SECTIONS;

    const current = SECTIONS.find(s => s.id === activeSection) || SECTIONS[0];

    const highlight = (text) => {
        if (!search.trim()) return text;
        const re = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(re, '<mark style="background:#fef08a;border-radius:2px">$1</mark>');
    };

    return (
        <div style={{ display: 'flex', height: '100%', minHeight: 0, gap: 0 }}>
            {/* Sidebar TOC */}
            <div style={{
                width: '240px', flexShrink: 0, borderRight: '1px solid var(--gray-200)',
                display: 'flex', flexDirection: 'column', background: 'var(--gray-50)'
            }}>
                <div style={{ padding: '1rem' }}>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="🔍 Cerca nel manuale..."
                        style={{
                            width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px',
                            border: '1px solid var(--gray-300)', fontSize: '0.875rem',
                            background: 'var(--gray-100)'
                        }}
                    />
                </div>
                <nav style={{ overflowY: 'auto', flex: 1, padding: '0 0.5rem 1rem' }}>
                    {filtered.map(s => (
                        <button
                            key={s.id}
                            onClick={() => { setActiveSection(s.id); setSearch(''); }}
                            style={{
                                width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem',
                                borderRadius: '8px', border: 'none', cursor: 'pointer',
                                fontSize: '0.85rem', fontWeight: activeSection === s.id ? '700' : '400',
                                background: activeSection === s.id ? 'var(--primary)' : 'transparent',
                                color: activeSection === s.id ? 'white' : 'var(--gray-700)',
                                marginBottom: '0.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
                            }}
                        >
                            <span>{s.icon}</span>
                            <span>{s.title}</span>
                        </button>
                    ))}
                    {filtered.length === 0 && (
                        <p style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--gray-400)' }}>Nessun risultato</p>
                    )}
                </nav>
            </div>

            {/* Content */}
            <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
                <div style={{ maxWidth: '760px' }}>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.25rem', color: 'var(--gray-900)' }}>
                            {current.icon} {current.title}
                        </h2>
                        <div style={{ height: '3px', width: '48px', background: 'var(--primary)', borderRadius: '999px' }} />
                    </div>
                    <div style={{ lineHeight: 1.7, color: 'var(--gray-700)', fontSize: '0.925rem' }}>
                        {search.trim() ? (
                            <div dangerouslySetInnerHTML={{ __html: highlight(current.content).replace(/\n/g, '<br/>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
                        ) : (
                            renderContent(current.content)
                        )}
                    </div>

                    {/* Navigazione sezione */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--gray-200)' }}>
                        {SECTIONS.findIndex(s => s.id === current.id) > 0 && (
                            <button
                                className="btn btn-secondary"
                                onClick={() => setActiveSection(SECTIONS[SECTIONS.findIndex(s => s.id === current.id) - 1].id)}
                                style={{ fontSize: '0.875rem' }}
                            >
                                ← Precedente
                            </button>
                        )}
                        <div />
                        {SECTIONS.findIndex(s => s.id === current.id) < SECTIONS.length - 1 && (
                            <button
                                className="btn btn-primary"
                                onClick={() => setActiveSection(SECTIONS[SECTIONS.findIndex(s => s.id === current.id) + 1].id)}
                                style={{ fontSize: '0.875rem' }}
                            >
                                Successivo →
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default UserManual;
