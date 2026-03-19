// src/hooks/usePersonalData.js
// Carga supervisores, vigiladores y encargados de la empresa desde Firestore.

import { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export function usePersonalData(empresa) {
    const [supervisores, setSupervisores] = useState([]);
    const [vigiladores,  setVigiladores]  = useState([]);
    const [encargados,   setEncargados]   = useState([]);
    const [cargando,     setCargando]     = useState(true);

    const cargar = async () => {
        if (!empresa) { setCargando(false); return; }
        setCargando(true);
        try {
            const [sSnap, vSnap, eSnap] = await Promise.all([
                getDocs(query(collection(db, "supervisores"), where("empresa", "==", empresa))),
                getDocs(query(collection(db, "vigiladores"),  where("empresa", "==", empresa))),
                getDocs(query(collection(db, "encargados"),   where("empresa", "==", empresa))),
            ]);
            setSupervisores(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setVigiladores (vSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setEncargados  (eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error("usePersonalData error:", e);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => { cargar(); }, [empresa]);

    return { supervisores, vigiladores, encargados, cargando, recargar: cargar };
}
