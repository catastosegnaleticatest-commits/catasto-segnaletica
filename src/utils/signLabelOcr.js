// OCR lato client (Tesseract.js) per leggere l'etichetta del produttore sul
// retro dei cartelli stradali professionali, da cui estrarre l'anno di
// fabbricazione/installazione e il riferimento all'ordinanza comunale.
// Usato in MobileAddSign.jsx per pre-compilare il form.

let tesseractPromise = null;

async function loadTesseract() {
    if (!tesseractPromise) {
        tesseractPromise = import('tesseract.js');
    }
    return tesseractPromise;
}

const CURRENT_YEAR = new Date().getFullYear();

// Cerca un anno plausibile (1990 - anno corrente + 1) nel testo riconosciuto
function extractYear(text) {
    const matches = text.match(/\b(19[9]\d|20[0-4]\d)\b/g);
    if (!matches) return null;

    const validYears = matches
        .map(y => parseInt(y, 10))
        .filter(y => y >= 1990 && y <= CURRENT_YEAR + 1);

    if (validYears.length === 0) return null;
    // Anno più recente trovato (in genere è quello di fabbricazione)
    return Math.max(...validYears);
}

// Cerca un riferimento a un'ordinanza comunale, es. "Ord. n. 123/2020",
// "Ordinanza n. 45/2019", "ORD. 12/2021"
function extractOrdinanceReference(text) {
    const pattern = /Ordinanza\.?\s*(?:Sindacale\s*)?[Nn]?[°.]?\s*([A-Za-z0-9]+\s*\/?\s*\d{2,4})|Ord\.?\s*[Nn]?[°.]?\s*([A-Za-z0-9]+\s*\/?\s*\d{2,4})/i;
    const match = text.match(pattern);
    if (!match) return null;

    const ref = (match[1] || match[2]).replace(/\s+/g, '');
    return ref;
}

// Analizza la foto dell'etichetta posteriore e restituisce i dati estratti
export async function extractSignLabelData(imageDataUrl) {
    const { default: Tesseract } = await loadTesseract();

    const { data } = await Tesseract.recognize(imageDataUrl, 'ita+eng');
    const text = data.text || '';

    const year = extractYear(text);
    const ordinance = extractOrdinanceReference(text);

    if (!year && !ordinance) return null;

    return { year, ordinance, rawText: text.trim() };
}
