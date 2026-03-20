// src/hooks/usePersonalData.js
// Carga supervisores, conductores y encargados de la empresa desde Firestore.

import { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export function usePersonalData(empresa) {
    const [supervisores, setSupervisores] = useState([]);
    const [conductores,  setConductores]  = useState([]);
    const [encargados,   setEncargados]   = useState([]);
    const [admins,       setAdmins]       = useState([]);
    const [cargando,     setCargando]     = useState(true);

    const cargar = async () => {
        if (!empresa) { setCargando(false); return; }
        setCargando(true);
        try {
            const [sSnap, vSnap, eSnap, aSnap] = await Promise.all([
                getDocs(query(collection(db, "supervisores"), where("empresa", "==", empresa))),
                getDocs(query(collection(db, "conductores"),  where("empresa", "==", empresa))),
                getDocs(query(collection(db, "encargados"),   where("empresa", "==", empresa))),
                getDocs(query(collection(db, "admins"),       where("empresa", "==", empresa))),
            ]);
            setSupervisores(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setConductores (vSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setEncargados  (eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setAdmins      (aSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error("usePersonalData error:", e);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => { cargar(); }, [empresa]);

    return { supervisores, conductores, encargados, admins, cargando, recargar: cargar };
}
