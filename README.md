# Catasto Segnaletica Stradale 📍

> **⚠️ AVVISO DI PROPRIETÀ INTELLETTUALE**  
> Questo software è di proprietà esclusiva del titolare del copyright.  
> È vietata la riproduzione, la distribuzione, la modifica o l'utilizzo senza autorizzazione scritta.  
> Tutti i diritti riservati. Per informazioni contattare il titolare del copyright.

---

Applicazione web per la gestione del catasto della segnaletica stradale con interfaccia mobile per il rilevamento sul campo e interfaccia desktop per la gestione completa.

## 🎯 Caratteristiche Principali

### 📱 Interfaccia Mobile
- Acquisizione foto con camera del telefono
- Geolocalizzazione GPS automatica
- Salvataggio dati offline con crittografia
- Sincronizzazione automatica quando il server è disponibile

### 💻 Interfaccia Desktop
- Mappa interattiva con tutti i segnali
- Archivio completo con filtri
- Gestione interventi programmati
- Dashboard con statistiche

### 🔐 Sicurezza
- Database SQLite crittografato
- Foto crittografate con AES-256
- Autenticazione JWT
- Comunicazione sicura HTTPS/WSS

### 🔄 Sincronizzazione P2P
- Upload/Download tra mobile e PC ufficio
- Modalità offline con queue di sincronizzazione
- Auto-sync ogni 5 minuti quando il server è disponibile
- Nessuna dipendenza da cloud terzi

## 🚀 Avvio Rapido

### 1. Avvia il Backend (PC Ufficio)

```bash
cd server
npm start
```

Il server sarà disponibile su `http://localhost:3000`

### 2. Avvia il Frontend

```bash
npm run dev
```

L'applicazione sarà disponibile su `http://localhost:5173`

### 3. Accedi all'applicazione

**Credenziali di default:**
- Username: `admin`
- Password: `admin123`

## 📂 Struttura Progetto

```
CatastoSegnaletica/
├── server/                 # Backend Node.js
│   ├── index.js           # Server Express + WebSocket
│   ├── data/              # Database e foto crittografate
│   └── .env               # Configurazione
├── src/
│   ├── components/        # Componenti React
│   │   ├── LoginPage.jsx
│   │   ├── MobileView.jsx
│   │   └── DesktopView.jsx
│   ├── services/          # Servizi
│   │   ├── api.js         # Comunicazione con backend
│   │   ├── localStorage.js # Storage locale IndexedDB
│   │   └── sync.js        # Sincronizzazione P2P
│   ├── App.jsx
│   └── index.css
└── package.json
```

## 🔧 Configurazione

### Backend (.env)
```env
PORT=3000
JWT_SECRET=your-super-secret-jwt-key
ENCRYPTION_KEY=your-32-byte-hex-encryption-key
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3000
```

## 📱 Utilizzo Mobile

1. **Accedi** con le credenziali
2. **Acquisisci posizione GPS** premendo il pulsante 📍
3. **Scatta foto** del segnale con il pulsante 📷
4. **Compila i dati** (tipo, stato, note)
5. **Salva** - I dati vengono salvati localmente e sincronizzati automaticamente

## 💻 Utilizzo Desktop

### Mappa
Visualizza tutti i segnali su mappa interattiva con marker cliccabili

### Archivio
Tabella completa di tutti i segnali con filtri e ricerca

### Interventi
Gestione e programmazione interventi di manutenzione

## 🔄 Sincronizzazione

### Automatica
- Ogni 5 minuti se il server è raggiungibile
- Indicatore di stato in tempo reale

### Manuale
- Pulsante "🔄 Sincronizza" nell'header
- Sincronizza immediatamente tutti i dati pendenti

### Offline
- Tutti i dati vengono salvati localmente
- Queue di sincronizzazione gestisce le operazioni pendenti
- Foto crittografate con AES-256

## 🛠️ Tecnologie Utilizzate

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: SQLite (better-sqlite3)
- **Mappe**: Leaflet + React-Leaflet
- **Storage Locale**: IndexedDB (idb)
- **Crittografia**: crypto-js, Node.js crypto
- **Real-time**: Socket.IO
- **Autenticazione**: JWT + bcrypt

## 📝 Note di Sicurezza

⚠️ **IMPORTANTE**: Prima di utilizzare in produzione:

1. Cambia `JWT_SECRET` in `.env` del server
2. Genera una nuova `ENCRYPTION_KEY` con:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. Configura HTTPS per comunicazioni sicure
4. Cambia la password dell'utente admin

## 🤝 Supporto

Per problemi o domande, consulta la documentazione o contatta il supporto tecnico.

---

## 📄 Copyright e Proprietà Intellettuale

**Copyright © 2025 Marcello Berneri. Tutti i diritti riservati.**

Questo software e la relativa documentazione sono protetti da copyright e sono di 
proprietà esclusiva del titolare del copyright. È vietata qualsiasi forma di 
riproduzione, distribuzione, modifica o utilizzo senza autorizzazione scritta.

Per informazioni su licenze, autorizzazioni o utilizzo commerciale, contattare 
il titolare del copyright.

---

Sviluppato per la gestione efficiente del catasto della segnaletica stradale 🚦
