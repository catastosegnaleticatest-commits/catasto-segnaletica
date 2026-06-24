import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import apiService from '../services/api';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const SIGN_TYPES = ['divieto', 'obbligo', 'pericolo', 'indicazione', 'precedenza', 'passo_carrabile'];

// Icona marker giallo lampeggiante
function createStagingIcon(blink) {
    return L.divIcon({
        className: '',
        html: `<div style="
            width:24px;height:24px;border-radius:50%;
            background:${blink ? '#fbbf24' : '#f59e0b'};
            border:3px solid #fff;
            box-shadow:0 0 ${blink ? '12px 6px' : '6px 3px'} #fbbf24;
            transition: all 0.4s;
        "></div>`,
        iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12],
    });
}

function FlyToSign({ lat, lng }) {
    const map = useMap();
    useEffect(() => {
        if (lat && lng) map.flyTo([lat, lng], 18, { animate: true, duration: 0.6 });
    }, [lat, lng, map]);
    return null;
}

function BboxCanvas({ photoDataUrl, bbox }) {
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !photoDataUrl) return;
        const img = new Image();
        img.onload = () => {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            if (bbox) {
                const { x, y, w, h } = bbox;
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = Math.max(2, img.naturalWidth * 0.005);
                ctx.setLineDash([8, 4]);
                ctx.strokeRect(
                    x * img.naturalWidth,
                    y * img.naturalHeight,
                    w * img.naturalWidth,
                    h * img.naturalHeight
                );
                ctx.setLineDash([]);
                ctx.fillStyle = 'rgba(251,191,36,0.15)';
                ctx.fillRect(x * img.naturalWidth, y * img.naturalHeight, w * img.naturalWidth, h * img.naturalHeight);
            }
        };
        img.src = photoDataUrl;
    }, [photoDataUrl, bbox]);
    return (
        <canvas
            ref={canvasRef}
            style={{ width: '100%', borderRadius: 8, border: '2px solid #475569', maxHeight: '300px', objectFit: 'contain' }}
        />
    );
}

