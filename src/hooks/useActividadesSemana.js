import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

function fmtKey(d) { return d.toISOString().slice(0, 10); }

/**
 * Builds the `actividades` object for CalendarioSemanal.
 * Shows:
 *   - Aniversarios de ingreso del personal (tipo: "aniversario")
 *   - Altas de gobierno con vencimiento esta semana (colección "altas", tipo: "alta")
 *   - Jornadas activas = supervisión del día (tipo: "supervision")
 *   - Actividades inconclusas en jornadas (tipo: "inconclusa")
 *   - Vencimiento de service de vehículos (tipo: "vtv")
 * Cumpleaños son manejados dentro de CalendarioSemanal desde legajos.nacimiento.
 */
export function useActividadesSemana(empresaId, legajos = []) {
    const [actividades, setActividades] = useState({});

    useEffect(() => {
        if (!empresaId) return;

        const hoy = new Date();
        const dias = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(hoy);
            d.setDate(hoy.getDate() + i);
            return d;
        });
        const semanaStart = fmtKey(dias[0]);
        const semanaEnd   = fmtKey(dias[6]);

        const acts = {};
        const addAct = (key, item) => {
            if (!acts[key]) acts[key] = [];
            acts[key].push(item);
        };

        async function build() {

            // 1. Aniversarios de ingreso del personal esta semana
            legajos.forEach(p => {
                if (!p.fechaIngreso) return;
                const parts = p.fechaIngreso.split("/").map(Number);
                if (parts.length < 2) return;
                const [dd, mm] = parts;
                dias.forEach(d => {
                    if (d.getDate() === dd && d.getMonth() + 1 === mm) {
                        const key    = fmtKey(d);
                        const nombre = ((p.apellido || "") + " " + (p.nombre || "")).trim().split(" ")[0];
                        addAct(key, { label: `Aniversario: ${nombre}`, tipo: "aniversario" });
                    }
                });
            });

            // 2. Altas de gobierno — permisos/habilitaciones que vencen esta semana
            //    Colección: "altas" → { empresaId, nombre, tipo, fechaVencimiento (YYYY-MM-DD) }
            try {
                const aSnap = await getDocs(
                    query(collection(db, "altas"), where("empresaId", "==", empresaId))
                );
                aSnap.docs.forEach(doc => {
                    const a   = doc.data();
                    const key = (a.fechaVencimiento || "").slice(0, 10);
                    if (!key || key < semanaStart || key > semanaEnd) return;
                    const label = a.nombre || a.tipo || "Alta";
                    addAct(key, { label: `Alta: ${label}`, tipo: "alta" });
                });
            } catch (e) { console.warn("[actividadesSemana] altas:", e); }

            // 3. Jornadas activas / actividades inconclusas
            try {
                const jSnap = await getDocs(
                    query(collection(db, "jornadas"), where("empresaId", "==", empresaId))
                );
                jSnap.docs.forEach(doc => {
                    const j   = doc.data();
                    const key = (j.fecha || "").slice(0, 10);
                    if (!key || key < semanaStart || key > semanaEnd) return;

                    if (j.estado === "activa") {
                        addAct(key, { label: "Supervisión activa", tipo: "supervision" });
                    }
                    (j.actividades || []).forEach(a => {
                        if (a.estado === "en_curso") {
                            addAct(key, { label: `Inconclusa: ${a.tipo || "actividad"}`, tipo: "inconclusa" });
                        }
                    });
                });
            } catch (e) { console.warn("[actividadesSemana] jornadas:", e); }

            // 4. Vencimientos de service de vehículos
            try {
                const vSnap = await getDocs(
                    query(collection(db, "vehiculos"), where("empresaId", "==", empresaId))
                );
                vSnap.docs.forEach(doc => {
                    const v   = doc.data();
                    const key = (v.proximoService?.fecha || "").slice(0, 10);
                    if (!key || key < semanaStart || key > semanaEnd) return;
                    const label = v.patente || v.modelo || "Vehículo";
                    addAct(key, { label: `Service: ${label}`, tipo: "vtv" });
                });
            } catch (e) { console.warn("[actividadesSemana] vehiculos:", e); }

            setActividades({ ...acts });
        }

        build();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empresaId, legajos.length]);

    return actividades;
}
