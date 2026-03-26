// src/utils/formatters.js
// Funciones de formato globales — aplicar en TODOS los módulos

/**
 * Formatea un objetivo para mostrar en UI.
 * Formato completo: "217-103-2 Cerro Moro PAS Supervisor"
 *
 * Campos del documento:
 *   cCosto        — C Costo          (ej: 217)
 *   numProyecto   — Nº Proyecto      (ej: 103)
 *   numObjetivo   — Nº Objetivo      (ej: 2)
 *   nombreProyecto— Nombre Proyecto  (ej: "Cerro Moro")
 *   nombre        — Nombre Objetivo  (ej: "PAS Supervisor")
 *
 * @param {object} o - documento objetivo
 * @returns {string}
 */
export function fmtObjetivo(o) {
    if (!o) return "";
    const codigo = [o.cCosto, o.numProyecto, o.numObjetivo].filter(Boolean).join("-");
    const partes  = [codigo, o.nombreProyecto, o.nombre].filter(Boolean);
    return partes.join(" ");
}

/**
 * Código compuesto del objetivo: "cCosto-numProyecto-numObjetivo"
 * Ej: "217-103-2"
 */
export function codigoObjetivo(o) {
    if (!o) return "";
    return [o.cCosto, o.numProyecto, o.numObjetivo]
        .filter(Boolean).join("-");
}

/**
 * Formatea un proyecto para mostrar en UI.
 * Formato: "217-103 Cerro Moro"
 */
export function fmtProyecto(nombreProyecto, cCosto, numProyecto) {
    if (!nombreProyecto) return "";
    const codigo = [cCosto, numProyecto].filter(Boolean).join("-");
    return codigo ? `${codigo} ${nombreProyecto}` : nombreProyecto;
}
