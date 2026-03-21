// src/utils/periodoUtils.js
// Utilidades compartidas de período: helpers de fechas y constantes de turno.
// Copiados de ProgramacionServiciosScreen.jsx como fuente canónica.

// ── Localización ─────────────────────────────────────────────────────────────
// NOTA: DIAS_ES y MESES_ES son las abreviaciones cortas (3 caracteres).
// Las versiones "LARGO" permanecen en cada archivo que las necesite.
export const DIAS_ES  = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
export const MESES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                         "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

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

// ── Clave de fecha ────────────────────────────────────────────────────────────
// Retorna "YYYY-MM-DD" a partir de un objeto Date.
// IMPORTANTE: esta versión construye la clave manualmente (no usa toISOString)
// para evitar problemas de zona horaria. Es distinta a la versión de VigHome,
// SupervisorHome y AdministrativoHome (que usan d.toISOString().slice(0,10)).
// No reemplazar la versión de esos archivos.
export function fmtKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ── Horas de un turno ─────────────────────────────────────────────────────────
// Interpreta un string de turno "HH:MM – HH:MM" y devuelve las horas trabajadas.
// Fuente canónica: ProgramacionServiciosScreen.jsx
// NOTA: Esta es la versión "base". FacturacionScreen, ConsolidadoScreen y
// ControlClienteScreen tienen variantes con lógica de filtrado diferente y
// NO fueron unificadas. Ver AUDITORIA.md para detalle.
export function horasDeValor(val) {
    if (!val) return 0;
    // Separa por cualquier variante de guion (-, –, —) con espacios opcionales
    const partes = val.split(/\s*[-\u2013\u2014]\s*/);
    if (partes.length !== 2) return 0;
    const [h1, m1] = partes[0].split(":").map(Number);
    const [h2, m2] = partes[1].split(":").map(Number);
    if (isNaN(h1) || isNaN(h2)) return 0;
    const ini = h1 * 60 + (m1 || 0);
    const fin = h2 * 60 + (m2 || 0);
    return (fin > ini ? fin - ini : fin + 1440 - ini) / 60;
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
