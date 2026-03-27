// src/utils/dateUtils.js
// Helpers de fecha compartidos — fuente canónica para parseo y cálculos de fecha.
// Importar desde aquí; no re-definir en pantallas.

import { EXCEL_EPOCH_DAYS, MS_POR_DIA, DAYS_PER_YEAR } from "../config/constants";

// ── Conversión de serial Excel a Date JS ──────────────────────────────────────
// Excel guarda fechas como días enteros desde 01/01/1900 (con bug: cuenta 1900 como bisiesto).
// 25569 = días entre ese epoch y Unix epoch (01/01/1970).
export function excelDateToJS(serial) {
    return new Date((serial - EXCEL_EPOCH_DAYS) * MS_POR_DIA);
}

// ── Parseo universal de fechas ────────────────────────────────────────────────
// Acepta: Firestore Timestamp | Date | número Excel | string "DD/MM/YYYY" | string ISO
export function parseFecha(val) {
    if (!val && val !== 0) return null;
    if (val?.toDate)        return val.toDate();            // Firestore Timestamp
    if (val instanceof Date) return isNaN(val) ? null : val;
    // Número Excel (serial) o string que sea un número en rango válido
    const num = typeof val === "number" ? val : Number(val);
    if (!isNaN(num) && num > 20000 && num < 60000) {
        const d = excelDateToJS(num);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof val === "string") {
        if (val.includes("/")) {
            // "DD/MM/YYYY"
            const [d, m, y] = val.split("/").map(Number);
            if (y >= 1900) return new Date(y, m - 1, d);
            return null;
        }
        const d = new Date(val);   // ISO u otro formato estándar
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
}

// ── Edad en años (entero) ─────────────────────────────────────────────────────
export function calcEdad(fecha) {
    const d = parseFecha(fecha);
    if (!d) return null;
    const diff = (Date.now() - d) / (MS_POR_DIA * DAYS_PER_YEAR);
    return isNaN(diff) || diff < 0 ? null : Math.floor(diff);
}

// ── Antigüedad en años (decimal) ──────────────────────────────────────────────
export function calcAntiguedad(fecha) {
    const d = parseFecha(fecha);
    if (!d) return null;
    const diff = (Date.now() - d) / (MS_POR_DIA * DAYS_PER_YEAR);
    return isNaN(diff) || diff < 0 ? null : diff;
}
