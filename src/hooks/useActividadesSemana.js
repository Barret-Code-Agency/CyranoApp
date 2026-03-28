import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

function fmtKey(d) { return d.toISOString().slice(0, 10); }

/**
 * Parsea fechas en cualquier formato → { dd, mm } o null.
 * Soporta: número Excel serial, "DD/MM/AAAA", "DD-MM-AAAA", "AAAA-MM-DD".
 */
function parseDDMM(valor) {
    if (valor == null) return null;
    const n = Number(valor);
    if (typeof valor === "number" || (n > 20000 && n < 60000 && !isNaN(n))) {
        const dt = new Date((n - 25569) * 86400000);
        return { dd: dt.getUTCDate(), mm: dt.getUTCMonth() + 1 };
    }
    const s = String(valor);
    if (!s) return null;
    const sep = s.includes("/") ? "/" : "-";
    const parts = s.split(sep).map(Number);
    if (parts.length < 2 || parts.some(isNaN)) return null;
    if (parts[0] > 31) return { dd: parts[2], mm: parts[1] };
    return { dd: parts[0], mm: parts[1] };
}

/**
 * Builds the `actividades` object for CalendarioSemanal.
 * Shows:
 *   - Cumpleaños del personal (tipo: "cumple") — desde legajos.nacimiento
 *   - Aniversarios de ingreso del personal (tipo: "aniversario")
 *   - Altas de gobierno con vencimiento próximo (colección "altas", tipo: "alta")
 *   - Jornadas activas = supervisión del día (tipo: "supervision")
 *   - Actividades inconclusas en jornadas (tipo: "inconclusa")
 *   - Vencimiento de service / VTV / seguro de vehículos (tipo: "vtv")
 */
export function useActividadesSemana(empresaId, legajos = [], currentUserId = null) {
    const [actividades, setActividades] = useState({});

    useEffect(() => {
        if (!empresaId) return;

        const hoy = new Date();
        // 7 días para eventos de jornadas/supervisión
        const dias7 = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(hoy); d.setDate(hoy.getDate() + i); return d;
        });
        // 30 días para vencimientos (aviso anticipado)
        const dias30 = Array.from({ length: 30 }, (_, i) => {
            const d = new Date(hoy); d.setDate(hoy.getDate() + i); return d;
        });
        const semanaStart = fmtKey(dias7[0]);
        const semanaEnd7  = fmtKey(dias7[6]);
        const semanaEnd30 = fmtKey(dias30[29]);

        const acts = {};
        const addAct = (key, item) => {
            if (!acts[key]) acts[key] = [];
            acts[key].push(item);
        };

        async function build() {

            // (Cumpleaños se manejan dentro de CalendarioSemanal desde legajos.nacimiento)

            // 2. Altas de gobierno — permisos/habilitaciones que vencen (próximos 30 días)
            try {
                const aSnap = await getDocs(
                    query(collection(db, "altas"), where("empresaId", "==", empresaId))
                );
                aSnap.docs.forEach(doc => {
                    const a   = doc.data();
                    const key = (a.fechaVencimiento || "").slice(0, 10);
                    if (!key || key < semanaStart || key > semanaEnd30) return;
                    addAct(key, { label: `📋 Alta: ${a.nombre || a.tipo || "permiso"}`, tipo: "alta" });
                });
            } catch (e) { console.warn("[actividadesSemana] altas:", e); }

            // 3. Jornadas activas / actividades inconclusas (sólo esta semana)
            try {
                const jSnap = await getDocs(
                    query(collection(db, "jornadas"), where("empresaId", "==", empresaId))
                );
                jSnap.docs.forEach(doc => {
                    const j   = doc.data();
                    const key = (j.fecha || "").slice(0, 10);
                    if (!key || key < semanaStart || key > semanaEnd7) return;
                    if (j.estado === "activa") {
                        addAct(key, { label: "🔍 Supervisión activa", tipo: "supervision" });
                    }
                    (j.actividades || []).forEach(a => {
                        if (a.estado === "en_curso") {
                            addAct(key, { label: `⚠️ Inconclusa: ${a.tipo || "actividad"}`, tipo: "inconclusa" });
                        }
                    });
                });
            } catch (e) { console.warn("[actividadesSemana] jornadas:", e); }

            // 4. Vencimientos de vehículos: service, VTV y seguro (próximos 30 días)
            try {
                const vSnap = await getDocs(
                    query(collection(db, "vehiculos"), where("empresaId", "==", empresaId))
                );
                vSnap.docs.forEach(doc => {
                    const v     = doc.data();
                    const label = v.patente || v.modelo || "Vehículo";

                    const serviceKey = (v.proximoService?.fecha || "").slice(0, 10);
                    if (serviceKey && serviceKey >= semanaStart && serviceKey <= semanaEnd30) {
                        addAct(serviceKey, { label: `🔧 Service: ${label}`, tipo: "vtv" });
                    }
                    const vtvKey = (v.vtv || "").slice(0, 10).replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1");
                    if (vtvKey && vtvKey >= semanaStart && vtvKey <= semanaEnd30) {
                        addAct(vtvKey, { label: `🚗 VTV vto.: ${label}`, tipo: "vtv" });
                    }
                    const segKey = (v.seguro || "").slice(0, 10).replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1");
                    if (segKey && segKey >= semanaStart && segKey <= semanaEnd30) {
                        addAct(segKey, { label: `🛡️ Seguro vto.: ${label}`, tipo: "vtv" });
                    }
                });
            } catch (e) { console.warn("[actividadesSemana] vehiculos:", e); }

            // 5. Comunicaciones no leídas — aparecen hoy (o en su fecha si es futura)
            try {
                const comSnap = await getDocs(
                    query(collection(db, "comunicaciones"), where("empresaId", "==", empresaId))
                );
                const hoyKey = fmtKey(hoy);
                comSnap.docs.forEach(doc => {
                    const c = doc.data();
                    // Saltar si ya fue leída por el usuario actual
                    if (currentUserId && (c.leidoPor || []).includes(currentUserId)) return;
                    // Fecha de la comunicación; si es pasada → anclar a hoy
                    const fechaDoc = c.creadoEn?.toDate ? fmtKey(c.creadoEn.toDate()) : hoyKey;
                    const targetKey = fechaDoc >= hoyKey ? fechaDoc : hoyKey;
                    if (targetKey > semanaEnd7) return;
                    const tipoLabel = c.tipo === "novedad" ? "novedad" : "comunicación";
                    addAct(targetKey, {
                        labelCorto: `📢 Tenés una ${tipoLabel}`,
                        label:      `📢 ${c.titulo || "Sin título"}`,
                        tipo:       "comunicacion",
                    });
                });
            } catch (e) { console.warn("[actividadesSemana] comunicaciones:", e); }

            setActividades({ ...acts });
        }

        build();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empresaId, legajos.length, currentUserId]);

    return actividades;
}
