import { useRef, useState, useEffect } from 'react';
import { applyRedactions } from '../utils/imageCompression';

// Modale che permette all'operatore di disegnare bande nere sulla foto per
// coprire volti, targhe o altri elementi sensibili prima del salvataggio.
function PhotoRedactor({ photo, onConfirm, onCancel }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [rects, setRects] = useState([]); // rettangoli in coordinate normalizzate (0-1)
    const [drawing, setDrawing] = useState(null); // rettangolo in corso di disegno
    const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
    const [applying, setApplying] = useState(false);

    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            setImgSize({ width: img.width, height: img.height });
            draw();
        };
        img.src = photo;
    }, [photo]);

    useEffect(() => {
        draw();
    }, [rects, drawing, imgSize]);

    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas || !imgSize.width) return;

        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#000000';
            [...rects, ...(drawing ? [drawing] : [])].forEach(r => {
                ctx.fillRect(
                    r.x * canvas.width,
                    r.y * canvas.height,
                    r.width * canvas.width,
                    r.height * canvas.height
                );
            });
        };
        img.src = photo;
    };

    const getRelativePos = (clientX, clientY) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        return {
            x: Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1),
            y: Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1)
        };
    };

    const handlePointerDown = (e) => {
        const pos = getRelativePos(e.clientX, e.clientY);
        setDrawing({ x: pos.x, y: pos.y, width: 0, height: 0 });
    };

    const handlePointerMove = (e) => {
        if (!drawing) return;
        const pos = getRelativePos(e.clientX, e.clientY);
        setDrawing(d => ({
            x: Math.min(d.x, pos.x),
            y: Math.min(d.y, pos.y),
            width: Math.abs(pos.x - d.x),
            height: Math.abs(pos.y - d.y)
        }));
    };

    const handlePointerUp = () => {
        if (drawing && drawing.width > 0.01 && drawing.height > 0.01) {
            setRects(prev => [...prev, drawing]);
        }
        setDrawing(null);
    };

    const handleUndo = () => {
        setRects(prev => prev.slice(0, -1));
    };

    const handleConfirm = async () => {
        setApplying(true);
        try {
            const redacted = await applyRedactions(photo, rects);
            onConfirm(redacted);
        } catch (error) {
            alert('Errore durante l\'applicazione della censura: ' + error.message);
        } finally {
            setApplying(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', zIndex: 10000,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '1rem'
        }}>
            <div style={{ color: 'white', marginBottom: '0.75rem', textAlign: 'center', fontSize: '0.9rem' }}>
                ✏️ Trascina sulla foto per disegnare bande nere e coprire volti o targhe
            </div>

            <div ref={containerRef} style={{ maxWidth: '100%', maxHeight: '70vh', touchAction: 'none' }}>
                <canvas
                    ref={canvasRef}
                    width={imgSize.width || 800}
                    height={imgSize.height || 600}
                    style={{ maxWidth: '100%', maxHeight: '70vh', width: 'auto', height: 'auto', cursor: 'crosshair', borderRadius: '4px', display: 'block' }}
                    onMouseDown={handlePointerDown}
                    onMouseMove={handlePointerMove}
                    onMouseUp={handlePointerUp}
                    onMouseLeave={() => drawing && handlePointerUp()}
                    onTouchStart={(e) => handlePointerDown(e.touches[0])}
                    onTouchMove={(e) => { e.preventDefault(); handlePointerMove(e.touches[0]); }}
                    onTouchEnd={handlePointerUp}
                />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button type="button" className="btn btn-secondary" onClick={handleUndo} disabled={rects.length === 0}>
                    ↩️ Annulla ultima banda
                </button>
                <button type="button" className="btn btn-secondary" onClick={onCancel}>
                    Annulla
                </button>
                <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={applying}>
                    {applying ? 'Applico...' : `✅ Conferma${rects.length > 0 ? ` (${rects.length} bande)` : ' (nessuna banda)'}`}
                </button>
            </div>
        </div>
    );
}

export default PhotoRedactor;
