// src/utils/periodoUtils.js
// Utilidades compartidas de período: helpers de fechas, constantes y funciones de turno.
// FUENTE CANÓNICA — importar desde aquí, nunca re-definir en los pantallas.

// ── Localización ─────────────────────────────────────────────────────────────
export const DIAS_ES    = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
export const MESES_ES   = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                           "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
export const MESES_CORTO = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// ── Período de liquidación ────────────────────────────────────────────────────
// Retorna un array de Date desde el 24 del mes anterior hasta el 23 del mes indicado.
// Fuente canónica: ProgramacionServiciosScreen.jsx
export function getDias(año, mes) {
    const dias = [];
    let cur = new Date(año, mes - 2, 24); // 0-indexed month
    const end = new Date(año, mes - 1, 23);
    while (cur <= end) {
        dias.push(new Date(cur));
        cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    }
    return dias;
}

// Retorna un array de Date del día 1 al último día del mes indicado (mes calendario).
export function getDiasCalendario(año, mes) {
    const dias = [];
    const total = new Date(año, mes, 0).getDate(); // último día del mes
    for (let d = 1; d <= total; d++) {
        dias.push(new Date(año, mes - 1, d));
    }
    return dias;
}

// ── Clave de fecha ────────────────────────────────────────────────────────────
// Retorna "YYYY-MM-DD" a partir de un objeto Date.
// IMPORTANTE: esta versión construye la clave manualmente (no usa toISOString)
// para evitar problemas de zona horaria. Es distinta a la versión de VigHome,
// SupervisorHome y AdministrativoHome (que usan d.toISOString().slice(0,10)).
// No reemplazar la versión de esos archivos.
export function fmtKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ── Códigos de ausentismo / no-laboral ───────────────────────────────────────
// Vac: vacaciones  |  Enf: enfermedad  |  Art: accidente  |  Asa/Aca/Sus/Lic: licencias
export const AUS_CODES      = ["Vac","Enf","Art","Asa","Aca","Sus","Lic"];
// Ausentismo REAL (excluye vacaciones y francos que no son ausentismo disciplinario)
export const REAL_AUS_CODES = ["Enf","Art","Asa","Aca","Sus","Lic"];


// Días no-laborales (franco, compuesto, feriado, licencia) — no generan horas
const NO_LABORAL_CODES = ["Fco","Com","FER","Lic"];

// Devuelve true si el valor representa un turno horario facturable
export function esLaboral(val) {
    return Boolean(val) && !NO_LABORAL_CODES.includes(val);
}

// ── Índice de días para lookup de horas contractuales ─────────────────────────
// Orden: Dom=0, Lun=1, …, Sáb=6  (igual que Date.getDay())
export const HORAS_KEYS = [
    "horasDomingo","horasLunes","horasMartes","horasMiercoles",
    "horasJueves","horasViernes","horasSabado",
];

// Lee las horas contratadas para un día desde un documento de horas (override o objetivo).
// Soporta:
//   Formato nuevo → hc.dias["YYYY-MM-DD"]   (un valor por fecha, guardado desde HorasObjetivoMesScreen)
//   Formato viejo → hc.horasLunes, hc.horasFeriados, etc.  (objetivo base o override legacy)
// FERIADOS_ARG se importa donde se use esta función; aquí se recibe como parámetro para
// no crear dependencia circular con utils/feriados.
export function horasDiaDeDoc(dia, hc, diasEsp = {}, feriadosMap = {}) {
    if (!hc) return null;
    const key = fmtKey(dia);
    if (diasEsp[key] === false) return 0;
    // Formato nuevo: mapa por fecha
    if (hc.dias) return (key in hc.dias) ? hc.dias[key] : null;
    // Formato viejo: feriado
    if (feriadosMap[key]) return hc.horasFeriados != null ? Number(hc.horasFeriados) : null;
    // Formato viejo: día de semana
    const hs = hc[HORAS_KEYS[dia.getDay()]];
    return hs != null ? Number(hs) : null;
}

// ── Horas de un turno ─────────────────────────────────────────────────────────
// Interpreta un string de turno "HH:MM – HH:MM" y devuelve las horas trabajadas.
// Maneja typeof number, todos los códigos de ausentismo/no-laboral → 0.
export function horasDeValor(val) {
    if (typeof val === "number") return val;
    if (!val) return 0;
    if (NO_LABORAL_CODES.includes(val) || AUS_CODES.includes(val)) return 0;
    const partes = val.split(/\s*[-\u2013\u2014]\s*/);
    if (partes.length !== 2) return 0;
    const [h1, m1] = partes[0].split(":").map(Number);
    const [h2, m2] = partes[1].split(":").map(Number);
    if (isNaN(h1) || isNaN(h2)) return 0;
    const ini = h1 * 60 + (m1 || 0);
    const fin = h2 * 60 + (m2 || 0);
    return (fin > ini ? fin - ini : fin + 1440 - ini) / 60;
}

// ── Redondeo a 1 decimal ──────────────────────────────────────────────────────
export function r1(n) { return Math.round(n * 10) / 10; }

