// src/utils/firma.js
// Firma electrónica — Ley 25.506 Argentina (firma electrónica, no digital)
//
// Mecanismo:
//   1. Se construye un payload determinístico (JSON con keys ordenadas)
//   2. Se genera SHA-256 via Web Crypto API (nativo en todos los browsers modernos)
//   3. Se guarda en la colección Firestore "firmasElectronicas" con serverTimestamp
//   4. Las reglas de Firestore impiden update/delete → inmutable
//
// El hash prueba integridad del dato.
// El UID de Firebase prueba identidad del firmante.
// El serverTimestamp de Firebase prueba el momento (sellado de tiempo).

import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

// ── SHA-256 via Web Crypto API ────────────────────────────────────────────────
async function sha256(text) {
    const encoder    = new TextEncoder();
    const data       = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray  = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Ordena keys recursivamente para serialización determinística
function sortKeys(obj) {
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return obj;
    return Object.keys(obj).sort().reduce((acc, k) => {
        acc[k] = sortKeys(obj[k]);
        return acc;
    }, {});
}

// ── firmarDocumento ───────────────────────────────────────────────────────────
// Genera el hash y escribe el registro de firma en Firestore.
// Retorna { hash, firmaId }
//
// Parámetros:
//   tipo        — string que identifica el tipo de documento firmado
//                 Ej: "cierre_jornada" | "ronda_completada" | "informe_novedad" | "planilla_vig"
//   datos       — objeto con el snapshot del documento en el momento de la firma
//   empresaId   — ID de la empresa
//   uid         — Firebase UID del firmante (nunca editable por el cliente)
//   displayName — nombre visible del firmante
//   email       — email del firmante
//   legajo      — legajo del vigilador (opcional)
//   referenciaId— ID del documento original firmado (rondaId, jornadaID, etc.)
export async function firmarDocumento({
    tipo,
    datos,
    empresaId,
    uid,
    displayName = "",
    email       = "",
    legajo      = null,
    referenciaId= null,
}) {
    if (!uid) throw new Error("firmarDocumento: uid es requerido");

    // Payload determinístico — mismo dato → mismo hash siempre
    const payload = JSON.stringify({
        tipo,
        datos:       sortKeys(datos),
        empresaId:   empresaId || null,
        uid,
        referenciaId:referenciaId || null,
        // No incluimos Date.now() en el payload para que sea reproducible;
        // el tiempo real de firma lo aporta serverTimestamp de Firestore.
    });

    const hash = await sha256(payload);

    const docRef = await addDoc(collection(db, "firmasElectronicas"), {
        tipo,
        datos,
        hash,
        empresaId:    empresaId    || null,
        uid,
        displayName,
        email,
        legajo:       legajo       || null,
        referenciaId: referenciaId || null,
        timestamp:    serverTimestamp(),  // inamovible — generado por Firebase
        estado:       "vigente",          // nunca se actualiza
    });

    return { hash, firmaId: docRef.id };
}
