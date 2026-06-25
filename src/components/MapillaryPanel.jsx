import { useState } from 'react';

export default function MapillaryPanel({ imageId, coords, onClose }) {
    const [loaded, setLoaded] = useState(false);

    return (
        <div style={{
            width: '400px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '2px solid #05CB63',
            background: '#0f172a',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.5rem 0.75rem',
                background: '#1e293b',
                color: 'white',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#05CB63', fontWeight: 700, fontSize: '0.9rem' }}>● Mapillary</span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Vista Stradale 360°</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {coords && (
                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
                            {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}
                        </span>
                    )}
                    <a
                        href={`https://www.mapillary.com/app/?image_key=${imageId}`}
                        target="_blank" rel="noreferrer"
                        style={{ color: '#05CB63', fontSize: '0.75rem', textDecoration: 'none' }}
                        title="Apri su Mapillary"
                    >↗</a>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, padding: '2px 4px' }}
                    >✕</button>
                </div>
            </div>

            {/* Viewer */}
            <div style={{ flex: 1, position: 'relative', background: '#000' }}>
                {!loaded && (
                    <div style={{
                        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', color: '#64748b', gap: '0.75rem',
                    }}>
                        <div style={{
                            width: '32px', height: '32px', border: '3px solid #05CB63',
                            borderTopColor: 'transparent', borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                        }} />
                        <span style={{ fontSize: '0.8rem' }}>Caricamento vista stradale...</span>
                    </div>
                )}
                <iframe
                    key={imageId}
                    src={`https://www.mapillary.com/embed?image_key=${imageId}&style=photo`}
                    style={{ width: '100%', height: '100%', border: 'none', opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
                    allowFullScreen
                    title="Mapillary 360°"
                    onLoad={() => setLoaded(true)}
                />
            </div>

            {/* Footer */}
            <div style={{ padding: '0.4rem 0.75rem', background: '#1e293b', fontSize: '0.7rem', color: '#475569', flexShrink: 0 }}>
                Trascina per ruotare · Scorri per avanzare · Doppioclick per avanzare di scena
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
