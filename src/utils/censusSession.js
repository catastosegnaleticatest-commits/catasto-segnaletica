// Gestione della "Sessione di Censimento": permette all'operatore di impostare
// una via e un riferimento ordinanza predefiniti che vengono applicati a tutti
// i nuovi segnali rilevati finché la sessione non viene chiusa.

const STORAGE_KEY = 'censusSession';

export function getCensusSession() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function startCensusSession({ via_predefinita, ordinanza_predefinita }) {
    const session = {
        via_predefinita: via_predefinita || '',
        ordinanza_predefinita: ordinanza_predefinita || '',
        started_at: new Date().toISOString(),
        count: 0,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return session;
}

export function closeCensusSession() {
    localStorage.removeItem(STORAGE_KEY);
}

// Incrementa il contatore dei segnali censiti nella sessione corrente e
// restituisce la sessione aggiornata (o null se nessuna sessione è attiva)
export function incrementCensusCount() {
    const session = getCensusSession();
    if (!session) return null;
    session.count = (session.count || 0) + 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return session;
}
