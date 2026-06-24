# 📱 Guida Accesso da Smartphone (via Cavo USB)

## ✅ Configurazione Completata!

Il server è configurato per accettare connessioni dal telefono collegato al PC
tramite **cavo USB e tethering**, senza bisogno del Wi-Fi.

---

## 🔌 Come Connettere il Telefono al PC via USB

### 1️⃣ Collega il telefono al PC con il cavo USB

Usa un cavo USB dati (non solo di ricarica) per collegare lo smartphone al PC.

### 2️⃣ Attiva il "Tethering USB"

#### 📱 Su Android

1. Apri **Impostazioni**
2. Vai su **Rete e Internet** (o **Connessioni**) → **Hotspot e tethering**
3. Attiva l'interruttore **Tethering USB**
   - Se richiesto, conferma di voler condividere la connessione dati/internet del telefono con il PC
4. Attendi qualche secondo: Windows installerà automaticamente la rete "Ethernet USB" / "Remote NDIS"

> 💡 Su alcuni modelli il percorso è: **Impostazioni → Connessioni → Hotspot mobile e tethering → Tethering USB**

#### 📱 Su iPhone (iOS)

1. Apri **Impostazioni**
2. Vai su **Hotspot Personale**
3. Attiva **Hotspot Personale** (deve essere attivo per poter condividere via USB)
4. Collega il cavo Lightning/USB-C al PC
5. Se richiesto sul telefono, tocca **Autorizza** per fidarti del computer
6. Windows installerà automaticamente la rete "iPhone USB"

### 3️⃣ Verifica che il PC abbia ricevuto un nuovo indirizzo di rete

Dopo qualche secondo dal collegamento, il PC riceve un nuovo indirizzo IP
sull'interfaccia USB (es. `192.168.42.x` per Android o `172.20.10.x` per iPhone).
Non serve configurare nulla manualmente: lo vedrai direttamente nel terminale
del server (vedi punto successivo).

---

## 🖥️ Trovare l'IP Corretto sul PC

### 1️⃣ Avvia il server backend

Nella cartella `server/`, esegui:

```
npm start
```

oppure, in modalità sviluppo:

```
npm run dev
```

### 2️⃣ Leggi gli indirizzi stampati nel terminale

All'avvio, il server stampa **tutti gli indirizzi IP locali disponibili**, ad esempio:

```
🚀 Server Catasto Segnaletica avviato!
📡 HTTP Server: http://localhost:3000
📡 Indirizzi di rete disponibili (da usare sullo smartphone):
   - http://192.168.42.129:3000  (Ethernet USB Android)
   - http://172.20.10.2:3000     (iPhone USB)
🔌 WebSocket Server: ws://localhost:3000
```

### 3️⃣ Scegli l'indirizzo dell'interfaccia USB

- Per **Android**, l'indirizzo tipico è del tipo `192.168.42.x` o `192.168.137.x`
- Per **iPhone**, l'indirizzo tipico è del tipo `172.20.10.x`

Annota l'indirizzo completo, ad esempio:

```
http://192.168.42.129:3000
```

### 4️⃣ Avvia anche il frontend

Nella cartella principale del progetto, esegui:

```
npm run dev
```

Vite stamperà a sua volta gli indirizzi disponibili per l'interfaccia web
(porta predefinita `5173`). Usa lo **stesso indirizzo IP USB** trovato al
punto precedente ma con la porta `5173`, ad esempio:

```
http://192.168.42.129:5173
```

---

## 📲 Configurare l'App sul Telefono

### 1️⃣ Apri il browser sul telefono

Usa Chrome o Safari e vai all'indirizzo del frontend trovato sopra, ad esempio:

```
http://192.168.42.129:5173
```

### 2️⃣ Accedi con le credenziali

- **Username**: `admin`
- **Password**: quella generata/configurata all'avvio del server (vedi terminale o `.env`)

### 3️⃣ Configura l'indirizzo del server (se cambia)

Se l'IP USB del PC cambia (es. dopo un riavvio o un nuovo collegamento), aggiorna
l'indirizzo direttamente dall'app mobile:

1. Nella schermata principale, tocca **⚙️ Configura indirizzo server ufficio**
2. Inserisci il nuovo indirizzo, ad esempio `http://192.168.42.129:3000`
3. Tocca **💾 Salva indirizzo**

L'app salverà l'indirizzo e si riconnetterà automaticamente al server.

---

## 🔄 Avviare la Sincronizzazione

La sincronizzazione **non è più automatica/periodica**: va avviata manualmente
quando il telefono è collegato via USB.

1. Collega il telefono al PC e attiva il **Tethering USB** (vedi sopra)
2. Apri l'app sul telefono (assicurati che l'indirizzo del server sia corretto)
3. Nella schermata principale, premi il pulsante:

   **🔌 Sincronizza Dati (Via Cavo USB)**

4. Attendi il messaggio di conferma "Sincronizzazione via cavo completata!"

