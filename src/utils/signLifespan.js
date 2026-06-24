// La pellicola rifrangente dei segnali stradali ha una durata legale limitata
// (tipicamente 5-10 anni). Oltre questa soglia il segnale è da considerarsi
// "scaduto per usura del materiale" e va inserito nei piani di sostituzione.
export const MAX_SIGN_LIFESPAN_YEARS = 10;

// Calcola l'età del segnale in anni a partire dalla data di installazione.
// Restituisce null se la data non è disponibile o non valida.
export function getSignAgeYears(installationDate) {
    if (!installationDate) return null;
    const installed = new Date(installationDate);
    if (isNaN(installed.getTime())) return null;

    const diffMs = Date.now() - installed.getTime();
    return diffMs / (1000 * 60 * 60 * 24 * 365.25);
}

// Vero se il segnale ha superato la durata massima legale del materiale rifrangente.
export function isSignExpired(installationDate) {
    const age = getSignAgeYears(installationDate);
    return age !== null && age > MAX_SIGN_LIFESPAN_YEARS;
}
