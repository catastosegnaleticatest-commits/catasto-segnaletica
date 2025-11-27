# Configurazione GitHub Pages per Repository Privato

## ⚠️ Problema: "There isn't a GitHub Pages site here"

Dopo aver reso il repository privato, GitHub Pages potrebbe richiedere una riconfigurazione.

## ✅ Soluzione: Riconfigurare GitHub Pages

### Passaggi da seguire:

1. **Vai su GitHub.com** e accedi al tuo account
2. **Apri il repository** `catasto-segnaletica`
3. **Vai su Settings** (Impostazioni) → nella barra laterale sinistra
4. **Scorri fino a "Pages"** nella sezione "Code and automation"
5. **Nella sezione "Source"**:
   - **Source**: Seleziona "GitHub Actions" (non "Deploy from a branch")
   - Questo abiliterà il deploy tramite il workflow `.github/workflows/deploy.yml`
6. **Salva** le modifiche

### Verifica:

1. **Vai su "Actions"** nel repository
2. **Verifica che il workflow "Deploy to GitHub Pages"** sia stato eseguito
3. Se non è stato eseguito, puoi triggerarlo manualmente:
   - Vai su Actions
   - Seleziona "Deploy to GitHub Pages"
   - Clicca "Run workflow" → "Run workflow"

### URL del sito:

Dopo il deploy, il sito sarà disponibile su:
- `https://[tuo-username].github.io/catasto-segnaletica/`

Oppure se hai configurato un dominio personalizzato, su quel dominio.

## 🔍 Verifica dello stato

Dopo aver configurato:

1. **Attendi 2-5 minuti** per il completamento del deploy
2. **Vai su Settings → Pages** e verifica che ci sia un URL del sito
3. **Clicca sull'URL** per verificare che il sito funzioni

## ⚙️ Configurazione Workflow

Il workflow è già configurato correttamente in `.github/workflows/deploy.yml`:
- Si attiva automaticamente ad ogni push su `main`
- Builda il progetto con Vite
- Deploya la cartella `dist` su GitHub Pages

## 🐛 Se il problema persiste

1. **Verifica le Actions**: Vai su Actions e controlla se ci sono errori nel workflow
2. **Controlla i log**: Apri l'ultimo workflow eseguito e verifica eventuali errori
3. **Verifica il build**: Assicurati che `npm run build` funzioni localmente
4. **Controlla le permissions**: Settings → Actions → General → verifica che "Workflow permissions" sia impostato correttamente

## 📝 Note Importanti

- **Repository Privato**: GitHub Pages funziona con repository privati su account gratuiti
- **Deploy Time**: Il primo deploy può richiedere 5-10 minuti
- **Cache**: Se vedi ancora il vecchio contenuto, svuota la cache del browser (Ctrl+Shift+R)

---

**Ultimo aggiornamento**: 2025

