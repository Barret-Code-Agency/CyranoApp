// src/screens/gerencia/DashboardsGestionScreen.jsx
// Dashboard de gestión — dos vistas: Mes en curso (por cliente) + Comparativo 6 meses

import { useEffect, useState, useMemo } from "react";
import { useAppData } from "../../context/AppDataContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, ComposedChart, Cell, LabelList, ReferenceLine,
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
    const [progDocs,        setProgDocs]        = useState([]);
    const [progDocProximo,  setProgDocProximo]  = useState([]);  // período siguiente (para facturación mes calendario)
    const [legajos,         setLegajos]         = useState([]);
    const [capacitaciones,  setCapacitaciones]  = useState([]);
    const [objetivos,       setObjetivos]       = useState([]);
    const [zonaActiva,      setZonaActiva]      = useState(null);
    const [diagramas,       setDiagramas]       = useState([]);
    const [activeTab,       setActiveTab]       = useState("mes");

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

                // Período siguiente: cubre días 24-31 del mes actual (para facturación mes calendario)
                const hoy        = new Date();
                const currMes    = hoy.getMonth() + 1;
                const currAño    = hoy.getFullYear();
                const proxMes    = currMes === 12 ? 1    : currMes + 1;
                const proxAño    = currMes === 12 ? currAño + 1 : currAño;
                setProgDocProximo(
                    allProgSnap.docs
                        .map(d => d.data())
                        .filter(d => d.año === proxAño && d.mes === proxMes)
                );

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

    // Docs del período SIGUIENTE filtrados por zona (días 24-31 del mes actual, para facturación calendario)
    const filteredDocsProximo = useMemo(() => {
        if (!zonaActiva) return progDocProximo;
        return progDocProximo.map(doc => ({
            ...doc,
            personal: (doc.personal ?? []).filter(p => legajosZonaSet.has(p.legajo)),
        })).filter(doc => doc.personal.length > 0);
    }, [progDocProximo, zonaActiva, legajosZonaSet]);

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
        // Prefijo para filtrar claves del mes calendario (YYYY-MM-)
        const calPrefix = `${año}-${String(mes).padStart(2, "0")}-`;

        // Paso 1: acumular datos por legajo (real data + cliente principal)
        const byLeg = {};
        docsDelMes.forEach(doc => {
            const cli = (doc.clienteNombre || doc.cliente || doc.contrato || "").trim() || "Sin cliente";
            (doc.personal || []).forEach(p => {
                const leg = String(p.legajo || "");
                if (!byLeg[leg]) byLeg[leg] = { nombre: p.nombre || leg, cliHoras: {}, realData: {} };
                const r = byLeg[leg];
                // Horas en este cliente: programado primero; si no hay, usar real (para extras sin planilla)
                const progTurnos = Object.keys(p.programado || {}).filter(k => esTurno((p.programado||{})[k]));
                if (progTurnos.length > 0) {
                    progTurnos.forEach(fecha => {
                        r.cliHoras[cli] = (r.cliHoras[cli] || 0) + parseHoras(p.programado[fecha]);
                    });
                } else {
                    Object.keys(p.real || {}).forEach(fecha => {
                        const v = p.real[fecha];
                        if (esTurno(v)) r.cliHoras[cli] = (r.cliHoras[cli] || 0) + parseHoras(v);
                    });
                }
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
            if (!byCli[cli]) byCli[cli] = { prog: 0, trab: 0, adicHoras: 0, factCalend: 0, ausDias: 0, ausHoras: 0, vacDias: 0, vacHoras: 0, ext50Hs: 0, ext50Cant: new Set(), ext100Hs: 0, ext100Cant: new Set() };
        };

        docsDelMes.forEach(doc => {
            const cli = (doc.clienteNombre || doc.cliente || doc.contrato || "").trim() || "Sin cliente";
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
                        else if (esAusentismo(vR))             { c.ausDias++; c.ausHoras += h; }
                        else if (vR?.toLowerCase() === "vac")  { c.vacDias++; c.vacHoras += h; }
                        // !vR → sin dato real: la hora queda como no cubierta (prog - trab)
                    } else {
                        // Sin turno programado: esta persona no estaba en la planilla → sus horas son adicionales.
                        // No se suman a prog (no era obligación cubrirla) ni a trab.
                        if (esTurno(vP))                        c.adicHoras += parseHoras(vP);
                        else if (esAusentismo(vP))             { c.ausDias++; c.ausHoras += 12; }
                        else if (vP?.toLowerCase() === "vac")  { c.vacDias++; c.vacHoras += 12; }
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

        // Paso 2b: Hs Facturadas mes calendario (1 al último día del mes)
        // El período de liquidación M cubre días 1-23 del mes M.
        // El período siguiente (M+1) cubre días 24-31 del mes M.
        // Se suman horas reales de ambos períodos filtrando por prefijo de fecha del mes calendario.
        const acumFactCalend = (docs) => {
            docs.forEach(doc => {
                const cli = (doc.clienteNombre || doc.cliente || doc.contrato || "").trim() || "Sin cliente";
                init(cli);
                (doc.personal || []).forEach(p => {
                    Object.entries(p.real || {}).forEach(([fecha, vR]) => {
                        if (!fecha.startsWith(calPrefix)) return;
                        const h = horasDeValor(normalizarTurno(vR));
                        if (h > 0) byCli[cli].factCalend += h;
                    });
                    Object.entries(p.capacitacion || {}).forEach(([fecha, v]) => {
                        if (!fecha.startsWith(calPrefix)) return;
                        const hc = Number(v) || 0;
                        if (hc > 0) byCli[cli].factCalend += hc;
                    });
                });
            });
        };
        acumFactCalend(docsDelMes);         // días 1-23 del mes M
        acumFactCalend(filteredDocsProximo); // días 24-31 del mes M (período M+1)

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
        let totalProg = 0, totalFact = 0, totalAusDias = 0, totalAusHoras = 0, totalVacDias = 0, totalVacHoras = 0, totalExt50 = 0, totalExt100 = 0;
        const rows = Object.entries(byCli).filter(([name]) => name !== "Sin cliente").map(([name, d]) => {
            const fact = Math.round(d.factCalend); // horas reales del mes calendario (1-último día)
            const ext50Pct  = fact > 0 ? Math.round((d.ext50Hs  / fact) * 100 * 10) / 10 : 0;
            const ext100Pct = fact > 0 ? Math.round((d.ext100Hs / fact) * 100 * 10) / 10 : 0;
            const ausPct    = d.prog > 0 ? Math.round((d.ausHoras / d.prog) * 100 * 10) / 10 : 0;
            totalProg    += d.prog;      totalFact      += fact;
            totalAusDias += d.ausDias;  totalAusHoras  += d.ausHoras;
            totalVacDias += d.vacDias;  totalVacHoras  += d.vacHoras;
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

        return { rows, totalProg, totalFact, totalAusDias, totalAusHoras, totalVacDias, totalVacHoras, totalExt50, totalExt100 };
    }, [filteredDocs, filteredDocsProximo, mesActual, excluidos, regimenMap, grupoMap, francosMap]);

    // ── Métricas 6 meses (para tab comparativo) ───────────────────────────────
    const metricas6m = useMemo(() => {
        // legajo → cargo para análisis de puestos
        const legajoCargo = {};
        legajos.forEach(l => { if (l.legajo) legajoCargo[String(l.legajo)] = l.cargo || l.tarea || "Sin puesto"; });

        const porMes = [];
        const cliKeys = new Set();
        const puestoKeys = new Set();
        const cliMes = {};   // { label: { cli: { prog,trab,fact,nocub,ausDias,ausHs,vacDias,ext50,ext100,adicionales,personal:Set } } }
        const puestoMes = {}; // { label: { puesto: Set<legajo> } }

        meses.forEach(({ año, mes, label }) => {
            const docs = filteredDocs.filter(d => d._mes?.año === año && d._mes?.mes === mes);
            const dias = getDias(año, mes);

            let prog = 0, trab = 0, adicionales = 0, ausDias = 0, ausHsAcum = 0, vacDias = 0;
            const byLegReal = {}; // legajo → { realData, cli }
            const cliData = {};
            const personalTotalSet = new Set(); // legajos únicos del mes (para % ausentismo por días)
            if (!puestoMes[label]) puestoMes[label] = {};

            docs.forEach(doc => {
                const cli = (doc.clienteNombre || doc.cliente || doc.contrato || "").trim() || "Sin cliente";
                if (cli === "Sin cliente") return; // no atribuible → ignorar
                cliKeys.add(cli);
                if (!cliData[cli]) cliData[cli] = { prog: 0, trab: 0, adicionales: 0, ausDias: 0, ausHs: 0, vacDias: 0, ext50: 0, ext100: 0, personal: new Set() };

                (doc.personal ?? []).forEach(p => {
                    const leg = String(p.legajo || "");
                    const puesto = (leg && legajoCargo[leg]) || "Sin puesto";
                    puestoKeys.add(puesto);

                    if (leg) {
                        cliData[cli].personal.add(leg);
                        personalTotalSet.add(leg);
                        if (!puestoMes[label][puesto]) puestoMes[label][puesto] = new Set();
                        puestoMes[label][puesto].add(leg);
                    }

                    // realData + capacitación para calcExtras
                    if (leg) {
                        if (!byLegReal[leg]) byLegReal[leg] = { realData: {}, cli };
                        Object.entries(p.real || {}).forEach(([k, v]) => { byLegReal[leg].realData[k] = v; });
                        Object.entries(p.capacitacion || {}).forEach(([k, v]) => {
                            const hc = Number(v) || 0;
                            if (hc > 0) byLegReal[leg].realData[k] = typeof byLegReal[leg].realData[k] === "number" ? byLegReal[leg].realData[k] + hc : hc;
                        });
                    }

                    const rawProg = p.programado || {};
                    const hasProg = Object.keys(rawProg).some(k => esTurno(rawProg[k]));
                    const progSrc = hasProg ? rawProg : (p.real || {});

                    Object.keys(progSrc).forEach(fecha => {
                        const vP = progSrc[fecha];
                        const vR = hasProg ? (p.real || {})[fecha] : vP;
                        if (!esTurno(vP)) {
                            // Sin programado: detectar ausentismo/vacaciones en real
                            if (!hasProg) {
                                // Ausentismo y vacaciones no suman a horas a cubrir
                                if (esAusentismo(vP))                 { ausDias++; cliData[cli].ausDias++; cliData[cli].ausHs += 12; }
                                else if (vP?.toLowerCase() === "vac") { vacDias++; cliData[cli].vacDias++; }
                            }
                            return;
                        }
                        const h = parseHoras(vP);
                        if (hasProg) {
                            prog += h; cliData[cli].prog += h;
                            if (vR && esTurno(vR))       { const hR = parseHoras(vR); trab += hR; cliData[cli].trab += hR; }
                            else if (esAusentismo(vR))   { ausDias++; ausHsAcum += h; cliData[cli].ausDias++; cliData[cli].ausHs += h; }
                            else if (vR?.toLowerCase() === "vac") { vacDias++; cliData[cli].vacDias++; }
                            // !vR → sin dato real: queda como no cubierto (prog - trab)
                        } else {
                            // Sin turno programado: sus horas reales son adicionales (no inflan prog ni trab)
                            adicionales += h; cliData[cli].adicionales += h;
                        }
                    });

                    if (hasProg) {
                        Object.keys(p.real ?? {}).forEach(fecha => {
                            const vR = p.real[fecha], vP = rawProg[fecha];
                            if (esTurno(vR) && !esTurno(vP)) { const h = parseHoras(vR); adicionales += h; cliData[cli].adicionales += h; }
                            if (!vP) {
                                if (esAusentismo(vR))              { ausDias++; cliData[cli].ausDias++; }
                                else if (vR?.toLowerCase() === "vac") { vacDias++; cliData[cli].vacDias++; }
                            }
                        });
                    }
                });
            });

            // Extras por legajo (incluyendo capacitaciones en realData)
            let ext50 = 0, ext100 = 0;
            Object.entries(byLegReal).forEach(([leg, { realData, cli }]) => {
                const e = calcExtras(leg, realData, dias);
                ext50 += e.ext50; ext100 += e.ext100;
                if (cliData[cli]) { cliData[cli].ext50 += e.ext50; cliData[cli].ext100 += e.ext100; }
            });
            ext50 = Math.round(ext50 * 10) / 10;
            ext100 = Math.round(ext100 * 10) / 10;

            const ausHs = Math.round(ausHsAcum * 10) / 10;
            const fact = trab + adicionales;
            const nocub = Math.max(0, prog - trab);
            const totalExt = Math.round((ext50 + ext100) * 10) / 10;
            const ausPct = prog > 0 ? parseFloat(((ausHs / prog) * 100).toFixed(1)) : 0;
            const pctExt = trab > 0 ? parseFloat(((totalExt / trab) * 100).toFixed(1)) : 0;
            // Índice de ausentismo en días: días perdidos / (personal × días del período)
            const ausPctDias = personalTotalSet.size > 0 && dias.length > 0
                ? parseFloat(((ausDias / (personalTotalSet.size * dias.length)) * 100).toFixed(1))
                : 0;

            porMes.push({ label, prog, trab, fact, nocub, ausDias, ausHs, ausPct, ausPctDias, vacDias, ext50, ext100, totalExt, pctExt, adicionales });

            cliMes[label] = {};
            Object.entries(cliData).forEach(([cli, d]) => {
                const cFact = d.trab + d.adicionales;
                const cNocub = Math.max(0, d.prog - d.trab);
                const cExt50 = Math.round(d.ext50 * 10) / 10;
                const cExt100 = Math.round(d.ext100 * 10) / 10;
                const cTotalExt = Math.round((cExt50 + cExt100) * 10) / 10;
                const cPctExt = d.trab > 0 ? parseFloat(((cTotalExt / d.trab) * 100).toFixed(1)) : 0;
                const cCobPct = d.prog > 0 ? parseFloat(((d.trab / d.prog) * 100).toFixed(1)) : 0;
                const cAusPct = d.prog > 0 ? parseFloat(((d.ausHs / d.prog) * 100).toFixed(1)) : 0;
                cliMes[label][cli] = {
                    prog: d.prog, trab: d.trab, fact: cFact, nocub: cNocub,
                    ausDias: d.ausDias, ausHs: d.ausHs, ausPct: cAusPct,
                    vacDias: d.vacDias, ext50: cExt50, ext100: cExt100,
                    totalExt: cTotalExt, pctExt: cPctExt,
                    adicionales: d.adicionales, cobPct: cCobPct,
                    personal: d.personal.size,
                };
            });
        });

        const cliKeysArr = [...cliKeys];
        const puestoKeysArr = [...puestoKeys];

        const buildCliArray = metric => meses.map(({ label }) => {
            const entry = { label };
            cliKeysArr.forEach(cli => { entry[cli] = cliMes[label]?.[cli]?.[metric] ?? 0; });
            return entry;
        });

        const totProg = porMes.reduce((s, m) => s + m.prog, 0);
        const totTrab = porMes.reduce((s, m) => s + m.trab, 0);
        const totNoCub = porMes.reduce((s, m) => s + m.nocub, 0);
        const pctCub = totProg > 0 ? Math.round((totTrab / totProg) * 100) : 0;

        const porMesPuesto = meses.map(({ label }) => {
            const entry = { label };
            puestoKeysArr.forEach(p => { entry[p] = puestoMes[label]?.[p]?.size ?? 0; });
            return entry;
        });

        return {
            porMes, cliKeys: cliKeysArr, puestoKeys: puestoKeysArr,
            totProg, totTrab, totNoCub, pctCub,
            porMesCliProg:     buildCliArray("prog"),
            porMesCliFact:     buildCliArray("fact"),
            porMesCliNocub:    buildCliArray("nocub"),
            porMesCliAusHs:    buildCliArray("ausHs"),
            porMesCliAusPct:   buildCliArray("ausPct"),
            porMesCliVacDias:  buildCliArray("vacDias"),
            porMesCliExt50:    buildCliArray("ext50"),
            porMesCliExt100:   buildCliArray("ext100"),
            porMesCliTotalExt: buildCliArray("totalExt"),
            porMesCliPctExt:   buildCliArray("pctExt"),
            porMesCliPersonal: buildCliArray("personal"),
            porMesCliAdic:     buildCliArray("adicionales"),
            porMesCliCobPct:   buildCliArray("cobPct"),
            porMesPuesto,
        };
    }, [filteredDocs, meses, legajos, diagramas]);

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

    const { rows, totalProg, totalFact, totalAusDias, totalAusHoras, totalVacDias, totalVacHoras, totalExt50, totalExt100 } = clienteMetricasMes;

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
            {activeTab === "mes" && <>
                    {/* KPI strip */}
                    <div className="dg-kpi-grid">
                        <KpiCard icon="👷" label="Personal activo"    value={legajosEnZona.length}          sub={`${objetivos.length} objetivos`}        color="#2563eb" />
                        <KpiCard icon="✅" label="Hs a cubrir"        value={totalProg.toLocaleString()}     sub="horas programadas del mes"              color="#7c3aed" />
                        <KpiCard icon="💼" label="Hs facturadas"      value={totalFact.toLocaleString()}     sub="cubiertas + adicionales"                color="#16a34a" />
                        <KpiCard icon="🤒" label="Ausentismo"         value={`${totalAusDias} días`}         sub={`${Math.round(totalAusHoras)} hs · ${totalProg > 0 ? Math.round(totalAusHoras / totalProg * 100 * 10) / 10 : 0}% del prog.`} color="#dc2626" />
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
                                            <td className="dg-td-num">{Math.round(totalAusHoras)}</td>
                                            <td className="dg-td-num">
                                                <span className="dg-badge dg-badge--warn">
                                                    {totalProg > 0 ? Math.round(totalAusHoras / totalProg * 100 * 10) / 10 : 0}%
                                                </span>
                                            </td>
                                            <td className="dg-td-num">{totalVacDias}</td>
                                            <td className="dg-td-num">{Math.round(totalVacHoras)}</td>
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
            </>}

            {/* ══════════════════════════════════════
                SECCIÓN 2 — COMPARATIVO 6 MESES
            ══════════════════════════════════════ */}
            {activeTab === "comparativo" && <>
                    {/* KPIs resumen */}
                    <div className="dg-kpi-grid">
                        <KpiCard icon="👷" label="Personal activo"    value={legajosEnZona.length}                 sub={`${metricas6m.puestoKeys.length} puestos`}     color={COLOR_PROG} />
                        <KpiCard icon="✅" label="Cobertura 6m"       value={`${metricas6m.pctCub}%`}             sub="horas cubiertas vs programadas"                color={COLOR_TRAB} />
                        <KpiCard icon="⏱️" label="Hs programadas 6m"  value={metricas6m.totProg.toLocaleString()} sub="últimos 6 meses"                               color={COLORS[4]} />
                        <KpiCard icon="❌" label="Hs no cubiertas 6m" value={metricas6m.totNoCub.toLocaleString()} sub="ausencias no reemplazadas"                   color={COLOR_AUS} />
                        <KpiCard icon="📍" label="Clientes"           value={metricas6m.cliKeys.length}           sub={`${objetivos.length} objetivos`}               color={COLORS[3]} />
                        <KpiCard icon="📊" label="Período"            value={meses.length}                        sub={`${meses[0].label} — ${meses[meses.length-1].label}`} color={COLORS[5]} />
                    </div>

                    {/* ── Sección A: Métricas generales ── */}
                    <div className="dg-section-title">📊 Métricas generales — evolución mensual</div>
                    <div className="dg-charts-row dg-charts-row--3">
                        <ChartCard titulo="⏱️ Horas a cubrir">
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={metricas6m.porMes} margin={{ top: 22, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip content={<CustomTooltip suffix=" hs" />} />
                                    <Bar dataKey="prog" name="Hs a cubrir" fill={COLOR_PROG} radius={[4,4,0,0]}>
                                        <LabelList dataKey="prog" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "var(--color-text)" }} formatter={v => v > 0 ? v : ""} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>

                        <ChartCard titulo="💰 Horas facturadas">
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={metricas6m.porMes} margin={{ top: 22, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip content={<CustomTooltip suffix=" hs" />} />
                                    <Bar dataKey="fact" name="Hs facturadas" fill={COLOR_TRAB} radius={[4,4,0,0]}>
                                        <LabelList dataKey="fact" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "var(--color-text)" }} formatter={v => v > 0 ? v : ""} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>

                        <ChartCard titulo="🚫 Horas no cubiertas">
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={metricas6m.porMes} margin={{ top: 22, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip content={<CustomTooltip suffix=" hs" />} />
                                    <Bar dataKey="nocub" name="No cubiertas" fill={COLOR_AUS} radius={[4,4,0,0]}>
                                        <LabelList dataKey="nocub" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "var(--color-text)" }} formatter={v => v > 0 ? v : ""} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>

                        <ChartCard titulo="📉 Ausentismo (días)">
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={metricas6m.porMes} margin={{ top: 22, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip content={<CustomTooltip suffix=" días" />} />
                                    <Bar dataKey="ausDias" name="Ausentismo" fill={COLOR_AUS} radius={[4,4,0,0]}>
                                        <LabelList dataKey="ausDias" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "var(--color-text)" }} formatter={v => v > 0 ? v : ""} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>

                        <ChartCard titulo="📉 Ausentismo % (días perdidos / días posibles)">
                            {(() => {
                                const vals = metricas6m.porMes.map(m => m.ausPctDias).filter(v => v > 0);
                                const prom = vals.length > 0
                                    ? parseFloat((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1))
                                    : 0;
                                return (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <LineChart data={metricas6m.porMes} margin={{ top: 22, right: 48, left: -10, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, "auto"]} />
                                            <Tooltip formatter={v => [`${v}%`, "% Ausentismo"]} />
                                            {prom > 0 && (
                                                <ReferenceLine y={prom} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 3"
                                                    label={{ value: `Prom ${prom}%`, position: "right", fontSize: 10, fontWeight: 700, fill: "#b45309" }} />
                                            )}
                                            <Line type="monotone" dataKey="ausPctDias" name="% Ausentismo" stroke={COLOR_AUS} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }}
                                                label={{ position: "top", fontSize: 11, fontWeight: 700, fill: COLOR_AUS, formatter: v => v > 0 ? `${v}%` : "" }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                );
                            })()}
                        </ChartCard>

                        <ChartCard titulo="🌴 Vacaciones (días)">
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={metricas6m.porMes} margin={{ top: 22, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip content={<CustomTooltip suffix=" días" />} />
                                    <Bar dataKey="vacDias" name="Vacaciones" fill={COLORS[5]} radius={[4,4,0,0]}>
                                        <LabelList dataKey="vacDias" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "var(--color-text)" }} formatter={v => v > 0 ? v : ""} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>

                        <ChartCard titulo="⚡ Extras 50% (hs)">
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={metricas6m.porMes} margin={{ top: 22, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip content={<CustomTooltip suffix=" hs" />} />
                                    <Bar dataKey="ext50" name="Ext 50%" fill={COLORS[3]} radius={[4,4,0,0]}>
                                        <LabelList dataKey="ext50" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "var(--color-text)" }} formatter={v => v > 0 ? v : ""} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>

                        <ChartCard titulo="🔥 Extras 100% (hs)">
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={metricas6m.porMes} margin={{ top: 22, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip content={<CustomTooltip suffix=" hs" />} />
                                    <Bar dataKey="ext100" name="Ext 100%" fill={COLOR_AUS} radius={[4,4,0,0]}>
                                        <LabelList dataKey="ext100" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "var(--color-text)" }} formatter={v => v > 0 ? v : ""} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>

                        <ChartCard titulo="➕ Total extras (hs)">
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={metricas6m.porMes} margin={{ top: 22, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip content={<CustomTooltip suffix=" hs" />} />
                                    <Bar dataKey="totalExt" name="Total extras" fill={COLORS[4]} radius={[4,4,0,0]}>
                                        <LabelList dataKey="totalExt" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "var(--color-text)" }} formatter={v => v > 0 ? v : ""} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>

                        <ChartCard titulo="📈 % Extras vs hs trabajadas">
                            <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={metricas6m.porMes} margin={{ top: 22, right: 20, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, "auto"]} />
                                    <Tooltip formatter={v => [`${v}%`, "% Extras"]} />
                                    <Line type="monotone" dataKey="pctExt" name="% Extras" stroke={COLORS[4]} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} label={{ position: "top", fontSize: 11, fontWeight: 700, fill: "var(--color-text)" }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartCard>
                    </div>

                    {/* ── Sección B: Por cliente ── */}
                    {metricas6m.cliKeys.length > 0 && (<>
                        <div className="dg-section-title">🏢 Por cliente — evolución mensual</div>

                        <div className="dg-charts-row">
                            <ChartCard titulo="📉 Ausentismo por cliente (hs)">
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={metricas6m.porMesCliAusHs} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <Tooltip content={<CustomTooltip suffix=" hs" />} />
                                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                                        {metricas6m.cliKeys.map((cli, i) => (
                                            <Bar key={cli} dataKey={cli} name={cli} fill={COLORS[i % COLORS.length]} stackId="a" radius={i === metricas6m.cliKeys.length - 1 ? [4,4,0,0] : [0,0,0,0]} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartCard>
                            <ChartCard titulo="📉 Ausentismo por cliente (%)">
                                <ResponsiveContainer width="100%" height={260}>
                                    <LineChart data={metricas6m.porMesCliAusPct} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                                        <Tooltip formatter={v => [`${v}%`]} />
                                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                                        {metricas6m.cliKeys.map((cli, i) => (
                                            <Line key={cli} type="monotone" dataKey={cli} name={cli} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        </div>

                        <div className="dg-charts-row">
                            <ChartCard titulo="⚡ Extras 50% por cliente (hs)">
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={metricas6m.porMesCliExt50} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <Tooltip content={<CustomTooltip suffix=" hs" />} />
                                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                                        {metricas6m.cliKeys.map((cli, i) => (
                                            <Bar key={cli} dataKey={cli} name={cli} fill={COLORS[i % COLORS.length]} stackId="a" radius={i === metricas6m.cliKeys.length - 1 ? [4,4,0,0] : [0,0,0,0]} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartCard>
                            <ChartCard titulo="🔥 Extras 100% por cliente (hs)">
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={metricas6m.porMesCliExt100} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <Tooltip content={<CustomTooltip suffix=" hs" />} />
                                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                                        {metricas6m.cliKeys.map((cli, i) => (
                                            <Bar key={cli} dataKey={cli} name={cli} fill={COLORS[i % COLORS.length]} stackId="a" radius={i === metricas6m.cliKeys.length - 1 ? [4,4,0,0] : [0,0,0,0]} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        </div>

                        <div className="dg-charts-row">
                            <ChartCard titulo="➕ Total extras por cliente (hs)">
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={metricas6m.porMesCliTotalExt} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <Tooltip content={<CustomTooltip suffix=" hs" />} />
                                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                                        {metricas6m.cliKeys.map((cli, i) => (
                                            <Bar key={cli} dataKey={cli} name={cli} fill={COLORS[i % COLORS.length]} stackId="a" radius={i === metricas6m.cliKeys.length - 1 ? [4,4,0,0] : [0,0,0,0]} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartCard>
                            <ChartCard titulo="📈 % Extras por cliente">
                                <ResponsiveContainer width="100%" height={260}>
                                    <LineChart data={metricas6m.porMesCliPctExt} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                                        <Tooltip formatter={v => [`${v}%`]} />
                                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                                        {metricas6m.cliKeys.map((cli, i) => (
                                            <Line key={cli} type="monotone" dataKey={cli} name={cli} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        </div>

                        <div className="dg-charts-row">
                            <ChartCard titulo="👷 Personal por cliente">
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={metricas6m.porMesCliPersonal} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                                        <Tooltip content={<CustomTooltip suffix=" pers." />} />
                                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                                        {metricas6m.cliKeys.map((cli, i) => (
                                            <Bar key={cli} dataKey={cli} name={cli} fill={COLORS[i % COLORS.length]} radius={[4,4,0,0]} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartCard>
                            <ChartCard titulo="🎯 Personal por puesto">
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={metricas6m.porMesPuesto} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                                        <Tooltip content={<CustomTooltip suffix=" pers." />} />
                                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                                        {metricas6m.puestoKeys.map((p, i) => (
                                            <Bar key={p} dataKey={p} name={p} fill={COLORS[i % COLORS.length]} radius={[4,4,0,0]} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        </div>

                        <div className="dg-charts-row">
                            <ChartCard titulo="🚫 Hs no cubiertas por cliente">
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={metricas6m.porMesCliNocub} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <Tooltip content={<CustomTooltip suffix=" hs" />} />
                                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                                        {metricas6m.cliKeys.map((cli, i) => (
                                            <Bar key={cli} dataKey={cli} name={cli} fill={COLORS[i % COLORS.length]} stackId="a" radius={i === metricas6m.cliKeys.length - 1 ? [4,4,0,0] : [0,0,0,0]} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartCard>
                            <ChartCard titulo="💰 Facturación por cliente (hs)">
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={metricas6m.porMesCliFact} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <Tooltip content={<CustomTooltip suffix=" hs" />} />
                                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                                        {metricas6m.cliKeys.map((cli, i) => (
                                            <Bar key={cli} dataKey={cli} name={cli} fill={COLORS[i % COLORS.length]} stackId="a" radius={i === metricas6m.cliKeys.length - 1 ? [4,4,0,0] : [0,0,0,0]} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        </div>

                        <div className="dg-charts-row">
                            <ChartCard titulo="➕ Hs adicionales por cliente">
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={metricas6m.porMesCliAdic} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <Tooltip content={<CustomTooltip suffix=" hs" />} />
                                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                                        {metricas6m.cliKeys.map((cli, i) => (
                                            <Bar key={cli} dataKey={cli} name={cli} fill={COLORS[i % COLORS.length]} stackId="a" radius={i === metricas6m.cliKeys.length - 1 ? [4,4,0,0] : [0,0,0,0]} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartCard>
                            <ChartCard titulo="✅ % Cobertura por cliente">
                                <ResponsiveContainer width="100%" height={260}>
                                    <LineChart data={metricas6m.porMesCliCobPct} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                                        <Tooltip formatter={v => [`${v}%`]} />
                                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                                        {metricas6m.cliKeys.map((cli, i) => (
                                            <Line key={cli} type="monotone" dataKey={cli} name={cli} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        </div>
                    </>)}
            </>}

        </div>
    );
}
