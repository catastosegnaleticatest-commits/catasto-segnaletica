import { useState, useEffect, useRef, useCallback } from 'react';
import { stagingDB } from '../services/stagingDB';

// Mappa classi MobileNet → tipo segnale catasto
const CLASS_TO_SIGN_TYPE = {
    'street sign': 'indicazione',
    'traffic light': 'obbligo',
    'traffic sign': 'divieto',
    'stop sign': 'divieto',
    'parking meter': 'divieto',
    'signboard': 'indicazione',
    'pole': 'indicazione',
    'barrier': 'divieto',
    'guardrail': 'pericolo',
};

const DETECTION_THRESHOLD = 0.25;
const SCAN_INTERVAL_MS = 2500;
const DEFAULT_DISTANCE_M = 5.0;

function degToRad(deg) { return (deg * Math.PI) / 180; }

function calcSignPosition(userLat, userLng, headingDeg, distanceM) {
    const bearing = degToRad(headingDeg);
    const lat = userLat + (distanceM * Math.cos(bearing)) / 111111;
    const lng = userLng + (distanceM * Math.sin(bearing)) / (111111 * Math.cos(degToRad(userLat)));
    return { lat, lng };
}

export default function ARScanView({ onBack }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const captureRef = useRef(null); // hidden canvas per frame capture
    const streamRef = useRef(null);
    const modelRef = useRef(null);
    const scanTimerRef = useRef(null);

    const [modelLoading, setModelLoading] = useState(true);
    const [modelError, setModelError] = useState(null);
    const [cameraError, setCameraError] = useState(null);
    const [heading, setHeading] = useState(null);
    const [gpsPos, setGpsPos] = useState(null);
    const [gpsError, setGpsError] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [lastDetection, setLastDetection] = useState(null);
    const [detectionCount, setDetectionCount] = useState(0);
    const [exporting, setExporting] = useState(false);
    const [flashVisible, setFlashVisible] = useState(false);

    // Carica conteggio iniziale staging
    useEffect(() => {
        stagingDB.count().then(setDetectionCount).catch(() => {});
    }, []);

    // Avvio camera
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: false,
                });
                streamRef.current = stream;
                if (videoRef.current && mounted) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
            } catch (e) {
                if (mounted) setCameraError(e.message || 'Accesso camera negato');
            }
        })();
        return () => {
            mounted = false;
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            if (scanTimerRef.current) clearInterval(scanTimerRef.current);
        };
    }, []);

    // Carica MobileNet
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                // Import dinamico per non bloccare il bundle principale
                const mobilenet = await import('@tensorflow-models/mobilenet');
                const model = await mobilenet.load({ version: 2, alpha: 0.5 });
                if (mounted) {
                    modelRef.current = model;
                    setModelLoading(false);
                }
            } catch (e) {
                if (mounted) {
                    setModelError('MobileNet non disponibile: ' + e.message);
                    setModelLoading(false);
                }
            }
        })();
        return () => { mounted = false; };
    }, []);

    // GPS
    useEffect(() => {
        if (!navigator.geolocation) {
            setGpsError('Geolocalizzazione non supportata');
            return;
        }
        const wid = navigator.geolocation.watchPosition(
            pos => setGpsPos({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
            err => setGpsError(err.message),
            { enableHighAccuracy: true, maximumAge: 3000 }
        );
        return () => navigator.geolocation.clearWatch(wid);
    }, []);

    // Bussola
    useEffect(() => {
        const handleOrientation = (e) => {
            // Alpha = azimuth (0=Nord, 90=Est)
            if (e.absolute && e.alpha != null) setHeading(e.alpha);
            else if (e.webkitCompassHeading != null) setHeading(e.webkitCompassHeading);
            else if (e.alpha != null) setHeading(e.alpha);
        };
        if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
            DeviceOrientationEvent.requestPermission()
                .then(perm => { if (perm === 'granted') window.addEventListener('deviceorientation', handleOrientation, true); })
                .catch(() => {});
        } else {
            window.addEventListener('deviceorientation', handleOrientation, true);
        }
        return () => window.removeEventListener('deviceorientation', handleOrientation, true);
    }, []);

    // Overlay canvas — mirino
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const draw = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            const size = Math.min(canvas.width, canvas.height) * 0.35;
            // Angoli mirino
            ctx.strokeStyle = '#00ffcc';
            ctx.lineWidth = 3;
            const arm = size * 0.3;
            [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx, sy]) => {
                const ox = cx + sx * size / 2;
                const oy = cy + sy * size / 2;
                ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + sx * arm * -1, oy); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox, oy + sy * arm * -1); ctx.stroke();
            });
            // Centro
            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#00ffcc';
            ctx.fill();
        };
        draw();
        const observer = new ResizeObserver(draw);
        observer.observe(canvas);
        return () => observer.disconnect();
    }, []);

    const captureAndClassify = useCallback(async () => {
        if (!modelRef.current || !videoRef.current || videoRef.current.readyState < 2) return;
        if (!gpsPos) return;

        const video = videoRef.current;
        const cap = captureRef.current;
        cap.width = video.videoWidth || 224;
        cap.height = video.videoHeight || 224;
        const ctx = cap.getContext('2d');
        ctx.drawImage(video, 0, 0, cap.width, cap.height);

        let predictions = [];
        try {
            predictions = await modelRef.current.classify(cap, 3);
        } catch { return; }

        const top = predictions[0];
        if (!top || top.probability < DETECTION_THRESHOLD) return;

        // Bounding box stimata: zona centrale del frame (60% dell'area)
        const margin = 0.2;
        const bbox = { x: margin, y: margin, w: 1 - margin * 2, h: 1 - margin * 2 };

        const headingVal = heading ?? 0;
        const { lat: signLat, lng: signLng } = calcSignPosition(
            gpsPos.lat, gpsPos.lng, headingVal, DEFAULT_DISTANCE_M
        );

        // Determina tipo segnale
        const lc = top.className.toLowerCase();
        let signType = 'indicazione';
        for (const [key, val] of Object.entries(CLASS_TO_SIGN_TYPE)) {
            if (lc.includes(key)) { signType = val; break; }
        }

        // Thumbnail JPEG da frame
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 320; thumbCanvas.height = 240;
        thumbCanvas.getContext('2d').drawImage(cap, 0, 0, 320, 240);
        const photoDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.75);

        const record = {
            codice_rilevato: top.className,
            sign_type: signType,
            confidenza: Math.round(top.probability * 100),
            testo_ocr: '',
            distanza_m: DEFAULT_DISTANCE_M,
            user_lat: gpsPos.lat,
            user_lng: gpsPos.lng,
            gps_accuracy: gpsPos.accuracy,
            device_heading: headingVal,
            sign_lat: signLat,
            sign_lng: signLng,
            bbox,
            photo_dataurl: photoDataUrl,
            all_predictions: predictions.map(p => ({ class: p.className, prob: p.probability })),
        };

        await stagingDB.add(record);
        const newCount = await stagingDB.count();
        setDetectionCount(newCount);
        setLastDetection({ ...record, id: newCount });
        setFlashVisible(true);
        setTimeout(() => setFlashVisible(false), 400);
    }, [gpsPos, heading]);

    const toggleScanning = () => {
        if (scanning) {
            clearInterval(scanTimerRef.current);
            setScanning(false);
        } else {
            setScanning(true);
            scanTimerRef.current = setInterval(captureAndClassify, SCAN_INTERVAL_MS);
        }
    };

    const handleManualCapture = () => captureAndClassify();

    const handleExport = async () => {
        setExporting(true);
        try {
            const records = await stagingDB.getAll();
            if (!records.length) { alert('Nessun rilevamento da esportare.'); return; }
            const json = JSON.stringify(records, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ar_staging_${new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } finally {
            setExporting(false);
        }
    };

    const handleClearAll = async () => {
        if (!confirm('Eliminare tutti i rilevamenti in staging?')) return;
        await stagingDB.clear();
        setDetectionCount(0);
        setLastDetection(null);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
            {/* Flash detection */}
            {flashVisible && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,255,200,0.25)', zIndex: 20, pointerEvents: 'none', transition: 'opacity 0.2s' }} />
            )}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.8rem', background: 'rgba(0,0,0,0.7)', zIndex: 10, flexShrink: 0 }}>
                <button onClick={onBack} style={{ background: 'none', border: '1px solid #475569', borderRadius: 6, color: '#94a3b8', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}>← Indietro</button>
                <span style={{ color: '#00ffcc', fontWeight: 700, fontSize: '0.85rem', flex: 1, textAlign: 'center' }}>🔍 Scansione Automatica AR</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ background: '#1e293b', color: '#fbbf24', borderRadius: 12, padding: '0.2rem 0.5rem', fontSize: '0.75rem', fontWeight: 700 }}>
                        {detectionCount} rilevati
                    </span>
                </div>
            </div>

            {/* Camera + canvas */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {cameraError ? (
                    <div style={{ color: '#ef4444', padding: '2rem', textAlign: 'center', marginTop: '3rem' }}>
                        📷 {cameraError}
                    </div>
                ) : (
                    <video
                        ref={videoRef}
                        playsInline
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                )}
                <canvas
                    ref={canvasRef}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                />
                {/* Canvas nascosto per cattura frame */}
                <canvas ref={captureRef} style={{ display: 'none' }} />

                {/* Status overlay */}
                <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div style={{ background: 'rgba(0,0,0,0.6)', color: gpsPos ? '#4ade80' : '#f87171', borderRadius: 6, padding: '0.25rem 0.5rem', fontSize: '0.72rem', fontWeight: 600 }}>
                        {gpsPos ? `📍 GPS ±${Math.round(gpsPos.accuracy || 0)}m` : `📍 ${gpsError || 'Attesa GPS...'}`}
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.6)', color: heading != null ? '#60a5fa' : '#94a3b8', borderRadius: 6, padding: '0.25rem 0.5rem', fontSize: '0.72rem', fontWeight: 600 }}>
                        🧭 {heading != null ? `${Math.round(heading)}°` : 'No bussola'}
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.6)', color: modelLoading ? '#fbbf24' : modelError ? '#ef4444' : '#4ade80', borderRadius: 6, padding: '0.25rem 0.5rem', fontSize: '0.72rem', fontWeight: 600 }}>
                        🧠 {modelLoading ? 'Caricamento AI...' : modelError ? 'AI non disp.' : 'AI pronto'}
                    </div>
                    {scanning && (
                        <div style={{ background: 'rgba(0,255,200,0.15)', border: '1px solid #00ffcc', color: '#00ffcc', borderRadius: 6, padding: '0.25rem 0.5rem', fontSize: '0.72rem', fontWeight: 700, animation: 'pulse 1s infinite' }}>
                            ● SCANSIONE ATTIVA
                        </div>
                    )}
                </div>

                {/* Last detection info */}
                {lastDetection && (
                    <div style={{ position: 'absolute', bottom: '1rem', left: '0.75rem', right: '0.75rem', background: 'rgba(0,0,0,0.75)', border: '1px solid #00ffcc', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
                        <div style={{ color: '#00ffcc', fontWeight: 700, fontSize: '0.78rem', marginBottom: '0.2rem' }}>
                            ✅ Ultimo rilevamento
                        </div>
                        <div style={{ color: '#e2e8f0', fontSize: '0.72rem' }}>
                            {lastDetection.codice_rilevato} · {lastDetection.confidenza}% conf.
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.68rem' }}>
                            {lastDetection.sign_lat?.toFixed(6)}, {lastDetection.sign_lng?.toFixed(6)}
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div style={{ background: 'rgba(0,0,0,0.85)', padding: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', flexShrink: 0 }}>
                <button
                    onClick={toggleScanning}
                    disabled={modelLoading || !!modelError}
                    style={{
                        background: scanning ? '#dc2626' : '#00ffcc',
                        color: scanning ? '#fff' : '#0a0f1e',
                        border: 'none', borderRadius: 8, padding: '0.6rem 1.2rem',
                        fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', flex: '1 1 120px'
                    }}
                >
                    {scanning ? '⏹ Ferma' : '▶ Avvia Scansione'}
                </button>
                <button
                    onClick={handleManualCapture}
                    disabled={modelLoading || !!modelError || !gpsPos}
                    style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', flex: '1 1 100px' }}
                >
                    📸 Cattura
                </button>
                <button
                    onClick={handleExport}
                    disabled={exporting || detectionCount === 0}
                    style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', flex: '1 1 100px' }}
                >
                    {exporting ? '⏳' : '📤 Esporta JSON'}
                </button>
                <button
                    onClick={handleClearAll}
                    disabled={detectionCount === 0}
                    style={{ background: '#374151', color: '#94a3b8', border: 'none', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                    🗑️ Svuota
                </button>
            </div>

            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
        </div>
    );
}
