import { useState, useEffect, useRef } from 'react';
import localStorageService from '../services/localStorage';
import apiService from '../services/api';

function DesktopSignDetails({ sign, onBack }) {
    const [photos, setPhotos] = useState([]);
    const [photosData, setPhotosData] = useState([]); // Array di {id, dataUrl}
    const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    // Verifica che il segnale sia valido
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

    useEffect(() => {
        loadPhotos();
    }, [sign.id]);

    const loadPhotos = async () => {
        setLoading(true);
        try {
            // Prima prova da locale
            const localPhoto = await localStorageService.getPhoto(sign.id);
            if (localPhoto) {
                setPhotosData([{ id: 'local', dataUrl: localPhoto }]);
                setLoading(false);
                return;
            }
            
            // Carica tutte le foto dal server
            const serverPhotos = await apiService.getSignPhotos(sign.id);
            
            if (serverPhotos && serverPhotos.length > 0) {
                setPhotos(serverPhotos);
                
                // Carica le immagini come data URL
                const photosWithData = await Promise.all(
                    serverPhotos.map(async (photo) => {
                        const dataUrl = await apiService.getPhotoByIdAsDataUrl(photo.id);
                        return { ...photo, dataUrl };
                    })
                );
                
                setPhotosData(photosWithData.filter(p => p.dataUrl));
            } else {
                setPhotosData([]);
            }
        } catch (error) {
            console.error('Errore caricamento foto:', error);
            setPhotosData([]);
        } finally {
            setLoading(false);
        }
    };

    // Funzione per comprimere l'immagine
    const compressImage = (file, maxWidth = 1920, maxHeight = 1920, quality = 0.8, maxSizeMB = 1) => {
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
        if (!file) return;

        // Verifica che sia un'immagine
        if (!file.type.startsWith('image/')) {
            alert('Per favore seleziona un file immagine');
            return;
        }

        // Mostra messaggio di compressione
        setUploading(true);
        
        try {
            // Comprimi l'immagine prima di caricarla
            const compressedDataUrl = await compressImage(file);
            const sizeKB = ((compressedDataUrl.length * 3) / 4 / 1024).toFixed(2);
            console.log(`📦 Immagine compressa: ${sizeKB} KB`);
            await handleUpload(compressedDataUrl);
        } catch (error) {
            console.error('Errore compressione immagine:', error);
            alert('Errore nella compressione dell\'immagine: ' + error.message);
            setUploading(false);
        }
    };

    const handleUpload = async (dataUrl, isPrimary = false) => {
        setUploading(true);
        try {
            await apiService.uploadPhoto(sign.id, dataUrl, isPrimary);
            await loadPhotos(); // Ricarica le foto
            if (isPrimary) {
                setSelectedPhotoIndex(0); // Seleziona la foto primaria
            }
        } catch (error) {
            console.error('Errore upload foto:', error);
            alert('Errore nel caricamento della foto: ' + error.message);
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleDeletePhoto = async (photoId, index) => {
        if (!confirm('Sei sicuro di voler eliminare questa foto?')) {
            return;
        }

        try {
            await apiService.deletePhoto(photoId);
            await loadPhotos();
            
            // Aggiusta l'indice se necessario
            if (selectedPhotoIndex >= photosData.length - 1) {
                setSelectedPhotoIndex(Math.max(0, photosData.length - 2));
            }
        } catch (error) {
            console.error('Errore eliminazione foto:', error);
            alert('Errore nell\'eliminazione della foto: ' + error.message);
        }
    };

    const handleSetPrimary = async (photoId) => {
        try {
            await apiService.setPrimaryPhoto(photoId);
            await loadPhotos();
            setSelectedPhotoIndex(0); // Seleziona la foto primaria
        } catch (error) {
            console.error('Errore impostazione foto primaria:', error);
            alert('Errore nell\'impostazione della foto primaria: ' + error.message);
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

    const currentPhoto = photosData[selectedPhotoIndex];

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
                                Foto Segnale {photosData.length > 0 && `(${photosData.length})`}
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

                        {loading ? (
                            <div style={{ height: '300px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--border-radius)' }}>
                                <div className="spinner"></div>
                            </div>
                        ) : photosData.length > 0 ? (
                            <>
                                {/* Foto principale */}
                                <div style={{ position: 'relative', marginBottom: '1rem' }}>
                                    <img
                                        src={currentPhoto.dataUrl}
                                        alt={`Segnale ${selectedPhotoIndex + 1}`}
                                        style={{
                                            width: '100%',
                                            maxHeight: '400px',
                                            objectFit: 'contain',
                                            borderRadius: 'var(--border-radius)',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                            background: '#f3f4f6'
                                        }}
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KIDxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmM2Y0ZjYiLz4KIDx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM2YjcyODAiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkZvdG8gbm9uIGRpc3BvbmliaWxlPC90ZXh0Pgo8L3N2Zz4=';
                                        }}
                                    />
                                    
                                    {/* Controlli foto */}
                                    {photosData.length > 1 && (
                                        <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => setSelectedPhotoIndex((prev) => (prev > 0 ? prev - 1 : photosData.length - 1))}
                                                style={{ background: 'rgba(255,255,255,0.9)', border: 'none' }}
                                            >
                                                ←
                                            </button>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => setSelectedPhotoIndex((prev) => (prev < photosData.length - 1 ? prev + 1 : 0))}
                                                style={{ background: 'rgba(255,255,255,0.9)', border: 'none' }}
                                            >
                                                →
                                            </button>
                                        </div>
                                    )}

                                    {/* Indicatore foto primaria */}
                                    {currentPhoto.is_primary && (
                                        <div style={{ position: 'absolute', top: '10px', left: '10px', background: '#10b981', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}>
                                            ⭐ Primaria
                                        </div>
                                    )}

                                    {/* Azioni foto */}
                                    <div style={{ position: 'absolute', bottom: '10px', right: '10px', display: 'flex', gap: '0.5rem' }}>
                                        {!currentPhoto.is_primary && currentPhoto.id !== 'local' && (
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => handleSetPrimary(currentPhoto.id)}
                                                style={{ background: 'rgba(255,255,255,0.9)', border: 'none' }}
                                                title="Imposta come primaria"
                                            >
                                                ⭐
                                            </button>
                                        )}
                                        {currentPhoto.id !== 'local' && (
                                            <button
                                                className="btn btn-sm btn-danger"
                                                onClick={() => handleDeletePhoto(currentPhoto.id, selectedPhotoIndex)}
                                                style={{ background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none' }}
                                                title="Elimina foto"
                                            >
                                                🗑️
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Miniature */}
                                {photosData.length > 1 && (
                                    <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                                        {photosData.map((photo, index) => (
                                            <div
                                                key={photo.id || index}
                                                onClick={() => setSelectedPhotoIndex(index)}
                                                style={{
                                                    minWidth: '80px',
                                                    height: '80px',
                                                    borderRadius: '4px',
                                                    overflow: 'hidden',
                                                    cursor: 'pointer',
                                                    border: selectedPhotoIndex === index ? '3px solid var(--primary)' : '2px solid transparent',
                                                    opacity: selectedPhotoIndex === index ? 1 : 0.7
                                                }}
                                            >
                                                <img
                                                    src={photo.dataUrl}
                                                    alt={`Miniatura ${index + 1}`}
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'cover'
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
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
                                    <div><strong>Stato Sync:</strong> {sign.synced ? '✅ Sincronizzato' : '⏳ In attesa di sync'}</div>
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
