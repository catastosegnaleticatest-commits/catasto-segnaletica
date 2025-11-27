# 💻 Sviluppo Locale - Guida Completa

## 🎯 Perché Sviluppare in Locale?

**Problema**: Ogni commit → Deploy automatico → Consumo di build minutes e bandwidth

**Soluzione**: Sviluppa e testa in locale, fai deploy solo quando tutto è pronto!

### Vantaggi:
- ✅ **Nessun consumo** di limiti Netlify/Vercel
- ✅ **Test immediati** senza attendere deploy
- ✅ **Debug più facile** con console e dev tools
- ✅ **Deploy solo quando necessario** (1-2 volte al giorno invece di 10-20)

---

## 🚀 Setup Sviluppo Locale

### 1. Installa Dipendenze

```bash
npm install
```

### 2. Configura Environment Variables

Crea un file `.env.local` nella root del progetto:

```env
VITE_API_URL=https://catasto-segnaletica.onrender.com
```

**Nota**: Il file `.env.local` è già nel `.gitignore`, quindi non verrà committato.

**Come creare il file**:
- Windows: Crea un nuovo file di testo chiamato `.env.local` (senza estensione)
- Linux/Mac: `touch .env.local` nel terminale
- Poi aggiungi la riga sopra con il tuo editor

### 3. Avvia Server di Sviluppo

```bash
npm run dev
```

Il server si avvierà su: `http://localhost:5173` (o altra porta se occupata)

### 4. Apri nel Browser

Apri `http://localhost:5173` nel browser e vedrai l'applicazione in tempo reale.

---

## 🔄 Workflow Consigliato

### Flusso di Lavoro Ottimale:

```
1. Lavora in Locale
   ↓
2. Testa tutto (funzionalità, UI, bug)
   ↓
3. Commit quando tutto funziona
   ↓
4. Push → Deploy automatico (solo quando necessario)
```

### Esempio Pratico:

**❌ SBAGLIATO** (consuma molti build):
```
Modifica 1 → Commit → Push → Deploy (2 min)
Modifica 2 → Commit → Push → Deploy (2 min)
Modifica 3 → Commit → Push → Deploy (2 min)
...
Totale: 20 deploy = 40 minuti build consumati
```

**✅ GIUSTO** (consuma pochi build):
```
Modifica 1 → Test locale ✅
Modifica 2 → Test locale ✅
Modifica 3 → Test locale ✅
Modifica 4 → Test locale ✅
Tutte le modifiche funzionano → Commit → Push → Deploy (1 volta, 2 min)
Totale: 1 deploy = 2 minuti build consumati
```

---

## 🛠️ Comandi Utili

### Sviluppo
```bash
# Avvia server di sviluppo (hot reload automatico)
npm run dev

# Build per produzione (test locale)
npm run build

# Preview build di produzione
npm run preview
```

### Git (Workflow Consigliato)
```bash
# Lavora in locale, fai tutte le modifiche
# Testa tutto con npm run dev

# Quando tutto è pronto, committa
git add .
git commit -m "Descrizione delle modifiche"

# Push solo quando necessario (1-2 volte al giorno)
git push
```

---

## 🧪 Testing Locale

### Test Funzionalità

1. **Login**: Testa login con credenziali admin
2. **Mappa**: Verifica che i marker appaiano correttamente
3. **Form**: Testa inserimento nuovo segnale
4. **Foto**: Verifica upload e visualizzazione
5. **Sincronizzazione**: Testa sync con backend

### Test UI/UX

1. **Responsive**: Ridimensiona finestra browser
2. **Animazioni**: Verifica hover e transizioni
3. **Colori**: Controlla contrasti e accessibilità
4. **Performance**: Apri DevTools → Network, verifica tempi di caricamento

### Debug

**Console Browser** (F12):
- Errori JavaScript
- Log di debug
- Network requests

**React DevTools**:
- Componenti React
- Props e state
- Performance profiling

---

