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
import "../supervisor/SupervisorDashboard.css";
import { TIPO_COLOR } from "../../config/activityTypes";
import { getVisitasDesglosadas } from "../supervisor/PlanSupervisorScreen";

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

// Calcula tiempos de actividades de un array de jornadas
// Mapea por a.tipo directamente; cap usa duracion si no tiene horaFin
const calcTiempos = (jorns) => {
    let ctrl = 0, cap = 0, traslado = 0;
    let admin = 0, taller = 0, vulnerab = 0, reclamos = 0, gremial = 0, almuerzo = 0, otras = 0;
    jorns.forEach(j => {
        const acts = [...(j.actividades || [])]
            .sort((a, b) => toMin(a.horaInicio || a.inicio || "00:00") - toMin(b.horaInicio || b.inicio || "00:00"));

        acts.forEach(a => {
            // Campos de hora: algunos usan horaInicio/horaFin, otros inicio/fin
            const hi = a.horaInicio || a.inicio;
            const hf = a.horaFin    || a.fin;
            // Duración: preferir diferencia de horas, sino campo duracion/duracionMin
            let d = 0;
            if (hi && hf) {
                d = diffMin(hi, hf);
            }
            if (d <= 0 && a.duracion)    d = Number(a.duracion)    || 0;
            if (d <= 0 && a.duracionMin) d = Number(a.duracionMin) || 0;
            if (d <= 0) return;

            switch (a.tipo) {
                case "ctrl":      ctrl     += d; break;
                case "cap":       cap      += d; break;
                case "traslado":  traslado += d; break;
                case "admin":     admin    += d; break;
                case "taller":    taller   += d; break;
                case "vulnerab":  vulnerab += d; break;
                case "reclamos":  reclamos += d; break;
                case "gremial":   gremial  += d; break;
                case "almuerzo":  almuerzo += d; break;
                default:          otras    += d; break;
            }
        });

        // Gaps entre actividades como tiempo de traslado implícito
        const conHora = acts.filter(a => (a.horaInicio || a.inicio) && (a.horaFin || a.fin));
        for (let i = 1; i < conHora.length; i++) {
            const prevFin  = conHora[i - 1].horaFin  || conHora[i - 1].fin;
            const nextIni  = conHora[i].horaInicio    || conHora[i].inicio;
            const g = diffMin(prevFin, nextIni);
            if (g > 1 && g < 120) traslado += g;
        }
    });
    const total = ctrl + cap + traslado + admin + taller + vulnerab + reclamos + gremial + almuerzo + otras;
    return { ctrl, cap, traslado, admin, taller, vulnerab, reclamos, gremial, almuerzo, otras, total };
};

const pct = (v, t) => t > 0 ? Math.round(v / t * 100) : 0;

// ── Radial progress ring ──────────────────────────────────────────────────────
function RadialProgress({ value = 0, max = 100, size = 72, stroke = 7, color = "var(--color-primary)" }) {
    const r     = (size - stroke) / 2;
    const circ  = 2 * Math.PI * r;
    const pct   = Math.min(value / max, 1);
    const dash  = pct * circ;
    const gap   = circ - dash;
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
                <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                    strokeDasharray={`${dash} ${gap}`} strokeLinecap="round"
                    style={{ transition: "stroke-dasharray 0.6s ease" }} />
            </svg>
        </div>
    );
}

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ data = [], color = "var(--color-primary)", height = 32, width = 80 }) {
    if (data.length < 2) return <div style={{ width, height }} />;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const pts = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
    }).join(" ");
    return (
        <svg width={width} height={height} style={{ display: "block" }}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}

// ── Día semana heatmap ────────────────────────────────────────────────────────
const DIA_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
function HeatmapSemana({ jornadas = [] }) {
    const counts = Array(7).fill(0);
    jornadas.forEach(j => {
        const d = new Date(j.creadaEn || j.fecha || 0);
        if (!isNaN(d)) counts[d.getDay()]++;
    });
    const max = Math.max(...counts, 1);
    const colors = ["#e0f2fe","#bae6fd","#7dd3fc","#38bdf8","#0ea5e9","#0284c7","#0369a1"];
    return (
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
            {counts.map((c, i) => {
                const intensity = Math.floor((c / max) * (colors.length - 1));
                return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: c > 0 ? "#0284c7" : "var(--color-muted)" }}>{c || ""}</div>
                        <div style={{
                            width: "100%", height: 40, borderRadius: 6,
                            background: c === 0 ? "var(--color-border)" : colors[intensity],
                            transition: "all 0.3s"
                        }} title={`${DIA_LABELS[i]}: ${c} jornadas`} />
                        <div style={{ fontSize: 10, color: "var(--color-muted)", fontWeight: 600 }}>{DIA_LABELS[i]}</div>
                    </div>
                );
            })}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════════════════════
const TABS = [
    { key: "resumen",      label: "Resumen",     icon: "📊" },
    { key: "supervisores", label: "Supervisores", icon: "👤" },
    { key: "objetivos",    label: "Objetivos",    icon: "📍" },
    { key: "tiempos",      label: "Tiempos",      icon: "⏱"  },
    { key: "km",           label: "Km & Flota",   icon: "🚗"  },
    { key: "cumplimiento", label: "Cumpl. obj.",  icon: "🎯"  },
];

