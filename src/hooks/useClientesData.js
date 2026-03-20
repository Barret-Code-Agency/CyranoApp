// src/hooks/useClientesData.js
// Carga clientes y objetivos de la empresa desde Firestore.

import { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export function useClientesData(empresa) {
    const [clientes,  setClientes]  = useState([]);
    const [objetivos, setObjetivos] = useState([]);
    const [cargando,  setCargando]  = useState(true);

    const cargar = async () => {
        if (!empresa) { setCargando(false); return; }
        setCargando(true);
        try {
            const [csSnap, osSnap] = await Promise.all([
                getDocs(query(collection(db, "clientes"),  where("empresa", "==", empresa))),
                getDocs(query(collection(db, "objetivos"), where("empresa", "==", empresa))),
            ]);
            setClientes (csSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setObjetivos(osSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error("useClientesData error:", e);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => { cargar(); }, [empresa]);

    return { clientes, objetivos, cargando, recargar: cargar };
}