## 📦 Build Locale

### Test Build di Produzione

Prima di fare deploy, testa il build di produzione:

```bash
# Build
npm run build

# Preview build
npm run preview
```

Questo ti permette di vedere esattamente come sarà il sito in produzione, senza fare deploy.

---

## 🔐 Environment Variables

### Locale (`.env.local`)
```env
VITE_API_URL=https://catasto-segnaletica.onrender.com
```

### Produzione (Netlify/Vercel)
Configura nelle impostazioni del sito:
- `VITE_API_URL` = `https://catasto-segnaletica.onrender.com`

**Nota**: `.env.local` non viene committato (è nel `.gitignore`)

---

## 🚨 Quando Fare Deploy

### ✅ Fai Deploy Quando:
- Tutte le modifiche sono testate e funzionano
- Non ci sono errori in console
- Il build locale funziona (`npm run build`)
- Sei soddisfatto del risultato

### ❌ NON Fare Deploy Quando:
- Stai ancora sviluppando
- Ci sono errori da sistemare
- Non hai ancora testato tutto
- È solo una modifica piccola (accumula più modifiche)

---

## 📊 Best Practices

### 1. **Lavora in Branch** (Opzionale ma Consigliato)

```bash
# Crea branch per feature
git checkout -b feature/nuova-funzionalita

# Lavora, testa in locale
npm run dev

# Quando pronto, merge in main
git checkout main
git merge feature/nuova-funzionalita
git push  # Deploy solo quando merge in main
```

### 2. **Commit Descriptivi**

```bash
# ❌ Male
git commit -m "fix"

# ✅ Bene
git commit -m "Aggiunta mappa interattiva per selezione coordinate GPS"
```

### 3. **Deploy Batch**

Invece di:
- Deploy 1: Fix bug A
- Deploy 2: Fix bug B
- Deploy 3: Aggiunta feature C

Fai:
- Deploy 1: Fix bug A + Fix bug B + Aggiunta feature C

### 4. **Usa Preview Deploy**

Netlify/Vercel creano preview deploy per ogni PR:
- Testa in preview prima di merge
- Non consuma limiti del sito principale

---

## 🐛 Risoluzione Problemi

### Porta Occupata

Se `localhost:5173` è occupata:
```bash
# Vite userà automaticamente la porta successiva (5174, 5175, etc.)
# Oppure specifica porta:
npm run dev -- --port 3000
```

### Errori di Build Locale

```bash
# Pulisci cache e reinstalla
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Backend Non Raggiungibile

Verifica che il backend Render sia online:
- Vai su [render.com](https://render.com)
- Controlla status del servizio
- Verifica URL in `.env.local`

---

## 📝 Checklist Pre-Deploy

Prima di fare push/deploy, verifica:

- [ ] Tutte le modifiche funzionano in locale (`npm run dev`)
- [ ] Build di produzione funziona (`npm run build`)
- [ ] Nessun errore in console browser
- [ ] Nessun errore in console terminale
- [ ] Testato su browser diversi (Chrome, Firefox, Safari)
- [ ] Testato responsive (mobile, tablet, desktop)
- [ ] Commit message descrittivo
- [ ] Codice pulito (no console.log di debug, no commenti temporanei)

---

## 🎯 Riepilogo

**Workflow Ottimale**:
1. ✅ Lavora in locale con `npm run dev`
2. ✅ Testa tutto prima di committare
3. ✅ Fai commit solo quando tutto funziona
4. ✅ Push 1-2 volte al giorno (non ad ogni commit)
5. ✅ Deploy automatico solo quando necessario

**Risultato**: 
- Meno consumo di build minutes
- Sviluppo più veloce (no attesa deploy)
- Meno errori in produzione
- Più controllo sul processo

---

**Ricorda**: Il deploy automatico è comodo, ma non devi usarlo per ogni piccola modifica. Lavora in locale, testa, e fai deploy solo quando tutto è pronto! 🚀

