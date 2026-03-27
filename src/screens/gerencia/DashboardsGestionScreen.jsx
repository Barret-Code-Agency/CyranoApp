// src/screens/gerencia/DashboardsGestionScreen.jsx
// Dashboard de gestión — dos vistas: Mes en curso (por cliente) + Comparativo 6 meses

import { useEffect, useState, useMemo } from "react";
import { useAppData } from "../../context/AppDataContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, ComposedChart, Cell,
} from "recharts";
import "./DashboardsGestionScreen.css";
import { getDias, fmtKey, horasDeValor, normalizarTurno } from "../../utils/periodoUtils";
import { FERIADOS_ARG } from "../../utils/feriados";

// ── Helpers ───────────────────────────────────────────────────────────────────
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

const esTurno     = v => v && (v.includes("–") || v.includes("-")) && v.includes(":");
const esAusentismo = v => v && ["enf","art","asa","aca","lic","sus"].includes(v.toLowerCase());
const esAusenteCode = v => v && ["enf","art","asa","aca","lic","sus","vac"].includes(v.toLowerCase());

function ultimos6Meses() {
    const hoy = new Date();
    return Array.from({ length: 6 }, (_, i) => {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() - 5 + i, 1);
        return { año: d.getFullYear(), mes: d.getMonth() + 1, label: MESES_CORTO[d.getMonth()] };
    });
}

const COLORS = ["#2563eb","#16a34a","#dc2626","#f59e0b","#7c3aed","#0891b2","#db2777","#ea580c"];
const COLOR_PROG = "#2563eb";
const COLOR_TRAB = "#16a34a";
const COLOR_AUS  = "#dc2626";

// ── YAxis tick de una sola línea (evita word-wrap de Recharts) ────────────────
function YTickLeft({ x, y, payload, axisWidth = 150, maxChars = 22 }) {
    const label = payload.value.length > maxChars ? payload.value.slice(0, maxChars) + "…" : payload.value;
    return (
        <text x={x - axisWidth + 4} y={y} fill="#374151" fontSize={10} dominantBaseline="middle">
            {label}
        </text>
    );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color = "#2563eb" }) {
    return (
        <div className="dg-kpi" style={{ borderTopColor: color }}>
            <div className="dg-kpi-icon" style={{ background: color + "18", color }}>{icon}</div>
            <div className="dg-kpi-body">
                <div className="dg-kpi-value" style={{ color }}>{value}</div>
                <div className="dg-kpi-label">{label}</div>
                {sub && <div className="dg-kpi-sub">{sub}</div>}
            </div>
        </div>
    );
}

