import { useState, useRef } from 'react';
import { signsService } from '../services/firestoreService';

const VALID_STATUSES = ['buono', 'danneggiato', 'da_sostituire', 'rimosso'];

// Parser CSV semplice con supporto per campi tra virgolette
function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    const parseLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    };

    const headers = parseLine(lines[0]).map(h => h.toLowerCase());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseLine(lines[i]);
        const row = {};
        headers.forEach((h, idx) => { row[h] = values[idx]; });
        rows.push(row);
    }
    return rows;
}

// Converte le righe CSV in oggetti segnale validi
function csvRowsToSigns(rows) {
    return rows.map((row, idx) => {
        const lat = parseFloat(row.latitude ?? row.lat);
        const lon = parseFloat(row.longitude ?? row.lon ?? row.lng);
        if (isNaN(lat) || isNaN(lon)) {
            throw new Error(`Riga ${idx + 2}: coordinate non valide`);
        }
        const sign = {
            type: (row.type || row.tipo || '').trim(),
            latitude: lat,
            longitude: lon,
        };
        if (row.status || row.stato) {
            const status = (row.status || row.stato).trim();
            if (VALID_STATUSES.includes(status)) sign.status = status;
        }
        if (row.installation_date || row.data_installazione) {
            sign.installation_date = (row.installation_date || row.data_installazione).trim();
        }
        if (row.notes || row.note) {
            sign.notes = row.notes || row.note;
        }
        if (!sign.type) {
            throw new Error(`Riga ${idx + 2}: campo "type" obbligatorio`);
        }
        return sign;
    });
}

// Converte un GeoJSON FeatureCollection in oggetti segnale validi
function geoJSONToSigns(geojson) {
    if (!geojson.features || !Array.isArray(geojson.features)) {
        throw new Error('GeoJSON non valido: manca "features"');
    }
    return geojson.features.map((feature, idx) => {
        const geom = feature.geometry;
        if (!geom || geom.type !== 'Point' || !Array.isArray(geom.coordinates)) {
            throw new Error(`Feature ${idx + 1}: geometria non valida (richiesto Point)`);
        }
        const [longitude, latitude] = geom.coordinates;
        const props = feature.properties || {};
        const sign = {
            type: String(props.type || props.tipo || '').trim(),
            latitude: Number(latitude),
            longitude: Number(longitude),
        };
        if (props.status && VALID_STATUSES.includes(props.status)) sign.status = props.status;
        if (props.installation_date) sign.installation_date = props.installation_date;
        if (props.notes) sign.notes = props.notes;
        if (!sign.type) {
            throw new Error(`Feature ${idx + 1}: campo "type" obbligatorio nelle properties`);
        }
        return sign;
    });
}

function ImportSigns() {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [parseError, setParseError] = useState(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);
    const fileInputRef = useRef(null);

    const handleFileChange = async (e) => {
        const selected = e.target.files[0];
        setFile(selected);
        setPreview(null);
        setParseError(null);
        setResult(null);

        if (!selected) return;

        try {
            const text = await selected.text();
            let signs;
            if (selected.name.toLowerCase().endsWith('.geojson') || selected.name.toLowerCase().endsWith('.json')) {
                signs = geoJSONToSigns(JSON.parse(text));
            } else {
                signs = csvRowsToSigns(parseCSV(text));
            }
            setPreview(signs);
        } catch (err) {
            setParseError(err.message);
        }
    };

    const handleImport = async () => {
        if (!preview || preview.length === 0) return;
        setImporting(true);
        setResult(null);
        try {
            const res = await signsService.bulkImport(preview);
            setResult({ success: true, count: res.count });
            setPreview(null);
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err) {
            setResult({ success: false, error: err.message });
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="card" style={{ marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                📥 Importa Segnali
            </h3>
            <p style={{ color: 'var(--gray-600)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Carica un file CSV o GeoJSON per popolare il catasto con segnali esistenti.
                Il file CSV deve contenere le colonne <code>type, latitude, longitude</code> (e opzionalmente <code>status, installation_date, notes</code>).
                Il GeoJSON deve essere una FeatureCollection di punti con le stesse proprietà.
            </p>

            <div className="form-group">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.geojson,.json"
                    className="form-input"
                    onChange={handleFileChange}
                />
            </div>

            {parseError && (
                <div style={{ color: 'var(--danger)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    ❌ Errore nel file: {parseError}
                </div>
            )}

            {preview && (
                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                        ✅ {preview.length} segnali pronti per l'importazione (anteprima prime 5 righe):
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--gray-200)' }}>
                                    <th style={{ padding: '0.4rem', textAlign: 'left' }}>Tipo</th>
                                    <th style={{ padding: '0.4rem', textAlign: 'left' }}>Latitudine</th>
                                    <th style={{ padding: '0.4rem', textAlign: 'left' }}>Longitudine</th>
                                    <th style={{ padding: '0.4rem', textAlign: 'left' }}>Stato</th>
                                    <th style={{ padding: '0.4rem', textAlign: 'left' }}>Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                {preview.slice(0, 5).map((s, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                                        <td style={{ padding: '0.4rem', textTransform: 'capitalize' }}>{s.type}</td>
                                        <td style={{ padding: '0.4rem', fontFamily: 'monospace' }}>{s.latitude}</td>
                                        <td style={{ padding: '0.4rem', fontFamily: 'monospace' }}>{s.longitude}</td>
                                        <td style={{ padding: '0.4rem' }}>{s.status || 'buono'}</td>
                                        <td style={{ padding: '0.4rem' }}>{s.notes || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {result && result.success && (
                <div style={{ color: 'var(--success)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    ✅ Importati {result.count} segnali con successo!
                </div>
            )}
            {result && !result.success && (
                <div style={{ color: 'var(--danger)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    ❌ Errore: {result.error}
                </div>
            )}

            <button
                className="btn btn-primary"
                disabled={!preview || preview.length === 0 || importing}
                onClick={handleImport}
            >
                {importing ? 'Importazione in corso...' : `📥 Importa ${preview ? preview.length : ''} Segnali`}
            </button>
        </div>
    );
}

export default ImportSigns;
