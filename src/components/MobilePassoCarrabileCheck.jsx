import { useState, useEffect } from 'react';
import localStorageService from '../services/localStorage';
import apiService from '../services/api';

const PROXIMITY_THRESHOLD_METERS = 30;

function distanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function MobilePassoCarrabileCheck({ onBack }) {
    const [position, setPosition] = useState(null);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [nearbySign, setNearbySign] = useState(undefined); // undefined = non cercato, null = nessuno trovato
    const [numeroLetto, setNumeroLetto] = useState('');
    const [note, setNote] = useState('');
    const [result, setResult] = useState(null); // 'ok' | 'mismatch' | 'non_censito'
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            setError('Geolocalizzazione non supportata dal browser.');
            return;
        }
        setGpsLoading(true);
        setError(null);
        setNearbySign(undefined);
        setResult(null);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                setPosition({ lat, lon });
                try {
                    const signs = await localStorageService.getSigns();
                    const candidates = signs
                        .filter(s => s.type === 'passo_carrabile')
                        .map(s => ({ sign: s, distance: distanceMeters(lat, lon, s.latitude, s.longitude) }))
                        .filter(c => c.distance <= PROXIMITY_THRESHOLD_METERS)
                        .sort((a, b) => a.distance - b.distance);

                    setNearbySign(candidates.length > 0 ? candidates[0] : null);
                } catch (err) {
                    setError('Errore nel caricamento del catasto locale: ' + err.message);
                }
                setGpsLoading(false);
            },
            (err) => {
                setError('GPS non disponibile: ' + err.message);
                setGpsLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleVerify = () => {
        if (nearbySign === null) {
            setResult('non_censito');
            return;
        }
        const numeroCatasto = (nearbySign.sign.numero_autorizzazione || '').trim().toUpperCase();
        const numeroFisico = numeroLetto.trim().toUpperCase();
        if (!numeroCatasto || numeroCatasto !== numeroFisico) {
            setResult('mismatch');
        } else {
            setResult('ok');
        }
    };

    const handleSendReport = async () => {
        if (!position) return;
        setSubmitting(true);
        try {
            await apiService.createTaxReport({
                sign_id: nearbySign ? nearbySign.sign.id : null,
                latitude: position.lat,
                longitude: position.lon,
                numero_rilevato: numeroLetto || null,
                motivo: result === 'non_censito' ? 'non_censito' : 'numero_non_corrispondente',
                note: note || null,
            });
            setSubmitted(true);
        } catch (err) {
            setError('Errore nell\'invio della segnalazione: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const reset = () => {
        setPosition(null);
        setNearbySign(undefined);
        setNumeroLetto('');
        setNote('');
        setResult(null);
        setSubmitted(false);
        setError(null);
    };

    return (
        <div className="container">
            <div style={{ marginBottom: '1rem' }}>
                <button className="btn btn-secondary" onClick={onBack}>← Indietro</button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                    🚪 Verifica Passo Carrabile
                </h2>
                <p style={{ color: 'var(--gray-600)' }}>
                    Controlla la corrispondenza tra il cartello fisico e il catasto locale
                </p>
            </div>

            {error && (
                <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: 'var(--border-radius)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                    {error}
                </div>
            )}

            <div className="card">
                <div className="form-group">
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleGetLocation}
                        disabled={gpsLoading}
                        style={{ width: '100%' }}
                    >
                        {gpsLoading ? '⏳ Ricerca in corso...' : '📍 Rileva posizione e cerca passo carrabile'}
                    </button>
                </div>

                {position && (
                    <div style={{ marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--gray-600)', fontFamily: 'monospace' }}>
                        {position.lat.toFixed(6)}, {position.lon.toFixed(6)}
                    </div>
                )}

                {nearbySign !== undefined && (
                    <>
                        {nearbySign ? (
                            <div style={{ padding: '1rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 'var(--border-radius-sm)', marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginBottom: '0.25rem' }}>
                                    PASSO CARRABILE CENSITO (a {Math.round(nearbySign.distance)} m) — Segnale #{nearbySign.sign.id}
                                </div>
                                <div><strong>Numero autorizzazione:</strong> {nearbySign.sign.numero_autorizzazione || 'Non specificato'}</div>
                                <div><strong>Proprietario:</strong> {nearbySign.sign.proprietario || 'Non specificato'}</div>
                            </div>
                        ) : (
                            <div style={{ padding: '1rem', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 'var(--border-radius-sm)', marginBottom: '1rem', fontWeight: '700', color: '#991b1b' }}>
                                ⚠️ Nessun passo carrabile censito entro {PROXIMITY_THRESHOLD_METERS} m da questa posizione
                            </div>
                        )}

                        {!submitted && (
                            <>
                                <div className="form-group">
                                    <label className="form-label">Numero letto sul cartello fisico</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={numeroLetto}
                                        onChange={e => setNumeroLetto(e.target.value)}
                                        placeholder="Es: PC-2024-0123"
                                    />
                                </div>

                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleVerify}
                                    disabled={nearbySign !== null && !numeroLetto}
                                    style={{ width: '100%', marginBottom: '1rem' }}
                                >
                                    🔍 Verifica corrispondenza
                                </button>
                            </>
                        )}

                        {result === 'ok' && (
                            <div style={{ padding: '1rem', background: '#dcfce7', color: '#166534', borderRadius: 'var(--border-radius-sm)', fontWeight: '700', textAlign: 'center' }}>
                                ✅ Corrispondenza confermata. Nessuna segnalazione necessaria.
                            </div>
                        )}

                        {(result === 'mismatch' || result === 'non_censito') && !submitted && (
                            <div style={{ padding: '1rem', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 'var(--border-radius-sm)' }}>
                                <div style={{ fontWeight: '700', color: '#991b1b', marginBottom: '0.5rem' }}>
                                    {result === 'mismatch'
                                        ? '⚠️ Il numero sul cartello NON corrisponde al catasto'
                                        : '⚠️ Passo carrabile non censito nel catasto'}
                                </div>
                                <div style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                                    Verrà generata una segnalazione per l'Ufficio Tributi del Comune per l'accertamento dell'evasione fiscale.
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Note (opzionale)</label>
                                    <textarea
                                        className="form-textarea"
                                        value={note}
                                        onChange={e => setNote(e.target.value)}
                                        rows="2"
                                        placeholder="Eventuali dettagli aggiuntivi"
                                    />
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleSendReport}
                                    disabled={submitting}
                                    style={{ width: '100%', background: '#dc2626', borderColor: '#dc2626' }}
                                >
                                    {submitting ? '📨 Invio in corso...' : '📨 Invia segnalazione Ufficio Tributi'}
                                </button>
                            </div>
                        )}

                        {submitted && (
                            <div style={{ padding: '1rem', background: '#dcfce7', color: '#166534', borderRadius: 'var(--border-radius-sm)', fontWeight: '700', textAlign: 'center' }}>
                                ✅ Segnalazione inviata all'Ufficio Tributi
                            </div>
                        )}

                        {(submitted || result) && (
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={reset}
                                style={{ width: '100%', marginTop: '1rem' }}
                            >
                                🔄 Nuova verifica
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default MobilePassoCarrabileCheck;