// ── Chart card ────────────────────────────────────────────────────────────────
function ChartCard({ titulo, children }) {
    return (
        <div className="dg-chart-card">
            <div className="dg-chart-title">{titulo}</div>
            {children}
        </div>
    );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
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
export default function DashboardsGestionScreen({ onBack, embedded }) {
    const { empresaNombre, empresaId } = useAppData();
    const [loading,        setLoading]        = useState(true);
    const [progDocs,       setProgDocs]       = useState([]);
    const [legajos,        setLegajos]        = useState([]);
    const [capacitaciones, setCapacitaciones] = useState([]);
    const [objetivos,      setObjetivos]      = useState([]);
    const [zonaActiva,     setZonaActiva]     = useState(null);
    const [diagramas,      setDiagramas]      = useState([]);
    const [activeTab,      setActiveTab]      = useState("mes");

    const meses = useMemo(() => ultimos6Meses(), []);

    useEffect(() => {
        if (!empresaId) return;
        const cargar = async () => {
            setLoading(true);
            try {
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

                const legSnap = await getDocs(query(collection(db, "legajos"), where("empresaId", "==", empresaId)));
                setLegajos(legSnap.docs.map(d => d.data()));

                const capSnap = await getDocs(query(collection(db, "capacitaciones"), where("empresaId", "==", empresaId)));
                setCapacitaciones(capSnap.docs.map(d => d.data()));

                const objSnap = await getDocs(query(collection(db, "objetivos"), where("empresaId", "==", empresaId)));
                setObjetivos(objSnap.docs.map(d => d.data()));

                const diagSnap = await getDocs(query(collection(db, "diagramas14x14"), where("empresaId", "==", empresaId))).catch(() => ({ docs: [] }));
                setDiagramas(diagSnap.docs.map(d => d.data()));
            } finally {
                setLoading(false);
            }
        };
        cargar();
    }, [empresaId]);

    const zonas = useMemo(() => [...new Set(legajos.map(l => l.zona).filter(Boolean))].sort(), [legajos]);
    const legajosEnZona = useMemo(() => zonaActiva ? legajos.filter(l => l.zona === zonaActiva) : legajos, [legajos, zonaActiva]);
    const legajosZonaSet = useMemo(() => new Set(legajosEnZona.map(l => l.legajo).filter(Boolean)), [legajosEnZona]);

    const filteredDocs = useMemo(() => {
        if (!zonaActiva) return progDocs;
        return progDocs.map(doc => ({
            ...doc,
            personal: (doc.personal ?? []).filter(p => legajosZonaSet.has(p.legajo)),
        })).filter(doc => doc.personal.length > 0);
    }, [progDocs, zonaActiva, legajosZonaSet]);

    // ── Helpers de régimen (para extras) ──────────────────────────────────────
    const { regimenMap, grupoMap, excluidos, francosMap } = useMemo(() => {
        const regimenMap = {}, grupoMap = {};
        const excluidos  = new Set();
        const EXCL_TAREA = new Set(["Jefe", "Supervisor (FC)"]);
        legajos.forEach(l => {
            const leg = String(l.legajo || "");
            regimenMap[leg] = l.regimen || "";
            grupoMap[leg]   = l.grupoTurno14 || "";
            if ((l.estado && l.estado !== "Activo") || (l.cargo || "").includes("(FC)") || EXCL_TAREA.has(l.tarea))
                excluidos.add(leg);
        });
        const francosMap = {};
        diagramas.forEach(g => { if (g.grupo && g.francos) francosMap[g.grupo] = new Set(g.francos); });
        return { regimenMap, grupoMap, excluidos, francosMap };
    }, [legajos, diagramas]);

    // ── Función de cálculo de extras para un legajo ───────────────────────────
    function calcExtras(leg, realData, dias) {
        const reg   = regimenMap[leg] || "";
        const grupo = grupoMap[leg]   || "";
        let ext50 = 0, ext100 = 0;
        const hs = key => { const v = realData[key]; return typeof v === "number" ? v : horasDeValor(normalizarTurno(v || "")); };

        if (reg === "14 x 14 x 8" || reg === "14 x 14 x 12") {
            const umbral = reg === "14 x 14 x 8" ? 8 : 12;
            const francos = francosMap[grupo] || new Set();
            dias.forEach(d => { const k = fmtKey(d), h = hs(k); if (h <= 0) return; if (francos.has(k)) ext100 += h; else if (h > umbral) ext50 += h - umbral; });
        } else if (reg === "200") {
            const total = dias.reduce((s, d) => s + hs(fmtKey(d)), 0);
            ext50 = Math.max(0, total - 200);
        } else {
            const umbral = reg === "4 x 2 x 12" ? 10 : reg === "5 x 2 x 12" ? 9.5 : reg === "6 x 1 x 8" ? 8 : reg === "12 x 36" ? 13 : null;
            if (umbral !== null) {
                dias.forEach(d => {
                    const k = fmtKey(d), h = hs(k);
                    if (h <= umbral) return;
                    const exc = h - umbral, dow = d.getDay(), esFer = !!FERIADOS_ARG[k];
                    if (esFer || dow === 0 || dow === 6) ext100 += exc; else ext50 += exc;
                });
            }
        }
        return { ext50: Math.round(ext50 * 10) / 10, ext100: Math.round(ext100 * 10) / 10 };
    }

    // ── Métricas por cliente — MES EN CURSO ───────────────────────────────────
    const mesActual = meses[meses.length - 1];
    const clienteMetricasMes = useMemo(() => {
        const { año, mes } = mesActual;
        const dias = getDias(año, mes);
        const docsDelMes = filteredDocs.filter(d => d._mes?.año === año && d._mes?.mes === mes);

        // Paso 1: acumular datos por legajo (real data + cliente principal)
        const byLeg = {};
        docsDelMes.forEach(doc => {
            const cli = doc.clienteNombre || doc.cliente || doc.contrato || "Sin cliente";
            (doc.personal || []).forEach(p => {
                const leg = String(p.legajo || "");
                if (!byLeg[leg]) byLeg[leg] = { nombre: p.nombre || leg, cliHoras: {}, realData: {} };
                const r = byLeg[leg];
                // Cuántas horas programadas tiene este legajo en este cliente
                Object.keys(p.programado || {}).forEach(fecha => {
                    const v = p.programado[fecha];
                    if (esTurno(v)) r.cliHoras[cli] = (r.cliHoras[cli] || 0) + parseHoras(v);
                });
                // Acumular real (puede aparecer en varios docs del mismo mes)
                Object.entries(p.real || {}).forEach(([k, v]) => {
                    const hs = horasDeValor(normalizarTurno(v));
                    r.realData[k] = hs > 0 ? (r.realData[k] || 0) + hs : (r.realData[k] || v || "");
                });
                // Capacitación cuenta como horas extra
                Object.entries(p.capacitacion || {}).forEach(([k, v]) => {
                    const hc = Number(v) || 0;
                    if (hc <= 0) return;
                    r.realData[k] = typeof r.realData[k] === "number" ? r.realData[k] + hc : hc;
                });
            });
        });

        // Cliente principal de cada legajo
        const legCliPrincipal = {};
        Object.entries(byLeg).forEach(([leg, r]) => {
            legCliPrincipal[leg] = Object.entries(r.cliHoras).sort((a, b) => b[1] - a[1])[0]?.[0] || "Sin cliente";
        });

        // Paso 2: acumular métricas operativas por cliente (de los docs)
        const byCli = {};
        const init = cli => {
            if (!byCli[cli]) byCli[cli] = { prog: 0, trab: 0, adicHoras: 0, ausDias: 0, ausHoras: 0, vacDias: 0, vacHoras: 0, ext50Hs: 0, ext50Cant: new Set(), ext100Hs: 0, ext100Cant: new Set() };
        };

        docsDelMes.forEach(doc => {
            const cli = doc.clienteNombre || doc.cliente || doc.contrato || "Sin cliente";
            init(cli);
            const c = byCli[cli];
            (doc.personal || []).forEach(p => {
                const rawProg = p.programado || {};
                const hasProg = Object.keys(rawProg).some(k => esTurno(rawProg[k]));
                const progSrc = hasProg ? rawProg : (p.real || {});
                Object.keys(progSrc).forEach(fecha => {
                    const vP = progSrc[fecha];
                    const vR = hasProg ? (p.real || {})[fecha] : vP;
                    if (hasProg) {
                        if (!esTurno(vP)) return;
                        const h = parseHoras(vP);
                        c.prog += h;
                        if (vR && esTurno(vR))               c.trab += parseHoras(vR);
                        else if (esAusentismo(vR))             { c.ausDias++; c.ausHoras += 12; }
                        else if (vR?.toLowerCase() === "vac")  { c.vacDias++; c.vacHoras += 12; }
                        else if (!vR)                          c.trab += h;
                    } else {
                        // Sin programado: usamos real como fuente única
                        if (esTurno(vP)) {
                            const h = parseHoras(vP);
                            c.prog += h;
                            c.trab += h;
                        } else if (esAusentismo(vP)) {
                            c.prog += 12;
                            c.ausDias++;
                            c.ausHoras += 12;
                        } else if (vP?.toLowerCase() === "vac") {
                            c.prog += 12;
                            c.vacDias++;
                            c.vacHoras += 12;
                        }
                    }
                });
                if (hasProg) {
                    Object.keys(p.real || {}).forEach(fecha => {
                        const vR = p.real[fecha], vP = rawProg[fecha];
                        if (esTurno(vR) && !esTurno(vP)) c.adicHoras += parseHoras(vR);
                        if (!vP) {
                            if (esAusentismo(vR))               { c.ausDias++; c.ausHoras += 12; }
                            else if (vR?.toLowerCase() === "vac") { c.vacDias++; c.vacHoras += 12; }
                        }
                    });
                }
            });
        });

        // Paso 3: calcular extras por legajo y atribuir al cliente principal
        Object.entries(byLeg).forEach(([leg, r]) => {
            if (excluidos.has(leg)) return;
            const cli = legCliPrincipal[leg];
            init(cli);
            const c = byCli[cli];
            const { ext50, ext100 } = calcExtras(leg, r.realData, dias);
            if (ext50  > 0) { c.ext50Hs  += ext50;  c.ext50Cant.add(leg);  }
            if (ext100 > 0) { c.ext100Hs += ext100; c.ext100Cant.add(leg); }
        });

        // Totales globales
        let totalProg = 0, totalFact = 0, totalAusDias = 0, totalVacDias = 0, totalExt50 = 0, totalExt100 = 0;
        const rows = Object.entries(byCli).map(([name, d]) => {
            const fact = d.trab + d.adicHoras;
            const ext50Pct  = fact > 0 ? Math.round((d.ext50Hs  / fact) * 100 * 10) / 10 : 0;
            const ext100Pct = fact > 0 ? Math.round((d.ext100Hs / fact) * 100 * 10) / 10 : 0;
            const ausPct    = d.prog > 0 ? Math.round((d.ausHoras / d.prog) * 100 * 10) / 10 : 0;
            totalProg    += d.prog;   totalFact   += fact;
            totalAusDias += d.ausDias; totalVacDias += d.vacDias;
            totalExt50   += d.ext50Hs; totalExt100  += d.ext100Hs;
            return {
                name,
                prog:       d.prog,
                facturadas: fact,
                cobPct:     d.prog > 0 ? Math.round((d.trab / d.prog) * 100) : 0,
                ausDias:    d.ausDias,
                ausHoras:   d.ausHoras,
                ausPct,
                vacDias:    d.vacDias,
                vacHoras:   d.vacHoras,
                ext50Hs:    Math.round(d.ext50Hs  * 10) / 10,
                ext50Cant:  d.ext50Cant.size,
                ext50Pct,
                ext100Hs:   Math.round(d.ext100Hs * 10) / 10,
                ext100Cant: d.ext100Cant.size,
                ext100Pct,
            };
        }).sort((a, b) => b.prog - a.prog);

        return { rows, totalProg, totalFact, totalAusDias, totalVacDias, totalExt50, totalExt100 };
    }, [filteredDocs, mesActual, excluidos, regimenMap, grupoMap, francosMap]);

    // ── Métricas 6 meses (para tab comparativo) ───────────────────────────────
    const metricas6m = useMemo(() => {
        const porMes = meses.map(({ año, mes, label }) => {
            const docs = filteredDocs.filter(d => d._mes?.año === año && d._mes?.mes === mes);
            let prog = 0, trab = 0, ausInv = 0, adicionales = 0;
            docs.forEach(doc => {
                (doc.personal ?? []).forEach(p => {
                    const rawProg = p.programado || {};
                    const hasProg = Object.keys(rawProg).some(k => esTurno(rawProg[k]));
                    const progSrc = hasProg ? rawProg : (p.real || {});
                    Object.keys(progSrc).forEach(fecha => {
                        const vP = progSrc[fecha], vR = hasProg ? (p.real ?? {})[fecha] : vP;
                        if (esTurno(vP)) {
                            const h = parseHoras(vP); prog += h;
                            if (hasProg) {
                                if (vR && esTurno(vR))  trab += parseHoras(vR);
                                else if (esAusentismo(vR)) ausInv += h;
                                else if (!vR)           trab += h;
                            } else {
                                trab += h;
                            }
                        }
                    });
                    if (hasProg) {
                        Object.keys(p.real ?? {}).forEach(fecha => {
                            const vR = p.real[fecha], vP = rawProg[fecha];
                            if (esTurno(vR) && !esTurno(vP)) adicionales += parseHoras(vR);
                        });
                    }
                });
            });
            const ausPct = prog > 0 ? parseFloat(((ausInv / prog) * 100).toFixed(1)) : 0;
            const capHoras = parseFloat((capacitaciones
                .filter(c => { const f = c.fecha || ""; return f.startsWith(`${año}-${String(mes).padStart(2,"0")}`); })
                .reduce((s, c) => s + (Number(c.duracion) || 0), 0) / 60).toFixed(1));
            return { label, prog, trab, nocub: Math.max(0, prog - trab), ausInv, ausPct, adicionales, capHoras };
        });

        // Evolución 6 meses por cliente
        const cliKeys = new Set();
        const porMesCliente = meses.map(({ año, mes, label }) => {
            const docs = filteredDocs.filter(d => d._mes?.año === año && d._mes?.mes === mes);
            const entry = { label };
            docs.forEach(doc => {
                const cli = doc.clienteNombre || doc.cliente || doc.contrato || "Sin cliente";
                cliKeys.add(cli);
                let prog = 0;
                (doc.personal || []).forEach(p => {
                    const rawProg = p.programado || {};
                    const hasProg = Object.keys(rawProg).some(k => esTurno(rawProg[k]));
                    const src = hasProg ? rawProg : (p.real || {});
                    Object.values(src).forEach(v => { if (esTurno(v)) prog += parseHoras(v); });
                });
                entry[cli] = (entry[cli] || 0) + prog;
            });
            return entry;
        });

        const totProg  = porMes.reduce((s, m) => s + m.prog, 0);
        const totTrab  = porMes.reduce((s, m) => s + m.trab, 0);
        const totNoCub = porMes.reduce((s, m) => s + m.nocub, 0);
        const pctCub   = totProg > 0 ? Math.round((totTrab / totProg) * 100) : 0;

        // Horas no cubiertas por objetivo (6m)
        const nocubPorObj = {};
        filteredDocs.forEach(doc => {
            const obj = doc.objetivo || "Sin objetivo";
            (doc.personal ?? []).forEach(p => {
                Object.keys(p.programado ?? {}).forEach(fecha => {
                    const vP = p.programado[fecha], vR = (p.real ?? {})[fecha];
                    if (esTurno(vP) && esAusenteCode(vR))
                        nocubPorObj[obj] = (nocubPorObj[obj] || 0) + parseHoras(vP);
                });
            });
        });
        const nocubObjData = Object.entries(nocubPorObj).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

        // Horas adicionales por objetivo (6m)
        const adicPorObj = {};
        filteredDocs.forEach(doc => {
            const obj = doc.objetivo || "Sin objetivo";
            (doc.personal ?? []).forEach(p => {
                Object.keys(p.real ?? {}).forEach(fecha => {
                    const vR = p.real[fecha], vP = (p.programado ?? {})[fecha];
                    if (esTurno(vR) && !esTurno(vP)) adicPorObj[obj] = (adicPorObj[obj] || 0) + parseHoras(vR);
                });
            });
        });
        const adicObjData = Object.entries(adicPorObj).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

        // Cobertura por cliente (6m)
        const cobCliente = {};
        filteredDocs.forEach(doc => {
            const cli = doc.clienteNombre || doc.cliente || doc.contrato || "Sin cliente";
            if (!cobCliente[cli]) cobCliente[cli] = { prog: 0, trab: 0 };
            (doc.personal ?? []).forEach(p => {
                const rawProg = p.programado || {};
                const hasProg = Object.keys(rawProg).some(k => esTurno(rawProg[k]));
                const progSrc = hasProg ? rawProg : (p.real || {});
                Object.keys(progSrc).forEach(fecha => {
                    const vP = progSrc[fecha], vR = hasProg ? (p.real ?? {})[fecha] : vP;
                    if (esTurno(vP)) {
                        const h = parseHoras(vP);
                        cobCliente[cli].prog += h;
                        if (hasProg) {
                            if (vR && esTurno(vR)) cobCliente[cli].trab += parseHoras(vR);
                            else if (!vR)          cobCliente[cli].trab += h;
                        } else {
                            cobCliente[cli].trab += h;
                        }
                    }
                });
            });
        });
        const cobClienteData = Object.entries(cobCliente)
            .map(([name, { prog, trab }]) => ({ name, prog, trab, value: prog > 0 ? parseFloat(((trab / prog) * 100).toFixed(1)) : 0 }))
            .sort((a, b) => a.value - b.value);

        // Personal por régimen
        const porRegimen = {};
        legajosEnZona.forEach(l => { const r = l.regimen || "Sin régimen"; porRegimen[r] = (porRegimen[r] || 0) + 1; });
        const regimenData = Object.entries(porRegimen).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

        // Capacitaciones por categoría
        const capPorCat = {};
        capacitaciones.forEach(c => { const cat = c.categoria || "Sin categoría"; capPorCat[cat] = (capPorCat[cat] || 0) + 1; });
        const capData = Object.entries(capPorCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);

        return { porMes, porMesCliente, cliKeys: [...cliKeys], totProg, totTrab, totNoCub, pctCub, nocubObjData, adicObjData, cobClienteData, regimenData, capData };
    }, [filteredDocs, meses, legajosEnZona, capacitaciones]);

    // ── Extras del mes actual por persona (top lists) ─────────────────────────
    const extrasDelMes = useMemo(() => {
        const hoy = new Date(), año = hoy.getFullYear(), mes = hoy.getMonth() + 1;
        const dias = getDias(año, mes);
        const EXCL_TAREA = new Set(["Jefe", "Supervisor (FC)"]);
        const excl = new Set();
        legajos.forEach(l => {
            const leg = String(l.legajo || "");
            if ((l.estado && l.estado !== "Activo") || (l.cargo || "").includes("(FC)") || EXCL_TAREA.has(l.tarea)) excl.add(leg);
        });

        const byLeg = {};
        const docsDelMes = filteredDocs.filter(d => d._mes?.año === año && d._mes?.mes === mes);
        docsDelMes.forEach(doc => {
            const vistoEnDoc = new Set();
            (doc.personal || []).forEach(p => {
                const leg = String(p.legajo || "");
                if (excl.has(leg) || vistoEnDoc.has(leg)) return;
                vistoEnDoc.add(leg);
                if (!byLeg[leg]) byLeg[leg] = { nombre: p.nombre || leg, data: {} };
                Object.entries(p.real || {}).forEach(([k, v]) => {
                    const hs = horasDeValor(normalizarTurno(v));
                    if (hs > 0) byLeg[leg].data[k] = (byLeg[leg].data[k] || 0) + hs;
                    else if (!byLeg[leg].data[k]) byLeg[leg].data[k] = v || "";
                });
                Object.entries(p.capacitacion || {}).forEach(([k, v]) => {
                    const hc = Number(v) || 0;
                    if (hc <= 0) return;
                    if (typeof byLeg[leg].data[k] === "number") byLeg[leg].data[k] += hc;
                    else if (!byLeg[leg].data[k]) byLeg[leg].data[k] = hc;
                });
            });
        });

        const personas = Object.entries(byLeg).map(([leg, r]) => {
            const { ext50, ext100 } = calcExtras(leg, r.data, dias);
            return { nombre: r.nombre.trim(), ext50, ext100 };
        });

        const totExt50  = Math.round(personas.reduce((s, p) => s + p.ext50,  0) * 10) / 10;
        const totExt100 = Math.round(personas.reduce((s, p) => s + p.ext100, 0) * 10) / 10;
        const top50  = personas.filter(p => p.ext50  > 0).sort((a, b) => b.ext50  - a.ext50).slice(0, 15);
        const top100 = personas.filter(p => p.ext100 > 0).sort((a, b) => b.ext100 - a.ext100).slice(0, 10);
        return { totExt50, totExt100, top50, top100 };
    }, [filteredDocs, legajos, diagramas]);

    if (loading) return (
        <div className="dg-loading">
            <div className="dg-loading-spinner" />
            <div>Calculando métricas...</div>
        </div>
    );

    const { rows, totalProg, totalFact, totalAusDias, totalVacDias, totalExt50, totalExt100 } = clienteMetricasMes;

    return (
        <div className="dg-root">

            {/* ── Tabs ── */}
            {!embedded && (
            <div className="dg-tabs">
                <button className={`dg-tab${activeTab === "mes" ? " dg-tab--active" : ""}`} onClick={() => setActiveTab("mes")}>
                    📅 Mes en curso — {mesActual.label} {mesActual.año}
                </button>
                <button className={`dg-tab${activeTab === "comparativo" ? " dg-tab--active" : ""}`} onClick={() => setActiveTab("comparativo")}>
                    📊 Comparativo 6 meses
                </button>
            </div>
            )}

            {/* ── Zona tabs ── */}
            {!embedded && zonas.length > 0 && (
                <div className="dg-zona-tabs">
                    <button className={`dg-zona-tab${zonaActiva === null ? " dg-zona-tab--active" : ""}`} onClick={() => setZonaActiva(null)}>
                        🌐 Todo el contrato <span className="dg-zona-tab-count">{legajos.length}</span>
                    </button>
                    {zonas.map(z => (
                        <button key={z} className={`dg-zona-tab${zonaActiva === z ? " dg-zona-tab--active" : ""}`} onClick={() => setZonaActiva(z)}>
                            📍 {z} <span className="dg-zona-tab-count">{legajos.filter(l => l.zona === z).length}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* ══════════════════════════════════════
                SECCIÓN 1 — MES EN CURSO
            ══════════════════════════════════════ */}
            <>
                    {/* KPI strip */}
                    <div className="dg-kpi-grid">
                        <KpiCard icon="👷" label="Personal activo"    value={legajosEnZona.length}          sub={`${objetivos.length} objetivos`}        color="#2563eb" />
                        <KpiCard icon="✅" label="Hs a cubrir"        value={totalProg.toLocaleString()}     sub="horas programadas del mes"              color="#7c3aed" />
                        <KpiCard icon="💼" label="Hs facturadas"      value={totalFact.toLocaleString()}     sub="cubiertas + adicionales"                color="#16a34a" />
                        <KpiCard icon="🤒" label="Ausentismo"         value={`${totalAusDias} días`}         sub={`${totalAusDias * 12} hs · ${totalProg > 0 ? Math.round(totalAusDias * 12 / totalProg * 100) : 0}% del prog.`} color="#dc2626" />
                        <KpiCard icon="🔶" label="Extras 50%"         value={`${totalExt50} hs`}             sub={`${totalFact > 0 ? Math.round(totalExt50 / totalFact * 100 * 10)/10 : 0}% de facturadas`} color="#f59e0b" />
                        <KpiCard icon="🔴" label="Extras 100%"        value={`${totalExt100} hs`}            sub={`${totalFact > 0 ? Math.round(totalExt100 / totalFact * 100 * 10)/10 : 0}% de facturadas`} color="#ef4444" />
                    </div>

                    {/* Tabla por cliente */}
                    {rows.length === 0 ? (
                        <div className="dg-empty">Sin datos para {mesActual.label} {mesActual.año}</div>
                    ) : (
                        <div className="dg-cli-table-wrap">
                            <div className="dg-cli-table-titulo">
                                📋 Estadísticas por cliente — {mesActual.label} {mesActual.año}
                            </div>
                            <div className="dg-cli-scroll">
                                <table className="dg-cli-table">
                                    <thead>
                                        <tr>
                                            <th rowSpan={2} className="dg-th-main">Cliente</th>
                                            <th rowSpan={2} className="dg-th-num">Hs a cubrir</th>
                                            <th rowSpan={2} className="dg-th-num">Hs facturadas</th>
                                            <th rowSpan={2} className="dg-th-num">% Cob.</th>
                                            <th colSpan={3} className="dg-th-group dg-th-group--aus">Ausentismo</th>
                                            <th colSpan={2} className="dg-th-group dg-th-group--vac">Vacaciones</th>
                                            <th colSpan={3} className="dg-th-group dg-th-group--e50">Extras 50%</th>
                                            <th colSpan={3} className="dg-th-group dg-th-group--e100">Extras 100%</th>
                                        </tr>
                                        <tr>
                                            <th className="dg-th-sub">Días</th>
                                            <th className="dg-th-sub">Horas</th>
                                            <th className="dg-th-sub">%</th>
                                            <th className="dg-th-sub">Días</th>
                                            <th className="dg-th-sub">Horas</th>
                                            <th className="dg-th-sub">Cant.</th>
                                            <th className="dg-th-sub">Hs</th>
                                            <th className="dg-th-sub">%</th>
                                            <th className="dg-th-sub">Cant.</th>
                                            <th className="dg-th-sub">Hs</th>
                                            <th className="dg-th-sub">%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((r, i) => (
                                            <tr key={r.name} className={i % 2 ? "dg-tr-alt" : ""}>
                                                <td className="dg-td-name">{r.name}</td>
                                                <td className="dg-td-num">{r.prog.toLocaleString()}</td>
                                                <td className="dg-td-num">{r.facturadas.toLocaleString()}</td>
                                                <td className="dg-td-num">
                                                    <span className={`dg-badge ${r.cobPct >= 95 ? "dg-badge--ok" : r.cobPct >= 80 ? "dg-badge--warn" : "dg-badge--bad"}`}>
                                                        {r.cobPct}%
                                                    </span>
                                                </td>
                                                <td className="dg-td-num">{r.ausDias}</td>
                                                <td className="dg-td-num">{r.ausHoras}</td>
                                                <td className="dg-td-num">
                                                    {r.ausPct > 0 && <span className={`dg-badge ${r.ausPct < 3 ? "dg-badge--ok" : r.ausPct < 6 ? "dg-badge--warn" : "dg-badge--bad"}`}>{r.ausPct}%</span>}
                                                </td>
                                                <td className="dg-td-num">{r.vacDias > 0 ? r.vacDias : "—"}</td>
                                                <td className="dg-td-num">{r.vacHoras > 0 ? r.vacHoras : "—"}</td>
                                                <td className="dg-td-num">{r.ext50Cant > 0 ? r.ext50Cant + " pers." : "—"}</td>
                                                <td className="dg-td-num">{r.ext50Hs > 0 ? r.ext50Hs : "—"}</td>
                                                <td className="dg-td-num">{r.ext50Pct > 0 ? <span className="dg-badge dg-badge--warn">{r.ext50Pct}%</span> : "—"}</td>
                                                <td className="dg-td-num">{r.ext100Cant > 0 ? r.ext100Cant + " pers." : "—"}</td>
                                                <td className="dg-td-num">{r.ext100Hs > 0 ? r.ext100Hs : "—"}</td>
                                                <td className="dg-td-num">{r.ext100Pct > 0 ? <span className="dg-badge dg-badge--bad">{r.ext100Pct}%</span> : "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="dg-tr-total">
                                            <td className="dg-td-name">TOTAL</td>
                                            <td className="dg-td-num">{totalProg.toLocaleString()}</td>
                                            <td className="dg-td-num">{totalFact.toLocaleString()}</td>
                                            <td className="dg-td-num">
                                                <span className={`dg-badge ${totalProg > 0 && totalFact/totalProg >= 0.95 ? "dg-badge--ok" : "dg-badge--warn"}`}>
                                                    {totalProg > 0 ? Math.round(totalFact / totalProg * 100) : 0}%
                                                </span>
                                            </td>
                                            <td className="dg-td-num">{totalAusDias}</td>
                                            <td className="dg-td-num">{totalAusDias * 12}</td>
                                            <td className="dg-td-num">
                                                <span className="dg-badge dg-badge--warn">
                                                    {totalProg > 0 ? Math.round(totalAusDias * 12 / totalProg * 100 * 10) / 10 : 0}%
                                                </span>
                                            </td>
                                            <td className="dg-td-num">{totalVacDias}</td>
                                            <td className="dg-td-num">{totalVacDias * 12}</td>
                                            <td className="dg-td-num">—</td>
                                            <td className="dg-td-num">{Math.round(totalExt50 * 10) / 10}</td>
                                            <td className="dg-td-num">
                                                <span className="dg-badge dg-badge--warn">{totalFact > 0 ? Math.round(totalExt50 / totalFact * 100 * 10) / 10 : 0}%</span>
                                            </td>
                                            <td className="dg-td-num">—</td>
                                            <td className="dg-td-num">{Math.round(totalExt100 * 10) / 10}</td>
                                            <td className="dg-td-num">
                                                <span className="dg-badge dg-badge--bad">{totalFact > 0 ? Math.round(totalExt100 / totalFact * 100 * 10) / 10 : 0}%</span>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Extras por persona */}
                    {(extrasDelMes.top50.length > 0 || extrasDelMes.top100.length > 0) && (
                        <div className="dg-extras-section">
                            <div className="dg-extras-titulo">⏰ Horas extra por persona — {mesActual.label} {mesActual.año}</div>
                            <div className="dg-charts-row dg-charts-row--2">
                                {extrasDelMes.top50.length > 0 && (
                                    <ChartCard titulo="🔶 Top — Ext 50%">
                                        <ResponsiveContainer width="100%" height={Math.max(180, extrasDelMes.top50.length * 24)}>
                                            <BarChart data={extrasDelMes.top50} layout="vertical" margin={{ left: 10, right: 24, top: 4, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                                <XAxis type="number" tick={{ fontSize: 10 }} height={18} />
                                                <YAxis type="category" dataKey="nombre" width={190} tick={<YTickLeft axisWidth={190} maxChars={28} />} />
                                                <Tooltip formatter={v => [`${v} hs`, "Ext 50%"]} />
                                                <Bar dataKey="ext50" name="Ext 50%" fill="#f59e0b" radius={[0,4,4,0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </ChartCard>
                                )}
                                {extrasDelMes.top100.length > 0 && (
                                    <ChartCard titulo="🔴 Top — Ext 100%">
                                        <ResponsiveContainer width="100%" height={Math.max(180, extrasDelMes.top100.length * 24)}>
                                            <BarChart data={extrasDelMes.top100} layout="vertical" margin={{ left: 10, right: 24, top: 4, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                                <XAxis type="number" tick={{ fontSize: 10 }} height={18} />
                                                <YAxis type="category" dataKey="nombre" width={190} tick={<YTickLeft axisWidth={190} maxChars={28} />} />
                                                <Tooltip formatter={v => [`${v} hs`, "Ext 100%"]} />
                                                <Bar dataKey="ext100" name="Ext 100%" fill="#ef4444" radius={[0,4,4,0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </ChartCard>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Resumen mes actual */}
                    <div className="dg-resumen-mes">
                        <div className="dg-resumen-titulo">📌 Resumen {mesActual.label} {mesActual.año}</div>
                        <div className="dg-resumen-grid">
                            {[
                                { val: totalProg.toLocaleString(),   key: "hs a cubrir",     color: "#7c3aed" },
                                { val: totalFact.toLocaleString(),   key: "hs facturadas",   color: "#16a34a" },
                                { val: totalAusDias + " días",       key: "ausentismo",      color: "#dc2626" },
                                { val: totalVacDias + " días",       key: "vacaciones",      color: "#7c3aed" },
                                { val: extrasDelMes.totExt50 + " hs", key: "extras 50%",     color: "#f59e0b" },
                                { val: extrasDelMes.totExt100 + " hs",key: "extras 100%",    color: "#ef4444" },
                            ].map(({ val, key, color }) => (
                                <div key={key} className="dg-resumen-item">
                                    <span className="dg-resumen-val" style={{ color }}>{val}</span>
                                    <span className="dg-resumen-key">{key}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Mini charts del mes */}
                    <div className="dg-charts-row dg-charts-row--3">
                        <ChartCard titulo="📉 Ausentismo por cliente">
                            {rows.length === 0 ? <div className="dg-empty">Sin datos</div> : (
                                <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 28)}>
                                    <BarChart data={rows} layout="vertical" margin={{ top: 16, right: 50, left: 8, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                                        <YAxis type="category" dataKey="name" width={150} tick={<YTickLeft axisWidth={150} maxChars={22} />} />
                                        <Tooltip formatter={(v, n) => [n === "ausHoras" ? `${v} hs` : `${v} días`, n === "ausHoras" ? "Horas aus." : "Días aus."]} />
                                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                                        <Bar dataKey="ausDias"  name="Días"  fill={COLOR_AUS}   radius={[0,3,3,0]} />
                                        <Bar dataKey="vacDias"  name="Vacac." fill="#a78bfa"  radius={[0,3,3,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCard>

                        <ChartCard titulo="🔶 Horas extra por cliente">
                            {rows.filter(r => r.ext50Hs > 0 || r.ext100Hs > 0).length === 0 ? <div className="dg-empty">Sin extras este mes</div> : (
                                <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 28)}>
                                    <BarChart data={rows} layout="vertical" margin={{ top: 6, right: 30, left: 8, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                                        <YAxis type="category" dataKey="name" width={150} tick={<YTickLeft axisWidth={150} maxChars={22} />} />
                                        <Tooltip formatter={(v, n) => [`${v} hs`, n]} />
                                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                                        <Bar dataKey="ext50Hs"  name="Ext 50%"  fill="#f59e0b" radius={[0,3,3,0]} />
                                        <Bar dataKey="ext100Hs" name="Ext 100%" fill="#ef4444" radius={[0,3,3,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCard>

                        <ChartCard titulo="✅ Cobertura por cliente">
                            {rows.length === 0 ? <div className="dg-empty">Sin datos</div> : (
                                <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 28)}>
                                    <BarChart data={rows} layout="vertical" margin={{ top: 16, right: 50, left: 8, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                                        <YAxis type="category" dataKey="name" width={150} tick={<YTickLeft axisWidth={150} maxChars={22} />} />
                                        <Tooltip formatter={(v) => [`${v}%`, "Cobertura"]} />
                                        <Bar dataKey="cobPct" name="Cobertura" radius={[0,3,3,0]}>
                                            {rows.map((r, i) => <Cell key={i} fill={r.cobPct >= 95 ? COLOR_TRAB : r.cobPct >= 80 ? "#f59e0b" : COLOR_AUS} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCard>
                    </div>
            </>

            {/* ══════════════════════════════════════
                SECCIÓN 2 — COMPARATIVO 6 MESES
            ══════════════════════════════════════ */}
            <>
                    <div className="dg-kpi-grid">
                        <KpiCard icon="👷" label="Personal activo"    value={legajosEnZona.length}                    sub={`${objetivos.length} objetivos`}          color="#2563eb" />
                        <KpiCard icon="✅" label="Cobertura 6m"       value={`${metricas6m.pctCub}%`}                 sub="horas cubiertas vs programadas"           color="#16a34a" />
                        <KpiCard icon="⏱️" label="Hs programadas 6m"  value={metricas6m.totProg.toLocaleString()}     sub="últimos 6 meses"                          color="#7c3aed" />
                        <KpiCard icon="❌" label="Hs no cubiertas 6m" value={metricas6m.totNoCub.toLocaleString()}    sub="ausencias no reemplazadas"                color="#dc2626" />
                        <KpiCard icon="🎓" label="Capacitaciones"     value={capacitaciones.length}                   sub={`${new Set(capacitaciones.map(c=>c.categoria)).size} categorías`} color="#0891b2" />
                        <KpiCard icon="📍" label="Objetivos"          value={objetivos.length}                        sub={`${metricas6m.cliKeys.length} clientes`}  color="#f59e0b" />
                    </div>

                    {/* Horas programadas vs cubiertas */}
                    <div className="dg-charts-row dg-charts-row--3">
                        <ChartCard titulo="📊 Horas programadas vs cubiertas">
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={metricas6m.porMes} margin={{ top: 28, right: 10, left: -10, bottom: 0 }}>
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

                        <ChartCard titulo="🚫 Horas no cubiertas por mes">
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={metricas6m.porMes} margin={{ top: 28, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip content={<CustomTooltip suffix="hs" />} />
                                    <Bar dataKey="nocub" name="No cubiertas" fill={COLOR_AUS} radius={[4,4,0,0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>

                        <ChartCard titulo="📉 Ausentismo % por mes">
                            <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={metricas6m.porMes} margin={{ top: 28, right: 20, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, "auto"]} />
                                    <Tooltip formatter={v => [`${v}%`, "Ausentismo"]} />
                                    <Line type="monotone" dataKey="ausPct" name="Ausentismo" stroke={COLOR_AUS} strokeWidth={2.5} dot={{ r: 4, fill: COLOR_AUS }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartCard>
                    </div>

                    {/* Evolución hs a cubrir por cliente (6 meses) */}
                    {metricas6m.cliKeys.length > 0 && (
                        <ChartCard titulo="🏢 Evolución hs a cubrir por cliente (6 meses)">
                            <ResponsiveContainer width="100%" height={280}>
                                <ComposedChart data={metricas6m.porMesCliente} margin={{ top: 28, right: 20, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip />
                                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                                    {metricas6m.cliKeys.map((cli, i) => (
                                        <Bar key={cli} dataKey={cli} name={cli} fill={COLORS[i % COLORS.length]} radius={[4,4,0,0]} stackId="a" />
                                    ))}
                                </ComposedChart>
                            </ResponsiveContainer>
                        </ChartCard>
                    )}

                    {/* Horas no cubiertas y adicionales por objetivo */}
                    <div className="dg-charts-row dg-charts-row--3">
                        <ChartCard titulo="⚠️ Hs no cubiertas por objetivo">
                            {metricas6m.nocubObjData.length === 0 ? <div className="dg-empty">Sin datos</div> : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={metricas6m.nocubObjData} layout="vertical" margin={{ top: 16, right: 30, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={165} tickFormatter={v => v.length > 22 ? v.slice(0,22)+"…" : v} />
                                        <Tooltip content={<CustomTooltip suffix="hs" />} />
                                        <Bar dataKey="value" name="No cubiertas" fill={COLOR_AUS} radius={[0,4,4,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCard>
                        <ChartCard titulo="➕ Hs adicionales por objetivo">
                            {metricas6m.adicObjData.length === 0 ? <div className="dg-empty">Sin adicionales</div> : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={metricas6m.adicObjData} layout="vertical" margin={{ top: 16, right: 30, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={165} tickFormatter={v => v.length > 22 ? v.slice(0,22)+"…" : v} />
                                        <Tooltip content={<CustomTooltip suffix="hs" />} />
                                        <Bar dataKey="value" name="Adicionales" fill="#f59e0b" radius={[0,4,4,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCard>
                        <ChartCard titulo="🎯 % Cobertura por cliente (6m)">
                            {metricas6m.cobClienteData.length === 0 ? <div className="dg-empty">Sin datos</div> : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={metricas6m.cobClienteData} layout="vertical" margin={{ top: 6, right: 50, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={165} tickFormatter={v => v.length > 22 ? v.slice(0,22)+"…" : v} />
                                        <Tooltip formatter={(v, n, props) => [`${v}% (${props.payload.trab?.toLocaleString?.()} / ${props.payload.prog?.toLocaleString?.()} hs)`, "Cobertura"]} />
                                        <Bar dataKey="value" name="Cobertura" radius={[0,4,4,0]}>
                                            {metricas6m.cobClienteData.map((r, i) => <Cell key={i} fill={r.value >= 95 ? COLOR_TRAB : r.value >= 80 ? "#f59e0b" : COLOR_AUS} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCard>
                    </div>

                    {/* Personal por régimen + Capacitaciones */}
                    <div className="dg-charts-row">
                        <ChartCard titulo="👷 Personal por régimen">
                            {metricas6m.regimenData.length === 0 ? <div className="dg-empty">Sin datos</div> : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={metricas6m.regimenData} layout="vertical" margin={{ top: 16, right: 30, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                                        <YAxis type="category" dataKey="name" width={140} tick={<YTickLeft axisWidth={140} maxChars={20} />} />
                                        <Tooltip content={<CustomTooltip suffix=" pers." />} />
                                        <Bar dataKey="value" name="Personal" radius={[0,4,4,0]}>
                                            {metricas6m.regimenData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCard>
                        <ChartCard titulo="🎓 Capacitaciones por categoría">
                            {metricas6m.capData.length === 0 ? <div className="dg-empty">Sin capacitaciones</div> : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={metricas6m.capData} layout="vertical" margin={{ top: 16, right: 30, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={165} tickFormatter={v => v.length > 22 ? v.slice(0,22)+"…" : v} />
                                        <Tooltip content={<CustomTooltip suffix="" />} />
                                        <Bar dataKey="value" name="Cantidad" fill="#0891b2" radius={[0,4,4,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCard>
                    </div>

                    {/* Hs cubiertas vs facturadas + capacitación */}
                    <ChartCard titulo="🔵 Hs cubiertas vs facturadas + capacitación">
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={metricas6m.porMes} margin={{ top: 28, right: 10, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip formatter={(v, name) => [`${v} hs`, name]} />
                                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                                <Bar dataKey="trab" name="Hs cubiertas" fill={COLOR_TRAB} radius={[4,4,0,0]} />
                                <Bar dataKey="prog"     name="Hs facturadas"    fill={COLOR_PROG}  stackId="fc" radius={[0,0,0,0]} />
                                <Bar dataKey="capHoras" name="Hs capacitación"  fill="#0891b2"     stackId="fc" radius={[4,4,0,0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>

                    {/* Horas adicionales por mes */}
                    <div className="dg-charts-row">
                        <ChartCard titulo="📅 Horas adicionales por mes">
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={metricas6m.porMes} margin={{ top: 28, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip content={<CustomTooltip suffix="hs" />} />
                                    <Bar dataKey="adicionales" name="Hs adicionales" fill="#f59e0b" radius={[4,4,0,0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>

                        <ChartCard titulo="📋 Horas cubiertas vs facturadas con eficiencia">
                            <ResponsiveContainer width="100%" height={220}>
                                <ComposedChart data={metricas6m.porMes} margin={{ top: 28, right: 20, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                    <YAxis yAxisId="hs" tick={{ fontSize: 10 }} />
                                    <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                                    <Tooltip formatter={(v, name) => name === "Eficiencia" ? [`${v}%`, name] : [`${v} hs`, name]} />
                                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                                    <Bar yAxisId="hs" dataKey="prog" name="Facturadas" fill={COLOR_PROG} radius={[4,4,0,0]} />
                                    <Bar yAxisId="hs" dataKey="trab" name="Cubiertas"  fill={COLOR_TRAB} radius={[4,4,0,0]} />
                                    <Line yAxisId="pct" type="monotone" dataKey={d => d.prog > 0 ? Math.round(d.trab / d.prog * 100) : 0} name="Eficiencia" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </ChartCard>
                    </div>
            </>

        </div>
    );
}
