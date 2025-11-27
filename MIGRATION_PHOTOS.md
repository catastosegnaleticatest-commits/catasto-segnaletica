# Migrazione Database: Supporto Multi-Foto

## 📋 Cosa è stato implementato

È stato aggiunto il supporto per **più foto per segnale**:
- ✅ Tabella `sign_photos` per gestire più foto
- ✅ API backend per upload/download/eliminazione foto
- ✅ Galleria foto nella sezione dettaglio segnale
- ✅ Upload di nuove foto dalla sezione dettaglio
- ✅ Eliminazione foto
- ✅ Impostazione foto primaria
- ✅ Migrazione automatica delle foto esistenti

## 🚀 Come eseguire la migrazione

### Opzione 1: Script automatico (Consigliato)

1. **Connettiti al server Render** (o al tuo server backend)
2. **Esegui lo script di migrazione**:
   ```bash
   cd server
   node migrate_add_photos_table.js
   ```

Lo script:
- Crea la tabella `sign_photos`
- Migra automaticamente le foto esistenti dalla tabella `signs` a `sign_photos`
- Imposta le foto esistenti come "primarie"

### Opzione 2: SQL Manuale

Se preferisci eseguire manualmente, ecco lo SQL:

```sql
-- Tabella per le foto dei segnali
CREATE TABLE IF NOT EXISTS sign_photos (
    id SERIAL PRIMARY KEY,
    sign_id INTEGER NOT NULL REFERENCES signs(id) ON DELETE CASCADE,
    photo_path TEXT NOT NULL,
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_primary BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_sign_photos_sign_id ON sign_photos(sign_id);
CREATE INDEX IF NOT EXISTS idx_sign_photos_primary ON sign_photos(sign_id, is_primary) WHERE is_primary = true;

-- Migrazione dati esistenti
INSERT INTO sign_photos (sign_id, photo_path, uploaded_by, is_primary, display_order)
SELECT id, photo_path, created_by, true, 0
FROM signs
WHERE photo_path IS NOT NULL AND photo_path != ''
ON CONFLICT DO NOTHING;
```

## ✅ Verifica migrazione

Dopo la migrazione, verifica che tutto sia andato a buon fine:

```sql
-- Conta le foto migrate
SELECT COUNT(*) FROM sign_photos;

-- Verifica che le foto siano state migrate correttamente
SELECT s.id, s.type, COUNT(sp.id) as photo_count
FROM signs s
LEFT JOIN sign_photos sp ON s.id = sp.sign_id
GROUP BY s.id, s.type
ORDER BY s.id;
```

## 🎯 Funzionalità disponibili

### Nella sezione Dettaglio Segnale:

1. **Galleria foto**: Visualizza tutte le foto del segnale
2. **Navigazione**: Frecce per navigare tra le foto
3. **Upload**: Pulsante "📷 Carica Foto" per aggiungere nuove foto
4. **Eliminazione**: Pulsante "🗑️" per eliminare una foto
5. **Foto primaria**: Pulsante "⭐" per impostare una foto come primaria
6. **Miniature**: Barra di miniature per navigazione rapida

### Nella mappa:

- La **prima foto disponibile** (o la foto primaria) viene mostrata nel tooltip
- Compatibilità con le foto esistenti (vecchia API)

## 🔄 Compatibilità

- ✅ **Retrocompatibilità**: Le foto esistenti continuano a funzionare
- ✅ **Migrazione automatica**: Le foto vecchie vengono migrate automaticamente
- ✅ **Fallback**: Se la nuova API non è disponibile, usa la vecchia

## 📝 Note

- Le foto esistenti vengono migrate automaticamente come "primarie"
- La tabella `signs.photo_path` rimane per compatibilità, ma le nuove foto vanno in `sign_photos`
- Le foto vengono crittografate lato server quando caricate dal desktop

---

**Dopo la migrazione, ricarica l'applicazione e verifica che le foto vengano visualizzate correttamente!**

