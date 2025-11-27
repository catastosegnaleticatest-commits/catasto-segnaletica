# 🚀 Setup Netlify - Guida Passo Passo

## ✅ Step 1: Account e Repository (COMPLETATO)
- ✅ Account Netlify creato
- ✅ GitHub collegato
- ✅ Repository `catasto-segnaletica` importato

## ⚙️ Step 2: Configurazione Build

Nella pagina di configurazione del sito su Netlify:

### Build & Deploy Settings

1. **Build command**: 
   ```
   npm run build
   ```

2. **Publish directory**: 
   ```
   dist
   ```

3. **Base directory**: 
   (lascia vuoto)

## 🔐 Step 3: Variabili d'Ambiente

1. **Clicca su "Show advanced"** o "Environment variables"
2. **Clicca "New variable"**
3. **Aggiungi**:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://catasto-segnaletica.onrender.com`
   - (Sostituisci con il tuo URL Render se diverso)

4. **Clicca "Save"**

## 🚀 Step 4: Deploy

1. **Clicca "Deploy site"** o "Save & deploy"
2. **Attendi** che il build completi (2-5 minuti)
3. **Verifica** che il deploy sia completato con successo

## 🌐 Step 5: URL del Sito

Dopo il deploy:
- Netlify genererà un URL tipo: `https://catasto-segnaletica-xxxxx.netlify.app`
- Puoi personalizzarlo in **Site settings → Domain management**

## 🔄 Deploy Automatico

Dopo il primo deploy:
- **Ogni push su `main`** → Deploy automatico
- **Pull Request** → Preview deploy automatico

## ✅ Verifica

1. Apri l'URL del sito generato da Netlify
2. Verifica che l'applicazione si carichi correttamente
3. Prova il login con le credenziali admin

## 🐛 Problemi Comuni

### Build Fallisce
- Verifica che `npm run build` funzioni localmente
- Controlla i log di build su Netlify per errori specifici

### Errore di Connessione API
- Verifica che `VITE_API_URL` sia configurato correttamente
- Assicurati che il backend Render sia online
- Controlla CORS sul backend

### Sito Non Si Carica
- Verifica che il deploy sia completato (status "Published")
- Controlla i log di deploy per errori
- Prova a svuotare la cache del browser

---

**Nota**: Il file `netlify.toml` è già configurato e verrà usato automaticamente da Netlify.