// ── Normalizador de turno manual ──────────────────────────────────────────────
// Convierte "6-14", "06/14", "6 a 14", "6:00-14" → "06:00 – 14:00"
export function normalizarTurno(str) {
    if (typeof str !== "string") return str;
    // Normalizar newlines → espacio para unificar patrones
    const s = str.trim().replace(/\n+/g, " ");
    if (!s) return s;
    // "HH:MM – HH:MM" (cualquier guión)
    const ya = s.match(/^(\d{1,2}):(\d{2})\s*[-\u2013\u2014]\s*(\d{1,2}):(\d{2})$/);
    if (ya) return `${String(ya[1]).padStart(2,"0")}:${ya[2]} \u2013 ${String(ya[3]).padStart(2,"0")}:${ya[4]}`;
    // "HH:MM a HH:MM" (separador "a" con minutos)
    const conA = s.match(/^(\d{1,2}):(\d{2})\s+a\s+(\d{1,2}):(\d{2})$/i);
    if (conA) return `${String(conA[1]).padStart(2,"0")}:${conA[2]} \u2013 ${String(conA[3]).padStart(2,"0")}:${conA[4]}`;
    // "HH:MM HH:MM" (solo espacio o newline como separador)
    const solo = s.match(/^(\d{1,2}):(\d{2})\s+(\d{1,2}):(\d{2})$/);
    if (solo) return `${String(solo[1]).padStart(2,"0")}:${solo[2]} \u2013 ${String(solo[3]).padStart(2,"0")}:${solo[4]}`;
    // "H-H", "H/H", "H a H" (sin minutos)
    const sin = s.match(/^(\d{1,2})\s*[-\u2013\u2014\/a]\s*(\d{1,2})$/i);
    if (sin) return `${String(sin[1]).padStart(2,"0")}:00 \u2013 ${String(sin[2]).padStart(2,"0")}:00`;
    // Mix: un lado con minutos, separador guión/barra/a
    const mix = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(?:[-\u2013\u2014\/]|a)\s*(\d{1,2})(?::(\d{2}))?$/i);
    if (mix) {
        const h1 = String(mix[1]).padStart(2,"0"); const m1 = String(mix[2] || "00").padStart(2,"0");
        const h2 = String(mix[3]).padStart(2,"0"); const m2 = String(mix[4] || "00").padStart(2,"0");
        return `${h1}:${m1} \u2013 ${h2}:${m2}`;
    }
    return s;
}

// ── Opciones de turno ─────────────────────────────────────────────────────────
// Array canónico de turnos. ProgramacionServiciosScreen tiene entradas adicionales
// (06:00 – 15:00, 17:00 – 07:00, 20:00 – 07:00) que ControlClienteScreen no tiene.
// Esta versión es la de ProgramacionServiciosScreen (más completa).
export const OPCIONES = [
    { val: "",              label: "—",      cls: ""    },
    // Diurnos
    { val: "06:00 – 14:00", label: "06-14",  cls: "dia" },
    { val: "06:00 – 15:00", label: "06-15",  cls: "dia" },
    { val: "06:00 – 16:00", label: "06-16",  cls: "dia" },
    { val: "06:00 – 19:00", label: "06-19",  cls: "dia" },
    { val: "06:00 – 18:00", label: "06-18",  cls: "dia" },
    { val: "07:00 – 17:00", label: "07-17",  cls: "dia" },
    { val: "07:00 – 19:00", label: "07-19",  cls: "dia" },
    { val: "08:00 – 20:00", label: "08-20",  cls: "dia" },
    { val: "09:00 – 17:00", label: "09-17",  cls: "dia" },
    { val: "09:00 – 18:00", label: "09-18",  cls: "dia" },
    { val: "10:00 – 18:00", label: "10-18",  cls: "dia" },
    { val: "05:00 – 13:00", label: "05-13",  cls: "dia" },
    { val: "05:00 – 13:30", label: "05-13½", cls: "dia" },
    { val: "05:00 – 17:00", label: "05-17",  cls: "dia" },
    { val: "13:00 – 21:00", label: "13-21",  cls: "tard"},
    { val: "13:30 – 22:00", label: "13½-22", cls: "tard"},
    // Tarde
    { val: "14:00 – 22:00", label: "14-22",  cls: "tard"},
    // Noche
    { val: "17:00 – 05:00", label: "17-05",  cls: "noch"},
    { val: "17:00 – 07:00", label: "17-07",  cls: "noch"},
    { val: "18:00 – 06:00", label: "18-06",  cls: "noch"},
    { val: "19:00 – 07:00", label: "19-07",  cls: "noch"},
    { val: "21:00 – 06:00", label: "21-06",  cls: "noch"},
    { val: "20:00 – 07:00", label: "20-07",  cls: "noch"},
    { val: "22:00 – 06:00", label: "22-06",  cls: "noch"},
    // Guardia 24hs
    { val: "06:00 – 06:00", label: "06-06",  cls: "g24" },
    { val: "07:00 – 07:00", label: "07-07",  cls: "g24" },
    { val: "08:00 – 08:00", label: "08-08",  cls: "g24" },
    // Descanso / licencia
    { val: "Fco",           label: "Fco",    cls: "fco" },
    { val: "Com",           label: "Com",    cls: "com" },
    { val: "FER",           label: "FER",    cls: "fer" },
    { val: "Lic",           label: "Lic",    cls: "lic" },
    // Ausentismo / licencias
    { val: "Vac",           label: "Vac",    cls: "vac" },
    { val: "Enf",           label: "Enf",    cls: "enf" },
    { val: "Art",           label: "ART",    cls: "art" },
    { val: "Asa",           label: "ASA",    cls: "asa" },
    { val: "Aca",           label: "ACA",    cls: "aca" },
    { val: "Sus",           label: "Sus",    cls: "sus" },
];
