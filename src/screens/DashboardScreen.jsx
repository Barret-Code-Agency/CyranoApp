// src/screens/DashboardScreen.jsx — Dashboard unificado admin
import { useState, useMemo } from "react";
import { useAppData } from "../context/AppDataContext";
import "../styles/DashboardScreen.css";

// ══════════════════════════════════════════════════════════════
// HELPERS GENERALES
// ══════════════════════════════════════════════════════════════
const toMin = (t) => { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
const diffMin = (a, b) => { if (!a || !b) return 0; let d = toMin(b) - toMin(a); if (d < 0) d += 1440; return Math.max(d, 0); };
const fmtMin = (m) => { if (!m || m <= 0) return "0m"; const h = Math.floor(m / 60), r = m % 60; return h > 0 ? (r > 0 ? `${h}h ${r}m` : `${h}h`) : `${r}m`; };
const parseKm = (j) => { const k = Number(j.kmFinal || 0) - Number(j.kmInicial || 0); return k > 0 ? k : 0; };

const semanaISO = (iso) => {
    const d = new Date(iso || Date.now());
    const day = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - day);
    const y = new Date(d.getFullYear(), 0, 1);
    return d.getFullYear() + "-W" + String(Math.ceil(((d - y) / 86400000 + 1) / 7)).padStart(2, "0");
};
const semanasRecientes = (n) => {
    const r = [], d = new Date();
    for (let i = n - 1; i >= 0; i--) {
        const dd = new Date(d); dd.setDate(d.getDate() - i * 7);
        r.push(semanaISO(dd.toISOString()));
    }
    return r;
};

// Calcula tiempos de actividades + traslados (gaps) de un array de jornadas
const calcTiempos = (jorns) => {
    let ctrl = 0, cap = 0, otra = 0, traslado = 0;
    jorns.forEach(j => {
        const acts = [...(j.actividades || [])]
            .filter(a => a.horaInicio && a.horaFin)
            .sort((a, b) => toMin(a.horaInicio) - toMin(b.horaInicio));
        acts.forEach(a => {
            const d = diffMin(a.horaInicio, a.horaFin);
            if (a.tipo === "ctrl") ctrl += d;
            if (a.tipo === "cap")  cap  += d;
            if (a.tipo === "otra") otra += d;
        });
        for (let i = 1; i < acts.length; i++) {
            const g = diffMin(acts[i - 1].horaFin, acts[i].horaInicio);
            if (g > 0 && g < 180) traslado += g;
        }
    });
    return { ctrl, cap, otra, traslado, total: ctrl + cap + otra + traslado };
};

const TIPO_COLOR = { ctrl: "#003087", cap: "#e20113", otra: "#f59e0b", traslado: "#10b981" };
const TIPO_LABEL = { ctrl: "Control", cap: "Capacitación", otra: "Otras", traslado: "Traslados" };
const pct = (v, t) => t > 0 ? Math.round(v / t * 100) : 0;

// ══════════════════════════════════════════════════════════════
// COMPONENTES DE GRÁFICOS
// ══════════════════════════════════════════════════════════════

function BarChart({ data, color, height }) {
    color = color || "var(--color-primary)"; height = height || 120;
    const max = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="bar-chart" style={{ height }}>
            {data.map((d, i) => (
                <div key={i} className="bar-col">
                    <div className="bar-val">{d.value > 0 ? d.value : ""}</div>
                    <div className="bar" style={{ height: (d.value / max * 100) + "%", background: color }} />
                    <div className="bar-lbl">{d.label}</div>
                </div>
            ))}
        </div>
    );
}

function DonutChart({ segments }) {
    const total = segments.reduce((s, g) => s + g.value, 0) || 1;
    let offset = 0;
    const r = 42, cx = 60, cy = 60, circ = 2 * Math.PI * r;
    return (
        <div className="donut-wrap">
            <svg width="130" height="130" viewBox="0 0 120 120">
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-surface3)" strokeWidth="16" />
                {segments.map((seg, i) => {
                    const pct = seg.value / total, dash = pct * circ;
                    const rot = (offset / total) * 360 - 90;
                    offset += seg.value;
                    return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="16"
                        strokeDasharray={dash + " " + (circ - dash)} strokeDashoffset={0}
                        transform={"rotate(" + rot + " " + cx + " " + cy + ")"} />;
                })}
                <text x={cx} y={cy + 6} textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--color-text)">{total}</text>
            </svg>
            <div className="donut-legend">
                {segments.map((seg, i) => (
                    <div key={i} className="donut-item">
                        <span className="donut-dot" style={{ background: seg.color }} />
                        <span>{seg.label}</span>
                        <strong>{seg.value}</strong>
                    </div>
                ))}
            </div>
        </div>
    );
}

