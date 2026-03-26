// src/hooks/usePersonalData.js
// Carga personal de la empresa desde la colección "legajos".
// Puede filtrar por cargo/rol si se necesita un subconjunto específico.

import { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

/**
 * @param {string} empresaId
 * @param {{ rol?: string, cargo?: string }} [filtros] - filtros opcionales
 */
export function usePersonalData(empresaId, filtros = {}) {
    const [personal,  setPersonal]  = useState([]);
    const [cargando,  setCargando]  = useState(true);

    const cargar = async () => {
        if (!empresaId) { setCargando(false); return; }
        setCargando(true);
        try {
            let q = query(collection(db, "legajos"), where("empresaId", "==", empresaId));
            const snap = await getDocs(q);
            let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Filtro local por rol o cargo si se especifica
            if (filtros.rol) {
                const rolLower = filtros.rol.toLowerCase();
                docs = docs.filter(d => String(d.rol || "").toLowerCase().includes(rolLower));
            }
            if (filtros.cargo) {
                const cargoLower = filtros.cargo.toLowerCase();
                docs = docs.filter(d => String(d.cargo || "").toLowerCase().includes(cargoLower));
            }

            setPersonal(docs);
        } catch (e) {
            console.error("usePersonalData error:", e);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => { cargar(); }, [empresaId, filtros.rol, filtros.cargo]);

    // Helpers por rol para compatibilidad con usos anteriores
    const supervisores = personal.filter(p =>
        String(p.rol || p.cargo || "").toUpperCase().includes("SUPERVISOR") ||
        String(p.tarea || "").toUpperCase().includes("SUPERVISOR")
    );
    const conductores = personal.filter(p =>
        String(p.rol || p.cargo || "").toUpperCase().includes("CONDUCTOR")
    );
    const encargados = personal.filter(p =>
        String(p.rol || p.cargo || "").toUpperCase().includes("ENCARGADO") ||
        String(p.tarea || "").toUpperCase().includes("ENCARGADO")
    );
    const vigiladores = personal.filter(p =>
        String(p.rol || p.cargo || "").toUpperCase().includes("VIGILADOR")
    );

    return { personal, supervisores, conductores, encargados, vigiladores, cargando, recargar: cargar };
}
