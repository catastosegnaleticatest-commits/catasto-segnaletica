// Motore geometrico deterministico per il posizionamento di infrastrutture stradali.
// Il modello LLM non calcola MAI coordinate: estrae solo l'intent JSON.
// Questo modulo produce tutti i vertici GeoJSON in modo matematicamente preciso.

const STALL_DIMS = {
    parallel:      { length: 5.0, width: 2.0 },
    perpendicular: { length: 2.5, width: 5.0 },
    angled:        { length: 4.5, width: 2.5 },
};

const LAT_PER_METER  = 1 / 111000;
function lngPerMeter(lat) { return 1 / (111000 * Math.cos(lat * Math.PI / 180)); }

function rotateVec(dx, dy, rad) {
    return [dx * Math.cos(rad) - dy * Math.sin(rad), dx * Math.sin(rad) + dy * Math.cos(rad)];
}

/**
 * Genera N stalli su strada come FeatureCollection GeoJSON.
 * @param {number} lat         Latitudine del punto di ancoraggio (inizio della fila)
 * @param {number} lng         Longitudine del punto di ancoraggio
 * @param {number} count       Numero di stalli
 * @param {string} arrangement 'parallel' | 'perpendicular' | 'angled'
 * @param {number} angleDeg    Direzione della strada rispetto al Nord (0 = Nord, 90 = Est)
 * @param {number} side        1 = destra, -1 = sinistra
 * @returns {GeoJSON.FeatureCollection}
 */
export function generateParkingGeometry(lat, lng, count = 3, arrangement = 'parallel', angleDeg = 90, side = 1) {
    const dims   = STALL_DIMS[arrangement] || STALL_DIMS.parallel;
    const rad    = (angleDeg * Math.PI) / 180;
    const llpm   = lngPerMeter(lat);
    const CURB   = 1.0 * side; // offset dal centro strada verso il marciapiede (metri)
    const features = [];

    for (let i = 0; i < count; i++) {
        // Centro dello stallo lungo la direzione della strada
        const along = (i + 0.5) * dims.length; // metri lungo l'asse stradale
        const perp  = CURB + (dims.width / 2) * side; // metri perpendicolare

        const [dLngAlong, dLatAlong] = rotateVec(along * llpm, 0, rad);
        const [dLngPerp,  dLatPerp]  = rotateVec(0, perp * LAT_PER_METER, rad);

        const cx = lng + dLngAlong - dLatAlong * (llpm / LAT_PER_METER) + dLngPerp;
        const cy = lat + dLatAlong + dLatPerp;

        // 4 angoli dello stallo
        const halfL = dims.length / 2;
        const halfW = dims.width  / 2;
        const corners = [
            [-halfL, -halfW],
            [ halfL, -halfW],
            [ halfL,  halfW],
            [-halfL,  halfW],
            [-halfL, -halfW],
        ];

        const coords = corners.map(([a, p]) => {
            const [dlng, dlat] = rotateVec(a * llpm, p * LAT_PER_METER, rad);
            return [cx + dlng, cy + dlat];
        });

        features.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [coords] },
            properties: {
                stall_index:   i + 1,
                arrangement,
                length_m:      dims.length,
                width_m:       dims.width,
                angle_deg:     angleDeg,
                side,
                compliant:     true,
                note:          `Stallo ${i + 1} — ${dims.length}m × ${dims.width}m (${arrangement}) — D.M. 2001`,
            },
        });
    }

    return { type: 'FeatureCollection', features };
}

/**
 * Applica una rotazione incrementale (deltaAngleDeg) all'intera FeatureCollection,
 * ruotando attorno al centroide del primo stallo.
 */
export function rotateFeatureCollection(fc, centerLat, centerLng, deltaAngleDeg) {
    const rad  = (deltaAngleDeg * Math.PI) / 180;
    const llpm = lngPerMeter(centerLat);

    return {
        ...fc,
        features: fc.features.map(f => ({
            ...f,
            geometry: {
                ...f.geometry,
                coordinates: [
                    f.geometry.coordinates[0].map(([lng, lat]) => {
                        const dx = (lng - centerLng) / llpm;
                        const dy = (lat - centerLat) / LAT_PER_METER;
                        const [rx, ry] = rotateVec(dx, dy, rad);
                        return [centerLng + rx * llpm, centerLat + ry * LAT_PER_METER];
                    }),
                ],
            },
        })),
    };
}

/**
 * Capovolge la fila di stalli sul lato opposto della strada.
 */
export function flipSide(fc, originLat, originLng, count, arrangement, angleDeg) {
    const currentSide = fc.features[0]?.properties?.side ?? 1;
    return generateParkingGeometry(originLat, originLng, count, arrangement, angleDeg, -currentSide);
}
