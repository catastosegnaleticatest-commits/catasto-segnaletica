# 🔥 Configurazione Firewall Windows

## Problema
Il firewall di Windows sta bloccando le connessioni in ingresso sulla porta 3000, impedendo al telefono di comunicare con il server backend.

## ✅ Soluzione: Aggiungere Eccezione Firewall

### Opzione 1: Tramite Interfaccia Grafica (Consigliata)

1. **Apri Windows Defender Firewall**
   - Premi `Win + R`
   - Digita `wf.msc` e premi Invio

2. **Crea Nuova Regola in Entrata**
   - Nel pannello sinistro, clicca su "Regole connessioni in entrata"
   - Nel pannello destro, clicca su "Nuova regola..."

3. **Configura la Regola**
   - **Tipo di regola**: Seleziona "Porta" → Avanti
   - **Protocollo**: TCP
   - **Porte locali specifiche**: Digita `3000` → Avanti
   - **Azione**: Seleziona "Consenti la connessione" → Avanti
   - **Profilo**: Seleziona "Privato" (importante!) → Avanti
   - **Nome**: Digita "Catasto Segnaletica - Backend" → Fine

4. **Ripeti per la Porta 5173** (Frontend)
   - Crea un'altra regola seguendo gli stessi passi
   - Porta: `5173`
   - Nome: "Catasto Segnaletica - Frontend"

### Opzione 2: Tramite PowerShell (Amministratore)

Apri PowerShell come Amministratore ed esegui:

```powershell
# Regola per porta 3000 (Backend)
New-NetFirewallRule -DisplayName "Catasto Segnaletica - Backend" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Private

# Regola per porta 5173 (Frontend)
New-NetFirewallRule -DisplayName "Catasto Segnaletica - Frontend" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow -Profile Private
```

## 🧪 Verifica

Dopo aver aggiunto le regole:

1. **Ricarica la pagina sul telefono**: `http://192.168.1.50:5173`
2. **Verifica lo stato**: Dovresti vedere 🟢 **"Online"** nell'header
3. **Prova sincronizzazione**: Clicca "🔄 Sincronizza"

## 🔍 Verifica Regole Create

Per verificare che le regole siano state create correttamente:

```powershell
Get-NetFirewallRule -DisplayName "Catasto Segnaletica*" | Format-Table DisplayName, Enabled, Direction, Action
```

## ⚠️ Note di Sicurezza

- Le regole sono configurate solo per il profilo "Privato" (rete domestica)
- Le porte sono accessibili solo dalla rete locale
- Quando non usi l'applicazione, puoi disabilitare le regole dal firewall

## 🗑️ Rimuovere le Regole (Quando Non Servono Più)

```powershell
Remove-NetFirewallRule -DisplayName "Catasto Segnaletica - Backend"
Remove-NetFirewallRule -DisplayName "Catasto Segnaletica - Frontend"
```

---

**Dopo aver configurato il firewall, riprova ad accedere dall'app sul telefono!**
