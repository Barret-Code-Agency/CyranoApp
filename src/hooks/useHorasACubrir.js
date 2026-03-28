// src/hooks/useHorasACubrir.js
// ─────────────────────────────────────────────────────────────────────────────
// FUENTE ÚNICA de "Horas a Cubrir" para el mes calendario.
//
// Lee de la colección horasObjetivoMes (editada en HorasObjetivoMesScreen).
// El mes calendario M se compone de dos períodos:
//   • Período A: días  1-23 del mes M  → doc { año: M, mes: M }
//   • Período B: días 24-31 del mes M  → doc { año: M, mes: M+1 }
//
// Retorna:
//   porObjetivo  → { [objetivoId]: { horas, clienteId, clienteNombre, objetivoNombre } }
//   porCliente   → { [clienteId]:  { horas, clienteNombre, objetivos: [...] } }
//   filas        → array ordenado cliente → objetivo (para tablas y gráficos)
//   cargando     → boolean
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db }             from "../firebase";
import { useClientesData } from "./useClientesData";
import { fmtObjetivo }    from "../utils/formatters";

const COL_OVERRID = "horasObjetivoMes";

function periodoSiguiente(año, mes) {
    return mes === 12 ? { año: año + 1, mes: 1 } : { año, mes: mes + 1 };
}

// Suma los valores de un mapa { "YYYY-MM-DD": valor } filtrando por año/mes/rango de días
function sumarDias(diasMap, año, mes, desdeDia, hastaDia) {
    let total = 0;
    Object.entries(diasMap || {}).forEach(([key, val]) => {
        const [y, m, d] = key.split("-").map(Number);
        if (y === año && m === mes && d >= desdeDia && d <= hastaDia) {
            total += Number(val) || 0;
        }
    });
    return total;
}

// Filtra un mapa de días dejando solo las claves del mes/rango indicado
function filtrarDias(diasMap, año, mes, desdeDia, hastaDia) {
    const result = {};
    Object.entries(diasMap || {}).forEach(([key, val]) => {
        const [y, m, d] = key.split("-").map(Number);
        if (y === año && m === mes && d >= desdeDia && d <= hastaDia) {
            result[key] = Number(val) || 0;
        }
    });
    return result;
}

export function useHorasACubrir(empresaId, año, mes) {
    const { objetivos, clientes, cargando: cargandoCatalogo } = useClientesData(empresaId);
    const [overrides,    setOverrides]    = useState({ A: [], B: [] });
    const [cargandoOver, setCargandoOver] = useState(true);

    const { año: añoB, mes: mesB } = periodoSiguiente(año, mes);

    // ── Cargar overrides del período actual ──────────────────────────────────
    useEffect(() => {
        if (!empresaId || cargandoCatalogo) return;
        setCargandoOver(true);
        Promise.all([
            getDocs(query(collection(db, COL_OVERRID),
                where("empresaId", "==", empresaId),
                where("año", "==", año),
                where("mes", "==", mes)
            )),
            getDocs(query(collection(db, COL_OVERRID),
                where("empresaId", "==", empresaId),
                where("año", "==", añoB),
                where("mes", "==", mesB)
            )),
        ])
            .then(([snapA, snapB]) => setOverrides({
                A: snapA.docs.map(d => ({ id: d.id, ...d.data() })),
                B: snapB.docs.map(d => ({ id: d.id, ...d.data() })),
            }))
            .catch(console.error)
            .finally(() => setCargandoOver(false));
    }, [empresaId, año, mes, añoB, mesB, cargandoCatalogo]);

    // ── Índices del catálogo ─────────────────────────────────────────────────
    const clienteMap = useMemo(() => {
        const m = {};
        clientes.forEach(c => { if (c.id) m[c.id] = c; });
        return m;
    }, [clientes]);

    const objMap = useMemo(() => {
        const m = {};
        objetivos.forEach(o => { if (o.id) m[o.id] = o; });
        return m;
    }, [objetivos]);

    // ── Cálculo principal ────────────────────────────────────────────────────
    const resultado = useMemo(() => {
        if (cargandoOver || cargandoCatalogo) {
            return { porObjetivo: {}, porCliente: {}, filas: [] };
        }

        // Mapas de días guardados: oid → { "YYYY-MM-DD": horas }
        const overMapA = {};
        overrides.A.forEach(d => { if (d.objetivoId) overMapA[d.objetivoId] = d.dias || {}; });
        const overMapB = {};
        overrides.B.forEach(d => { if (d.objetivoId) overMapB[d.objetivoId] = d.dias || {}; });

        // Conjunto de todos los objetivos: catálogo + los que tengan datos guardados
        const allOids = new Set([
            ...Object.keys(objMap),
            ...Object.keys(overMapA),
            ...Object.keys(overMapB),
        ]);

        // ── Por objetivo ─────────────────────────────────────────────────────
        const porObjetivo    = {};
        const diasPorObjetivo = {};
        allOids.forEach(oid => {
            const catObj        = objMap[oid];
            const clienteId     = catObj?.clienteId || "";
            const clienteNombre = clienteMap[clienteId]?.nombre || catObj?.clienteNombre || "";
            const objetivoNombre = fmtObjetivo(catObj) || oid;

            // Días 1-23 vienen del período A; días 24-31 vienen del período B
            const horasA = sumarDias(overMapA[oid], año, mes,  1, 23);
            const horasB = sumarDias(overMapB[oid], año, mes, 24, 31);
            const horas  = horasA + horasB;

            porObjetivo[oid] = { horas, clienteId, clienteNombre, objetivoNombre };

            // Mapa día a día para comparación en FacturacionScreen
            const diasA = filtrarDias(overMapA[oid], año, mes,  1, 23);
            const diasB = filtrarDias(overMapB[oid], año, mes, 24, 31);
            diasPorObjetivo[oid] = { ...diasA, ...diasB };
        });

        // ── Por cliente (suma de sus objetivos) ──────────────────────────────
        const porCliente = {};
        Object.entries(porObjetivo).forEach(([oid, data]) => {
            const cid = data.clienteId || "__sin_cliente__";
            if (!porCliente[cid]) {
                porCliente[cid] = {
                    horas: 0,
                    clienteNombre: data.clienteNombre || cid,
                    objetivos: [],
                };
            }
            porCliente[cid].horas += data.horas;
            porCliente[cid].objetivos.push({ objetivoId: oid, ...data });
        });

        // ── Filas ordenadas: cliente ASC → objetivo ASC ──────────────────────
        const filas = Object.entries(porObjetivo)
            .map(([oid, data]) => ({ objetivoId: oid, ...data }))
            .sort((a, b) =>
                a.clienteNombre.localeCompare(b.clienteNombre) ||
                a.objetivoNombre.localeCompare(b.objetivoNombre)
            );

        return { porObjetivo, porCliente, filas, diasPorObjetivo };
    }, [overrides, objMap, clienteMap, año, mes, cargandoOver, cargandoCatalogo]);

    return {
        cargando:        cargandoOver || cargandoCatalogo,
        porObjetivo:     resultado.porObjetivo,
        porCliente:      resultado.porCliente,
        filas:           resultado.filas,
        diasPorObjetivo: resultado.diasPorObjetivo ?? {},
    };
}