function GaugeChart({ value, max, label, color }) {
    max = max || 100;
    const p = Math.min(value / max, 1), angle = p * 180;
    const r = 48, cx = 60, cy = 62;
    const toXY = (deg) => { const rad = ((deg - 180) * Math.PI) / 180; return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }; };
    const start = toXY(0), end = toXY(angle), large = angle > 180 ? 1 : 0;
    const arcBg = "M " + (cx - r) + " " + cy + " A " + r + " " + r + " 0 0 1 " + (cx + r) + " " + cy;
    const arcFg = angle > 0 ? "M " + start.x + " " + start.y + " A " + r + " " + r + " 0 " + large + " 1 " + end.x + " " + end.y : "";
    const clr = color || (p >= 0.8 ? "var(--color-success)" : p >= 0.5 ? "#f59e0b" : "var(--color-danger)");
    return (
        <div className="gauge-wrap">
            <svg width="120" height="72" viewBox="0 0 120 72">
                <path d={arcBg} fill="none" stroke="var(--color-surface3)" strokeWidth="14" strokeLinecap="round" />
                {arcFg && <path d={arcFg} fill="none" stroke={clr} strokeWidth="14" strokeLinecap="round" />}
                <text x={cx} y={cy + 4} textAnchor="middle" fontSize="15" fontWeight="800" fill={clr}>{Math.round(p * 100)}%</text>
            </svg>
            {label && <div className="gauge-label">{label}</div>}
        </div>
    );
}

function LineChart({ data, color, height }) {
    color = color || "var(--color-primary)"; height = height || 90;
    if (data.length < 2) return <div className="chart-empty">Sin datos suficientes</div>;
    const max = Math.max(...data.map(d => d.value), 1), w = 300, padX = 12, availW = w - padX * 2;
    const pts = data.map((d, i) => {
        const x = padX + (i / (data.length - 1)) * availW;
        const y = height - 10 - ((d.value / max) * (height - 20));
        return x + "," + y;
    });
    const path = "M " + pts.join(" L ");
    const area = path + " L " + (w - padX) + "," + height + " L " + padX + "," + height + " Z";
    return (
        <div className="chart-wrap">
            <svg width="100%" viewBox={"0 0 " + w + " " + height} preserveAspectRatio="none">
                <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.15" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.01" />
                </linearGradient></defs>
                <path d={area} fill="url(#lg)" />
                <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {data.map((d, i) => { const [x, y] = pts[i].split(",").map(Number); return <circle key={i} cx={x} cy={y} r="3.5" fill={color} />; })}
            </svg>
            <div className="line-labels">{data.map((d, i) => <div key={i} className="line-lbl">{d.label}</div>)}</div>
        </div>
    );
}