export default function ARValidationPanel({ user }) {
    const [records, setRecords] = useState([]);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [blink, setBlink] = useState(true);
    const [rectifyMode, setRectifyMode] = useState(false);
    const [rectifyPos, setRectifyPos] = useState(null);
    const [saving, setSaving] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [importError, setImportError] = useState(null);
    const markerRef = useRef(null);
    const fileInputRef = useRef(null);

    // Blink timer
    useEffect(() => {
        const t = setInterval(() => setBlink(b => !b), 500);
        return () => clearInterval(t);
    }, []);

    const selected = records[selectedIdx] ?? null;

    // Aggiorna editForm quando cambia la riga selezionata
    useEffect(() => {
        if (selected) {
            setEditForm({
                type: selected.sign_type || 'indicazione',
                street_name: selected.street_name || '',
                notes: selected.notes || '',
                status: 'buono',
            });
            setRectifyMode(false);
            setRectifyPos(null);
        }
    }, [selectedIdx, records]);

    // Keyboard shortcuts
    const handleApprove = useCallback(() => {
        if (!selected) return;
        handleApproveFn(selected);
    }, [selected, editForm, rectifyPos]);

    const handleRectify = useCallback(() => {
        if (!selected) return;
        setRectifyMode(r => !r);
        setRectifyPos({ lat: selected.sign_lat, lng: selected.sign_lng });
    }, [selected]);

    const handleDiscard = useCallback(() => {
        if (!selected) return;
        if (!confirm(`Scartare il rilevamento "${selected.codice_rilevato}"?`)) return;
        const next = records.filter((_, i) => i !== selectedIdx);
        setRecords(next);
        setSelectedIdx(Math.min(selectedIdx, next.length - 1));
    }, [selected, records, selectedIdx]);

    useEffect(() => {
        const onKey = (e) => {
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.key === 'Enter') { e.preventDefault(); handleApprove(); }
            if (e.key === ' ') { e.preventDefault(); handleRectify(); }
            if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); handleDiscard(); }
            if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, records.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [handleApprove, handleRectify, handleDiscard, records.length]);

    async function handleApproveFn(rec) {
        setSaving(true);
        try {
            const finalLat = rectifyPos?.lat ?? rec.sign_lat;
            const finalLng = rectifyPos?.lng ?? rec.sign_lng;
            await apiService.createSign({
                type: editForm.type || rec.sign_type || 'indicazione',
                latitude: finalLat,
                longitude: finalLng,
                status: editForm.status || 'buono',
                street_name: editForm.street_name || null,
                notes: editForm.notes || `Rilevato via AR · ${rec.codice_rilevato} · ${rec.confidenza}%`,
                photo: rec.photo_dataurl || null,
            });
            const next = records.filter((_, i) => i !== selectedIdx);
            setRecords(next);
            setSelectedIdx(Math.min(selectedIdx, Math.max(0, next.length - 1)));
            setRectifyMode(false);
        } catch (e) {
            alert('Errore approvazione: ' + e.message);
        } finally {
            setSaving(false);
        }
    }

    const handleImport = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportError(null);
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (!Array.isArray(data)) throw new Error('Il file deve contenere un array JSON');
                setRecords(data);
                setSelectedIdx(0);
            } catch (err) {
                setImportError(err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const panelBg = '#0a0f1e';
    const cardBg = '#0d1525';
    const borderCol = '#1e293b';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: panelBg, overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 1rem', borderBottom: `1px solid ${borderCol}`, flexShrink: 0 }}>
                <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.9rem' }}>📡 Pannello Revisione Flussi AI/AR</span>
                <span style={{ color: '#4e6a8a', fontSize: '0.75rem' }}>{records.length} record in coda</span>
                <div style={{ flex: 1 }} />
                <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, padding: '0.35rem 0.85rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                    📂 Importa JSON (USB)
                </button>
                {importError && <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>{importError}</span>}
                <div style={{ background: '#1e293b', borderRadius: 6, padding: '0.25rem 0.6rem', fontSize: '0.72rem', color: '#64748b' }}>
                    <kbd style={{ background: '#0a0f1e', borderRadius: 3, padding: '0 4px', color: '#94a3b8' }}>↵</kbd> Approva &nbsp;
                    <kbd style={{ background: '#0a0f1e', borderRadius: 3, padding: '0 4px', color: '#94a3b8' }}>Spazio</kbd> Rettifica &nbsp;
                    <kbd style={{ background: '#0a0f1e', borderRadius: 3, padding: '0 4px', color: '#ef4444' }}>Canc</kbd> Scarta
                </div>
            </div>

            {records.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#4e6a8a' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📡</div>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Nessun dato in staging</div>
                    <div style={{ fontSize: '0.85rem', color: '#2d3f58' }}>Importa un file JSON esportato dall'app mobile via USB</div>
                </div>
            ) : (
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {/* ═══ LEFT PANE — Tabella ═══ */}
                    <div style={{ width: '420px', flexShrink: 0, borderRight: `1px solid ${borderCol}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                <thead style={{ position: 'sticky', top: 0, background: '#060b14', zIndex: 1 }}>
                                    <tr style={{ borderBottom: `1px solid ${borderCol}` }}>
                                        {['#', 'Codice Rilevato', 'Conf%', 'Distanza', 'Ora'].map(h => (
                                            <th key={h} style={{ padding: '0.5rem 0.6rem', textAlign: 'left', color: '#4e6a8a', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.map((r, i) => {
                                        const active = i === selectedIdx;
                                        return (
                                            <tr
                                                key={r.id ?? i}
                                                onClick={() => setSelectedIdx(i)}
                                                style={{
                                                    borderBottom: `1px solid ${borderCol}`,
                                                    background: active ? 'rgba(251,191,36,0.08)' : 'transparent',
                                                    borderLeft: active ? '3px solid #fbbf24' : '3px solid transparent',
                                                    cursor: 'pointer',
                                                    transition: 'background 0.1s',
                                                }}
                                            >
                                                <td style={{ padding: '0.45rem 0.6rem', color: '#64748b' }}>{i + 1}</td>
                                                <td style={{ padding: '0.45rem 0.6rem', color: active ? '#fbbf24' : '#cbd5e1', fontWeight: active ? 600 : 400, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {r.codice_rilevato}
                                                </td>
                                                <td style={{ padding: '0.45rem 0.6rem', color: r.confidenza >= 60 ? '#4ade80' : r.confidenza >= 35 ? '#fbbf24' : '#f87171' }}>
                                                    {r.confidenza}%
                                                </td>
                                                <td style={{ padding: '0.45rem 0.6rem', color: '#64748b' }}>{r.distanza_m}m</td>
                                                <td style={{ padding: '0.45rem 0.6rem', color: '#2d3f58', fontSize: '0.7rem' }}>
                                                    {r.captured_at ? new Date(r.captured_at).toLocaleTimeString('it-IT') : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Form modifica dati (bottom del pane sx) */}
                        {selected && (
                            <div style={{ borderTop: `1px solid ${borderCol}`, padding: '0.75rem', background: cardBg, flexShrink: 0 }}>
                                <div style={{ fontSize: '0.75rem', color: '#4e6a8a', fontWeight: 600, marginBottom: '0.5rem' }}>Dati per approvazione</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.4rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Tipo</label>
                                        <select
                                            value={editForm.type || 'indicazione'}
                                            onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
                                            style={{ width: '100%', background: '#0a0f1e', color: '#e2e8f0', border: `1px solid ${borderCol}`, borderRadius: 4, padding: '0.25rem', fontSize: '0.75rem' }}
                                        >
                                            {SIGN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Stato</label>
                                        <select
                                            value={editForm.status || 'buono'}
                                            onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                                            style={{ width: '100%', background: '#0a0f1e', color: '#e2e8f0', border: `1px solid ${borderCol}`, borderRadius: 4, padding: '0.25rem', fontSize: '0.75rem' }}
                                        >
                                            {['ottimo', 'buono', 'discreto', 'danneggiato', 'da_sostituire'].map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Via / Ubicazione"
                                    value={editForm.street_name || ''}
                                    onChange={e => setEditForm(f => ({ ...f, street_name: e.target.value }))}
                                    style={{ width: '100%', background: '#0a0f1e', color: '#e2e8f0', border: `1px solid ${borderCol}`, borderRadius: 4, padding: '0.25rem 0.4rem', fontSize: '0.75rem', marginBottom: '0.4rem', boxSizing: 'border-box' }}
                                />
                                <input
                                    type="text"
                                    placeholder="Note aggiuntive"
                                    value={editForm.notes || ''}
                                    onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                                    style={{ width: '100%', background: '#0a0f1e', color: '#e2e8f0', border: `1px solid ${borderCol}`, borderRadius: 4, padding: '0.25rem 0.4rem', fontSize: '0.75rem', boxSizing: 'border-box' }}
                                />
                                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                                    <button
                                        onClick={() => handleApproveFn(selected)}
                                        disabled={saving}
                                        style={{ flex: 1, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        {saving ? '⏳' : '✅ Approva (↵)'}
                                    </button>
                                    <button
                                        onClick={handleRectify}
                                        style={{ flex: 1, background: rectifyMode ? '#d97706' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        {rectifyMode ? '🔒 Blocca (Spazio)' : '✏️ Rettifica (Spazio)'}
                                    </button>
                                    <button
                                        onClick={handleDiscard}
                                        style={{ background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: 6, padding: '0.4rem 0.6rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                                        title="Scarta (Canc)"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ═══ RIGHT PANE — Mappa + Immagine ═══ */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {selected ? (
                            <>
                                {/* Mini mappa */}
                                <div style={{ flex: '0 0 55%', position: 'relative' }}>
                                    {rectifyMode && (
                                        <div style={{ position: 'absolute', top: 8, left: 0, right: 0, textAlign: 'center', zIndex: 1000, pointerEvents: 'none' }}>
                                            <span style={{ background: '#d97706', color: '#fff', borderRadius: 20, padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 700 }}>
                                                ✏️ Trascina il marker nella posizione corretta
                                            </span>
                                        </div>
                                    )}
                                    <MapContainer
                                        center={[selected.sign_lat || 41.9, selected.sign_lng || 12.5]}
                                        zoom={18}
                                        style={{ height: '100%', width: '100%' }}
                                        scrollWheelZoom={true}
                                    >
                                        <TileLayer
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                            attribution='&copy; OpenStreetMap'
                                        />
                                        <FlyToSign lat={selected.sign_lat} lng={selected.sign_lng} />
                                        <Marker
                                            ref={markerRef}
                                            position={[rectifyPos?.lat ?? selected.sign_lat, rectifyPos?.lng ?? selected.sign_lng]}
                                            icon={createStagingIcon(blink)}
                                            draggable={rectifyMode}
                                            eventHandlers={{
                                                dragend: (e) => {
                                                    const { lat, lng } = e.target.getLatLng();
                                                    setRectifyPos({ lat, lng });
                                                }
                                            }}
                                        />
                                    </MapContainer>
                                </div>

                                {/* Immagine con bbox */}
                                <div style={{ flex: 1, padding: '0.75rem', overflowY: 'auto', background: cardBg, borderTop: `1px solid ${borderCol}` }}>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                        <div style={{ flex: 1 }}>
                                            {selected.photo_dataurl ? (
                                                <BboxCanvas photoDataUrl={selected.photo_dataurl} bbox={selected.bbox} />
                                            ) : (
                                                <div style={{ height: 120, background: '#111', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2d3f58' }}>
                                                    Nessuna foto
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ width: '200px', flexShrink: 0, fontSize: '0.75rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                            <div><span style={{ color: '#4e6a8a' }}>Classe AI:</span> <span style={{ color: '#e2e8f0' }}>{selected.codice_rilevato}</span></div>
                                            <div><span style={{ color: '#4e6a8a' }}>Confidenza:</span> <span style={{ color: selected.confidenza >= 60 ? '#4ade80' : '#fbbf24' }}>{selected.confidenza}%</span></div>
                                            <div><span style={{ color: '#4e6a8a' }}>GPS utente:</span> <span style={{ color: '#94a3b8' }}>{selected.user_lat?.toFixed(6)}, {selected.user_lng?.toFixed(6)}</span></div>
                                            <div><span style={{ color: '#4e6a8a' }}>Heading:</span> <span style={{ color: '#94a3b8' }}>{Math.round(selected.device_heading ?? 0)}°</span></div>
                                            <div><span style={{ color: '#4e6a8a' }}>Pos. stim.:</span> <span style={{ color: '#fbbf24' }}>{selected.sign_lat?.toFixed(6)}, {selected.sign_lng?.toFixed(6)}</span></div>
                                            {rectifyPos && (
                                                <div style={{ background: 'rgba(217,119,6,0.15)', border: '1px solid #d97706', borderRadius: 4, padding: '0.3rem 0.4rem' }}>
                                                    <div style={{ color: '#d97706', fontWeight: 600 }}>Posizione rettificata:</div>
                                                    <div style={{ color: '#fbbf24' }}>{rectifyPos.lat.toFixed(6)}, {rectifyPos.lng.toFixed(6)}</div>
                                                </div>
                                            )}
                                            <div style={{ marginTop: '0.25rem' }}>
                                                <div style={{ color: '#4e6a8a', marginBottom: '0.2rem' }}>Alt. previsioni:</div>
                                                {(selected.all_predictions || []).map((p, i) => (
                                                    <div key={i} style={{ color: '#2d3f58', fontSize: '0.68rem' }}>
                                                        {Math.round(p.prob * 100)}% — {p.class}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2d3f58', fontSize: '0.85rem' }}>
                                Seleziona un record dalla tabella
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
