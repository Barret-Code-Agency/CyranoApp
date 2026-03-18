// src/hooks/useClientesData.js
// Carga clientes, objetivos y puestos de la empresa desde Firestore.

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../firebase";

export function useClientesData(empresa) {
    const [clientes,  setClientes]  = useState([]);
    const [objetivos, setObjetivos] = useState([]);
    const [puestos,   setPuestos]   = useState([]);
    const [cargando,  setCargando]  = useState(true);

    const cargar = async () => {
        if (!empresa) { setCargando(false); return; }
        setCargando(true);
        try {
            const [csSnap, osSnap, psSnap] = await Promise.all([
                getDocs(query(collection(db, "clientes"),  where("empresa", "==", empresa))),
                getDocs(query(collection(db, "objetivos"), where("empresa", "==", empresa))),
                getDocs(query(collection(db, "puestos"),   where("empresa", "==", empresa))),
            ]);
            setClientes (csSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setObjetivos(osSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setPuestos  (psSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error("useClientesData error:", e);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => { cargar(); }, [empresa]);

    return { clientes, objetivos, puestos, cargando, recargar: cargar };
}