// Barra de distribución de tiempos
function BarraTiempos({ ctrl, cap, otra, traslado, showLabels }) {
    const total = ctrl + cap + otra + traslado || 1;
    const segs = [
        { key: "ctrl", val: ctrl, color: TIPO_COLOR.ctrl },
        { key: "cap",  val: cap,  color: TIPO_COLOR.cap  },
        { key: "otra", val: otra, color: TIPO_COLOR.otra },
        { key: "traslado", val: traslado, color: TIPO_COLOR.traslado },
    ].filter(s => s.val > 0);
    return (
        <div>
            <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 1, background: "#e8eaf2" }}>
                {segs.map(s => (
                    <div key={s.key} style={{ width: `${pct(s.val, total)}%`, background: s.color, borderRadius: 2 }}
                        title={`${TIPO_LABEL[s.key]}: ${fmtMin(s.val)} (${pct(s.val, total)}%)`} />
                ))}
            </div>
            {showLabels && (
                <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                    {segs.map(s => (
                        <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                            <span style={{ color: "#4a5568", fontWeight: 600 }}>{TIPO_LABEL[s.key]}</span>
                            <span style={{ color: s.color, fontWeight: 800 }}>{pct(s.val, total)}%</span>
                            <span style={{ color: "#8894ac" }}>{fmtMin(s.val)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}


// Gráfico Plan vs Realizado — día a día del mes actual
function PlanVsRealChart({ jornadas, plan }) {
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = hoy.getMonth();
    const diasEnMes = new Date(año, mes + 1, 0).getDate();

    // Visitas requeridas totales por semana → distribuidas uniformemente por día hábil
    const reqSemana = plan.reduce((s, p) => s + (p.visitasPorSemana || 1), 0);
    const reqDia = reqSemana / 7; // promedio diario

    // Controles del mes actual agrupados por día
    const ctrlPorDia = {};
    jornadas.forEach(j => {
        const d = new Date(j.creadaEn || j.cerradaEn || 0);
        if (d.getFullYear() === año && d.getMonth() === mes) {
            (j.actividades || []).filter(a => a.tipo === "ctrl").forEach(() => {
                const dia = d.getDate();
                ctrlPorDia[dia] = (ctrlPorDia[dia] || 0) + 1;
            });
        }
    });

    // Acumulados día a día hasta hoy
    const dias = [];
    let acumReal = 0, acumPlan = 0;
    for (let d = 1; d <= diasEnMes; d++) {
        acumPlan += reqDia;
        if (d <= hoy.getDate()) acumReal += (ctrlPorDia[d] || 0);
        dias.push({
            dia: d,
            plan: Math.round(acumPlan * 10) / 10,
            real: d <= hoy.getDate() ? acumReal : null,
            esFuturo: d > hoy.getDate(),
        });
    }

    const maxVal = Math.max(...dias.map(d => Math.max(d.plan, d.real || 0)), 1);
    const W = 320, H = 110, padX = 8, padY = 12, availW = W - padX * 2, availH = H - padY * 2;

    const toX = (i) => padX + (i / (diasEnMes - 1)) * availW;
    const toY = (v) => padY + availH - (v / maxVal) * availH;

    // Build SVG paths
    const planPts = dias.map((d, i) => `${toX(i)},${toY(d.plan)}`);
    const realPts = dias.filter(d => d.real !== null).map((d, i) => `${toX(i)},${toY(d.real)}`);

    const planPath = "M " + planPts.join(" L ");
    const realPath = realPts.length > 1 ? "M " + realPts.join(" L ") : null;
    const realArea = realPath
        ? realPath + ` L ${toX(realPts.length - 1)},${padY + availH} L ${toX(0)},${padY + availH} Z`
        : null;

    const hoyIdx = hoy.getDate() - 1;
    const hoyX = toX(hoyIdx);
    const realHoy = acumReal;
    const planHoy = Math.round(reqDia * hoy.getDate() * 10) / 10;
    const pctHoy = planHoy > 0 ? Math.min(Math.round(realHoy / planHoy * 100), 999) : 0;
    const color = pctHoy >= 80 ? "#10b981" : pctHoy >= 50 ? "#f59e0b" : "#e20113";

    // X-axis labels: only show every 5 days
    const xLabels = dias.filter(d => d.dia === 1 || d.dia % 5 === 0 || d.dia === diasEnMes);

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 16, fontSize: 11 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 20, height: 2, background: "#003087", display: "inline-block", borderRadius: 2 }} />
                        Plan acumulado
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 20, height: 3, background: color, display: "inline-block", borderRadius: 2 }} />
                        Realizado
                    </span>
                </div>
                <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "var(--font-display,'Bebas Neue',sans-serif)" }}>{pctHoy}%</span>
                    <div style={{ fontSize: 10, color: "#8894ac" }}>{realHoy} / {planHoy} al día de hoy</div>
                </div>
            </div>
            <div className="chart-wrap">
                <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="realGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
                        </linearGradient>
                    </defs>
                    {/* Grilla horizontal */}
                    {[0.25, 0.5, 0.75, 1].map(p => (
                        <line key={p} x1={padX} y1={toY(maxVal * p)} x2={W - padX} y2={toY(maxVal * p)}
                            stroke="#e8eaf2" strokeWidth="0.8" />
                    ))}
                    {/* Línea vertical "hoy" */}
                    <line x1={hoyX} y1={padY} x2={hoyX} y2={padY + availH}
                        stroke="#8894ac" strokeWidth="1" strokeDasharray="3 2" />
                    <text x={hoyX + 3} y={padY + 8} fontSize="7" fill="#8894ac">hoy</text>
                    {/* Área realizado */}
                    {realArea && <path d={realArea} fill="url(#realGrad)" />}
                    {/* Línea plan */}
                    <path d={planPath} fill="none" stroke="#003087" strokeWidth="1.5"
                        strokeDasharray="5 3" strokeLinecap="round" />
                    {/* Línea realizado */}
                    {realPath && <path d={realPath} fill="none" stroke={color} strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round" />}
                    {/* Punto hoy en realizado */}
                    {realPts.length > 0 && (
                        <circle cx={hoyX} cy={toY(realHoy)} r="4" fill={color} />
                    )}
                </svg>
                <div className="line-labels" style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                    {xLabels.map(d => (
                        <div key={d.dia} className="line-lbl" style={{ fontSize: 9 }}>{d.dia}</div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════════════════════
const TABS = [
    { key: "resumen",      label: "Resumen",        icon: "📊" },
    { key: "supervisores", label: "Supervisores",   icon: "👤" },
    { key: "tiempos",      label: "Tiempos",        icon: "⏱" },
    { key: "puestos",      label: "Puestos",        icon: "🎯" },
    { key: "km",           label: "Km & Vehículos", icon: "🚗" },
    { key: "cumplimiento", label: "Cumplimiento",   icon: "📋" },
];

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export default function DashboardScreen() {
    const { jornadas, plan, data, limpiarSimulados, mantenimiento } = useAppData();
    const [tab,        setTab]        = useState("resumen");
    const [periodo,    setPeriodo]    = useState("mes");
    const [showBorrar, setShowBorrar] = useState(false);

    // ── Filtrado por período ─────────────────────────────────
    const jornadasFiltradas = useMemo(() => {
        const ahora = Date.now();
        return jornadas.filter(j => {
            if (periodo === "todo") return true;
            const diff = (ahora - new Date(j.creadaEn || j.cerradaEn || 0)) / (1000 * 60 * 60 * 24);
            return periodo === "semana" ? diff <= 7 : diff <= 30;
        });
    }, [jornadas, periodo]);

    // ── Actividades ──────────────────────────────────────────
    const todasActs = useMemo(() =>
        jornadasFiltradas.flatMap(j => (j.actividades || []).map(a => ({ ...a, jornada: j }))),
        [jornadasFiltradas]);

    const controles = todasActs.filter(a => a.tipo === "ctrl");
    const caps      = todasActs.filter(a => a.tipo === "cap");
    const otras     = todasActs.filter(a => a.tipo === "otra");
    const ctrlDia   = controles.filter(c => c.turno === "diurno"   && !c.esFinDeSemana);
    const ctrlNoc   = controles.filter(c => c.turno === "nocturno" && !c.esFinDeSemana);
    const ctrlFdS   = controles.filter(c => c.esFinDeSemana);

    const totalKm = jornadasFiltradas.reduce((s, j) => s + parseKm(j), 0);
    const avgCtrl = useMemo(() => {
        const mins = controles.map(c => diffMin(c.horaInicio, c.horaFin)).filter(Boolean);
        return mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : 0;
    }, [controles]);

    // ── Plan / cumplimiento ──────────────────────────────────
    const cumplPlan = useMemo(() => {
        if (!plan.length) return [];
        return plan.map(p => {
            const vv  = controles.filter(c => c.objetivo === p.objetivo);
            const noc = vv.filter(c => c.turno === "nocturno").length;
            const fds = vv.filter(c => c.esFinDeSemana).length;
            const p2  = Math.min(Math.round((vv.length / (p.visitasPorSemana || 1)) * 100), 100);
            return { ...p, visitas: vv.length, nocturnas: noc, fds, pct: p2 };
        });
    }, [plan, controles]);
    const cumplTotal = cumplPlan.length
        ? Math.round(cumplPlan.reduce((s, p) => s + p.pct, 0) / cumplPlan.length) : 0;

    // ── Por supervisor ───────────────────────────────────────
    const porSup = useMemo(() => {
        const map = {};
        jornadasFiltradas.forEach(j => {
            const s = j.supervisor || j.nombre || "Sin nombre";
            if (!map[s]) map[s] = { controles: 0, caps: 0, otras: 0, km: 0, nocturnos: 0, fds: 0, jornadas: [] };
            map[s].jornadas.push(j);
            (j.actividades || []).forEach(a => {
                if (a.tipo === "ctrl") { map[s].controles++; if (a.turno === "nocturno") map[s].nocturnos++; if (a.esFinDeSemana) map[s].fds++; }
                if (a.tipo === "cap")  map[s].caps++;
                if (a.tipo === "otra") map[s].otras++;
            });
            map[s].km += parseKm(j);
        });
        return Object.entries(map).map(([nombre, v]) => ({ nombre, ...v, tiempos: calcTiempos(v.jornadas) }));
    }, [jornadasFiltradas]);

    // ── Tiempos globales ─────────────────────────────────────
    const tiemposGlobal = useMemo(() => calcTiempos(jornadasFiltradas), [jornadasFiltradas]);

    // ── Km por semana ────────────────────────────────────────
    const kmSemanas = useMemo(() => {
        const ss = semanasRecientes(8);
        const mp = Object.fromEntries(ss.map(s => [s, 0]));
        jornadas.forEach(j => { const s = semanaISO(j.creadaEn); const km = parseKm(j); if (mp[s] !== undefined && km > 0) mp[s] += km; });
        return ss.map(s => ({ label: "S" + s.split("-W")[1], value: mp[s] }));
    }, [jornadas]);

    const noData = jornadasFiltradas.length === 0;
    const tieneSimulados = jornadas.some(j => j.jornadaID?.startsWith("J0"));

    return (
        <div className="dash-wrap">

            {/* Banner simulados */}
            {tieneSimulados && (
                <div className="dash-sim-banner">
                    <span>🧪 Mostrando datos simulados de prueba.</span>
                    {!showBorrar
                        ? <button onClick={() => setShowBorrar(true)}>Borrar datos de prueba</button>
                        : <span className="dash-sim-confirm">
                            ¿Confirmar? &nbsp;
                            <button onClick={() => { limpiarSimulados(); setShowBorrar(false); }}>Sí, borrar</button>
                            &nbsp;<button onClick={() => setShowBorrar(false)}>Cancelar</button>
                        </span>
                    }
                </div>
            )}

            {/* Período */}
            <div className="dash-periodo">
                {[["semana", "7 días"], ["mes", "30 días"], ["todo", "Todo"]].map(([k, l]) => (
                    <button key={k} className={"dash-periodo-btn " + (periodo === k ? "active" : "")} onClick={() => setPeriodo(k)}>{l}</button>
                ))}
            </div>

            {/* Tabs */}
            <div className="dash-tabs">
                {TABS.map(t => (
                    <button key={t.key} className={"dash-tab " + (tab === t.key ? "active" : "")} onClick={() => setTab(t.key)}>
                        <span>{t.icon}</span> {t.label}
                    </button>
                ))}
            </div>

            {noData && (
                <div className="dash-empty">
                    <div className="dash-empty-icon">📊</div>
                    <p>Sin datos para el período seleccionado.</p>
                    <small>Seleccioná "Todo" para ver los datos simulados.</small>
                </div>
            )}

            {/* ══ RESUMEN ══ */}
            {tab === "resumen" && !noData && (
                <>
                    <div className="dash-kpis">
                        {[
                            { label: "Jornadas",   value: jornadasFiltradas.length,     icon: "📋" },
                            { label: "Controles",  value: controles.length,              icon: "🎯" },
                            { label: "Km totales", value: totalKm + " km",              icon: "🚗" },
                            { label: "Prom. ctrl", value: fmtMin(avgCtrl),              icon: "⏱" },
                        ].map((k, i) => (
                            <div key={i} className="dash-kpi">
                                <div className="dash-kpi-icon">{k.icon}</div>
                                <div className="dash-kpi-value">{k.value}</div>
                                <div className="dash-kpi-label">{k.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Tiempos globales */}
                    <div className="dash-card">
                        <div className="dash-card-title">Distribución de tiempos — Total</div>
                        <BarraTiempos {...tiemposGlobal} showLabels />
                        <div style={{ textAlign: "right", fontSize: 11, color: "#8894ac", marginTop: 6 }}>
                            Total registrado: <strong>{fmtMin(tiemposGlobal.total)}</strong>
                        </div>
                    </div>

                    <div className="dash-card">
                        <div className="dash-card-title">Controles por turno</div>
                        <div className="dash-turno-grid">
                            <div className="dash-turno-item diurno"><span className="dash-turno-icon">☀️</span><span className="dash-turno-value">{ctrlDia.length}</span><span className="dash-turno-label">Diurnos</span><span className="dash-turno-sub">06:00 – 17:59</span></div>
                            <div className="dash-turno-item nocturno"><span className="dash-turno-icon">🌙</span><span className="dash-turno-value">{ctrlNoc.length}</span><span className="dash-turno-label">Nocturnos</span><span className="dash-turno-sub">18:00 – 05:59</span></div>
                            <div className="dash-turno-item fds"><span className="dash-turno-icon">📅</span><span className="dash-turno-value">{ctrlFdS.length}</span><span className="dash-turno-label">Fin de semana</span><span className="dash-turno-sub">Sáb / Dom</span></div>
                        </div>
                    </div>

                    <div className="dash-card">
                        <div className="dash-card-title">Distribución de actividades</div>
                        <DonutChart segments={[
                            { label: "Controles",      value: controles.length, color: "var(--color-primary)" },
                            { label: "Capacitaciones", value: caps.length,      color: "#0ea5e9" },
                            { label: "Otras",          value: otras.length,     color: "var(--color-red)" },
                        ]} />
                    </div>

                    <div className="dash-card">
                        <div className="dash-card-title">Cumplimiento del plan</div>
                        <div className="dash-gauge-row">
                            <GaugeChart value={cumplTotal} max={100} label={cumplTotal + "% del plan"} />
                            <div className="dash-gauge-detail">
                                {cumplPlan.length === 0
                                    ? <p className="dash-empty-small">Sin plan cargado.</p>
                                    : cumplPlan.slice(0, 6).map((p, i) => (
                                        <div key={i} className="dash-plan-row">
                                            <span className="dash-plan-name" title={p.objetivo}>{(p.objetivo.split("—")[1] || p.objetivo).trim().split(" ").slice(0, 3).join(" ")}</span>
                                            <div className="dash-plan-bar"><div className="dash-plan-fill" style={{ width: p.pct + "%", background: p.pct >= 80 ? "var(--color-success)" : p.pct >= 50 ? "#f59e0b" : "var(--color-danger)" }} /></div>
                                            <span className="dash-plan-pct">{p.pct}%</span>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    </div>

                    <div className="dash-card">
                        <div className="dash-card-title">Km por semana (últimas 8)</div>
                        <LineChart data={kmSemanas} color="var(--color-primary)" />
                    </div>

                    {plan.length > 0 && (
                        <div className="dash-card">
                            <div className="dash-card-title">📈 Plan vs Realizado — {new Date().toLocaleString("es-AR",{month:"long",year:"numeric"})}</div>
                            <PlanVsRealChart jornadas={jornadas} plan={plan} />
                        </div>
                    )}
                </>
            )}

            {/* ══ SUPERVISORES ══ */}
            {tab === "supervisores" && !noData && (
                <>
                    <div className="dash-card">
                        <div className="dash-card-title">Controles por supervisor</div>
                        <BarChart data={porSup.map(s => ({ label: s.nombre.split(" ")[0], value: s.controles }))} color="var(--color-primary)" />
                    </div>
                    <div className="dash-card">
                        <div className="dash-card-title">Detalle por supervisor</div>
                        <div className="dash-table-wrap">
                            <table className="dash-table">
                                <thead><tr><th>Supervisor</th><th>Ctrl</th><th>🌙Noc</th><th>📅FdS</th><th>Cap</th><th>Otras</th><th>Km</th></tr></thead>
                                <tbody>
                                    {porSup.map((s, i) => (
                                        <tr key={i}>
                                            <td style={{ fontWeight: 600, fontSize: "var(--text-xs)" }}>{s.nombre.split(" ").slice(0, 2).join(" ")}</td>
                                            <td><span className="tag blue">{s.controles}</span></td>
                                            <td>{s.nocturnos}</td><td>{s.fds}</td>
                                            <td>{s.caps}</td><td>{s.otras}</td><td>{s.km}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="dash-card">
                        <div className="dash-card-title">Km por supervisor</div>
                        <BarChart data={porSup.map(s => ({ label: s.nombre.split(" ")[0], value: s.km }))} color="var(--color-red)" />
                    </div>
                </>
            )}

            {/* ══ TIEMPOS ══ */}
            {tab === "tiempos" && !noData && (
                <>
                    {/* Global */}
                    <div className="dash-card">
                        <div className="dash-card-title">Distribución total de tiempos</div>
                        <BarraTiempos {...tiemposGlobal} showLabels />
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 16 }}>
                            {[
                                { key: "ctrl",     label: "Control",       icon: "🎯" },
                                { key: "cap",      label: "Capacitación",  icon: "📚" },
                                { key: "otra",     label: "Otras act.",    icon: "🔧" },
                                { key: "traslado", label: "Traslados",     icon: "🚗" },
                            ].map(t => (
                                <div key={t.key} style={{
                                    background: "#f8f9fc", borderRadius: 10, padding: "12px 8px",
                                    textAlign: "center", borderTop: `3px solid ${TIPO_COLOR[t.key]}`
                                }}>
                                    <div style={{ fontSize: 18 }}>{t.icon}</div>
                                    <div style={{ fontWeight: 800, fontSize: 16, color: TIPO_COLOR[t.key], marginTop: 4 }}>
                                        {pct(tiemposGlobal[t.key], tiemposGlobal.total)}%
                                    </div>
                                    <div style={{ fontWeight: 700, fontSize: 12, color: "#0d1b3e" }}>
                                        {fmtMin(tiemposGlobal[t.key])}
                                    </div>
                                    <div style={{ fontSize: 10, color: "#8894ac", marginTop: 2 }}>{t.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Por supervisor */}
                    <div className="dash-card">
                        <div className="dash-card-title">Tiempos por supervisor</div>
                        {porSup.map((s, i) => {
                            const t = s.tiempos;
                            return (
                                <div key={i} style={{ marginBottom: 16 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                        <span style={{ fontWeight: 700, fontSize: 13, color: "#0d1b3e" }}>
                                            {s.nombre.split(" ").slice(0, 2).join(" ")}
                                        </span>
                                        <span style={{ fontSize: 11, color: "#8894ac" }}>
                                            {s.jornadas.length} jornadas · {fmtMin(t.total)}
                                        </span>
                                    </div>
                                    <BarraTiempos {...t} />
                                    <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 11, flexWrap: "wrap" }}>
                                        {[["ctrl", "🎯"], ["cap", "📚"], ["otra", "🔧"], ["traslado", "🚗"]].map(([k, ic]) => (
                                            <span key={k} style={{ color: TIPO_COLOR[k], fontWeight: 700 }}>
                                                {ic} {pct(t[k], t.total)}% <span style={{ color: "#8894ac", fontWeight: 400 }}>({fmtMin(t[k])})</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Tabla comparativa */}
                    <div className="dash-card">
                        <div className="dash-card-title">Comparativo de tiempos</div>
                        <div className="dash-table-wrap">
                            <table className="dash-table">
                                <thead><tr>
                                    <th>Supervisor</th>
                                    <th style={{ color: TIPO_COLOR.ctrl }}>🎯 Control</th>
                                    <th style={{ color: TIPO_COLOR.cap  }}>📚 Capac.</th>
                                    <th style={{ color: TIPO_COLOR.otra }}>🔧 Otras</th>
                                    <th style={{ color: TIPO_COLOR.traslado }}>🚗 Traslado</th>
                                    <th>Total</th>
                                </tr></thead>
                                <tbody>
                                    {porSup.map((s, i) => {
                                        const t = s.tiempos;
                                        return (
                                            <tr key={i}>
                                                <td style={{ fontWeight: 600, fontSize: "var(--text-xs)" }}>{s.nombre.split(" ").slice(0, 2).join(" ")}</td>
                                                <td><span style={{ color: TIPO_COLOR.ctrl, fontWeight: 700 }}>{fmtMin(t.ctrl)}</span> <small style={{ color: "#8894ac" }}>({pct(t.ctrl, t.total)}%)</small></td>
                                                <td><span style={{ color: TIPO_COLOR.cap,  fontWeight: 700 }}>{fmtMin(t.cap)}</span>  <small style={{ color: "#8894ac" }}>({pct(t.cap,  t.total)}%)</small></td>
                                                <td><span style={{ color: TIPO_COLOR.otra, fontWeight: 700 }}>{fmtMin(t.otra)}</span> <small style={{ color: "#8894ac" }}>({pct(t.otra, t.total)}%)</small></td>
                                                <td><span style={{ color: TIPO_COLOR.traslado, fontWeight: 700 }}>{fmtMin(t.traslado)}</span> <small style={{ color: "#8894ac" }}>({pct(t.traslado, t.total)}%)</small></td>
                                                <td><strong>{fmtMin(t.total)}</strong></td>
                                            </tr>
                                        );
                                    })}
                                    {/* Fila totales */}
                                    <tr style={{ background: "#f0f2f7", fontWeight: 700 }}>
                                        <td>TOTAL</td>
                                        <td style={{ color: TIPO_COLOR.ctrl }}>{fmtMin(tiemposGlobal.ctrl)}</td>
                                        <td style={{ color: TIPO_COLOR.cap  }}>{fmtMin(tiemposGlobal.cap)}</td>
                                        <td style={{ color: TIPO_COLOR.otra }}>{fmtMin(tiemposGlobal.otra)}</td>
                                        <td style={{ color: TIPO_COLOR.traslado }}>{fmtMin(tiemposGlobal.traslado)}</td>
                                        <td>{fmtMin(tiemposGlobal.total)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* ══ PUESTOS ══ */}
            {tab === "puestos" && !noData && (
                <>
                    <div className="dash-card">
                        <div className="dash-card-title">Visitas por puesto</div>
                        {(() => {
                            const map = {};
                            controles.forEach(c => { const k = c.objetivo || "Sin objetivo"; map[k] = (map[k] || 0) + 1; });
                            return <BarChart data={Object.entries(map).map(([k, v]) => ({ label: (k.split("—")[1] || k).trim().split(" ").slice(0, 2).join(" "), value: v }))} color="#0ea5e9" />;
                        })()}
                    </div>
                    <div className="dash-card">
                        <div className="dash-card-title">Detalle por puesto</div>
                        <div className="dash-table-wrap">
                            <table className="dash-table">
                                <thead><tr><th>Puesto</th><th>Total</th><th>☀️Día</th><th>🌙Noc</th><th>📅FdS</th><th>Plan</th><th>Cumpl.</th></tr></thead>
                                <tbody>
                                    {data.objetivos.map((obj, i) => {
                                        const vv  = controles.filter(c => c.objetivo === obj);
                                        const noc = vv.filter(c => c.turno === "nocturno").length;
                                        const fds = vv.filter(c => c.esFinDeSemana).length;
                                        const dia = vv.length - noc;
                                        const pe  = plan.find(p => p.objetivo === obj);
                                        const p2  = pe ? Math.min(Math.round((vv.length / pe.visitasPorSemana) * 100), 100) : null;
                                        return (
                                            <tr key={i}>
                                                <td style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "var(--text-xs)" }}>{obj}</td>
                                                <td><strong>{vv.length}</strong></td>
                                                <td>{dia}</td><td>{noc}</td><td>{fds}</td>
                                                <td>{pe?.visitasPorSemana || "—"}</td>
                                                <td>{p2 !== null ? <span className="tag" style={{ background: p2 >= 80 ? "var(--color-success-ghost)" : p2 >= 50 ? "#fef3c7" : "var(--color-danger-ghost)", color: p2 >= 80 ? "var(--color-success)" : p2 >= 50 ? "#92400e" : "var(--color-danger)" }}>{p2}%</span> : "—"}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* ══ KM & VEHÍCULOS ══ */}
            {tab === "km" && !noData && (
                <>
                    <div className="dash-card">
                        <div className="dash-card-title">Km por semana (últimas 8)</div>
                        <LineChart data={kmSemanas} color="var(--color-primary)" />
                    </div>
                    <div className="dash-card">
                        <div className="dash-card-title">Km por vehículo</div>
                        {(() => {
                            const map = {};
                            jornadasFiltradas.forEach(j => { const v = j.vehiculo || "Sin vehículo"; const km = parseKm(j); if (km > 0) map[v] = (map[v] || 0) + km; });
                            return <BarChart data={Object.entries(map).map(([l, v]) => ({ label: l.split("—")[0].trim(), value: v }))} color="var(--color-red)" />;
                        })()}
                    </div>
                    <div className="dash-card">
                        <div className="dash-card-title">Km por supervisor</div>
                        <BarChart data={porSup.map(s => ({ label: s.nombre.split(" ")[0], value: s.km }))} color="#10b981" />
                    </div>

                    {/* Mantenimiento */}
                    {mantenimiento && mantenimiento.length > 0 && (
                        <div className="dash-card">
                            <div className="dash-card-title">Estado de mantenimiento</div>
                            <div className="dash-table-wrap">
                                <table className="dash-table">
                                    <thead><tr><th>Vehículo</th><th>Tipo</th><th>Último service</th><th>Próximo</th><th>Estado</th></tr></thead>
                                    <tbody>
                                        {mantenimiento.map((m, i) => {
                                            const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
                                            const prox = m.proximoService?.fecha ? new Date(m.proximoService.fecha) : null;
                                            const dias = prox ? Math.round((prox - hoy) / 86400000) : null;
                                            const est = dias === null ? null : dias < 0 ? "vencido" : dias <= 7 ? "urgente" : dias <= 30 ? "proximo" : "ok";
                                            return (
                                                <tr key={i}>
                                                    <td style={{ fontWeight: 600, fontSize: "var(--text-xs)" }}>{m.vehiculo}</td>
                                                    <td style={{ fontSize: "var(--text-xs)" }}>{m.tipo}</td>
                                                    <td style={{ fontSize: "var(--text-xs)" }}>{m.ultimoService?.fecha || "—"}</td>
                                                    <td style={{ fontSize: "var(--text-xs)" }}>{m.proximoService?.fecha || "—"}</td>
                                                    <td>{est ? <span className="tag" style={{
                                                        background: est === "ok" ? "var(--color-success-ghost)" : est === "vencido" ? "var(--color-danger-ghost)" : "#fef3c7",
                                                        color: est === "ok" ? "var(--color-success)" : est === "vencido" ? "var(--color-danger)" : "#92400e"
                                                    }}>{est === "ok" ? "✓ OK" : est === "vencido" ? `Vencido ${Math.abs(dias)}d` : est === "urgente" ? `${dias}d` : `${dias}d`}</span> : "—"}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="dash-card">
                        <div className="dash-card-title">Historial de jornadas</div>
                        <div className="dash-table-wrap">
                            <table className="dash-table">
                                <thead><tr><th>Fecha</th><th>Supervisor</th><th>Vehículo</th><th>Km ini</th><th>Km fin</th><th>Rec.</th></tr></thead>
                                <tbody>
                                    {jornadasFiltradas.map((j, i) => {
                                        const km = parseKm(j);
                                        return (
                                            <tr key={i}>
                                                <td style={{ fontSize: "var(--text-xs)" }}>{j.fecha}</td>
                                                <td style={{ fontSize: "var(--text-xs)" }}>{(j.nombre || "").split(" ").slice(0, 2).join(" ")}</td>
                                                <td style={{ fontSize: "var(--text-xs)" }}>{(j.vehiculo || "").split("—")[0].trim()}</td>
                                                <td>{j.kmInicial}</td><td>{j.kmFinal || "—"}</td>
                                                <td>{km > 0 ? <span className="tag blue">{km}km</span> : "—"}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* ══ CUMPLIMIENTO ══ */}
            {tab === "cumplimiento" && (
                <>
                    {cumplPlan.length === 0 ? (
                        <div className="dash-empty">
                            <div className="dash-empty-icon">📋</div>
                            <p>No hay un plan de supervisión cargado.</p>
                        </div>
                    ) : (
                        <>
                            <div className="dash-card">
                                <div className="dash-card-title">Cumplimiento general</div>
                                <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-4)" }}>
                                    <GaugeChart value={cumplTotal} max={100} label={cumplTotal + "% del plan cumplido"} />
                                </div>
                                <div className="dash-turno-grid" style={{ marginTop: "var(--space-2)" }}>
                                    <div className="dash-turno-item diurno"><span className="dash-turno-icon">☀️</span><span className="dash-turno-value">{ctrlDia.length}</span><span className="dash-turno-label">Diurnos</span></div>
                                    <div className="dash-turno-item nocturno"><span className="dash-turno-icon">🌙</span><span className="dash-turno-value">{ctrlNoc.length}</span><span className="dash-turno-label">Nocturnos</span></div>
                                    <div className="dash-turno-item fds"><span className="dash-turno-icon">📅</span><span className="dash-turno-value">{ctrlFdS.length}</span><span className="dash-turno-label">Fin de semana</span></div>
                                </div>
                            </div>

                            {/* Cumplimiento por supervisor */}
                            {porSup.length > 0 && (
                                <div className="dash-card">
                                    <div className="dash-card-title">Cumplimiento por supervisor</div>
                                    {porSup.map((s, i) => {
                                        const supControles = controles.filter(c => (c.jornada?.supervisor || c.jornada?.nombre) === s.nombre);
                                        const supCumpl = cumplPlan.map(p => {
                                            const v = supControles.filter(c => c.objetivo === p.objetivo).length;
                                            return { ...p, visitas: v, pct: Math.min(Math.round((v / (p.visitasPorSemana || 1)) * 100), 100) };
                                        });
                                        const supTotal = supCumpl.length ? Math.round(supCumpl.reduce((a, b) => a + b.pct, 0) / supCumpl.length) : 0;
                                        return (
                                            <div key={i} style={{ marginBottom: 16 }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                                    <span style={{ fontWeight: 700, fontSize: 13 }}>{s.nombre.split(" ").slice(0, 2).join(" ")}</span>
                                                    <span style={{ fontWeight: 800, color: supTotal >= 80 ? "var(--color-success)" : supTotal >= 50 ? "#d97706" : "var(--color-danger)", fontSize: 14 }}>{supTotal}%</span>
                                                </div>
                                                <div style={{ height: 8, borderRadius: 4, background: "#e8eaf2", overflow: "hidden" }}>
                                                    <div style={{ height: "100%", width: supTotal + "%", background: supTotal >= 80 ? "var(--color-success)" : supTotal >= 50 ? "#f59e0b" : "var(--color-danger)", borderRadius: 4, transition: "width 0.5s" }} />
                                                </div>
                                                <div style={{ fontSize: 11, color: "#8894ac", marginTop: 3 }}>{s.controles} controles realizados</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="dash-card">
                                <div className="dash-card-title">Detalle por puesto</div>
                                {cumplPlan.map((p, i) => (
                                    <div key={i} className="dash-cumpl-row">
                                        <div className="dash-cumpl-header">
                                            <span className="dash-cumpl-name" title={p.objetivo}>{p.objetivo}</span>
                                            <span className="dash-cumpl-nums">{p.visitas} vis · 🌙{p.nocturnas} · 📅{p.fds}</span>
                                            <span className="dash-cumpl-pct" style={{ color: p.pct >= 80 ? "var(--color-success)" : p.pct >= 50 ? "#92400e" : "var(--color-danger)" }}>{p.pct}%</span>
                                        </div>
                                        {p.restriccion && <div className="dash-cumpl-restriccion">{p.restriccion}</div>}
                                        <div className="dash-plan-bar" style={{ marginTop: 4 }}>
                                            <div className="dash-plan-fill" style={{ width: p.pct + "%", background: p.pct >= 80 ? "var(--color-success)" : p.pct >= 50 ? "#f59e0b" : "var(--color-danger)" }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
