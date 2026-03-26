// src/screens/gerencia/DashboardsGestionScreen.jsx
// Dashboard de gestión con métricas y KPIs — datos en tiempo real de Firestore.

import { useEffect, useState, useMemo } from "react";
import { useAppData } from "../../context/AppDataContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, ComposedChart,
} from "recharts";
import "./DashboardsGestionScreen.css";
import { getDias, fmtKey, horasDeValor, normalizarTurno } from "../../utils/periodoUtils";
import { FERIADOS_ARG } from "../../utils/feriados";

// ── Helpers ──────────────────────────────────────────────────────────────────
const MESES_CORTO = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function parseHoras(turno) {
    if (!turno || (!turno.includes("–") && !turno.includes("-"))) return 0;
    const partes = turno.split(/[–-]/).map(t => t.trim());
    if (partes.length < 2) return 0;
    const [h1, m1] = partes[0].split(":").map(Number);
    const [h2, m2] = partes[1].split(":").map(Number);
    if (isNaN(h1) || isNaN(h2)) return 0;
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff <= 0) diff += 24 * 60;
    return Math.round(diff / 60);
}

const esTurno  = v => v && (v.includes("–") || v.includes("-")) && v.includes(":");
const esAusenteCode    = v => v && ["enf","art","lic","sus","vac"].includes(v.toLowerCase());
// Ausentismo real: solo involuntario (enf, art, lic, sus) — excluye vac y francos
const esAusentismo = v => v && ["enf","art","lic","sus"].includes(v.toLowerCase());

function ultimos6Meses() {
    const hoy = new Date();
    return Array.from({ length: 6 }, (_, i) => {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() - 5 + i, 1);
        return { año: d.getFullYear(), mes: d.getMonth() + 1, label: MESES_CORTO[d.getMonth()] };
    });
}

const COLORS_PIE = ["#2563eb", "#16a34a", "#dc2626", "#f59e0b", "#7c3aed"];
const COLOR_PROG = "#2563eb";
const COLOR_TRAB = "#16a34a";
const COLOR_AUS  = "#dc2626";
const COLOR_FCO  = "#94a3b8";

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color = "#2563eb" }) {
    return (
        <div className="dg-kpi">
            <div className="dg-kpi-icon" style={{ background: color + "18", color }}>{icon}</div>
            <div className="dg-kpi-body">
                <div className="dg-kpi-value" style={{ color }}>{value}</div>
                <div className="dg-kpi-label">{label}</div>
                {sub && <div className="dg-kpi-sub">{sub}</div>}
            </div>
        </div>
    );
}

// ── Chart card ───────────────────────────────────────────────────────────────
function ChartCard({ titulo, children }) {
    return (
        <div className="dg-chart-card">
            <div className="dg-chart-title">{titulo}</div>
            {children}
        </div>
    );
}