Durante la sincronizzazione:
- I segnali e gli interventi salvati localmente sul telefono vengono caricati sul server
- I dati aggiornati sul server vengono scaricati sul telefono
- Eventuali conflitti (modifiche più recenti sul server) vengono segnalati come
  "richiede revisione" per il controllo da desktop

---

## 📱 Interfaccia Mobile

Una volta effettuato l'accesso, vedrai l'interfaccia mobile ottimizzata con:

### 🎯 Funzionalità Disponibili

1. **📍 Acquisisci Posizione GPS**
   - Premi il pulsante "📍 Acquisisci Posizione"
   - Il browser chiederà il permesso di accedere alla posizione
   - Autorizza per ottenere le coordinate GPS

2. **📷 Scatta Foto**
   - Premi il pulsante "📷 Scatta Foto"
   - Si aprirà la camera del telefono
   - La foto viene automaticamente compressa (max 1920px, JPEG) prima del salvataggio

3. **📝 Compila Dati**
   - Seleziona il tipo di segnale (divieto, obbligo, pericolo, etc.)
   - Seleziona lo stato (ottimo, buono, discreto, danneggiato)
   - Aggiungi note opzionali

4. **💾 Salva**
   - Premi "💾 Salva Segnale"
   - I dati vengono salvati localmente sul telefono
   - Crittografati automaticamente

5. **🔌 Sincronizzazione via USB**
   - Solo manuale, tramite il pulsante "🔌 Sincronizza Dati (Via Cavo USB)"
   - Indicatore di stato: 🟢 Online / 🔴 Offline

---

## 🔧 Risoluzione Problemi

### ❌ Non riesco a connettermi

**Verifica:**
1. Il cavo USB è collegato e il **Tethering USB** è attivo sul telefono
2. Windows ha riconosciuto la nuova interfaccia di rete USB (controlla in
   "Impostazioni di rete" che compaia una connessione Ethernet/RNDIS)
3. L'indirizzo IP usato è quello stampato dal server all'avvio (interfaccia USB,
   non Wi-Fi)
4. Firewall di Windows non blocca le porte 3000 e 5173

**Soluzione Firewall:**
Se necessario, aggiungi eccezione al firewall per Node.js e Vite.

### ❌ L'IP è cambiato e l'app non si connette più

1. Riavvia il server (`npm start` in `server/`) e leggi il nuovo indirizzo
   stampato nel terminale
2. Sull'app mobile, apri **⚙️ Configura indirizzo server ufficio**, inserisci
   il nuovo indirizzo e premi **💾 Salva indirizzo**

### ❌ GPS non funziona

**Verifica:**
1. Hai autorizzato il browser ad accedere alla posizione
2. Sei all'aperto o in una posizione con buona ricezione GPS
3. Il browser supporta la geolocalizzazione (Chrome/Safari consigliati)

### ❌ Camera non si apre

**Verifica:**
1. Hai autorizzato il browser ad accedere alla camera
2. Nessun'altra app sta usando la camera
3. Usa Chrome o Safari (browser consigliati)

---

## 📊 Modalità Offline

### Come Funziona

- **Tutti i dati vengono salvati localmente** sul telefono
- **Crittografati con AES-256** per sicurezza
- **Queue di sincronizzazione** accumula le operazioni
- **Sincronizzazione manuale via USB** quando si preme l'apposito pulsante

### Indicatori di Stato

- 🟢 **Online**: Server raggiungibile, sincronizzazione possibile
- 🔴 **Offline**: Dati salvati localmente, sincronizzazione in attesa
- 🟡 **Sincronizzazione...**: Upload/download in corso

### Statistiche

Nella parte alta dell'interfaccia mobile vedrai:
- **Segnali Locali**: Numero di segnali salvati sul telefono
- **Da Sincronizzare**: Numero di operazioni in attesa di sync

---

## 🎨 Screenshot Interfaccia Mobile

L'interfaccia si adatta automaticamente allo schermo del telefono con:
- Form semplificato e touch-friendly
- Pulsanti grandi per facile utilizzo
- Preview foto immediata
- Feedback visivo per ogni azione

---

## 🔐 Sicurezza

### Dati Protetti

- ✅ Foto crittografate con AES-256
- ✅ Database locale crittografato
- ✅ Comunicazione autenticata con JWT
- ✅ Password hashate con bcrypt

### Privacy

- ❌ **Nessun dato inviato a cloud terzi**
- ✅ Connessione diretta PC-telefono via cavo USB
- ✅ Controllo completo dei tuoi dati

---

## 📞 Supporto

Se hai problemi, verifica:
1. Entrambi i server sono in esecuzione (backend e frontend)
2. Il cavo USB è collegato e il Tethering USB è attivo
3. L'IP usato nell'app corrisponde a quello stampato dal server all'avvio
4. Firewall non blocca le connessioni

---

**Buon rilevamento! 🚦📍**
