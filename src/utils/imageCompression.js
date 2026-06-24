// NOTA PRIVACY: i rilievi stradali possono inquadrare involontariamente volti o
// targhe (GDPR). Prima del salvataggio offline/crittografia, l'operatore può usare
// applyRedactions() per "disegnare" delle bande nere opache sopra le aree sensibili
// dell'immagine. Il risultato (data URL) sostituisce la foto originale: la versione
// non censurata non viene mai salvata né caricata.

// Disegna rettangoli neri opachi sopra un'immagine per coprire elementi sensibili
// (volti, targhe) prima del salvataggio. `redactions` è un array di rettangoli con
// coordinate normalizzate (0-1) relative alle dimensioni dell'immagine:
// [{ x, y, width, height }, ...]
export function applyRedactions(imageSrc, redactions = []) {
    return new Promise((resolve, reject) => {
        if (!redactions || redactions.length === 0) {
            resolve(imageSrc);
            return;
        }

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(img, 0, 0);

            ctx.fillStyle = '#000000';
            redactions.forEach(({ x, y, width, height }) => {
                ctx.fillRect(
                    x * canvas.width,
                    y * canvas.height,
                    width * canvas.width,
                    height * canvas.height
                );
            });

            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = reject;
        img.src = imageSrc;
    });
}

// Comprime un'immagine lato client ridimensionandola e convertendola in JPEG
export function compressImage(file, maxSize = 1920, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = Math.round(height * (maxSize / width));
                        width = maxSize;
                    } else {
                        width = Math.round(width * (maxSize / height));
                        height = maxSize;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
