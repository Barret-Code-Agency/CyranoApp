// src/utils/geoUtils.js
// Utilidades de geolocalización para el sistema de rondas GPS

/**
 * Calcula la distancia en metros entre dos puntos GPS (fórmula Haversine)
 */
export function distanciaMetros(lat1, lng1, lat2, lng2) {
    const R    = 6371000; // radio Tierra en metros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a    = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Verifica si una posición está dentro del radio de un checkpoint
 */
export function dentroDeGeofence(posLat, posLng, cpLat, cpLng, radioMetros = 30) {
    return distanciaMetros(posLat, posLng, cpLat, cpLng) <= radioMetros;
}

/**
 * Convierte minutos a string legible — 90 → "1h 30min"
 */
export function formatearDuracion(minutos) {
    if (!minutos || minutos <= 0) return "—";
    if (minutos < 60) return `${Math.round(minutos)}min`;
    const h = Math.floor(minutos / 60);
    const m = Math.round(minutos % 60);
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/**
 * Formatea un Date o Firestore Timestamp a HH:MM
 */
export function formatearHora(ts) {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Formatea un Date o Firestore Timestamp a fecha corta
 */
export function formatearFecha(ts) {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * Genera un ID simple único (para checkpoints y tareas)
 */
export const uid = () => Math.random().toString(36).slice(2, 9);
