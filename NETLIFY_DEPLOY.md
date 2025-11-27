# Deploy su Netlify (Alternativa a GitHub Pages)

## 🎯 Perché Netlify?

Con un account GitHub **gratuito**, GitHub Pages **non funziona** con repository privati. 
Netlify invece:
- ✅ Funziona con repository **privati** gratuitamente
- ✅ Deploy automatico ad ogni push
- ✅ HTTPS gratuito
- ✅ CDN globale
- ✅ Supporto SPA (Single Page Application)

## 🚀 Setup Netlify

### Opzione 1: Deploy Automatico da GitHub (Consigliato)

1. **Vai su [netlify.com](https://netlify.com)** e crea un account (gratuito)

2. **Clicca su "Add new site" → "Import an existing project"**

3. **Connetti GitHub**:
   - Autorizza Netlify ad accedere a GitHub
   - Seleziona il repository `catasto-segnaletica`
   - Netlify può accedere anche a repository privati

4. **Configurazione Build**:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Base directory**: (lascia vuoto)

5. **Variabili d'Ambiente**:
   - Clicca su "Show advanced"
   - Aggiungi variabile d'ambiente:
     - **Key**: `VITE_API_URL`
     - **Value**: `https://catasto-segnaletica.onrender.com` (o il tuo URL Render)

6. **Deploy**:
   - Clicca "Deploy site"
   - Netlify farà il build e il deploy automaticamente

7. **URL del sito**:
   - Netlify genererà un URL tipo: `https://catasto-segnaletica-xxxxx.netlify.app`
   - Puoi personalizzarlo in Site settings → Domain management

### Opzione 2: Deploy Manuale (via CLI)

```bash
# Installa Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
npm run build
netlify deploy --prod --dir=dist
```

## ⚙️ Configurazione Automatica

Il file `netlify.toml` è già configurato con:
- Build command automatico
- Redirect per SPA
- Headers di sicurezza

## 🔄 Deploy Automatico

Dopo il setup iniziale:
- **Ogni push su `main`** → Deploy automatico
- **Pull Request** → Preview deploy automatico
- **Notifiche** via email quando il deploy è completato

## 🔒 Repository Privato

Netlify può accedere a repository privati:
- Durante il setup, autorizza Netlify
- Netlify manterrà l'accesso anche se il repository è privato
- Il codice rimane privato, solo il sito è pubblico

## 📝 Note

- **HTTPS**: Automatico e gratuito
- **CDN**: Globale, sito veloce ovunque
- **Limiti Gratuiti**: 
  - 100 GB bandwidth/mese
  - 300 minuti build/mese
  - Più che sufficiente per la maggior parte dei progetti

## 🆚 Confronto con GitHub Pages

| Feature | GitHub Pages (Free) | Netlify (Free) |
|---------|-------------------|----------------|
| Repository Privati | ❌ No | ✅ Sì |
| Deploy Automatico | ✅ Sì | ✅ Sì |
| HTTPS | ✅ Sì | ✅ Sì |
| CDN | ✅ Sì | ✅ Sì |
| Preview PR | ❌ No | ✅ Sì |
| Form Handling | ❌ No | ✅ Sì |

---

**Raccomandazione**: Usa Netlify per repository privati. È gratuito e più potente di GitHub Pages.

