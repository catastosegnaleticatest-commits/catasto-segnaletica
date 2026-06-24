// Classificazione locale (in-browser) della foto di un segnale stradale,
// usata per pre-compilare il campo "Tipo Segnale" in MobileAddSign.jsx.
// Il modello (MobileNet/TensorFlow.js) viene caricato in modo lazy al primo
// utilizzo e poi resta in cache, per non appesantire il bundle iniziale.

let modelPromise = null;

async function loadModel() {
    if (!modelPromise) {
        modelPromise = (async () => {
            const tf = await import('@tensorflow/tfjs');
            const mobilenetModule = await import('@tensorflow-models/mobilenet');
            return mobilenetModule.load({ version: 2, alpha: 1.0 });
        })();
    }
    return modelPromise;
}

// Mappa tra le etichette ImageNet riconosciute da MobileNet e le categorie
// di segnali usate nell'app. Le parole chiave sono confrontate in modo
// case-insensitive con le etichette restituite dal modello.
const LABEL_TO_SIGN_TYPE = [
    { keywords: ['stop sign'], type: 'precedenza' },
    { keywords: ['traffic light', 'traffic signal'], type: 'precedenza' },
    { keywords: ['parking meter'], type: 'divieto' },
    { keywords: ['street sign'], type: 'indicazione' },
];

// Analizza l'immagine (data URL) e restituisce un suggerimento di tipo segnale,
// oppure null se il modello non riconosce nulla di utile.
export async function classifySignPhoto(imageDataUrl) {
    const model = await loadModel();

    const img = await loadImage(imageDataUrl);
    const predictions = await model.classify(img, 5);

    for (const prediction of predictions) {
        const label = prediction.className.toLowerCase();
        for (const mapping of LABEL_TO_SIGN_TYPE) {
            if (mapping.keywords.some(keyword => label.includes(keyword))) {
                return {
                    type: mapping.type,
                    label: prediction.className,
                    confidence: prediction.probability
                };
            }
        }
    }

    return null;
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}
