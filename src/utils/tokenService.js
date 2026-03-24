// src/utils/tokenService.js
// Servicio centralizado para otorgar y consumir tokens.

import {
    doc, getDoc, setDoc, updateDoc, addDoc,
    collection, serverTimestamp, increment,
} from "firebase/firestore";
import { db } from "../firebase";

export const TOKENS = {
    CAP_CORTA:   10,   // capacitación < 1h
    CAP_LARGA:   25,   // capacitación >= 1h
    BONUS_MES:   15,   // completó todos los cursos del mes
    RONDA:        3,   // ronda completada sin incidentes
};

/**
 * Otorga tokens a un usuario y registra el movimiento.
 */
export async function otorgarTokens(uid, empresaId, cantidad, motivo) {
    if (!uid || !empresaId || cantidad <= 0) return;
    const ref = doc(db, "tokens", uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
        await updateDoc(ref, { saldo: increment(cantidad), updatedAt: serverTimestamp() });
    } else {
        await setDoc(ref, { uid, empresaId, saldo: cantidad, updatedAt: serverTimestamp() });
    }
    await addDoc(collection(db, "tokensMovimientos"), {
        uid, empresaId, cantidad, motivo,
        tipo: "ganado",
        creadoEn: serverTimestamp(),
    });
    return cantidad;
}

/**
 * Descuenta tokens al aprobar un canje.
 */
export async function consumirTokens(uid, empresaId, cantidad, motivo) {
    if (!uid || !empresaId || cantidad <= 0) return;
    const ref = doc(db, "tokens", uid);
    await updateDoc(ref, { saldo: increment(-cantidad), updatedAt: serverTimestamp() });
    await addDoc(collection(db, "tokensMovimientos"), {
        uid, empresaId, cantidad: -cantidad, motivo,
        tipo: "canjeado",
        creadoEn: serverTimestamp(),
    });
}

/**
 * Calcula tokens para una capacitación según su duración.
 * horaInicio y horaFin son strings "HH:MM".
 */
export function tokensParaCapacitacion(horaInicio, horaFin) {
    try {
        const [h1, m1] = horaInicio.split(":").map(Number);
        const [h2, m2] = horaFin.split(":").map(Number);
        const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (mins <= 0) return TOKENS.CAP_CORTA;
        return mins >= 60 ? TOKENS.CAP_LARGA : TOKENS.CAP_CORTA;
    } catch {
        return TOKENS.CAP_CORTA;
    }
}
