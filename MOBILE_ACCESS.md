# 📱 Guida Accesso da Smartphone

## ✅ Configurazione Completata!

Il server è ora configurato per accettare connessioni dalla rete locale.

---

## 🔗 Come Accedere dal Telefono

### 1️⃣ Assicurati di essere sulla stessa rete Wi-Fi del PC

Il telefono e il PC devono essere connessi alla **stessa rete Wi-Fi** (wind3.hub).

### 2️⃣ Apri il browser sul telefono

Usa Chrome, Safari o qualsiasi browser mobile.

### 3️⃣ Vai all'indirizzo:

```
http://192.168.1.50:5173
```

### 4️⃣ Accedi con le credenziali

- **Username**: `admin`
- **Password**: `admin123`

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
   - Scatta la foto del segnale stradale

3. **📝 Compila Dati**
   - Seleziona il tipo di segnale (divieto, obbligo, pericolo, etc.)
   - Seleziona lo stato (ottimo, buono, discreto, danneggiato)
   - Aggiungi note opzionali

4. **💾 Salva**
   - Premi "💾 Salva Segnale"
   - I dati vengono salvati localmente sul telefono
   - Crittografati automaticamente

5. **🔄 Sincronizzazione**
   - Automatica ogni 5 minuti se il PC è acceso
   - Manuale premendo "🔄 Sincronizza" nell'header
   - Indicatore di stato: 🟢 Online / 🔴 Offline

---

## 🔧 Risoluzione Problemi

### ❌ Non riesco a connettermi

**Verifica:**
1. Telefono e PC sulla stessa rete Wi-Fi
2. Firewall di Windows non blocca la porta 3000 e 5173
3. L'indirizzo IP è corretto: `192.168.1.50`

**Soluzione Firewall:**
Se necessario, aggiungi eccezione al firewall per Node.js e Vite.

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
- **Sincronizzazione automatica** quando il PC è raggiungibile

### Indicatori di Stato

- 🟢 **Online**: Server raggiungibile, sincronizzazione attiva
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
- ✅ Tutti i dati rimangono sulla tua rete locale
- ✅ Controllo completo dei tuoi dati

---

## 📞 Supporto

Se hai problemi, verifica:
1. Entrambi i server sono in esecuzione (backend e frontend)
2. L'IP del PC è corretto
3. Firewall non blocca le connessioni
4. Stessa rete Wi-Fi

---

**Buon rilevamento! 🚦📍**
