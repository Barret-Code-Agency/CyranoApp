// src/utils/formatters.js
// Funciones de formato globales — aplicar en TODOS los módulos

/**
 * Formatea un objetivo para mostrar en UI.
 * Formato: "217-103-2 Cerro Moro - PAS Supervisor"
 *
 * @param {object} o - objeto objetivo con campos: codigo, proyecto, nombre
 * @returns {string}
 */
export function fmtObjetivo(o) {
    if (!o) return "";
    const partes = [];
    if (o.codigo)   partes.push(o.codigo);
    if (o.proyecto && o.nombre) partes.push(`${o.proyecto} - ${o.nombre}`);
    else if (o.nombre)   partes.push(o.nombre);
    else if (o.proyecto) partes.push(o.proyecto);
    return partes.join(" ");
}

/**
 * Formatea un proyecto para mostrar en UI.
 * Formato: "217-103 Cerro Moro"
 *
 * codigoCc puede derivarse de cualquier objetivo del proyecto
 * tomando los primeros dos segmentos de su código.
 *
 * @param {string} nombre    - nombre del proyecto ej. "Cerro Moro"
 * @param {string} [codigoCc] - código CC-Proyecto ej. "217-103"
 * @returns {string}
 */
export function fmtProyecto(nombre, codigoCc) {
    if (!nombre) return "";
    return codigoCc ? `${codigoCc} ${nombre}` : nombre;
}

/**
 * Deriva el código CC-Proyecto a partir del código de un objetivo.
 * "217-103-2" → "217-103"   |   "217-1-1" → "217-1"
 *
 * @param {string} codigoObjetivo - código completo del objetivo
 * @returns {string}
 */
export function codigoProyecto(codigoObjetivo) {
    if (!codigoObjetivo) return "";
    const partes = codigoObjetivo.toString().split("-");
    return partes.length >= 2 ? partes.slice(0, 2).join("-") : codigoObjetivo;
}