// ── Tooltip personalizado ─────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, suffix = "hs" }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="dg-tooltip">
            <div className="dg-tooltip-label">{label}</div>
            {payload.map((p, i) => (
                <div key={i} className="dg-tooltip-row">
                    <span className="dg-tooltip-dot" style={{ background: p.color }} />
                    <span>{p.name}: <strong>{p.value} {suffix}</strong></span>
                </div>
            ))}
        </div>
    );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function DashboardsGestionScreen({ onBack }) {
    const { empresaNombre, empresaId } = useAppData();
    const [loading,       setLoading]       = useState(true);
    const [progDocs,      setProgDocs]      = useState([]);
    const [legajos,       setLegajos]       = useState([]);
    const [capacitaciones,setCapacitaciones]= useState([]);
    const [objetivos,     setObjetivos]     = useState([]);
    const [zonaActiva,    setZonaActiva]    = useState(null); // null = Total
    const [diagramas,     setDiagramas]     = useState([]);

    const meses = useMemo(() => ultimos6Meses(), []);

    useEffect(() => {
        if (!empresaId) return;
        const cargar = async () => {
            setLoading(true);
            try {
                // Programación últimos 6 meses (filtro año+mes en cliente para evitar índice compuesto)
                const allProgSnap = await getDocs(query(
                    collection(db, "programacionServicios"),
                    where("empresaId", "==", empresaId)
                ));
                const docs = allProgSnap.docs
                    .map(d => d.data())
                    .filter(d => meses.some(m => m.año === d.año && m.mes === d.mes))
                    .map(d => {
                        const m = meses.find(m => m.año === d.año && m.mes === d.mes);
                        return { ...d, _mes: m };
                    });
                setProgDocs(docs);

                // Legajos
                const legSnap = await getDocs(query(
                    collection(db, "legajos"),
                    where("empresaId", "==", empresaId)
                ));
                setLegajos(legSnap.docs.map(d => d.data()));

                // Capacitaciones
                const capSnap = await getDocs(query(
                    collection(db, "capacitaciones"),
                    where("empresaId", "==", empresaId)
                ));
                setCapacitaciones(capSnap.docs.map(d => d.data()));

                // Objetivos
                const objSnap = await getDocs(query(
                    collection(db, "objetivos"),
                    where("empresaId", "==", empresaId)
                ));
                setObjetivos(objSnap.docs.map(d => d.data()));

                // Diagramas 14x14 (francos — opcionales)
                const diagSnap = await getDocs(query(
                    collection(db, "diagramas14x14"),
                    where("empresaId", "==", empresaId)
                )).catch(() => ({ docs: [] }));
                setDiagramas(diagSnap.docs.map(d => d.data()));
            } finally {
                setLoading(false);
            }
        };
        cargar();
    }, [empresaId]);

    // Zonas derivadas de legajos (campo zona)
    const zonas = useMemo(() =>
        [...new Set(legajos.map(l => l.zona).filter(Boolean))].sort(),
    [legajos]);

    // Legajos de la zona activa
    const legajosEnZona = useMemo(() =>
        zonaActiva ? legajos.filter(l => l.zona === zonaActiva) : legajos,
    [legajos, zonaActiva]);

    // Legajos de la zona como Set para filtrar progDocs
    const legajosZonaSet = useMemo(() =>
        new Set(legajosEnZona.map(l => l.legajo).filter(Boolean)),
    [legajosEnZona]);

    // Filtrado de docs: solo los que tienen personal en la zona
    const filteredDocs = useMemo(() => {
        if (!zonaActiva) return progDocs;
        return progDocs.map(doc => ({
            ...doc,
            personal: (doc.personal ?? []).filter(p => legajosZonaSet.has(p.legajo)),
        })).filter(doc => doc.personal.length > 0);
    }, [progDocs, zonaActiva, legajosZonaSet]);

    // ── Cómputos ─────────────────────────────────────────────────────────────
    const metricas = useMemo(() => {
        // Por mes: horas programadas, trabajadas, ausencia, franco
        const porMes = meses.map(({ año, mes, label }) => {
            const docs = filteredDocs.filter(d => d._mes.año === año && d._mes.mes === mes);
            let prog = 0, trab = 0, aus = 0, ausInv = 0, fco = 0, adicionales = 0;
            docs.forEach(doc => {
                (doc.personal ?? []).forEach(p => {
                    // Desde programado
                    Object.keys(p.programado ?? {}).forEach(fecha => {
                        const vProg = p.programado[fecha];
                        const vReal = (p.real ?? {})[fecha];
                        if (esTurno(vProg)) {
                            const hProg = parseHoras(vProg);
                            prog += hProg;
                            if (vReal && esTurno(vReal))     trab += parseHoras(vReal);
                            else if (esAusenteCode(vReal)) { aus += hProg; if (esAusentismo(vReal)) ausInv += hProg; }
                            else if (!vReal)                 trab += hProg;
                        } else if (vProg?.toLowerCase() === "fco" || vProg?.toLowerCase() === "com") {
                            fco++;
                        }
                    });
                    // Horas adicionales: real con turno pero sin turno programado
                    Object.keys(p.real ?? {}).forEach(fecha => {
                        const vReal = p.real[fecha];
                        const vProg = (p.programado ?? {})[fecha];
                        if (esTurno(vReal) && !esTurno(vProg)) adicionales += parseHoras(vReal);
                    });
                });
            });
            const ausPct = prog > 0 ? parseFloat(((ausInv / prog) * 100).toFixed(1)) : 0;
            return { label, prog, trab, nocub: Math.max(0, prog - trab), aus, ausInv, ausPct, fco, adicionales };
        });

        // Total adicionales
        let adicionales = porMes.reduce((s, m) => s + m.adicionales, 0);

        // Totales globales
        const totProg  = porMes.reduce((s, m) => s + m.prog, 0);
        const totTrab  = porMes.reduce((s, m) => s + m.trab, 0);
        const totNoCub = porMes.reduce((s, m) => s + m.nocub, 0);
        const totAus   = porMes.reduce((s, m) => s + m.aus, 0);
        const pctCub   = totProg > 0 ? Math.round((totTrab / totProg) * 100) : 0;

        // Capacitaciones por categoría
        const capPorCat = {};
        capacitaciones.forEach(c => {
            const cat = c.categoria || "Sin categoría";
            capPorCat[cat] = (capPorCat[cat] || 0) + 1;
        });
        const capData = Object.entries(capPorCat)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);

        // Personal por régimen
        const porRegimen = {};
        legajosEnZona.forEach(l => {
            const r = l.regimen || "Sin régimen";
            porRegimen[r] = (porRegimen[r] || 0) + 1;
        });
        const regimenData = Object.entries(porRegimen)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        // Distribución de horas (donut)
        const distribucion = [
            { name: "Cubiertas",     value: totTrab  },
            { name: "No cubiertas",  value: totNoCub },
            { name: "Adicionales",   value: adicionales },
            { name: "Ausencias",     value: totAus   },
        ].filter(d => d.value > 0);

        // Horas no cubiertas por objetivo
        const nocubPorObj = {};
        filteredDocs.forEach(doc => {
            const obj = doc.objetivo || "Sin objetivo";
            (doc.personal ?? []).forEach(p => {
                Object.keys(p.programado ?? {}).forEach(fecha => {
                    const vProg = p.programado[fecha];
                    const vReal = (p.real ?? {})[fecha];
                    if (esTurno(vProg) && esAusenteCode(vReal)) {
                        nocubPorObj[obj] = (nocubPorObj[obj] || 0) + parseHoras(vProg);
                    }
                });
            });
        });
        const nocubObjData = Object.entries(nocubPorObj)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        // Horas adicionales por objetivo
        const adicPorObj = {};
        filteredDocs.forEach(doc => {
            const obj = doc.objetivo || "Sin objetivo";
            (doc.personal ?? []).forEach(p => {
                Object.keys(p.real ?? {}).forEach(fecha => {
                    const vReal = p.real[fecha];
                    const vProg = (p.programado ?? {})[fecha];
                    if (esTurno(vReal) && !esTurno(vProg)) {
                        adicPorObj[obj] = (adicPorObj[obj] || 0) + parseHoras(vReal);
                    }
                });
            });
        });
        const adicObjData = Object.entries(adicPorObj)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        // % cobertura por cliente (suma todas las horas de todos los puestos del cliente)
        const cobCliente = {};
        filteredDocs.forEach(doc => {
            const cli = doc.clienteNombre || doc.cliente || doc.contrato || "Sin cliente";
            if (!cobCliente[cli]) cobCliente[cli] = { prog: 0, trab: 0 };
            (doc.personal ?? []).forEach(p => {
                Object.keys(p.programado ?? {}).forEach(fecha => {
                    const vProg = p.programado[fecha];
                    const vReal = (p.real ?? {})[fecha];
                    if (esTurno(vProg)) {
                        const h = parseHoras(vProg);
                        cobCliente[cli].prog += h;
                        if (vReal && esTurno(vReal))  cobCliente[cli].trab += parseHoras(vReal);
                        else if (!vReal)               cobCliente[cli].trab += h;
                    }
                });
            });
        });
        const cobClienteData = Object.entries(cobCliente)
            .map(([name, { prog, trab }]) => ({
                name,
                prog,
                trab,
                value: prog > 0 ? parseFloat(((trab / prog) * 100).toFixed(1)) : 0,
            }))
            .sort((a, b) => a.value - b.value);

        return { porMes, totProg, totTrab, totNoCub, totAus, adicionales, pctCub, capData, regimenData, distribucion, nocubObjData, adicObjData, cobClienteData };
    }, [filteredDocs, legajosEnZona, capacitaciones, meses]);

    // ── Extras del mes actual ─────────────────────────────────────────────────
    const extrasDelMes = useMemo(() => {
        const hoy   = new Date();
        const año   = hoy.getFullYear();
        const mes   = hoy.getMonth() + 1;
        const dias  = getDias(año, mes);

        // Maps desde legajos
        const regimenMap  = {};
        const grupoMap    = {};
        const excluidos   = new Set();
        const EXCL_TAREA  = new Set(["Jefe", "Supervisor (FC)"]);
        legajos.forEach(l => {
            const leg = String(l.legajo || "");
            regimenMap[leg] = l.regimen || "";
            grupoMap[leg]   = l.grupoTurno14 || "";
            if ((l.estado && l.estado !== "Activo") ||
                (l.cargo || "").includes("(FC)") ||
                EXCL_TAREA.has(l.tarea))
                excluidos.add(leg);
        });

        // Franco map
        const francosMap = {};
        diagramas.forEach(g => {
            if (g.grupo && g.francos) francosMap[g.grupo] = new Set(g.francos);
        });

        // Acumular horas reales por persona solo en docs del mes actual
        const byLeg = {};
        const docsDelMes = progDocs.filter(d => d._mes?.año === año && d._mes?.mes === mes);
        docsDelMes.forEach(doc => {
            const vistoEnDoc = new Set();
            (doc.personal || []).forEach(p => {
                const leg = String(p.legajo || "");
                if (excluidos.has(leg) || vistoEnDoc.has(leg)) return;
                vistoEnDoc.add(leg);
                if (!byLeg[leg]) byLeg[leg] = { nombre: p.nombre || leg, data: {} };
                // Reales
                Object.entries(p.real || {}).forEach(([key, val]) => {
                    const hs = horasDeValor(normalizarTurno(val));
                    if (hs > 0) byLeg[leg].data[key] = (byLeg[leg].data[key] || 0) + hs;
                    else if (!byLeg[leg].data[key]) byLeg[leg].data[key] = val || "";
                });
                // Capacitación
                Object.entries(p.capacitacion || {}).forEach(([key, val]) => {
                    const hc = Number(val) || 0;
                    if (hc <= 0) return;
                    if (typeof byLeg[leg].data[key] === "number")
                        byLeg[leg].data[key] += hc;
                    else if (!byLeg[leg].data[key])
                        byLeg[leg].data[key] = hc;
                });
            });
        });

        // Calcular extras por persona
        const personas = Object.entries(byLeg).map(([leg, r]) => {
            const reg    = regimenMap[leg] || "";
            const grupo  = grupoMap[leg]   || "";
            let ext50 = 0, ext100 = 0, lvHs = 0, sadomHs = 0;

            const hsDelDia = key => {
                const v = r.data[key];
                return typeof v === "number" ? v : horasDeValor(normalizarTurno(v || ""));
            };

            if (reg === "14 x 14 x 8" || reg === "14 x 14 x 12") {
                const umbral  = reg === "14 x 14 x 8" ? 8 : 12;
                const francos = francosMap[grupo] || new Set();
                dias.forEach(d => {
                    const key = fmtKey(d);
                    const hs  = hsDelDia(key);
                    if (hs <= 0) return;
                    if (francos.has(key)) ext100 += hs;
                    else if (hs > umbral) ext50  += hs - umbral;
                });
            } else if (reg === "200") {
                const total = dias.reduce((s, d) => s + hsDelDia(fmtKey(d)), 0);
                ext50 = Math.max(0, total - 200);
            } else {
                const umbral = reg === "4 x 2 x 12" ? 10
                             : reg === "5 x 2 x 12" ? 9.5
                             : reg === "6 x 1 x 8"  ? 8
                             : reg === "12 x 36"    ? 13
                             : null;
                if (umbral !== null) {
                    dias.forEach(d => {
                        const key  = fmtKey(d);
                        const hs   = hsDelDia(key);
                        if (hs <= umbral) return;
                        const exc  = hs - umbral;
                        const dow  = d.getDay();
                        const esFer = !!FERIADOS_ARG[key];
                        if (esFer || dow === 0 || dow === 6) ext100 += exc;
                        else                                  ext50  += exc;
                    });
                }
            }

            // Autorizado estimado por DOW
            dias.forEach(d => {
                const key  = fmtKey(d);
                const hs   = hsDelDia(key);
                if (hs <= 0) return;
                const dow  = d.getDay();
                const esFer = !!FERIADOS_ARG[key];
                if (esFer || dow === 0 || dow === 6) sadomHs += hs;
                else                                  lvHs    += hs;
            });

            return {
                nombre: r.nombre.trim(),
                ext50:  Math.round(ext50  * 10) / 10,
                ext100: Math.round(ext100 * 10) / 10,
                lvHs, sadomHs,
            };
        });

        const totExt50  = Math.round(personas.reduce((s, p) => s + p.ext50,  0) * 10) / 10;
        const totExt100 = Math.round(personas.reduce((s, p) => s + p.ext100, 0) * 10) / 10;
        const autExt50  = Math.round(personas.reduce((s, p) => s + p.lvHs,   0) * 0.07 * 10) / 10;
        const autExt100 = Math.round(personas.reduce((s, p) => s + p.sadomHs,0) * 0.07 * 10) / 10;

        const top50  = personas.filter(p => p.ext50  > 0).sort((a,b) => b.ext50  - a.ext50).slice(0,15);
        const top100 = personas.filter(p => p.ext100 > 0).sort((a,b) => b.ext100 - a.ext100).slice(0,10);

        return { totExt50, totExt100, autExt50, autExt100, top50, top100 };
    }, [progDocs, legajos, diagramas]);

    const mesActual = meses[meses.length - 1];
    const datosMesActual = metricas.porMes[metricas.porMes.length - 1] ?? {};

    if (loading) return (
        <div className="dg-loading">
            <div className="dg-loading-spinner" />
            <div>Calculando métricas...</div>
        </div>
    );

    return (
        <div className="dg-root">

            {/* ── Período ── */}
            <div className="dg-periodo">
                Últimos 6 meses · {meses[0].label} – {meses[5].label} {meses[5].año}
            </div>

            {/* ── Zona tabs ── */}
            {zonas.length > 0 && (
                <div className="dg-zona-tabs">
                    <button
                        className={`dg-zona-tab${zonaActiva === null ? " dg-zona-tab--active" : ""}`}
                        onClick={() => setZonaActiva(null)}
                    >
                        🌐 Todo el contrato
                        <span className="dg-zona-tab-count">{legajos.length}</span>
                    </button>
                    {zonas.map(z => (
                        <button
                            key={z}
                            className={`dg-zona-tab${zonaActiva === z ? " dg-zona-tab--active" : ""}`}
                            onClick={() => setZonaActiva(z)}
                        >
                            📍 {z}
                            <span className="dg-zona-tab-count">
                                {legajos.filter(l => l.zona === z).length}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* ── KPIs ── */}
            <div className="dg-kpi-grid">
                <KpiCard icon="👷" label="Personal activo"    value={legajosEnZona.length}          sub={`${zonaActiva ? "1 objetivo" : objetivos.length + " objetivos"}`} color="#2563eb" />
                <KpiCard icon="✅" label="Cobertura"          value={`${metricas.pctCub}%`}         sub="horas cubiertas vs programadas"           color="#16a34a" />
                <KpiCard icon="⏱️" label="Horas programadas"  value={metricas.totProg.toLocaleString()} sub="últimos 6 meses"                      color="#7c3aed" />
                <KpiCard icon="❌" label="Horas no cubiertas" value={metricas.totNoCub.toLocaleString()} sub="ausencias no reemplazadas"            color="#dc2626" />
                <KpiCard icon="➕" label="Horas adicionales"  value={metricas.adicionales.toLocaleString()} sub="más allá de lo programado"        color="#f59e0b" />
                <KpiCard icon="🎓" label="Capacitaciones"     value={capacitaciones.length}         sub={`${new Set(capacitaciones.map(c=>c.categoria)).size} categorías`} color="#0891b2" />
            </div>

            {/* ── Fila 1: prog vs cubiertas | no prestadas por mes | adicionales por mes ── */}
            <div className="dg-charts-row dg-charts-row--3">
                <ChartCard titulo="📊 Horas programadas vs cubiertas">
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={metricas.porMes} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip content={<CustomTooltip suffix="hs" />} />
                            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="prog" name="Programadas" fill={COLOR_PROG} radius={[4,4,0,0]} />
                            <Bar dataKey="trab" name="Cubiertas"   fill={COLOR_TRAB} radius={[4,4,0,0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard titulo="🚫 Horas no prestadas por mes">
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={metricas.porMes} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip content={<CustomTooltip suffix="hs" />} />
                            <Bar dataKey="nocub" name="No prestadas" fill={COLOR_AUS} radius={[4,4,0,0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard titulo="📅 Horas adicionales por mes">
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={metricas.porMes} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip content={<CustomTooltip suffix="hs" />} />
                            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="adicionales" name="Hs adicionales" fill="#f59e0b" radius={[4,4,0,0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* ── Fila 2: cubiertas vs facturadas | no cubiertas por objetivo | adicionales por objetivo ── */}
            <div className="dg-charts-row dg-charts-row--3">
                <ChartCard titulo="📋 Horas cubiertas vs facturadas">
                    <ResponsiveContainer width="100%" height={220}>
                        <ComposedChart data={metricas.porMes} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis yAxisId="hs" tick={{ fontSize: 10 }} />
                            <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                            <Tooltip formatter={(v, name) => name === "Eficiencia" ? [`${v}%`, name] : [`${v} hs`, name]} />
                            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                            <Bar yAxisId="hs" dataKey="prog" name="Facturadas" fill={COLOR_PROG} radius={[4,4,0,0]} />
                            <Bar yAxisId="hs" dataKey="trab" name="Cubiertas"  fill={COLOR_TRAB} radius={[4,4,0,0]} />
                            <Line yAxisId="pct" type="monotone" dataKey={d => d.prog > 0 ? Math.round((d.trab / d.prog) * 100) : 0} name="Eficiencia" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard titulo="⚠️ Horas no cubiertas por objetivo">
                    {metricas.nocubObjData.length === 0 ? (
                        <div className="dg-empty">Sin datos</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={metricas.nocubObjData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                                <Tooltip content={<CustomTooltip suffix="hs" />} />
                                <Bar dataKey="value" name="No cubiertas" fill={COLOR_AUS} radius={[0,4,4,0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>

                <ChartCard titulo="➕ Horas adicionales por objetivo">
                    {metricas.adicObjData.length === 0 ? (
                        <div className="dg-empty">Sin horas adicionales registradas</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={metricas.adicObjData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                                <Tooltip content={<CustomTooltip suffix="hs" />} />
                                <Bar dataKey="value" name="Adicionales" fill="#f59e0b" radius={[0,4,4,0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>
            </div>

            {/* ── Fila 3: % cobertura por objetivo | ausentismo | régimen ── */}
            <div className="dg-charts-row dg-charts-row--3">
                <ChartCard titulo="🎯 % Cobertura por cliente">
                    {metricas.cobClienteData.length === 0 ? (
                        <div className="dg-empty">Sin datos</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={metricas.cobClienteData} layout="vertical" margin={{ top: 10, right: 50, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                                <Tooltip
                                    formatter={(v, name, props) => {
                                        const d = props.payload;
                                        return [`${v}% (${d.trab?.toLocaleString() ?? 0} / ${d.prog?.toLocaleString() ?? 0} hs)`, "Cobertura"];
                                    }}
                                />
                                <Bar dataKey="value" name="Cobertura" radius={[0,4,4,0]}>
                                    {metricas.cobClienteData.map((entry, i) => (
                                        <Cell key={i} fill={entry.value >= 95 ? COLOR_TRAB : entry.value >= 80 ? "#f59e0b" : COLOR_AUS} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>

                <ChartCard titulo="📉 Ausentismo mensual (%)">
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={metricas.porMes} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 'auto']} />
                            <Tooltip formatter={(v) => [`${v}%`, "Ausentismo"]} labelFormatter={l => l} />
                            <Line
                                type="monotone"
                                dataKey="ausPct"
                                name="Ausentismo"
                                stroke={COLOR_AUS}
                                strokeWidth={2.5}
                                dot={{ r: 4, fill: COLOR_AUS }}
                                activeDot={{ r: 6 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard titulo="👷 Personal por régimen">
                    {metricas.regimenData.length === 0 ? (
                        <div className="dg-empty">Sin datos de personal</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={metricas.regimenData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                                <Tooltip content={<CustomTooltip suffix=" pers." />} />
                                <Bar dataKey="value" name="Personal" radius={[0,4,4,0]}>
                                    {metricas.regimenData.map((_, i) => (
                                        <Cell key={i} fill={COLORS_PIE[i % COLORS_PIE.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>
            </div>

            {/* ── Extras del mes actual ── */}
            {(extrasDelMes.top50.length > 0 || extrasDelMes.top100.length > 0) && (
                <div className="dg-extras-section">
                    <div className="dg-extras-titulo">
                        ⏰ Horas extra — {mesActual.label} {mesActual.año}
                    </div>

                    {/* KPIs de extras */}
                    <div className="dg-extras-kpis">
                        {[
                            { label: "Ext 50% pagadas",   val: extrasDelMes.totExt50,  aut: extrasDelMes.autExt50,  color: "#f59e0b" },
                            { label: "Ext 100% pagadas",  val: extrasDelMes.totExt100, aut: extrasDelMes.autExt100, color: "#ef4444" },
                        ].map(k => {
                            const desv = Math.round((k.val - k.aut) * 10) / 10;
                            const pct  = k.aut > 0 ? Math.round((k.val / k.aut - 1) * 1000) / 10 : null;
                            return (
                                <div key={k.label} className="dg-extras-kpi">
                                    <div className="dg-extras-kpi-label">{k.label}</div>
                                    <div className="dg-extras-kpi-val" style={{ color: k.color }}>{k.val} hs</div>
                                    <div className="dg-extras-kpi-meta">
                                        <span>Aut. estimado: {k.aut} hs</span>
                                        <span className={desv > 0 ? "dg-extras-pos" : desv < 0 ? "dg-extras-neg" : ""}>
                                            Desvío: {desv > 0 ? "+" : ""}{desv} hs
                                            {pct != null && ` (${pct > 0 ? "+" : ""}${pct}%)`}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Gráficos top personas */}
                    <div className="dg-charts-row dg-charts-row--2">
                        {extrasDelMes.top50.length > 0 && (
                            <ChartCard titulo="🔶 Top — Ext 50%">
                                <ResponsiveContainer width="100%" height={Math.max(180, extrasDelMes.top50.length * 24)}>
                                    <BarChart data={extrasDelMes.top50} layout="vertical"
                                        margin={{ left: 4, right: 24, top: 4, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                        <XAxis type="number" tick={{ fontSize: 10 }} height={18} />
                                        <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10 }} width={150}
                                            tickFormatter={v => v.length > 22 ? v.slice(0,22)+"…" : v} />
                                        <Tooltip formatter={(v) => [`${v} hs`, "Ext 50%"]} />
                                        <Bar dataKey="ext50" name="Ext 50%" fill="#f59e0b" radius={[0,4,4,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        )}
                        {extrasDelMes.top100.length > 0 && (
                            <ChartCard titulo="🔴 Top — Ext 100%">
                                <ResponsiveContainer width="100%" height={Math.max(180, extrasDelMes.top100.length * 24)}>
                                    <BarChart data={extrasDelMes.top100} layout="vertical"
                                        margin={{ left: 4, right: 24, top: 4, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                        <XAxis type="number" tick={{ fontSize: 10 }} height={18} />
                                        <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10 }} width={150}
                                            tickFormatter={v => v.length > 22 ? v.slice(0,22)+"…" : v} />
                                        <Tooltip formatter={(v) => [`${v} hs`, "Ext 100%"]} />
                                        <Bar dataKey="ext100" name="Ext 100%" fill="#ef4444" radius={[0,4,4,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        )}
                    </div>
                </div>
            )}

            {/* ── Resumen mes actual ── */}
            <div className="dg-resumen-mes">
                <div className="dg-resumen-titulo">📌 Resumen {mesActual.label} {mesActual.año}</div>
                <div className="dg-resumen-grid">
                    <div className="dg-resumen-item">
                        <span className="dg-resumen-val" style={{ color: "#2563eb" }}>{datosMesActual.prog ?? 0}</span>
                        <span className="dg-resumen-key">hs programadas</span>
                    </div>
                    <div className="dg-resumen-item">
                        <span className="dg-resumen-val" style={{ color: "#16a34a" }}>{datosMesActual.trab ?? 0}</span>
                        <span className="dg-resumen-key">hs cubiertas</span>
                    </div>
                    <div className="dg-resumen-item">
                        <span className="dg-resumen-val" style={{ color: "#dc2626" }}>{datosMesActual.nocub ?? 0}</span>
                        <span className="dg-resumen-key">hs no cubiertas</span>
                    </div>
                    <div className="dg-resumen-item">
                        <span className="dg-resumen-val" style={{ color: "#f59e0b" }}>{datosMesActual.ausPct ?? 0}%</span>
                        <span className="dg-resumen-key">ausentismo</span>
                    </div>
                    <div className="dg-resumen-item">
                        <span className="dg-resumen-val" style={{ color: "#0891b2" }}>
                            {((datosMesActual.prog ?? 0) + (datosMesActual.adicionales ?? 0)).toLocaleString()}
                        </span>
                        <span className="dg-resumen-key">hs facturadas</span>
                    </div>
                </div>
            </div>

        </div>
    );
}
