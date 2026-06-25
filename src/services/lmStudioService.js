const DEFAULT_BASE_URL = 'http://localhost:1234/v1';
const STORAGE_KEY = 'lmStudio_url';

function getBaseUrl() {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_BASE_URL;
}

export function setBaseUrl(url) {
    localStorage.setItem(STORAGE_KEY, url.replace(/\/$/, ''));
}

export function getConfiguredUrl() {
    return getBaseUrl();
}

export async function ping() {
    const res = await fetch(`${getBaseUrl()}/models`, {
        signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.data ?? data; // lista modelli
}

async function chatCompletion(messages, { temperature = 0.3, max_tokens = 1024 } = {}) {
    const res = await fetch(`${getBaseUrl()}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'local-model',
            messages,
            temperature,
            max_tokens,
            stream: false,
        }),
        signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`LM Studio: HTTP ${res.status} — ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
}

// ─── Helper di dominio ────────────────────────────────────────────────────────

export async function askSql(question, signs = []) {
    const systemPrompt = `Sei un assistente per un catasto segnaletica stradale italiano.
Rispondi SEMPRE in italiano.
Hai accesso ai dati del catasto sotto forma di array JSON di segnali stradali.
Ogni segnale ha: id, type, status, latitude, longitude, notes, installation_date, photo (boolean), ordinanza_rif, numero_autorizzazione, proprietario.
I valori di status possono essere: 'active', 'damaged', 'removed', 'maintenance'.
I valori di type sono codici segnaletica (es. 'II.1', 'I.1', ecc.) oppure testo libero.
Rispondi con un'analisi chiara e concisa. Se disponibile, fornisci numeri precisi.`;

    const userMsg = `Dati catasto (${signs.length} segnali): ${JSON.stringify(signs.slice(0, 200))}

Domanda: ${question}`;

    const answer = await chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg },
    ]);
    return { explanation: answer, rows: [], rowCount: 0 };
}

export async function askRag(question) {
    const systemPrompt = `Sei un assistente esperto in normativa stradale italiana e gestione segnaletica.
Rispondi SEMPRE in italiano in modo chiaro e preciso.
Se non hai informazioni specifiche, dillo chiaramente e suggerisci dove cercare.`;

    const answer = await chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
    ]);
    return { answer, sources: [] };
}

export async function classifySign(description) {
    const systemPrompt = `Sei un esperto di segnaletica stradale italiana (Codice della Strada).
Classifica il segnale descritto e rispondi con un JSON: {"code": "...", "name": "...", "category": "..."}`;

    const answer = await chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: description },
    ], { max_tokens: 256 });

    try { return JSON.parse(answer); } catch { return { code: '?', name: answer, category: 'sconosciuta' }; }
}

const lmStudioService = { ping, askSql, askRag, classifySign, setBaseUrl, getConfiguredUrl };
export default lmStudioService;
