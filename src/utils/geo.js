// === Geometria spaziale: geofencing zone sensibili (Scuole, Ospedali, ZTL) ===

export function distanceMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = deg => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isPointInPolygon(lat, lng, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [latI, lngI] = polygon[i];
        const [latJ, lngJ] = polygon[j];
        const intersect = ((lngI > lng) !== (lngJ > lng)) &&
            (lat < (latJ - latI) * (lng - lngI) / (lngJ - lngI) + latI);
        if (intersect) inside = !inside;
    }
    return inside;
}

export function distanceToPolygonMeters(lat, lng, polygon) {
    if (isPointInPolygon(lat, lng, polygon)) return 0;
    let min = Infinity;
    for (const [pLat, pLng] of polygon) {
        const d = distanceMeters(lat, lng, pLat, pLng);
        if (d < min) min = d;
    }
    return min;
}

export function findNearestZone(lat, lng, zones) {
    let nearest = null;
    for (const zone of zones) {
        const inside = isPointInPolygon(lat, lng, zone.coordinates);
        const distance = inside ? 0 : distanceToPolygonMeters(lat, lng, zone.coordinates);
        if (!nearest || distance < nearest.distance) {
            nearest = { zone, distance, inside };
        }
    }
    return nearest;
}

// Ritorna il moltiplicatore di priorità della zona sensibile che contiene il punto, altrimenti 1.0
export function getPriorityMultiplier(lat, lng, zones) {
    for (const zone of zones) {
        if (isPointInPolygon(lat, lng, zone.coordinates)) {
            return { multiplier: zone.priority_multiplier, zone };
        }
    }
    return { multiplier: 1.0, zone: null };
}
