// src/utils/seedFirestoreDiagramas.js
// Ejecutar una sola vez para poblar Firestore con los diagramas 14x14

import { doc, setDoc, updateDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { GRUPOS_14x14, PERSONAS_POR_GRUPO } from "../data/seedDiagramas14x14";

function norm(s) {
    return String(s || "").toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ").trim();
}

// Asigna grupoTurno14 en masa a los legajos que coincidan por nombre
export async function seedAsignarGrupos(empresaId) {
    const snap = await getDocs(query(collection(db, "legajos"), where("empresaId", "==", empresaId)));
    const legajos = snap.docs.map(d => ({ docId: d.id, ...d.data() }));

    let ok = 0, noEncontrado = [];
    for (const [grupo, nombres] of Object.entries(PERSONAS_POR_GRUPO)) {
        for (const nombre of nombres) {
            const match = legajos.find(l => norm(l.nombre) === norm(nombre));
            if (match) {
                await updateDoc(doc(db, "legajos", match.docId), { grupoTurno14: grupo });
                ok++;
            } else {
                noEncontrado.push(`[G${grupo}] ${nombre}`);
            }
        }
    }
    return { ok, noEncontrado };
}

export async function seedDiagramas14x14(empresaId) {
    for (const grupo of GRUPOS_14x14) {
        const docId = `${empresaId}_${grupo.id}`;
        await setDoc(doc(db, "diagramas14x14", docId), {
            empresaId,
            grupo:   grupo.grupo,
            nombre:  grupo.nombre,
            francos: [...new Set(grupo.francos)].sort(),
        });
        console.log(`✓ Grupo ${grupo.grupo} guardado (${grupo.francos.length} francos)`);
    }
    console.log("✓ Seed completado");
}