// ══════════════════════════════════════════════════════════════
// HELPER COMPONENT
// ══════════════════════════════════════════════════════════════
function TurnoStatRow({ icon, label, value, color, total }) {
    const pctVal = total > 0 ? Math.round(value / total * 100) : 0;
    return (
        <div className="sup-turno-row">
            <span className="sup-turno-row-icon">{icon}</span>
            <div className="sup-turno-row-body">
                <div className="sup-turno-row-top">
                    <span className="sup-turno-row-label">{label}</span>
                    <span className="sup-turno-row-count" style={{ color }}>{value}</span>
                </div>
                <div className="sup-prog-bar">
                    <div className="sup-prog-fill" style={{ width: pctVal + "%", background: color }} />
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export default function DashboardScreen({ embedded }) {
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

    // ── Plan efectivo: global si existe, sino agregar planes por supervisor ──
    const semsDePatron = (patron, custom) => {
        if (patron === "impares") return [1, 3];
        if (patron === "pares")   return [2, 4];
        if (patron === "custom")  return custom || [];
        return [1, 2, 3, 4];
    };

    const planEfectivo = useMemo(() => {
        if (plan.length > 0) return plan;
        // Sin plan global → agregar desde planes individuales de supervisores
        const supervisores = getSupervisoresConEmail();
        const mapa = {};
        supervisores.forEach(sup => {
            const ps = sup.email
                ? getPlanSupervisor(sup.email) || getPlanSupervisor(sup.nombre)
                : getPlanSupervisor(sup.nombre);
            if (!ps) return;
            (ps.objetivos || []).forEach(o => {
                const vv   = getVisitasDesglosadas(o);
                const sems = semsDePatron(o.patron, o.semanasCustom);
                const fdsW = vv.semanasConFdS.length || sems.length;
                if (!mapa[o.objetivo]) {
                    mapa[o.objetivo] = {
                        objetivo: o.objetivo,
                        patron: o.patron, semanasCustom: o.semanasCustom,
                        visitasDiurnas: sems.length * vv.diurnas,
                        visitasNocturnas: sems.length * vv.nocturnas,
                        visitasFdS: fdsW * vv.fds,
                        semanasConFdS: [],  // ya precalculado
                        _precalc: true,
                    };
                } else {
                    mapa[o.objetivo].visitasDiurnas   += sems.length * vv.diurnas;
                    mapa[o.objetivo].visitasNocturnas += sems.length * vv.nocturnas;
                    mapa[o.objetivo].visitasFdS       += fdsW * vv.fds;
                }
            });
        });
        return Object.values(mapa);
    }, [plan, getSupervisoresConEmail, getPlanSupervisor]);

    // ── Plan / cumplimiento (con desglose por turno) ─────────
    const cumplPlan = useMemo(() => {
        if (!planEfectivo.length) return [];
        return planEfectivo.map(p => {
            const vv      = controles.filter(c => c.objetivo === p.objetivo);
            const realDia = vv.filter(c => c.turno !== "nocturno" && !c.esFinDeSemana).length;
            const realNoc = vv.filter(c => c.turno === "nocturno"  && !c.esFinDeSemana).length;
            const realFdS = vv.filter(c => c.esFinDeSemana).length;

            // Si vino del agregador ya tiene los totales precalculados
            let planDia, planNoc, planFdS;
            if (p._precalc) {
                planDia = p.visitasDiurnas   ?? 0;
                planNoc = p.visitasNocturnas  ?? 0;
                planFdS = p.visitasFdS        ?? 0;
            } else {
                const v    = getVisitasDesglosadas(p);
                const sems = semsDePatron(p.patron, p.semanasCustom);
                const fdsW = v.semanasConFdS.length || sems.length;
                planDia = sems.length * v.diurnas;
                planNoc = sems.length * v.nocturnas;
                planFdS = fdsW * v.fds;
            }
            const planTot = planDia + planNoc + planFdS;

            const pctDia = planDia > 0 ? Math.round(realDia / planDia * 100) : null;
            const pctNoc = planNoc > 0 ? Math.round(realNoc / planNoc * 100) : null;
            const pctFdS = planFdS > 0 ? Math.round(realFdS / planFdS * 100) : null;
            const pctTot = planTot > 0 ? Math.min(Math.round(vv.length / planTot * 100), 100) : 0;

            return {
                ...p, visitas: vv.length,
                realDia, realNoc, realFdS,
                planDia, planNoc, planFdS, planTot,
                pctDia, pctNoc, pctFdS,
                pct: pctTot,
            };
        });
    }, [planEfectivo, controles]);
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

    // ── supDataComputed: calcula datos de cada supervisor para reusar en tabs ──
    const supDataComputed = useMemo(() => {
        const mesInicio = new Date(); mesInicio.setDate(1); mesInicio.setHours(0,0,0,0);
        const supervisores = getSupervisoresConEmail();
        return supervisores.map(sup => {
            const planSup = sup.email
                ? getPlanSupervisor(sup.email) || getPlanSupervisor(sup.nombre)
                : getPlanSupervisor(sup.nombre);

            const reqMes = planSup
                ? (planSup.objetivos || []).reduce((s, o) => {
                    const vv = getVisitasDesglosadas(o);
                    const sems = semsDePatron(o.patron, o.semanasCustom);
                    const fdsW = vv.semanasConFdS.length || sems.length;
                    return s + sems.length * (vv.diurnas + vv.nocturnas) + fdsW * vv.fds;
                }, 0)
                : 0;

            const jornadasSup = jornadasFiltradas.filter(j =>
                j.email === sup.email || j.supervisor === sup.nombre || j.nombre === sup.nombre
            );
            const ctrlSup = jornadasSup.flatMap(j => (j.actividades || []).filter(a => a.tipo === "ctrl"));
            const realMes = jornadas
                .filter(j => j.email === sup.email && new Date(j.creadaEn || 0) >= mesInicio)
                .flatMap(j => (j.actividades || []).filter(a => a.tipo === "ctrl")).length;

            const pctMes = reqMes > 0 ? Math.min(Math.round(realMes / reqMes * 100), 100) : null;

            const objCumpl = planSup ? (planSup.objetivos || []).map(o => {
                const vDes = getVisitasDesglosadas(o);
                const sems = semsDePatron(o.patron, o.semanasCustom);
                const fdsW = vDes.semanasConFdS.length || sems.length;
                const req  = sems.length * (vDes.diurnas + vDes.nocturnas) + fdsW * vDes.fds;
                const real = ctrlSup.filter(c => c.objetivo === o.objetivo).length;
                return { objetivo: o.objetivo, real, req, pct: req > 0 ? Math.min(Math.round(real / req * 100), 100) : 0 };
            }) : [];

            const noc = ctrlSup.filter(c => c.turno === "nocturno" && !c.esFinDeSemana).length;
            const fds = ctrlSup.filter(c => c.esFinDeSemana).length;
            const dia = ctrlSup.filter(c => c.turno !== "nocturno" && !c.esFinDeSemana).length;
            const km  = jornadasSup.reduce((s, j) => { const k = Number(j.kmFinal||0) - Number(j.kmInicial||0); return s + (k > 0 ? k : 0); }, 0);

            // Plan turno desglose mensual
            const planDia = planSup ? (planSup.objetivos||[]).reduce((s, o) => {
                const vv = getVisitasDesglosadas(o); const sems = semsDePatron(o.patron, o.semanasCustom);
                return s + sems.length * vv.diurnas;
            }, 0) : 0;
            const planNoc = planSup ? (planSup.objetivos||[]).reduce((s, o) => {
                const vv = getVisitasDesglosadas(o); const sems = semsDePatron(o.patron, o.semanasCustom);
                return s + sems.length * vv.nocturnas;
            }, 0) : 0;
            const planFdS = planSup ? (planSup.objetivos||[]).reduce((s, o) => {
                const vv = getVisitasDesglosadas(o); const sems = semsDePatron(o.patron, o.semanasCustom);
                const fdsW = vv.semanasConFdS.length || sems.length;
                return s + fdsW * vv.fds;
            }, 0) : 0;
            const pctDia = planDia > 0 ? Math.round(dia / planDia * 100) : null;
            const pctNoc = planNoc > 0 ? Math.round(noc / planNoc * 100) : null;
            const pctFdS = planFdS > 0 ? Math.round(fds / planFdS * 100) : null;

            return { ...sup, planSup, reqMes, realMes, pctMes, objCumpl, ctrlTotal: ctrlSup.length, dia, noc, fds, planDia, planNoc, planFdS, pctDia, pctNoc, pctFdS, km, jornadasCount: jornadasSup.length };
        }).sort((a, b) => {
            if (a.pctMes === null && b.pctMes === null) return 0;
            if (a.pctMes === null) return 1;
            if (b.pctMes === null) return -1;
            return b.pctMes - a.pctMes;
        });
    }, [jornadasFiltradas, jornadas, getSupervisoresConEmail, getPlanSupervisor]);

    return (
        <div className="sup-dash">
            {/* ── Período ── */}
            {!embedded && (
            <div style={{ display: "flex", gap: 6, marginBottom: "var(--space-3)" }}>
                {[["semana","7 días"],["mes","30 días"],["todo","Todo"]].map(([k,l]) => (
                    <button key={k} onClick={() => setPeriodo(k)} style={{
                        padding: "5px 14px", borderRadius: 20, border: "1px solid",
                        fontWeight: 700, fontSize: 12, cursor: "pointer",
                        borderColor: periodo === k ? "var(--color-primary)" : "var(--color-border)",
                        background: periodo === k ? "rgba(var(--color-primary-rgb,0,169,224),.1)" : "transparent",
                        color: periodo === k ? "var(--color-primary)" : "var(--color-muted)",
                    }}>{l}</button>
                ))}
            </div>
            )}

            {/* ── Tabs ── */}
            {!embedded && (
            <div style={{ display: "flex", gap: 4, marginBottom: "var(--space-3)", overflowX: "auto", paddingBottom: 2 }}>
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{
                        padding: "7px 14px", borderRadius: 20, border: "1px solid",
                        fontWeight: 700, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
                        borderColor: tab === t.key ? "var(--color-primary)" : "var(--color-border)",
                        background: tab === t.key ? "var(--color-primary)" : "transparent",
                        color: tab === t.key ? "#fff" : "var(--color-muted)",
                    }}>{t.icon} {t.label}</button>
                ))}
            </div>
            )}

            {/* ══ RESUMEN ══ */}
            {!embedded && tab === "resumen" && (<>
                {/* Banner global */}
                <div className="sup-week-banner">
                    <div className="sup-week-left">
                        <div className="sup-week-label">CUMPLIMIENTO GLOBAL DEL MES</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
                            <div style={{ position: "relative", width: 80, height: 80, flexShrink: 0 }}>
                                <RadialProgress value={cumplTotal} max={100} size={80} stroke={8}
                                    color={cumplTotal >= 80 ? "#10b981" : cumplTotal >= 50 ? "#f59e0b" : "#ef4444"} />
                                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                    <span style={{ fontSize: 17, fontWeight: 900, lineHeight: 1, color: cumplTotal >= 80 ? "#10b981" : cumplTotal >= 50 ? "#f59e0b" : "#ef4444" }}>{cumplTotal}%</span>
                                    <span style={{ fontSize: 8, color: "var(--color-muted)" }}>del plan</span>
                                </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px" }}>
                                {[
                                    { v: jornadasFiltradas.length, l: "Jornadas",   c: "var(--color-primary)" },
                                    { v: controles.length,         l: "Controles",  c: "#6366f1" },
                                    { v: totalKm > 0 ? totalKm + " km" : "—", l: "Km totales", c: "#10b981" },
                                    { v: fmtMin(avgCtrl),          l: "Prom. ctrl", c: "#f59e0b" },
                                ].map((s, i) => (
                                    <div key={i}>
                                        <div style={{ fontFamily: "var(--font-display,\"Bebas Neue\",sans-serif)", fontSize: "1.5rem", color: s.c, lineHeight: 1 }}>{s.v}</div>
                                        <div style={{ fontSize: 9, color: "var(--color-muted)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{s.l}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="sup-week-turnos">
                        <div className="sup-turnos-title">CONTROLES POR TURNO</div>
                        <TurnoStatRow icon="☀️" label="Diurnas"        value={ctrlDia.length} color="#d97706"                  total={controles.length} />
                        <TurnoStatRow icon="🌙" label="Nocturnas"      value={ctrlNoc.length} color="var(--color-primary)"     total={controles.length} />
                        <TurnoStatRow icon="📅" label="Fin de semana"  value={ctrlFdS.length} color="#8b5cf6"                  total={controles.length} />
                        <TurnoStatRow icon="📚" label="Capacitaciones" value={caps.length}    color="#10b981"                  total={controles.length + caps.length} />
                    </div>
                </div>

                {/* Top 5 supervisores */}
                {supDataComputed.length > 0 && (
                    <div className="sup-card">
                        <div className="sup-card-title">🏆 Ranking supervisores</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {supDataComputed.slice(0, 5).map((s, i) => {
                                const col = s.pctMes !== null ? (s.pctMes >= 80 ? "#10b981" : s.pctMes >= 50 ? "#f59e0b" : "#ef4444") : "var(--color-muted)";
                                const medals = ["🥇", "🥈", "🥉"];
                                return (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <span style={{ fontSize: 18, flexShrink: 0, width: 24 }}>{medals[i] || ""}</span>
                                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${col}18`, border: `1px solid ${col}44`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: col, flexShrink: 0 }}>
                                            {s.nombre[0]}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{s.nombre.split(" ").slice(0, 3).join(" ")}</div>
                                            <div className="sup-prog-bar">
                                                <div className="sup-prog-fill" style={{ width: Math.min(s.pctMes ?? 0, 100) + "%", background: col }} />
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 14, fontWeight: 900, color: col, flexShrink: 0, minWidth: 36, textAlign: "right" }}>
                                            {s.pctMes !== null ? s.pctMes + "%" : "—"}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Objetivos críticos */}
                {cumplPlan.filter(p => p.pct < 50).length > 0 && (
                    <div className="sup-card sup-card-danger">
                        <div className="sup-card-title danger">⚠️ Objetivos con bajo cumplimiento</div>
                        {cumplPlan.filter(p => p.pct < 50).slice(0, 6).map((p, i) => (
                            <div key={i} style={{ marginBottom: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, flex: 1, marginRight: 8 }}>{p.objetivo}</div>
                                    <span style={{ fontSize: 12, fontWeight: 900, color: "#ef4444", flexShrink: 0 }}>{p.pct}%</span>
                                </div>
                                <div className="sup-prog-bar">
                                    <div className="sup-prog-fill" style={{ width: p.pct + "%", background: "#ef4444" }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Distribución tiempos */}
                <div className="sup-card">
                    <div className="sup-card-title">⏱ Tiempos globales</div>
                    <BarraTiempos {...tiemposGlobal} showLabels />
                    <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 6, textAlign: "right" }}>
                        Total registrado: <strong>{fmtMin(tiemposGlobal.total)}</strong>
                    </div>
                </div>

                {/* Km por semana */}
                {kmSemanas.some(k => k.value > 0) && (
                    <div className="sup-card">
                        <div className="sup-card-title">🚗 Km por semana (últimas 8)</div>
                        <LineChart data={kmSemanas} color="var(--color-primary)" />
                    </div>
                )}
            </>)}

            {/* ══ SUPERVISORES ══ */}
            {!embedded && tab === "supervisores" && (<>
                {supDataComputed.length === 0
                    ? <div className="sup-empty" style={{ padding: 40 }}>Sin supervisores registrados.</div>
                    : supDataComputed.map((s, i) => {
                        const col = s.pctMes !== null ? (s.pctMes >= 80 ? "#10b981" : s.pctMes >= 50 ? "#f59e0b" : "#ef4444") : "var(--color-muted)";
                        return (
                            <div key={i} className="sup-card" style={{ borderLeft: `3px solid ${col}` }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                                    <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
                                        <RadialProgress value={s.pctMes ?? 0} max={100} size={64} stroke={6} color={col} />
                                        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                            <span style={{ fontSize: 12, fontWeight: 900, color: col, lineHeight: 1 }}>{s.pctMes !== null ? s.pctMes + "%" : "—"}</span>
                                            {s.pctMes !== null && <span style={{ fontSize: 8, color: "var(--color-muted)" }}>{s.realMes}/{s.reqMes}</span>}
                                        </div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 3 }}>{s.nombre}</div>
                                        <div style={{ fontSize: 11, color: "var(--color-muted)" }}>
                                            {s.planSup ? `${s.planSup.objetivos?.length || 0} objetivos · ${s.reqMes} vis/mes` : "Sin plan individual"}
                                        </div>
                                        {/* Desglose turno: plan vs real */}
                                        <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
                                            {(() => {
                                                const chips = [];
                                                if (s.planDia > 0 || s.dia > 0) {
                                                    const c = (s.pctDia??0)>=100?"#10b981":(s.pctDia??0)>=50?"#f59e0b":"#ef4444";
                                                    chips.push(<span key="d" style={{fontSize:10,padding:"3px 8px",borderRadius:20,background:`${c}18`,color:c,border:`1px solid ${c}44`,fontWeight:700}}>☀️ {s.dia}/{s.planDia>0?s.planDia:"?"} día{s.pctDia!==null?` (${s.pctDia}%)`:""}</span>);
                                                }
                                                if (s.planNoc > 0 || s.noc > 0) {
                                                    const c = (s.pctNoc??0)>=100?"#10b981":(s.pctNoc??0)>=50?"#f59e0b":"#ef4444";
                                                    chips.push(<span key="n" style={{fontSize:10,padding:"3px 8px",borderRadius:20,background:`${c}18`,color:c,border:`1px solid ${c}44`,fontWeight:700}}>🌙 {s.noc}/{s.planNoc>0?s.planNoc:"?"} noc{s.pctNoc!==null?` (${s.pctNoc}%)`:""}</span>);
                                                }
                                                if (s.planFdS > 0 || s.fds > 0) {
                                                    const c = (s.pctFdS??0)>=100?"#10b981":(s.pctFdS??0)>=50?"#f59e0b":"#ef4444";
                                                    chips.push(<span key="f" style={{fontSize:10,padding:"3px 8px",borderRadius:20,background:`${c}18`,color:c,border:`1px solid ${c}44`,fontWeight:700}}>📅 {s.fds}/{s.planFdS>0?s.planFdS:"?"} FdS{s.pctFdS!==null?` (${s.pctFdS}%)`:""}</span>);
                                                }
                                                if (s.km > 0) chips.push(<span key="km" style={{fontSize:10,padding:"3px 8px",borderRadius:20,background:"var(--color-surface2)",color:"#10b981",border:"1px solid var(--color-border)",fontWeight:700}}>🚗 {s.km} km</span>);
                                                return chips.length > 0 ? chips : <span style={{fontSize:10,color:"var(--color-muted)"}}>Sin datos de turno</span>;
                                            })()}
                                        </div>
                                    </div>
                                </div>
                                {s.pctMes !== null && (
                                    <div className="sup-prog-bar" style={{ marginBottom: s.objCumpl.length > 0 ? 10 : 0 }}>
                                        <div className="sup-prog-fill" style={{ width: s.pctMes + "%", background: col }} />
                                    </div>
                                )}
                                {s.objCumpl.length > 0 && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                        {s.objCumpl.map((o, oi) => {
                                            const oc = o.pct >= 100 ? "#10b981" : o.pct >= 50 ? "#f59e0b" : "#ef4444";
                                            return (
                                                <div key={oi} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    <div style={{ flex: 1, fontSize: 10, color: "var(--color-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={o.objetivo}>{o.objetivo}</div>
                                                    <div style={{ width: 60, height: 4, background: "var(--color-border)", borderRadius: 2, flexShrink: 0 }}>
                                                        <div style={{ width: Math.min(o.pct, 100) + "%", height: "100%", background: oc, borderRadius: 2 }} />
                                                    </div>
                                                    <span style={{ fontSize: 10, fontWeight: 700, color: oc, width: 32, textAlign: "right", flexShrink: 0 }}>{o.real}/{o.req}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })
                }

                {/* Tabla comparativa compacta */}
                {supDataComputed.length > 0 && (
                    <div className="sup-card">
                        <div className="sup-card-title">📊 Comparativo rápido</div>
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                                <thead>
                                    <tr style={{ borderBottom: "2px solid var(--color-border)", background: "var(--color-surface2)" }}>
                                        {["Supervisor","Total%","Ctrl","☀️Día","🌙Noc","📅FdS","Km","Jorn."].map(h => (
                                            <th key={h} style={{ textAlign: h==="Supervisor"?"left":"center", padding: "5px 4px", color: "var(--color-muted)", fontWeight: 700, fontSize: 9 }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {supDataComputed.map((s, i) => {
                                        const col = s.pctMes !== null ? (s.pctMes >= 80 ? "#10b981" : s.pctMes >= 50 ? "#f59e0b" : "#ef4444") : "var(--color-muted)";
                                        const dc = (s.pctDia??0)>=80?"#10b981":(s.pctDia??0)>=50?"#f59e0b":"#ef4444";
                                        const nc = (s.pctNoc??0)>=80?"#10b981":(s.pctNoc??0)>=50?"#f59e0b":"#ef4444";
                                        const fc = (s.pctFdS??0)>=80?"#10b981":(s.pctFdS??0)>=50?"#f59e0b":"#ef4444";
                                        return (
                                            <tr key={i} style={{ borderBottom: "1px solid var(--color-border)" }}>
                                                <td style={{ padding: "7px 0", fontWeight: 700, fontSize: 11 }}>{s.nombre.split(" ").slice(0,2).join(" ")}</td>
                                                <td style={{ textAlign: "center", padding: "7px 3px", fontWeight: 800, color: col }}>{s.pctMes !== null ? s.pctMes + "%" : "—"}</td>
                                                <td style={{ textAlign: "center", padding: "7px 3px" }}>{s.ctrlTotal}</td>
                                                <td style={{ textAlign: "center", padding: "7px 3px", color: s.planDia>0?dc:"var(--color-muted)" }}>
                                                    {s.dia}{s.planDia>0?<span style={{opacity:.6}}>/{s.planDia}</span>:""}
                                                </td>
                                                <td style={{ textAlign: "center", padding: "7px 3px", color: s.planNoc>0?nc:"var(--color-muted)" }}>
                                                    {s.noc}{s.planNoc>0?<span style={{opacity:.6}}>/{s.planNoc}</span>:""}
                                                </td>
                                                <td style={{ textAlign: "center", padding: "7px 3px", color: s.planFdS>0?fc:"var(--color-muted)" }}>
                                                    {s.fds}{s.planFdS>0?<span style={{opacity:.6}}>/{s.planFdS}</span>:""}
                                                </td>
                                                <td style={{ textAlign: "center", padding: "7px 3px" }}>{s.km > 0 ? s.km : "—"}</td>
                                                <td style={{ textAlign: "center", padding: "7px 3px" }}>{s.jornadasCount}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </>)}

            {/* ══ OBJETIVOS ══ */}
            {!embedded && tab === "objetivos" && (<>
                {cumplPlan.length === 0
                    ? <div className="sup-empty" style={{ padding: 40 }}>Sin plan cargado.</div>
                    : [...cumplPlan].sort((a, b) => a.pct - b.pct).map((p, i) => {
                        const col = p.pct >= 80 ? "#10b981" : p.pct >= 50 ? "#f59e0b" : "#ef4444";
                        const bg  = p.pct >= 80 ? "rgba(16,185,129,0.04)" : p.pct >= 50 ? "rgba(245,158,11,0.04)" : "rgba(239,68,68,0.04)";
                        const visitanteMap = {};
                        controles.filter(c => c.objetivo === p.objetivo).forEach(c => {
                            const n = c.jornada?.nombre || c.jornada?.supervisor || "?";
                            visitanteMap[n] = (visitanteMap[n] || 0) + 1;
                        });
                        return (
                            <div key={i} className="sup-card" style={{ borderLeft: `3px solid ${col}`, background: bg }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                                    <div style={{ flex: 1, fontSize: 12, fontWeight: 700, marginRight: 12 }}>{p.objetivo}</div>
                                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                                        <div style={{ fontFamily: "var(--font-display,\"Bebas Neue\",sans-serif)", fontSize: "1.6rem", color: col, lineHeight: 1 }}>{p.pct}%</div>
                                        <div style={{ fontSize: 9, color: "var(--color-muted)" }}>{p.visitas}/{p.planTot}</div>
                                    </div>
                                </div>
                                <div className="sup-prog-bar" style={{ marginBottom: 8 }}>
                                    <div className="sup-prog-fill" style={{ width: p.pct + "%", background: col }} />
                                </div>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: Object.keys(visitanteMap).length > 0 ? 8 : 0 }}>
                                    {p.planDia > 0 && (() => { const c = (p.pctDia??0)>=100?"#10b981":(p.pctDia??0)>=50?"#f59e0b":"#ef4444"; return <span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:`${c}18`,color:c,border:`1px solid ${c}44`,fontWeight:700}}>☀️ {p.realDia}/{p.planDia} ({p.pctDia??0}%)</span>; })()}
                                    {p.planNoc > 0 && (() => { const c = (p.pctNoc??0)>=100?"#10b981":(p.pctNoc??0)>=50?"#f59e0b":"#ef4444"; return <span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:`${c}18`,color:c,border:`1px solid ${c}44`,fontWeight:700}}>🌙 {p.realNoc}/{p.planNoc} ({p.pctNoc??0}%)</span>; })()}
                                    {p.planFdS > 0 && (() => { const c = (p.pctFdS??0)>=100?"#10b981":(p.pctFdS??0)>=50?"#f59e0b":"#ef4444"; return <span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:`${c}18`,color:c,border:`1px solid ${c}44`,fontWeight:700}}>📅 {p.realFdS}/{p.planFdS} ({p.pctFdS??0}%)</span>; })()}
                                </div>
                                {Object.keys(visitanteMap).length > 0 && (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                        {Object.entries(visitanteMap).map(([n, cnt], vi) => (
                                            <span key={vi} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 20, background: "var(--color-surface2)", color: "var(--color-muted)", border: "1px solid var(--color-border)", fontWeight: 600 }}>
                                                {n.split(" ")[0]} ×{cnt}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })
                }
            </>)}

            {/* ══ TIEMPOS ══ */}
            {!embedded && tab === "tiempos" && (<>
                {/* ── Definición completa de categorías de tiempo ── */}
                {(() => {
                    const CATS_T = [
                        { key: "ctrl",     label: "Supervisión / Control", icon: "🎯", color: "#3b82f6" },
                        { key: "cap",      label: "Capacitación / Apoyo",  icon: "📚", color: "#8b5cf6" },
                        { key: "traslado", label: "Traslados",             icon: "🚗", color: "#0ea5e9" },
                        { key: "admin",    label: "Administrativo",        icon: "📋", color: "#64748b" },
                        { key: "vulnerab", label: "Vulnerabilidades",      icon: "⚠️", color: "#f97316" },
                        { key: "reclamos", label: "Reclamos / Incidentes", icon: "🔴", color: "#ef4444" },
                        { key: "almuerzo", label: "Almuerzo / Cena",       icon: "🍽️", color: "#22c55e" },
                        { key: "taller",   label: "Taller / Reparación",   icon: "🔧", color: "#6b7280" },
                        { key: "gremial",  label: "Gremial / Sindical",    icon: "🤝", color: "#a855f7" },
                        { key: "otras",    label: "Otras actividades",     icon: "📌", color: "#94a3b8" },
                    ];
                    const activasTG = CATS_T.filter(t => tiemposGlobal[t.key] > 0);

                    return (<>
                        {/* ── GLOBAL ── */}
                        <div className="sup-card sup-card-week">
                            <div className="sup-card-title">⏱ Distribución global de tiempos</div>
                            <BarraTiempos {...tiemposGlobal} showLabels />

                            {/* Grid con TODAS las categorías con tiempo */}
                            {activasTG.length > 0 ? (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginTop: 14 }}>
                                    {activasTG.map(t => {
                                        const p = pct(tiemposGlobal[t.key], tiemposGlobal.total);
                                        return (
                                            <div key={t.key} style={{
                                                background: "var(--color-surface2)", borderRadius: "var(--radius-md,10px)",
                                                padding: "10px 12px", border: "1px solid var(--color-border)",
                                                borderLeft: `3px solid ${t.color}`,
                                            }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                                                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text)" }}>{t.icon} {t.label}</span>
                                                    <span style={{ fontWeight: 900, fontSize: 14, color: t.color }}>{p}%</span>
                                                </div>
                                                {/* Barra */}
                                                <div style={{ height: 4, background: "var(--color-border)", borderRadius: 2, marginBottom: 5 }}>
                                                    <div style={{ width: p + "%", height: "100%", background: t.color, borderRadius: 2 }} />
                                                </div>
                                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                    <span style={{ fontSize: 11, fontWeight: 700, color: t.color }}>{fmtMin(tiemposGlobal[t.key])}</span>
                                                    <span style={{ fontSize: 10, color: "var(--color-muted)" }}>de {fmtMin(tiemposGlobal.total)} total</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="sup-empty" style={{ marginTop: 12 }}>Sin actividades con tiempo registrado.</div>
                            )}

                            <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 12, textAlign: "right" }}>
                                Total registrado: <strong style={{ color: "var(--color-text)" }}>{fmtMin(tiemposGlobal.total)}</strong>
                                {" · "}{jornadasFiltradas.length} jornadas
                            </div>
                        </div>

                        {/* ── POR SUPERVISOR ── */}
                        {porSup.filter(s => s.tiempos.total > 0).map((s, i) => {
                            const activasS = CATS_T.filter(t => s.tiempos[t.key] > 0);
                            return (
                                <div key={i} className="sup-card">
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                        <div style={{ fontWeight: 800, fontSize: 13 }}>{s.nombre.split(" ").slice(0, 3).join(" ")}</div>
                                        <div style={{ fontSize: 11, color: "var(--color-muted)" }}>
                                            {s.jornadas.length} jornada{s.jornadas.length !== 1 ? "s" : ""} · <strong>{fmtMin(s.tiempos.total)}</strong>
                                        </div>
                                    </div>
                                    <BarraTiempos {...s.tiempos} />
                                    {/* Todos los tipos con tiempo */}
                                    <div style={{ display: "flex", gap: 5, marginTop: 10, flexWrap: "wrap" }}>
                                        {activasS.map(t => (
                                            <div key={t.key} style={{
                                                display: "flex", flexDirection: "column", alignItems: "center",
                                                padding: "6px 10px", borderRadius: "var(--radius-md,10px)",
                                                background: `${t.color}12`, border: `1px solid ${t.color}30`,
                                                minWidth: 64,
                                            }}>
                                                <span style={{ fontSize: 14 }}>{t.icon}</span>
                                                <span style={{ fontSize: 12, fontWeight: 800, color: t.color, lineHeight: 1.2 }}>
                                                    {fmtMin(s.tiempos[t.key])}
                                                </span>
                                                <span style={{ fontSize: 8, color: "var(--color-muted)", textAlign: "center", lineHeight: 1.2, marginTop: 2 }}>
                                                    {t.label.split(" ")[0]}
                                                </span>
                                                <span style={{ fontSize: 9, color: t.color, fontWeight: 700 }}>
                                                    {pct(s.tiempos[t.key], s.tiempos.total)}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </>);
                })()}
            </>)}

            {/* ══ KM & FLOTA ══ */}
            {!embedded && tab === "km" && (<>
                <div className="sup-card sup-card-week">
                    <div className="sup-card-title">🚗 Km por semana (últimas 8)</div>
                    <LineChart data={kmSemanas} color="var(--color-primary)" />
                </div>

                <div className="sup-card">
                    <div className="sup-card-title">📊 Km por supervisor</div>
                    {porSup.filter(s => s.km > 0).sort((a, b) => b.km - a.km).map((s, i) => {
                        const maxKm = Math.max(...porSup.map(x => x.km), 1);
                        return (
                            <div key={i} style={{ marginBottom: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                    <span style={{ fontSize: 12, fontWeight: 600 }}>{s.nombre.split(" ").slice(0, 2).join(" ")}</span>
                                    <span style={{ fontFamily: "var(--font-display,\"Bebas Neue\",sans-serif)", fontSize: "1.1rem", color: "#10b981" }}>{s.km} km</span>
                                </div>
                                <div className="sup-prog-bar">
                                    <div className="sup-prog-fill" style={{ width: Math.round(s.km / maxKm * 100) + "%", background: "#10b981" }} />
                                </div>
                            </div>
                        );
                    })}
                    {porSup.every(s => s.km === 0) && <div className="sup-empty">Sin registros de Km en este período.</div>}
                </div>

                {/* Tabla flota */}
                {data.vehiculos?.length > 0 && (
                    <div className="sup-card">
                        <div className="sup-card-title">🚙 Estado de flota</div>
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                                <thead>
                                    <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                                        {["Vehículo","Último Km","Km período","Usos","Últ. uso"].map(h => (
                                            <th key={h} style={{ textAlign: h==="Vehículo"?"left":"right", padding: "6px 4px", color: "var(--color-muted)", fontWeight: 600 }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const vstats = {};
                                        (data.vehiculos || []).forEach(v => { vstats[v] = { usos: 0, kmTotal: 0, kmUltimo: null, fechaUltimo: null }; });
                                        jornadas.forEach(j => {
                                            const v = j.vehiculo; if (!v) return;
                                            if (!vstats[v]) vstats[v] = { usos: 0, kmTotal: 0, kmUltimo: null, fechaUltimo: null };
                                            const kFin = Number(j.kmFinal) || 0;
                                            const jf = j.fecha || j.creadaEn || "";
                                            if (kFin > 0 && (!vstats[v].fechaUltimo || jf >= vstats[v].fechaUltimo)) {
                                                vstats[v].kmUltimo = kFin; vstats[v].fechaUltimo = jf;
                                            }
                                        });
                                        jornadasFiltradas.forEach(j => {
                                            const v = j.vehiculo; if (!v || !vstats[v]) return;
                                            vstats[v].usos++; vstats[v].kmTotal += parseKm(j);
                                        });
                                        return Object.entries(vstats).sort((a,b)=>(b[1].kmUltimo||0)-(a[1].kmUltimo||0)).map(([veh, s], i) => (
                                            <tr key={i} style={{ borderBottom: "1px solid var(--color-border)", opacity: s.usos===0&&!s.kmUltimo ? .5 : 1 }}>
                                                <td style={{ padding: "8px 0", fontWeight: 600 }}>{veh}</td>
                                                <td style={{ textAlign: "right", padding: "8px 4px" }}>{s.kmUltimo ? s.kmUltimo.toLocaleString("es-AR") + " km" : "—"}</td>
                                                <td style={{ textAlign: "right", padding: "8px 4px" }}>{s.kmTotal > 0 ? s.kmTotal + " km" : "—"}</td>
                                                <td style={{ textAlign: "right", padding: "8px 4px" }}>{s.usos > 0 ? s.usos + "x" : "—"}</td>
                                                <td style={{ textAlign: "right", padding: "8px 4px", color: "var(--color-muted)" }}>{s.fechaUltimo || "—"}</td>
                                            </tr>
                                        ));
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {mantenimiento?.length > 0 && (
                    <div className="sup-card sup-card-warn">
                        <div className="sup-card-title warn">🔧 Mantenimiento</div>
                        {mantenimiento.map((m, i) => {
                            const hoy = new Date(); hoy.setHours(0,0,0,0);
                            const prox = m.proximoService?.fecha ? new Date(m.proximoService.fecha) : null;
                            const dias = prox ? Math.round((prox - hoy) / 86400000) : null;
                            const est  = dias === null ? null : dias < 0 ? "vencido" : dias <= 7 ? "urgente" : dias <= 30 ? "proximo" : "ok";
                            const ec   = est === "ok" ? "#10b981" : est === "vencido" ? "#ef4444" : "#f59e0b";
                            return (
                                <div key={i} className="sup-alert-row" style={{ background: `${ec}08`, borderColor: `${ec}30` }}>
                                    <span style={{ fontSize: 18 }}>{est==="ok"?"✅":est==="vencido"?"🔴":"🟠"}</span>
                                    <div>
                                        <div className="sup-alert-obj" style={{ color: ec }}>{m.vehiculo} — {m.tipo}</div>
                                        <div className="sup-alert-sem">
                                            {est === "ok" ? "Al día" : est === "vencido" ? `Vencido hace ${Math.abs(dias)} días` : `Vence en ${dias} días`}
                                            {m.proximoService?.fecha && ` · ${m.proximoService.fecha}`}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </>)}

            {/* ══ CUMPLIMIENTO POR OBJETIVOS ══ */}
            {(embedded || tab === "cumplimiento") && (<>
                {cumplPlan.length === 0 ? (
                    <div className="sup-empty" style={{ padding: 40 }}>Sin plan cargado para calcular cumplimiento.</div>
                ) : (<>
                    {/* KPIs globales */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 4 }}>
                        {[
                            { val: cumplTotal + "%",                                                             label: "Cumplimiento global",   col: cumplTotal>=80?"#10b981":cumplTotal>=50?"#f59e0b":"#ef4444" },
                            { val: cumplPlan.filter(p=>p.pct>=80).length + "/" + cumplPlan.length,               label: "Objetivos ≥ 80%",       col: "#10b981" },
                            { val: cumplPlan.filter(p=>p.pct<50).length,                                         label: "Objetivos críticos",    col: "#ef4444" },
                        ].map((k,i) => (
                            <div key={i} className="sup-card" style={{ textAlign:"center", padding:"12px 8px" }}>
                                <div style={{ fontFamily:"var(--font-display,\"Bebas Neue\",sans-serif)", fontSize:"1.8rem", color:k.col, lineHeight:1 }}>{k.val}</div>
                                <div style={{ fontSize:10, color:"var(--color-muted)", marginTop:4 }}>{k.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Barra de progreso global */}
                    <div className="sup-card" style={{ padding: "12px 16px" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                            <span style={{ fontSize:12, fontWeight:700 }}>Cumplimiento general del plan</span>
                            <span style={{ fontFamily:"var(--font-display,\"Bebas Neue\",sans-serif)", fontSize:"1.2rem", color: cumplTotal>=80?"#10b981":cumplTotal>=50?"#f59e0b":"#ef4444" }}>{cumplTotal}%</span>
                        </div>
                        <div className="sup-prog-bar" style={{ height:10 }}>
                            <div className="sup-prog-fill" style={{ width:cumplTotal+"%", background: cumplTotal>=80?"#10b981":cumplTotal>=50?"#f59e0b":"#ef4444" }} />
                        </div>
                    </div>

                    {/* Barras horizontales: % cumplimiento por objetivo */}
                    <div className="sup-card">
                        <div className="sup-card-title">🎯 % Cumplimiento por objetivo</div>
                        {[...cumplPlan].sort((a,b)=>a.pct-b.pct).map((p,i)=>{
                            const col = p.pct>=80?"#10b981":p.pct>=50?"#f59e0b":"#ef4444";
                            return (
                                <div key={i} style={{ marginBottom: 10 }}>
                                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3, gap:8 }}>
                                        <span style={{ fontSize:11, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{p.objetivo}</span>
                                        <span style={{ fontFamily:"var(--font-display,\"Bebas Neue\",sans-serif)", fontSize:"1rem", color:col, flexShrink:0 }}>{p.pct}%</span>
                                    </div>
                                    <div className="sup-prog-bar">
                                        <div className="sup-prog-fill" style={{ width:p.pct+"%", background:col }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Tabla detallada: todos los objetivos */}
                    <div className="sup-card">
                        <div className="sup-card-title">📋 Detalle por objetivo</div>
                        <div style={{ overflowX:"auto" }}>
                            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                                <thead>
                                    <tr style={{ borderBottom:"2px solid var(--color-border)" }}>
                                        {["Objetivo","Total","Cump.%","☀️ Día","🌙 Noc","📅 FdS","Sup."].map((h,i)=>(
                                            <th key={i} style={{ textAlign:i===0?"left":"center", padding:"6px 4px", color:"var(--color-muted)", fontWeight:700, whiteSpace:"nowrap" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...cumplPlan].sort((a,b)=>a.pct-b.pct).map((p,i)=>{
                                        const col = p.pct>=80?"#10b981":p.pct>=50?"#f59e0b":"#ef4444";
                                        // Contar supervisores únicos que visitaron este objetivo
                                        const sups = new Set(controles.filter(c=>c.objetivo===p.objetivo).map(c=>c.jornada?.nombre||c.jornada?.supervisor||"?")).size;
                                        return (
                                            <tr key={i} style={{ borderBottom:"1px solid var(--color-border)", background: i%2?"var(--color-surface2)":"" }}>
                                                <td style={{ padding:"7px 0", fontWeight:600, maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.objetivo}</td>
                                                <td style={{ textAlign:"center", padding:"7px 4px" }}>{p.visitas}/{p.planTot}</td>
                                                <td style={{ textAlign:"center", padding:"7px 4px" }}>
                                                    <span style={{ background:`${col}18`, color:col, border:`1px solid ${col}44`, borderRadius:20, padding:"1px 8px", fontWeight:800 }}>{p.pct}%</span>
                                                </td>
                                                <td style={{ textAlign:"center", padding:"7px 4px", color:p.planDia>0?(p.pctDia>=100?"#10b981":p.pctDia>=50?"#f59e0b":"#ef4444"):"var(--color-muted)" }}>
                                                    {p.planDia>0?`${p.realDia}/${p.planDia}`:"—"}
                                                </td>
                                                <td style={{ textAlign:"center", padding:"7px 4px", color:p.planNoc>0?(p.pctNoc>=100?"#10b981":p.pctNoc>=50?"#f59e0b":"#ef4444"):"var(--color-muted)" }}>
                                                    {p.planNoc>0?`${p.realNoc}/${p.planNoc}`:"—"}
                                                </td>
                                                <td style={{ textAlign:"center", padding:"7px 4px", color:p.planFdS>0?(p.pctFdS>=100?"#10b981":p.pctFdS>=50?"#f59e0b":"#ef4444"):"var(--color-muted)" }}>
                                                    {p.planFdS>0?`${p.realFdS}/${p.planFdS}`:"—"}
                                                </td>
                                                <td style={{ textAlign:"center", padding:"7px 4px", color:"var(--color-muted)" }}>{sups>0?sups:"—"}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>)}
            </>)}
        </div>
    );
}
