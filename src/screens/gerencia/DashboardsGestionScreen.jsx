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
    const { empresaNombre } = useAppData();
    const [loading,       setLoading]       = useState(true);
    const [progDocs,      setProgDocs]      = useState([]);
    const [legajos,       setLegajos]       = useState([]);
    const [capacitaciones,setCapacitaciones]= useState([]);
    const [objetivos,     setObjetivos]     = useState([]);
    const [zonaActiva,    setZonaActiva]    = useState(null); // null = Total

    const meses = useMemo(() => ultimos6Meses(), []);

    useEffect(() => {
        if (!empresaNombre) return;
        const cargar = async () => {
            setLoading(true);
            try {
                // Programación últimos 6 meses
                const progPromises = meses.map(({ año, mes }) =>
                    getDocs(query(
                        collection(db, "programacionServicios"),
                        where("empresa", "==", empresaNombre),
                        where("año", "==", año),
                        where("mes", "==", mes)
                    ))
                );
                const snaps = await Promise.all(progPromises);
                const docs = snaps.flatMap((snap, i) =>
                    snap.docs.map(d => ({ ...d.data(), _mes: meses[i] }))
                );
                setProgDocs(docs);

                // Legajos
                const legSnap = await getDocs(query(
                    collection(db, "legajos"),
                    where("empresa", "==", empresaNombre)
                ));
                setLegajos(legSnap.docs.map(d => d.data()));

                // Capacitaciones
                const capSnap = await getDocs(query(
                    collection(db, "capacitaciones"),
                    where("empresa", "==", empresaNombre)
                ));
                setCapacitaciones(capSnap.docs.map(d => d.data()));

                // Objetivos
                const objSnap = await getDocs(query(
                    collection(db, "objetivos"),
                    where("empresa", "==", empresaNombre)
                ));
                setObjetivos(objSnap.docs.map(d => d.data()));
            } finally {
                setLoading(false);
            }
        };
        cargar();
    }, [empresaNombre]);

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
