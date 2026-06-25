import { useState, useRef } from 'react';
import { signsService } from '../services/firestoreService';

function DesktopSignDetails({ sign, onBack }) {
    const [currentPhoto, setCurrentPhoto] = useState(sign.photo || null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    if (!sign || !sign.id) {
        return (
            <div className="card">
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-500)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                    <h3>Segnale non trovato</h3>
                    <p>Il segnale richiesto non è disponibile.</p>
                    <button className="btn btn-primary" onClick={onBack} style={{ marginTop: '1rem' }}>
                        ← Torna indietro
                    </button>
                </div>
            </div>
        );
    }

    const compressImage = (file, maxWidth = 800, maxHeight = 600, quality = 0.55, maxSizeMB = 0.8) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Calcola le nuove dimensioni mantenendo le proporzioni
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth || height > maxHeight) {
                        const ratio = Math.min(maxWidth / width, maxHeight / height);
                        width = width * ratio;
                        height = height * ratio;
                    }

                    // Crea un canvas per ridimensionare e comprimere
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Converti in data URL con compressione
                    let dataUrl = canvas.toDataURL('image/jpeg', quality);
                    
                    // Se ancora troppo grande, riduci ulteriormente la qualità
                    const sizeMB = (dataUrl.length * 3) / 4 / 1024 / 1024;
                    if (sizeMB > maxSizeMB) {
                        let newQuality = quality;
                        let attempts = 0;
                        while (sizeMB > maxSizeMB && newQuality > 0.1 && attempts < 5) {
                            newQuality -= 0.1;
                            dataUrl = canvas.toDataURL('image/jpeg', newQuality);
                            attempts++;
                        }
                    }

                    resolve(dataUrl);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file || !file.type.startsWith('image/')) return;
        setUploading(true);
        try {
            const compressed = await compressImage(file);
            await signsService.update(sign.id, { photo: compressed });
            setCurrentPhoto(compressed);
        } catch (error) {
            alert('Errore caricamento foto: ' + error.message);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeletePhoto = async () => {
        if (!confirm('Eliminare la foto di questo segnale?')) return;
        try {
            await signsService.update(sign.id, { photo: null });
            setCurrentPhoto(null);
        } catch (error) {
            alert('Errore eliminazione foto: ' + error.message);
        }
    };

    const getSignIcon = (type) => {
        const icons = {
            divieto: '🚫',
            obbligo: '🔵',
            pericolo: '⚠️',
            indicazione: 'ℹ️',
            precedenza: '🔺'
        };
        return icons[type] || '📍';
    };

    const getStatusColor = (status) => {
        const colors = {
            ottimo: '#10b981',
            buono: '#3b82f6',
            discreto: '#f59e0b',
            danneggiato: '#ef4444'
        };
        return colors[status] || '#6b7280';
    };

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--gray-200)', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button className="btn btn-secondary" onClick={onBack}>
                        ← Indietro
                    </button>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>
                        Dettagli Segnale #{sign.id}
                    </h2>
                </div>
                <span className="badge" style={{
                    background: getStatusColor(sign.status || 'buono'),
                    color: 'white',
                    fontSize: '1rem',
                    padding: '0.5rem 1rem'
                }}>
                    {(sign.status || 'buono').toUpperCase()}
                </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* Colonna Sinistra: Galleria Foto */}
                <div>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>
                                Foto Segnale
                            </h3>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={handleFileSelect}
                                />
                                <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                >
                                    {uploading ? '⏳ Caricamento...' : '📷 Carica Foto'}
                                </button>
                            </div>
                        </div>

                        {currentPhoto ? (
                            <div style={{ position: 'relative', marginBottom: '1rem' }}>
                                <img
                                    src={currentPhoto}
                                    alt="Segnale"
                                    style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: 'var(--border-radius)', background: '#f3f4f6' }}
                                />
                                <div style={{ position: 'absolute', bottom: '10px', right: '10px' }}>
                                    <button className="btn btn-sm btn-danger" onClick={handleDeletePhoto} title="Elimina foto">🗑️</button>
                                </div>
                            </div>
                        ) : (
                            <div style={{
                                padding: '3rem',
                                background: '#f3f4f6',
                                borderRadius: 'var(--border-radius)',
                                textAlign: 'center',
                                color: 'var(--gray-500)'
                            }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📷</div>
                                <p>Nessuna foto disponibile</p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{ marginTop: '1rem' }}
                                    disabled={uploading}
                                >
                                    {uploading ? '⏳ Caricamento...' : 'Carica la prima foto'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Colonna Destra: Dettagli */}
                <div>
                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>Informazioni Generali</h3>
                        <div style={{ display: 'grid', gap: '1rem', background: 'var(--gray-50)', padding: '1.5rem', borderRadius: 'var(--border-radius)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ fontSize: '2rem' }}>{getSignIcon(sign.type || 'indicazione')}</span>
                                <div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>TIPO</div>
                                    <div style={{ fontWeight: '600', textTransform: 'capitalize', fontSize: '1.125rem' }}>{sign.type || 'N/A'}</div>
                                </div>
                            </div>

                            <div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>POSIZIONE GPS</div>
                                {sign.latitude && sign.longitude ? (
                                    <>
                                        <div style={{ fontFamily: 'monospace', fontSize: '1.125rem' }}>
                                            {Number(sign.latitude).toFixed(6)}, {Number(sign.longitude).toFixed(6)}
                                        </div>
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${sign.latitude},${sign.longitude}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ display: 'inline-block', marginTop: '0.25rem', fontSize: '0.875rem', color: 'var(--primary)' }}
                                        >
                                            Apri in Google Maps ↗️
                                        </a>
                                    </>
                                ) : (
                                    <div style={{ color: 'var(--gray-500)' }}>Posizione non disponibile</div>
                                )}
                            </div>

                            <div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>DATA INSTALLAZIONE</div>
                                <div>{sign.installation_date ? new Date(sign.installation_date).toLocaleDateString('it-IT') : '-'}</div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>Note e Altro</h3>
                        <div style={{ background: 'var(--gray-50)', padding: '1.5rem', borderRadius: 'var(--border-radius)' }}>
                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '0.25rem' }}>NOTE</div>
                                <div style={{ whiteSpace: 'pre-wrap' }}>{sign.notes || 'Nessuna nota specificata.'}</div>
                            </div>

                            <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '1rem', marginTop: '1rem' }}>
                                <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>METADATI</div>
                                <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                                    <div><strong>Creato il:</strong> {sign.created_at ? new Date(sign.created_at).toLocaleString('it-IT') : 'N/A'}</div>
                                    <div><strong>Archiviazione:</strong> ✅ Su Firestore</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DesktopSignDetails;
