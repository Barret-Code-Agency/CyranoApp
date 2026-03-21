// src/screens/gerencia/DashboardScreen.jsx — Dashboard unificado admin
import { useState, useMemo } from "react";
import { useAppData } from "../../context/AppDataContext";
import BarChart        from "../../components/charts/BarChart";
import DonutChart      from "../../components/charts/DonutChart";
import GaugeChart      from "../../components/charts/GaugeChart";
import LineChart       from "../../components/charts/LineChart";
import BarraTiempos    from "../../components/charts/BarraTiempos";
import PlanVsRealChart from "../../components/charts/PlanVsRealChart";
import "./DashboardScreen.css";
import { TIPO_COLOR } from "../../config/activityTypes";

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
    let ctrl = 0, cap = 0, traslado = 0;
    let admin = 0, taller = 0, vulnerab = 0, reclamos = 0, gremial = 0, almuerzo = 0, otras = 0;
    jorns.forEach(j => {
        const acts = [...(j.actividades || [])]
            .filter(a => a.horaInicio && a.horaFin)
            .sort((a, b) => toMin(a.horaInicio) - toMin(b.horaInicio));
        acts.forEach(a => {
            const d = diffMin(a.horaInicio, a.horaFin);
            const act2 = (a.actividad || "").toLowerCase();
            if (a.tipo === "ctrl") ctrl += d;
            else if (a.tipo === "cap") cap += d;
            else if (a.tipo === "otra") {
                if      (act2.includes("admin"))                               admin    += d;
                else if (act2.includes("traslado"))                            traslado += d;
                else if (act2.includes("reparac") || act2.includes("taller"))  taller   += d;
                else if (act2.includes("vulnerab") || act2.includes("riesgo")) vulnerab += d;
                else if (act2.includes("reclamo"))                             reclamos += d;
                else if (act2.includes("gremial"))                             gremial  += d;
                else if (act2.includes("almuerzo") || act2.includes("cena"))   almuerzo += d;
                else                                                           otras    += d;
            }
        });
        for (let i = 1; i < acts.length; i++) {
            const g = diffMin(acts[i - 1].horaFin, acts[i].horaInicio);
            if (g > 0 && g < 180) traslado += g;
        }
    });
    const total = ctrl + cap + traslado + admin + taller + vulnerab + reclamos + gremial + almuerzo + otras;
    return { ctrl, cap, traslado, admin, taller, vulnerab, reclamos, gremial, almuerzo, otras, total };
};

const pct = (v, t) => t > 0 ? Math.round(v / t * 100) : 0;

