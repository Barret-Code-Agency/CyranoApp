// src/config/constants.js — Constantes globales del sistema

// ── Super admin ────────────────────────────────────────────────────────────────
export const SUPER_ADMIN_EMAIL = "supervision.brinks@gmail.com";

// ── Empresa fallback ───────────────────────────────────────────────────────────
export const EMPRESA_ID_FALLBACK = "default";

// ── Anomalía: todos los valores que representan "Sí" ──────────────────────────
export const ANOMALIA_SI_VALORES = ["Si", "Sí", "SI", "sí", "si", true];
export const isAnomaliaPositiva  = (v) => ANOMALIA_SI_VALORES.includes(v);

// ── Horarios de turno ──────────────────────────────────────────────────────────
export const HORA_NOCTURNO_INICIO = 20 * 60;  // 20:00 hs
export const HORA_NOCTURNO_FIN    =  6 * 60;  // 06:00 hs

// ── Calificación: umbrales ─────────────────────────────────────────────────────
export const CALIF_UMBRALES = [
    { min: 9, label: "Excelente"    },
    { min: 7, label: "Muy bien"     },
    { min: 5, label: "Aceptable"    },
    { min: 3, label: "Regular"      },
    { min: 0, label: "Insuficiente" },
];
export const getCalifLabel = (ratingsOrAvg) => {
    if (ratingsOrAvg == null) return null;
    let avg;
    if (typeof ratingsOrAvg === "object") {
        const vals = Object.values(ratingsOrAvg).filter(v => v > 0);
        if (!vals.length) return null;
        avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    } else {
        avg = ratingsOrAvg;
    }
    return (CALIF_UMBRALES.find(u => avg >= u.min) || CALIF_UMBRALES.at(-1)).label;
};

// ── Campos de hora normalizados (actividades usan inicio/fin o horaInicio/horaFin) ──
export const getHoraInicio = (a) => a?.horaInicio || a?.inicio || "";
export const getHoraFin    = (a) => a?.horaFin    || a?.fin    || "";

// ── Validación ─────────────────────────────────────────────────────────────────
export const FILTRO_VIGILADOR_MIN_CHARS = 3;
export const ANOMALIA_INFORME_MIN_CHARS = 10;

// ── Tiempo ─────────────────────────────────────────────────────────────────────
export const MS_POR_DIA = 86_400_000;