// ══════════════════════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════════════════════
const TABS = [
    { key: "resumen", label: "Resumen", icon: "📊" },
    { key: "supervisores", label: "Supervisores", icon: "👤" },
    { key: "tiempos", label: "Tiempos", icon: "⏱" },
    { key: "puestos", label: "Objetivos", icon: "📍" },
    { key: "km", label: "Km & Vehículos", icon: "🚗" },
    { key: "cumplimiento", label: "Cumplimiento", icon: "📋" },
];

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export default function DashboardScreen() {
    const { jornadas, plan, data, mantenimiento, getSupervisoresConEmail, getPlanSupervisor } = useAppData();
    const [tab, setTab] = useState("resumen");
    const [periodo, setPeriodo] = useState("mes");

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
    const caps = todasActs.filter(a => a.tipo === "cap");
    const otras = todasActs.filter(a => a.tipo === "otra");
    const ctrlDia = controles.filter(c => c.turno === "diurno" && !c.esFinDeSemana);
    const ctrlNoc = controles.filter(c => c.turno === "nocturno" && !c.esFinDeSemana);
    const ctrlFdS = controles.filter(c => c.esFinDeSemana);

    const totalKm = jornadasFiltradas.reduce((s, j) => s + parseKm(j), 0);
    const avgCtrl = useMemo(() => {
        const mins = controles.map(c => diffMin(c.horaInicio, c.horaFin)).filter(Boolean);
        return mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : 0;
    }, [controles]);

    // ── Plan / cumplimiento ──────────────────────────────────
    const cumplPlan = useMemo(() => {
        if (!plan.length) return [];
        return plan.map(p => {
            const vv = controles.filter(c => c.objetivo === p.objetivo);
            const noc = vv.filter(c => c.turno === "nocturno").length;
            const fds = vv.filter(c => c.esFinDeSemana).length;
            const p2 = Math.min(Math.round((vv.length / (p.visitasPorSemana || 1)) * 100), 100);
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
                if (a.tipo === "cap") map[s].caps++;
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

    return (
        <div className="dash-wrap">

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

            {noData && tab !== "cumplimiento" && tab !== "tiempos" && tab !== "puestos" && tab !== "km" && (
                <div className="dash-empty">
                    <div className="dash-empty-icon">📊</div>
                    <p>Sin jornadas registradas en este período.</p>
                    <small>Seleccioná "Todo" o esperá a que se registren jornadas.</small>
                </div>
            )}

            {/* ══ RESUMEN ══ */}
            {tab === "resumen" && !noData && (
                <>
                    <div className="dash-kpis">
                        {[
                            { label: "Jornadas", value: jornadasFiltradas.length, icon: "📋" },
                            { label: "Controles", value: controles.length, icon: "🎯" },
                            { label: "Km totales", value: totalKm + " km", icon: "🚗" },
                            { label: "Prom. ctrl", value: fmtMin(avgCtrl), icon: "⏱" },
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
                        <div className="ds-tiempos-total-note">
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
                            { label: "Controles", value: controles.length, color: "var(--color-primary)" },
                            { label: "Capacitaciones", value: caps.length, color: "#0ea5e9" },
                            { label: "Otras", value: otras.length, color: "var(--color-red)" },
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
                                            <div className="dash-plan-bar"><div className={"dash-plan-fill " + (p.pct >= 80 ? "ds-fill--good" : p.pct >= 50 ? "ds-fill--mid" : "ds-fill--bad")} style={{ "--ds-w": p.pct + "%" }} /></div>
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
                            <div className="dash-card-title">📈 Plan vs Realizado — {new Date().toLocaleString("es-AR", { month: "long", year: "numeric" })}</div>
                            <PlanVsRealChart jornadas={jornadas} plan={plan} />
                        </div>
                    )}
                </>
            )}

            {/* ══ SUPERVISORES ══ */}
            {tab === "supervisores" && (() => {
                const mesInicio = new Date(); mesInicio.setDate(1); mesInicio.setHours(0, 0, 0, 0);
                const supervisores = getSupervisoresConEmail();

                const supData = supervisores.map(sup => {
                    const planSup = sup.email ? getPlanSupervisor(sup.email) : null;
                    const semanasDePatron = (patron, custom) => {
                        if (patron === "todas") return [1, 2, 3, 4];
                        if (patron === "impares") return [1, 3];
                        if (patron === "pares") return [2, 4];
                        if (patron === "custom") return custom || [];
                        return [1, 2, 3, 4];
                    };
                    const reqMes = planSup
                        ? (planSup.objetivos || []).reduce((s, o) =>
                            s + semanasDePatron(o.patron, o.semanasCustom).length * (o.visitasPorSemana || 1), 0)
                        : 0;

                    const jornadasSup = jornadasFiltradas.filter(j =>
                        j.email === sup.email || j.supervisor === sup.nombre || j.nombre === sup.nombre
                    );
                    const ctrlSup = jornadasSup.flatMap(j => (j.actividades || []).filter(a => a.tipo === "ctrl"));
                    const realMes = jornadas
                        .filter(j => (j.email === sup.email) && new Date(j.creadaEn || 0) >= mesInicio)
                        .flatMap(j => (j.actividades || []).filter(a => a.tipo === "ctrl")).length;

                    const pctMes = reqMes > 0 ? Math.min(Math.round(realMes / reqMes * 100), 100) : null;
                    const pctColor = pctMes >= 80 ? "var(--color-success)" : pctMes >= 50 ? "#f59e0b" : "var(--color-danger)";

                    // Cumplimiento por objetivo
                    const objCumpl = planSup ? (planSup.objetivos || []).map(o => {
                        const real = ctrlSup.filter(c => c.objetivo === o.objetivo).length;
                        const sems = semanasDePatron(o.patron, o.semanasCustom);
                        const req = sems.length * (o.visitasPorSemana || 1);
                        return { objetivo: o.objetivo, real, req, pct: req > 0 ? Math.min(Math.round(real / req * 100), 100) : 0 };
                    }) : [];

                    const noc = ctrlSup.filter(c => c.turno === "nocturno").length;
                    const fds = ctrlSup.filter(c => c.esFinDeSemana).length;
                    const km = jornadasSup.reduce((s, j) => { const k = Number(j.kmFinal || 0) - Number(j.kmInicial || 0); return s + (k > 0 ? k : 0); }, 0);

                    return { ...sup, planSup, reqMes, realMes, pctMes, pctColor, objCumpl, ctrlTotal: ctrlSup.length, noc, fds, km, jornadas: jornadasSup.length };
                });

                return (
                    <>
                        {/* ── Ranking tarjetas ── */}
                        <div className="dash-card">
                            <div className="dash-card-title">Avance del mes — por supervisor</div>
                            {supData.length === 0 && (
                                <div className="dash-empty-small">Sin supervisores registrados.</div>
                            )}
                            {supData.map((s, i) => (
                                <div key={i} className={"ds-sup-item" + (i < supData.length - 1 ? " ds-sup-item--border" : "")}>
                                    {/* Header supervisor */}
                                    <div className="ds-sup-header">
                                        <div className="ds-sup-avatar">{s.nombre[0]}</div>
                                        <div className="ds-sup-info">
                                            <div className="ds-sup-nombre">
                                                {s.nombre.split(" ").slice(0, 3).join(" ")}
                                            </div>
                                            <div className="ds-sup-sub">
                                                {s.planSup
                                                    ? `${{ "diurno": "☀️ Diurno", "nocturno": "🌙 Nocturno", "mixto": "🔄 Mixto" }[s.planSup.turnoBase || "mixto"]} · ${s.planSup.objetivos?.length || 0} objetivos · ${s.reqMes} visitas req./mes`
                                                    : "Sin plan individual"}
                                            </div>
                                        </div>
                                        {/* % cumplimiento mes */}
                                        {s.pctMes !== null ? (
                                            <div className="ds-sup-pct-wrap">
                                                <div className={"ds-sup-pct-val " + (s.pctMes >= 80 ? "ds-color--good" : s.pctMes >= 50 ? "ds-color--mid" : "ds-color--bad")}>{s.pctMes}%</div>
                                                <div className="ds-sup-pct-sub">{s.realMes}/{s.reqMes} este mes</div>
                                            </div>
                                        ) : (
                                            <div className="ds-sup-no-plan">Sin plan</div>
                                        )}
                                    </div>

                                    {/* Barra global */}
                                    {s.pctMes !== null && (
                                        <div className="ds-sup-bar-wrap">
                                            <div className="sup-prog-bar">
                                                <div className={"sup-prog-fill " + (s.pctMes >= 80 ? "ds-fill--good" : s.pctMes >= 50 ? "ds-fill--mid" : "ds-fill--bad")} style={{ "--ds-w": s.pctMes + "%" }} />
                                            </div>
                                        </div>
                                    )}

                                    {/* Mini stats */}
                                    <div className={"ds-sup-stats" + (s.objCumpl.length > 0 ? " ds-sup-stats--mb" : "")}>
                                        {[
                                            { l: "Controles", v: s.ctrlTotal, c: "var(--color-primary)" },
                                            { l: "🌙 Nocturnos", v: s.noc, c: "#6366f1" },
                                            { l: "📅 Fin sem.", v: s.fds, c: "#ec4899" },
                                            { l: "Jornadas", v: s.jornadas, c: "var(--color-muted)" },
                                            { l: "Km", v: s.km > 0 ? s.km + " km" : "—", c: "#10b981" },
                                        ].map((m, mi) => (
                                            <div key={mi} className="ds-stat-cell" style={{ "--ds-stat-color": m.c }}>
                                                <span className="ds-stat-val">{m.v}</span>
                                                <span className="ds-stat-lbl">{m.l}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Cumplimiento por objetivo */}
                                    {s.objCumpl.length > 0 && (
                                        <div className="ds-obj-list">
                                            {s.objCumpl.map((o, oi) => {
                                                const ocCls = o.pct >= 100 ? "ds-color--good" : o.pct >= 50 ? "ds-color--mid" : "ds-color--bad";
                                                return (
                                                    <div key={oi} className="ds-obj-row">
                                                        <div className="ds-obj-name" title={o.objetivo}>
                                                            {o.objetivo.split("—").pop().trim()}
                                                        </div>
                                                        <div className="ds-obj-track">
                                                            <div className={"ds-obj-fill " + ocCls} style={{ "--ds-w": Math.min(o.pct, 100) + "%" }} />
                                                        </div>
                                                        <div className={"ds-obj-score " + ocCls}>
                                                            {o.real}/{o.req}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* ── Tabla comparativa ── */}
                        <div className="dash-card">
                            <div className="dash-card-title">Comparativo rápido</div>
                            <div className="dash-table-wrap">
                                <table className="dash-table">
                                    <thead>
                                        <tr>
                                            <th>Supervisor</th>
                                            <th>Cumpl. mes</th>
                                            <th>Real/Req</th>
                                            <th>Ctrl</th>
                                            <th>🌙Noc</th>
                                            <th>📅FdS</th>
                                            <th>Km</th>
                                            <th>Jornadas</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {supData.map((s, i) => {
                                            const pc = s.pctMes;
                                            return (
                                                <tr key={i}>
                                                    <td className="ds-td-nombre-xs">{s.nombre.split(" ").slice(0, 2).join(" ")}</td>
                                                    <td>
                                                        {pc !== null
                                                            ? <span className={"tag ds-tag-pct " + (pc >= 80 ? "ds-tag--good" : pc >= 50 ? "ds-tag--mid" : "ds-tag--bad")}>{pc}%</span>
                                                            : <span className="ds-no-plan-sm">Sin plan</span>
                                                        }
                                                    </td>
                                                    <td className="ds-td-muted-xs">
                                                        {pc !== null ? `${s.realMes}/${s.reqMes}` : "—"}
                                                    </td>
                                                    <td><span className="tag blue">{s.ctrlTotal}</span></td>
                                                    <td>{s.noc}</td>
                                                    <td>{s.fds}</td>
                                                    <td>{s.km > 0 ? s.km + " km" : "—"}</td>
                                                    <td>{s.jornadas}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                );
            })()}

            {/* ══ TIEMPOS ══ */}
            {tab === "tiempos" && (
                <>
                    {/* Global */}
                    <div className="dash-card">
                        <div className="dash-card-title">Distribución total de tiempos</div>
                        <BarraTiempos {...tiemposGlobal} showLabels />
                        <div className="ds-tiempo-grid">
                            {[
                                { key: "ctrl",     label: "Control",         icon: "🎯" },
                                { key: "cap",      label: "Capacitación",    icon: "📚" },
                                { key: "traslado", label: "Traslados",       icon: "🚗" },
                                { key: "admin",    label: "Administrativo",  icon: "📋" },
                                { key: "vulnerab", label: "Vuln./Riesgos",   icon: "⚠️" },
                                { key: "reclamos", label: "Reclamos",        icon: "📣" },
                                { key: "almuerzo", label: "Almuerzo/Cena",   icon: "🍽️" },
                                { key: "taller",   label: "Taller/Rep.",     icon: "🔧" },
                                { key: "gremial",  label: "Gremial",         icon: "🤝" },
                                { key: "otras",    label: "Otras",           icon: "📌" },
                            ].filter(t => tiemposGlobal[t.key] > 0).map(t => (
                                <div key={t.key} className="ds-tiempo-card" style={{ "--ds-tipo-color": TIPO_COLOR[t.key] }}>
                                    <div className="ds-tiempo-icon">{t.icon}</div>
                                    <div className="ds-tiempo-pct">
                                        {pct(tiemposGlobal[t.key], tiemposGlobal.total)}%
                                    </div>
                                    <div className="ds-tiempo-val">
                                        {fmtMin(tiemposGlobal[t.key])}
                                    </div>
                                    <div className="ds-tiempo-label">{t.label}</div>
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
                                <div key={i} className="ds-sup-tiempo-row">
                                    <div className="ds-sup-tiempo-header">
                                        <span className="ds-sup-tiempo-nombre">
                                            {s.nombre.split(" ").slice(0, 2).join(" ")}
                                        </span>
                                        <span className="ds-sup-tiempo-sub">
                                            {s.jornadas.length} jornadas · {fmtMin(t.total)}
                                        </span>
                                    </div>
                                    <BarraTiempos {...t} />
                                    <div className="ds-sup-tiempo-breakdown">
                                        {[["ctrl", "🎯"], ["cap", "📚"], ["otra", "🔧"], ["traslado", "🚗"]].map(([k, ic]) => (
                                            <span key={k} className="ds-tiempo-breakdown-item" style={{ "--ds-tipo-color": TIPO_COLOR[k] }}>
                                                {ic} {pct(t[k], t.total)}% <span className="ds-tiempo-breakdown-min">({fmtMin(t[k])})</span>
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
                                    <th className="ds-th-tipo" style={{ "--ds-tipo-color": TIPO_COLOR.ctrl }}>🎯 Control</th>
                                    <th className="ds-th-tipo" style={{ "--ds-tipo-color": TIPO_COLOR.cap }}>📚 Capac.</th>
                                    <th className="ds-th-tipo" style={{ "--ds-tipo-color": TIPO_COLOR.otra }}>🔧 Otras</th>
                                    <th className="ds-th-tipo" style={{ "--ds-tipo-color": TIPO_COLOR.traslado }}>🚗 Traslado</th>
                                    <th>Total</th>
                                </tr></thead>
                                <tbody>
                                    {porSup.map((s, i) => {
                                        const t = s.tiempos;
                                        return (
                                            <tr key={i}>
                                                <td className="ds-td-nombre-xs">{s.nombre.split(" ").slice(0, 2).join(" ")}</td>
                                                <td><span className="ds-td-tipo-val" style={{ "--ds-tipo-color": TIPO_COLOR.ctrl }}>{fmtMin(t.ctrl)}</span> <small className="ds-td-tipo-pct">({pct(t.ctrl, t.total)}%)</small></td>
                                                <td><span className="ds-td-tipo-val" style={{ "--ds-tipo-color": TIPO_COLOR.cap }}>{fmtMin(t.cap)}</span>  <small className="ds-td-tipo-pct">({pct(t.cap, t.total)}%)</small></td>
                                                <td><span className="ds-td-tipo-val" style={{ "--ds-tipo-color": TIPO_COLOR.otra }}>{fmtMin(t.otra)}</span> <small className="ds-td-tipo-pct">({pct(t.otra, t.total)}%)</small></td>
                                                <td><span className="ds-td-tipo-val" style={{ "--ds-tipo-color": TIPO_COLOR.traslado }}>{fmtMin(t.traslado)}</span> <small className="ds-td-tipo-pct">({pct(t.traslado, t.total)}%)</small></td>
                                                <td><strong>{fmtMin(t.total)}</strong></td>
                                            </tr>
                                        );
                                    })}
                                    {/* Fila totales */}
                                    <tr className="ds-tr-totals">
                                        <td>TOTAL</td>
                                        <td className="ds-td-tipo-val" style={{ "--ds-tipo-color": TIPO_COLOR.ctrl }}>{fmtMin(tiemposGlobal.ctrl)}</td>
                                        <td className="ds-td-tipo-val" style={{ "--ds-tipo-color": TIPO_COLOR.cap }}>{fmtMin(tiemposGlobal.cap)}</td>
                                        <td className="ds-td-tipo-val" style={{ "--ds-tipo-color": TIPO_COLOR.otra }}>{fmtMin(tiemposGlobal.otra)}</td>
                                        <td className="ds-td-tipo-val" style={{ "--ds-tipo-color": TIPO_COLOR.traslado }}>{fmtMin(tiemposGlobal.traslado)}</td>
                                        <td>{fmtMin(tiemposGlobal.total)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* ══ PUESTOS ══ */}
            {tab === "puestos" && (
                <>
                    <div className="dash-card">
                        <div className="dash-card-title">Visitas por objetivo</div>
                        {(() => {
                            const map = {};
                            controles.forEach(c => { const k = c.objetivo || "Sin objetivo"; map[k] = (map[k] || 0) + 1; });
                            return <BarChart data={Object.entries(map).map(([k, v]) => ({ label: (k.split("—")[1] || k).trim().split(" ").slice(0, 2).join(" "), value: v }))} color="#0ea5e9" />;
                        })()}
                    </div>
                    <div className="dash-card">
                        <div className="dash-card-title">Detalle por objetivo</div>
                        <div className="dash-table-wrap">
                            <table className="dash-table">
                                <thead><tr><th>Objetivo</th><th>Total</th><th>☀️Día</th><th>🌙Noc</th><th>📅FdS</th><th>Plan</th><th>Cumpl.</th></tr></thead>
                                <tbody>
                                    {data.objetivos.map((obj, i) => {
                                        const vv = controles.filter(c => c.objetivo === obj);
                                        const noc = vv.filter(c => c.turno === "nocturno").length;
                                        const fds = vv.filter(c => c.esFinDeSemana).length;
                                        const dia = vv.length - noc;
                                        const pe = plan.find(p => p.objetivo === obj);
                                        const p2 = pe ? Math.min(Math.round((vv.length / pe.visitasPorSemana) * 100), 100) : null;
                                        return (
                                            <tr key={i}>
                                                <td className="ds-td-objetivo">{obj}</td>
                                                <td><strong>{vv.length}</strong></td>
                                                <td>{dia}</td><td>{noc}</td><td>{fds}</td>
                                                <td>{pe?.visitasPorSemana || "—"}</td>
                                                <td>{p2 !== null ? <span className={"tag ds-tag-pct " + (p2 >= 80 ? "ds-tag--good" : p2 >= 50 ? "ds-tag--mid" : "ds-tag--bad")}>{p2}%</span> : "—"}</td>
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
            {tab === "km" && (
                <>
                    <div className="dash-card">
                        <div className="dash-card-title">Km por semana (últimas 8)</div>
                        <LineChart data={kmSemanas} color="var(--color-primary)" />
                    </div>
                    <div className="dash-card">
                        <div className="dash-card-title">Estado de flota</div>
                        {(() => {
                            // Build vehicle stats from ALL jornadas (not just filtered period)
                            const vehiculoStats = {};
                            // Init all known vehicles
                            (data.vehiculos || []).forEach(v => {
                                vehiculoStats[v] = { usos: 0, kmTotal: 0, kmUltimo: null, fechaUltimo: null, supervisorUltimo: null };
                            });
                            // Fill from jornadas (all time for last km, filtered for period km)
                            jornadas.forEach(j => {
                                const v = j.vehiculo;
                                if (!v) return;
                                if (!vehiculoStats[v]) vehiculoStats[v] = { usos: 0, kmTotal: 0, kmUltimo: null, fechaUltimo: null, supervisorUltimo: null };
                                const km = parseKm(j);
                                const kFin = Number(j.kmFinal) || 0;
                                // Last km final registered
                                const jFecha = j.fecha || j.creadaEn || "";
                                if (kFin > 0 && (!vehiculoStats[v].fechaUltimo || jFecha >= vehiculoStats[v].fechaUltimo)) {
                                    vehiculoStats[v].kmUltimo = kFin;
                                    vehiculoStats[v].fechaUltimo = jFecha;
                                    vehiculoStats[v].supervisorUltimo = (j.nombre || "").split(" ").slice(0,2).join(" ");
                                }
                            });
                            // km period from filtered
                            jornadasFiltradas.forEach(j => {
                                const v = j.vehiculo;
                                if (!v || !vehiculoStats[v]) return;
                                vehiculoStats[v].usos++;
                                vehiculoStats[v].kmTotal += parseKm(j);
                            });
                            const rows = Object.entries(vehiculoStats).sort((a,b) => (b[1].kmUltimo||0) - (a[1].kmUltimo||0));
                            return (
                                <div className="dash-table-wrap">
                                    <table className="dash-table">
                                        <thead><tr>
                                            <th>Vehículo</th>
                                            <th>Último Km</th>
                                            <th>Km período</th>
                                            <th>Usos</th>
                                            <th>Último uso</th>
                                            <th>Supervisor</th>
                                        </tr></thead>
                                        <tbody>
                                            {rows.map(([veh, s], i) => (
                                                <tr key={i} className={s.usos === 0 && !s.kmUltimo ? "ds-tr-inactive" : ""}>
                                                    <td className="ds-td-nombre-xs">{veh}</td>
                                                    <td>
                                                        {s.kmUltimo
                                                            ? <span className="ds-km-val">{s.kmUltimo.toLocaleString("es-AR")} km</span>
                                                            : <span className="ds-td-empty">—</span>}
                                                    </td>
                                                    <td>
                                                        {s.kmTotal > 0
                                                            ? <span className="tag blue">{s.kmTotal} km</span>
                                                            : <span className="ds-td-empty">0</span>}
                                                    </td>
                                                    <td>
                                                        {s.usos > 0
                                                            ? <span className="tag">{s.usos}x</span>
                                                            : <span className="ds-td-empty">—</span>}
                                                    </td>
                                                    <td className="ds-td-muted-xs">{s.fechaUltimo || "—"}</td>
                                                    <td className="ds-td-muted-xs">{s.supervisorUltimo || "—"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
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
                                                    <td className="ds-td-nombre-xs">{m.vehiculo}</td>
                                                    <td className="ds-td-xs">{m.tipo}</td>
                                                    <td className="ds-td-xs">{m.ultimoService?.fecha || "—"}</td>
                                                    <td className="ds-td-xs">{m.proximoService?.fecha || "—"}</td>
                                                    <td>{est ? <span className={"tag ds-tag-est " + (est === "ok" ? "ds-tag--good" : est === "vencido" ? "ds-tag--bad" : "ds-tag--mid")}>{est === "ok" ? "✓ OK" : est === "vencido" ? `Vencido ${Math.abs(dias)}d` : est === "urgente" ? `${dias}d` : `${dias}d`}</span> : "—"}</td>
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
                                                <td className="ds-td-xs">{j.fecha}</td>
                                                <td className="ds-td-xs">{(j.nombre || "").split(" ").slice(0, 2).join(" ")}</td>
                                                <td className="ds-td-xs">{(j.vehiculo || "").split("—")[0].trim()}</td>
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
                                <div className="ds-gauge-center">
                                    <GaugeChart value={cumplTotal} max={100} label={cumplTotal + "% del plan cumplido"} />
                                </div>
                                <div className="dash-turno-grid ds-turno-grid--mt">
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
                                            <div key={i} className="ds-cumpl-sup-row">
                                                <div className="ds-cumpl-sup-header">
                                                    <span className="ds-cumpl-sup-nombre">{s.nombre.split(" ").slice(0, 2).join(" ")}</span>
                                                    <span className={"ds-cumpl-sup-pct " + (supTotal >= 80 ? "ds-color--good" : supTotal >= 50 ? "ds-color--mid-dark" : "ds-color--bad")}>{supTotal}%</span>
                                                </div>
                                                <div className="ds-cumpl-bar-track">
                                                    <div className={"ds-cumpl-bar-fill " + (supTotal >= 80 ? "ds-fill--good" : supTotal >= 50 ? "ds-fill--mid" : "ds-fill--bad")} style={{ "--ds-w": supTotal + "%" }} />
                                                </div>
                                                <div className="ds-cumpl-sup-sub">{s.controles} controles realizados</div>
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
                                            <span className={"dash-cumpl-pct " + (p.pct >= 80 ? "ds-color--good" : p.pct >= 50 ? "ds-color--mid-dark" : "ds-color--bad")}>{p.pct}%</span>
                                        </div>
                                        {p.restriccion && <div className="dash-cumpl-restriccion">{p.restriccion}</div>}
                                        <div className="dash-plan-bar ds-plan-bar--mt">
                                            <div className={"dash-plan-fill " + (p.pct >= 80 ? "ds-fill--good" : p.pct >= 50 ? "ds-fill--mid" : "ds-fill--bad")} style={{ "--ds-w": p.pct + "%" }} />
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
