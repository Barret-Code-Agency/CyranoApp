// src/screens/SupervisorDashboard.jsx
import { useState, useMemo, useEffect } from "react";
import { useAppData } from "../../context/AppDataContext";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";
import "./SupervisorDashboard.css";
import AnalistaDashboard from "../AnalistaDashboard";
import { getVisitasDesglosadas } from "./PlanSupervisorScreen";

const WEEK_RANGES = { 1: "1–7", 2: "8–14", 3: "15–21", 4: "22–28" };
const TURNO_ICON  = { diurno: "☀️", nocturno: "🌙", mixto: "🔄" };

const getSemana = (d = new Date()) => {
    const day = d.getDate();
    if (day <= 7)  return 1;
    if (day <= 14) return 2;
    if (day <= 21) return 3;
    if (day <= 28) return 4;
    return null;
};

const semanasDePatron = (patron, custom) => {
    if (patron === "todas")   return [1, 2, 3, 4];
    if (patron === "impares") return [1, 3];
    if (patron === "pares")   return [2, 4];
    if (patron === "custom")  return custom || [];
    return [1, 2, 3, 4];
};

const mesNombre = () =>
    new Date().toLocaleString("es-AR", { month: "long", year: "numeric" });

function CircleProgress({ pct, size = 64 }) {
    const r = size * 0.38, cx = size / 2, cy = size / 2;
    const c = 2 * Math.PI * r, dash = (pct / 100) * c;
    const color = pct >= 100 ? "var(--color-success)" : pct >= 50 ? "var(--color-primary)" : "var(--color-danger)";
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-surface3)" strokeWidth="5" />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="5"
                strokeLinecap="round" strokeDasharray={`${dash} ${c}`}
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{ transition: "stroke-dasharray .6s ease" }}
            />
            <text x={cx} y={cy + 5} textAnchor="middle" fontSize={size * 0.2} fontWeight="800" fill={color}>
                {pct}%
            </text>
        </svg>
    );
}

// Donut simple con color único — para los 4 mini-donuts del avance
function MiniDonut({ pct, color, label, real, plan, size = 56 }) {
    const r    = size * 0.36, cx = size / 2, cy = size / 2;
    const circ = 2 * Math.PI * r;
    const dash = (Math.min(pct, 100) / 100) * circ;
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={cx} cy={cy} r={r} fill="none"
                    stroke="var(--color-surface3)" strokeWidth="5.5" />
                <circle cx={cx} cy={cy} r={r} fill="none"
                    stroke={color} strokeWidth="5.5" strokeLinecap="round"
                    strokeDasharray={`${dash} ${circ}`}
                    transform={`rotate(-90 ${cx} ${cy})`}
                    style={{ transition: "stroke-dasharray .5s ease" }}
                />
                <text x={cx} y={cy + 3} textAnchor="middle"
                    fontSize={size * 0.195} fontWeight="900" fill={color}>
                    {pct}%
                </text>
            </svg>
            <div style={{ fontSize: 9, fontWeight: 700, color: "var(--color-muted)",
                textTransform: "uppercase", letterSpacing: ".5px", textAlign: "center" }}>
                {label}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color,
                textAlign: "center", lineHeight: 1 }}>
                {real}{plan > 0 ? `/${plan}` : ""}
            </div>
        </div>
    );
}

// Donut multi-segmento: ☀️ diurnas | 🌙 nocturnas | 📅 FdS | ⬜ restante
function DonutMulti({ dia, noc, fds, planTotal, size = 72 }) {
    const r    = size * 0.36;
    const cx   = size / 2, cy = size / 2;
    const circ = 2 * Math.PI * r;
    const real = dia + noc + fds;
    const base = Math.max(planTotal, real, 1);

    const pct    = planTotal > 0 ? Math.min(Math.round(real / planTotal * 100), 100) : (real > 0 ? 100 : 0);
    const pctClr = pct >= 100 ? "var(--color-success)" : pct >= 50 ? "#f59e0b" : "var(--color-danger)";

    const SEGS = [
        { value: dia, color: "#d97706"  },  // ☀️ diurnas
        { value: noc, color: "#00a9e0"  },  // 🌙 nocturnas
        { value: fds, color: "#8b5cf6"  },  // 📅 FdS
    ];

    let accum = 0;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Track gris */}
            <circle cx={cx} cy={cy} r={r} fill="none"
                stroke="var(--color-surface3)" strokeWidth="6" />
            {/* Arcos de cada turno */}
            {SEGS.map((seg, i) => {
                if (seg.value <= 0) return null;
                const startAngle = (accum / base) * 360 - 90;
                const len = (seg.value / base) * circ;
                accum += seg.value;
                return (
                    <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                        stroke={seg.color} strokeWidth="6"
                        strokeLinecap="butt"
                        strokeDasharray={`${len} ${circ}`}
                        transform={`rotate(${startAngle} ${cx} ${cy})`}
                        style={{ transition: "stroke-dasharray .5s ease" }}
                    />
                );
            })}
            {/* Centro: % total */}
            <text x={cx} y={cy + 3} textAnchor="middle"
                fontSize={size * 0.195} fontWeight="900" fill={pctClr}>
                {pct}%
            </text>
            <text x={cx} y={cy + size * 0.23} textAnchor="middle"
                fontSize={size * 0.135} fill="var(--color-muted)" fontWeight="600">
                {real}/{planTotal > 0 ? planTotal : "?"}
            </text>
        </svg>
    );
}

function ProgressBar({ value, max }) {
    const pct = max > 0 ? Math.min(value / max, 1) * 100 : 0;
    const clr = pct >= 80 ? "var(--color-success)" : pct >= 50 ? "#f59e0b" : "var(--color-danger)";
    return (
        <div className="sup-prog-bar">
            <div className="sup-prog-fill" style={{ width: pct + "%", background: clr }} />
        </div>
    );
}

// Fila solo-plan (card superior de la semana)
function PlanOnlyRow({ icon, label, value, color }) {
    return (
        <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 0", borderBottom: "1px solid rgba(var(--color-primary-rgb,0,169,224),.15)",
        }}>
            <span style={{ fontSize: 16, width: 24, textAlign: "center", flexShrink: 0 }}>{icon}</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--color-text)" }}>{label}</span>
            <span style={{
                fontSize: 22, fontWeight: 900, lineHeight: 1,
                fontFamily: "var(--font-display,'Bebas Neue',sans-serif)",
                color: value > 0 ? color : "var(--color-muted)", letterSpacing: 1,
            }}>
                {value > 0 ? value : "—"}
            </span>
        </div>
    );
}

// Fila comparativa Plan vs Realizado — Panel mensual
function PlanMesRow({ icon, label, plan, real, color }) {
    const pct  = plan > 0 ? Math.min(Math.round(real / plan * 100), 100) : null;
    const bClr = pct === null      ? color
               : pct >= 100        ? "var(--color-success)"
               : pct >= 50         ? "#f59e0b"
               :                     "var(--color-danger)";
    return (
        <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "7px 0", borderBottom: "1px solid var(--color-border)",
        }}>
            <span style={{ fontSize: 15, width: 22, textAlign: "center", flexShrink: 0 }}>{icon}</span>
            <span style={{ flex: 1, fontSize: 12, color: "var(--color-muted)" }}>{label}</span>
            <span style={{ width: 30, textAlign: "center", fontSize: 14, fontWeight: 700,
                color: plan > 0 ? color : "var(--color-muted)" }}>
                {plan > 0 ? plan : "—"}
            </span>
            <div style={{ width: 1, height: 18, background: "var(--color-border)", flexShrink: 0 }} />
            <span style={{ width: 30, textAlign: "center", fontSize: 14, fontWeight: 800, color: bClr }}>
                {real}
            </span>
            <span style={{ width: 34, textAlign: "right", fontSize: 10, fontWeight: 700,
                color: bClr, flexShrink: 0 }}>
                {pct !== null ? `${pct}%` : ""}
            </span>
        </div>
    );
}

// Fila de turno con barra de progreso
function TurnoRow({ icon, label, realizado, requerido, color }) {
    const pct = requerido > 0 ? Math.min(Math.round(realizado / requerido * 100), 100) : 0;
    const barColor = pct >= 80 ? "var(--color-success)" : pct >= 40 ? color : "var(--color-danger)";
    return (
        <div className="sup-turno-row">
            <span className="sup-turno-row-icon">{icon}</span>
            <div className="sup-turno-row-body">
                <div className="sup-turno-row-top">
                    <span className="sup-turno-row-label">{label}</span>
                    <span className="sup-turno-row-count" style={{ color }}>
                        {realizado}
                        {requerido > 0 && <span className="sup-turno-row-sep">/{requerido}</span>}
                    </span>
                </div>
                {requerido > 0 && (
                    <div className="sup-prog-bar">
                        <div className="sup-prog-fill" style={{ width: pct + "%", background: barColor }} />
                    </div>
                )}
            </div>
        </div>
    );
}


// Barra horizontal: avance de semana o de mes
function DayProgressBar({ semana, useMes = false }) {
    const hoy        = new Date();
    const dayInMonth = hoy.getDate();
    const fechaFmt   = hoy.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });

    let pct, label;

    if (useMes) {
        // Días hábiles del mes: cuántos pasaron vs total del mes
        const totalDiasDelMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
        let habilesPasados = 0, habilesTotales = 0;
        for (let d = 1; d <= totalDiasDelMes; d++) {
            const dow = new Date(hoy.getFullYear(), hoy.getMonth(), d).getDay();
            if (dow >= 1 && dow <= 5) {
                habilesTotales++;
                if (d <= dayInMonth) habilesPasados++;
            }
        }
        pct   = habilesTotales > 0 ? Math.round(habilesPasados / habilesTotales * 100) : 0;
        label = "avance del mes";
    } else {
        const WEEK_RANGES_NUM = { 1:[1,7], 2:[8,14], 3:[15,21], 4:[22,28] };
        const [dIni, dFin] = WEEK_RANGES_NUM[semana] || [1,7];
        // Progreso: días transcurridos del rango vs total del rango (7 días)
        const diasEnRango = dFin - dIni + 1; // siempre 7
        const diasPasados = Math.max(0, Math.min(dayInMonth, dFin) - dIni + 1);
        pct   = Math.min(Math.round(diasPasados / diasEnRango * 100), 100);
        label = "avance de semana";
    }

    const color = pct >= 80 ? "var(--color-success)" : pct >= 50 ? "var(--color-primary)" : "#f59e0b";

    return (
        <div className="sup-day-bar-wrap">
            <div className="sup-day-bar-fecha">{fechaFmt}</div>
            <div className="sup-day-bar-row">
                <div className="sup-day-bar-track">
                    <div className="sup-day-bar-fill" style={{ width: pct + "%", background: color }} />
                </div>
                <span className="sup-day-bar-pct" style={{ color }}>{pct}%</span>
            </div>
            <div className="sup-day-bar-label">{label}</div>
        </div>
    );
}

export default function SupervisorDashboard({ user: userProp, onIniciarJornada, hideHeader = false }) {
    const [vistaAnalista,    setVistaAnalista]    = useState(false);
    const [firestoreData,    setFirestoreData]    = useState(null);
    const [semSeleccionada,  setSemSeleccionada]  = useState(null); // semana expandida en tarjetas

    const { user: authUser } = useAuth();
    const user = authUser || userProp;

    // Leer campos de analista directo de Firestore como fuente de verdad
    // Cubre casos donde el onSnapshot falló o el campo fue agregado después del login
    useEffect(() => {
        const uid = user?.uid;
        if (!uid) return;
        getDoc(doc(db, "usuarios", uid)).then(snap => {
            if (snap.exists()) {
                const d = snap.data();
                setFirestoreData({
                    esAnalista:           d.esAnalista === true,
                    zona:                 d.zona || null,
                    objetivosVisibles:    d.objetivosVisibles || null,
                    vehiculosVisibles:    d.vehiculosVisibles || null,
                    supervisoresVisibles: d.supervisoresVisibles || null,
                });
            }
        }).catch(e => console.warn("SupervisorDashboard Firestore read:", e));
    }, [user?.uid]);

    // Merge: firestoreData tiene prioridad sobre lo que vino por props/context
    const analista = firestoreData || {
        esAnalista:           user?.esAnalista === true,
        zona:                 user?.zona,
        objetivosVisibles:    user?.objetivosVisibles,
        vehiculosVisibles:    user?.vehiculosVisibles,
        supervisoresVisibles: user?.supervisoresVisibles,
    };
    const {
        plan: planGlobal,
        getPlanSupervisor, getObjetivosSemana,
        jornadas, jornadaActiva,
        getAlertasMantenimiento,
        empresaLogos, empresaNombre,
        planesSuper,
    } = useAppData();

    const semana = getSemana();
    // Buscar plan por email, nombre, uid y también por email-prefix (girelli@... → "girelli")
    const ps = getPlanSupervisor(user.email)
            || getPlanSupervisor(user.name)
            || getPlanSupervisor(user.uid)
            || getPlanSupervisor((user.email || "").split("@")[0]);

    const mesInicio = useMemo(() => {
        const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d;
    }, []);

    const alertasVehiculos = getAlertasMantenimiento();

    // Controles del mes — cada control lleva la semana de su jornada
    const controlesMes = useMemo(() =>
        jornadas
            .filter(j => j.email === user.email && new Date(j.creadaEn || j.fecha || 0) >= mesInicio)
            .flatMap(j => {
                const semanaJ = getSemana(new Date(j.creadaEn || j.fecha || 0));
                return (j.actividades || [])
                    .filter(a => a.tipo === "ctrl")
                    .map(a => ({ ...a, _semana: semanaJ }));
            }),
        [jornadas, user.email, mesInicio]
    );

    const getSemanaDeCtrl = (c) => c._semana ?? getSemana(new Date(c.iniciadaEn || 0));

    const controlesSemana = useMemo(() =>
        controlesMes.filter(c => getSemanaDeCtrl(c) === semana),
        [controlesMes, semana]
    );

    // Desglose por turno — semana actual
    const diurnosSem   = controlesSemana.filter(c => c.turno === "diurno"   && !c.esFinDeSemana).length;
    const nocturnosSem = controlesSemana.filter(c => c.turno === "nocturno" && !c.esFinDeSemana).length;
    const fdsSem       = controlesSemana.filter(c => c.esFinDeSemana).length;

    // Desglose por turno — mes completo
    const diurnosMes   = controlesMes.filter(c => c.turno === "diurno"   && !c.esFinDeSemana).length;
    const nocturnosMes = controlesMes.filter(c => c.turno === "nocturno" && !c.esFinDeSemana).length;
    const fdsMes       = controlesMes.filter(c => c.esFinDeSemana).length;

    // Normaliza nombre: quita guiones em/en y espacios extra para comparación
    const normObj = (s) => (s || "").replace(/\s*[—–-]\s*/g, " ").trim().toLowerCase();

    const visitasPorObj = useMemo(() => {
        const map = {};
        controlesMes.forEach(c => {
            const key = normObj(c.objetivo);
            if (key) map[key] = (map[key] || 0) + 1;
        });
        return map;
    }, [controlesMes]);

    const getVisitas = (objName) => visitasPorObj[normObj(objName)] || 0;

    // ── Plan global ───────────────────────────────────────────────────────────
    const objGlobalSemana = useMemo(() =>
        (planGlobal || []).filter(p => { const vv = getVisitasDesglosadas(p); return (vv.diurnas + vv.nocturnas + vv.fds) > 0; }),
        [planGlobal]
    );
    const sinPlanGlobal    = objGlobalSemana.length === 0;
    const reqGlobalSemana  = objGlobalSemana.reduce((s, o) => { const vv = getVisitasDesglosadas(o); return s + (vv.diurnas + vv.nocturnas + vv.fds || 1); }, 0);
    const realGlobalSemana = controlesSemana.length;
    const pctGlobalSemana  = reqGlobalSemana > 0 ? Math.min(Math.round(realGlobalSemana / reqGlobalSemana * 100), 100) : 0;
    const reqGlobalMes     = reqGlobalSemana * 4;
    const pctGlobalMes     = reqGlobalMes > 0 ? Math.min(Math.round(controlesMes.length / reqGlobalMes * 100), 100) : 0;

    // ── Plan individual ───────────────────────────────────────────────────────
    const sinPlanIndivid = !ps;

    // Usamos ps directamente (ya resuelto arriba) en lugar de getObjetivosSemana(user.email)
    // porque getObjetivosSemana re-busca por email y puede fallar si el plan está keyed por nombre
    const objIndivSemana = useMemo(() => {
        if (!ps || !semana) return [];
        return (ps.objetivos || [])
            .filter(o => {
                if (o.patron === "todas")   return true;
                if (o.patron === "impares") return semana === 1 || semana === 3;
                if (o.patron === "pares")   return semana === 2 || semana === 4;
                if (o.patron === "custom")  return (o.semanasCustom || []).includes(semana);
                return true;
            })
            .map(o => ({
                ...o,
                turnoEfectivo: (!o.turno || o.turno === "base") ? (ps.turnoBase || "mixto") : o.turno,
            }));
    }, [ps, semana]);

    const reqIndivSemana = objIndivSemana.reduce((s, o) => { const vv = getVisitasDesglosadas(o); return s + (vv.diurnas + vv.nocturnas + vv.fds || 1); }, 0);
    const pctIndivSemana = reqIndivSemana > 0 ? Math.min(Math.round(realGlobalSemana / reqIndivSemana * 100), 100) : 0;
    const reqIndivMes    = (ps?.objetivos || []).reduce((s, o) => {
        const vv = getVisitasDesglosadas(o);
        const sems = semanasDePatron(o.patron, o.semanasCustom);
        const fdsW = vv.semanasConFdS.length || sems.length;
        return s + sems.length * (vv.diurnas + vv.nocturnas) + fdsW * vv.fds;
    }, 0);
    const pctIndivMes    = reqIndivMes > 0 ? Math.min(Math.round(controlesMes.length / reqIndivMes * 100), 100) : 0;

    // Requeridos por turno — mismo cálculo que planDiaW/planNocW para consistencia
    const reqDiurnoSem = !sinPlanIndivid
        ? (ps?.objetivos || []).reduce((s, o) => {
            const vv = getVisitasDesglosadas(o);
            return semanasDePatron(o.patron, o.semanasCustom).includes(semana) ? s + vv.diurnas : s;
        }, 0)
        : reqGlobalSemana;
    const reqNocturnoSem = !sinPlanIndivid
        ? (ps?.objetivos || []).reduce((s, o) => {
            const vv = getVisitasDesglosadas(o);
            return semanasDePatron(o.patron, o.semanasCustom).includes(semana) ? s + vv.nocturnas : s;
        }, 0)
        : 0;
    const reqFdsSem = !sinPlanIndivid
        ? (ps?.objetivos || []).reduce((s, o) => {
            const vv    = getVisitasDesglosadas(o);
            const sems  = semanasDePatron(o.patron, o.semanasCustom);
            const fdsWs = vv.semanasConFdS?.length ? vv.semanasConFdS : sems;
            return fdsWs.includes(semana) ? s + vv.fds : s;
        }, 0)
        : 0;
    const planTotSem = reqDiurnoSem + reqNocturnoSem + reqFdsSem;

    // Requeridos por turno según plan individual — mes
    const reqDiurnoMes = (ps?.objetivos || []).reduce((s, o) => {
        const vv = getVisitasDesglosadas(o);
        return s + semanasDePatron(o.patron, o.semanasCustom).length * vv.diurnas;
    }, 0);
    const reqNocturnoMes = (ps?.objetivos || []).reduce((s, o) => {
        const vv = getVisitasDesglosadas(o);
        return s + semanasDePatron(o.patron, o.semanasCustom).length * vv.nocturnas;
    }, 0);

    // ── Panel 3: contribución al plan maestro ────────────────────────────────
    const ctrlTodosEquipo = useMemo(() =>
        jornadas
            .filter(j => new Date(j.creadaEn || 0) >= mesInicio)
            .flatMap(j => (j.actividades || []).filter(a => a.tipo === "ctrl")),
        [jornadas, mesInicio]
    );
    const totalEquipo    = ctrlTodosEquipo.length;
    const miContribucion = controlesMes.length;
    const pctContrib     = totalEquipo > 0 ? Math.round(miContribucion / totalEquipo * 100) : 0;
    // Cumplimiento del equipo contra plan global
    const pctEquipoMes   = reqGlobalMes > 0 ? Math.min(Math.round(totalEquipo / reqGlobalMes * 100), 100) : 0;

    // ── Plan zonal total (suma de todos los planes individuales de supervisores) ──
    const planZonalMes = useMemo(() =>
        Object.values(planesSuper).reduce((total, plan) => {
            return total + (plan.objetivos || []).reduce((s, o) => {
                const vv   = getVisitasDesglosadas(o);
                const sems = semanasDePatron(o.patron, o.semanasCustom);
                const fdsW = vv.semanasConFdS?.length ? vv.semanasConFdS : sems;
                return s + sems.length * (vv.diurnas + vv.nocturnas) + fdsW.length * vv.fds;
            }, 0);
        }, 0),
        [planesSuper]
    );
    const miPlanMes      = reqDiurnoMes + reqNocturnoMes;
    const miPctDeZonal   = planZonalMes > 0 ? Math.round(miPlanMes / planZonalMes * 100) : 0;
    const miCumplMes     = miPlanMes > 0 ? Math.min(Math.round(miContribucion / miPlanMes * 100), 100) : null;
    const cumplZonalMes  = planZonalMes > 0 ? Math.min(Math.round(totalEquipo / planZonalMes * 100), 100) : null;
    const cantSuper      = Object.keys(planesSuper).length;

    // ── Cumplimiento mensual por objetivo (plan individual) ─────────────────
    const objCumplMes = useMemo(() => {
        if (!ps?.objetivos?.length) return [];
        return ps.objetivos.map(o => {
            const vDes = getVisitasDesglosadas(o);
            const sems = semanasDePatron(o.patron, o.semanasCustom);
            const fdsW = vDes.semanasConFdS.length || sems.length;
            const reqDia = sems.length * vDes.diurnas;
            const reqNoc = sems.length * vDes.nocturnas;
            const reqFdS = fdsW * vDes.fds;
            const reqTot = reqDia + reqNoc + reqFdS;

            const ctrlsO   = controlesMes.filter(c => normObj(c.objetivo) === normObj(o.objetivo));
            const realDia  = ctrlsO.filter(c => c.turno !== "nocturno" && !c.esFinDeSemana).length;
            const realNoc  = ctrlsO.filter(c => c.turno === "nocturno"  && !c.esFinDeSemana).length;
            const realFdS  = ctrlsO.filter(c => c.esFinDeSemana).length;
            const real     = ctrlsO.length;
            const pct      = reqTot > 0 ? Math.min(Math.round(real / reqTot * 100), 100) : 0;
            const pctDia   = reqDia > 0 ? Math.round(realDia / reqDia * 100) : null;
            const pctNoc   = reqNoc > 0 ? Math.round(realNoc / reqNoc * 100) : null;
            const pctFdS   = reqFdS > 0 ? Math.round(realFdS / reqFdS * 100) : null;
            // semanas activas para mostrar patrón
            const semsLabel = sems.length === 4 ? "todas" : `sem ${sems.join(",")}`;
            return { objetivo: o.objetivo, reqTot, reqDia, reqNoc, reqFdS, real, realDia, realNoc, realFdS, pct, pctDia, pctNoc, pctFdS, semsLabel };
        });
    }, [ps, controlesMes]);

    // Alertas semanas anteriores — usa plan individual si existe, si no plan global
    const alertasPlan = useMemo(() => {
        if (!semana || semana <= 1) return [];

        // Prioridad: plan individual del supervisor
        const usarIndividual = !sinPlanIndivid && (ps?.objetivos || []).length > 0;
        const objetivosBase  = usarIndividual
            ? (ps?.objetivos || []).filter(o => { const vv = getVisitasDesglosadas(o); return (vv.diurnas + vv.nocturnas + vv.fds) > 0; })
            : objGlobalSemana;

        if (objetivosBase.length === 0) return [];

        const lista = [];
        for (let w = 1; w < semana; w++) {
            objetivosBase.forEach(o => {
                // Plan individual: respetar patrón (solo alertar semanas que debía visitar)
                if (usarIndividual) {
                    const semanasActivas = semanasDePatron(o.patron, o.semanasCustom);
                    if (!semanasActivas.includes(w)) return;
                }
                const real = controlesMes.filter(c =>
                    normObj(c.objetivo) === normObj(o.objetivo) && getSemanaDeCtrl(c) === w
                ).length;
                const vvO = getVisitasDesglosadas(o);
                const requeridas = vvO.diurnas + vvO.nocturnas + vvO.fds || 1;
                if (real < requeridas)
                    lista.push({ semana: w, objetivo: o.objetivo, realizadas: real, requeridas });
            });
        }
        return lista;
    }, [sinPlanIndivid, sinPlanGlobal, semana, ps, objGlobalSemana, controlesMes]);

    return (
        <div className="sup-dash">
            {!hideHeader && (
                <div className="sup-dash-header">
                    <div>
                        <div className="sup-dash-title">Mi Panel — {empresaNombre}</div>
                        <div className="sup-dash-sub">{user.name} · {mesNombre()}</div>
                    </div>
                    {empresaLogos?.panel && (
                        <img src={empresaLogos.panel} alt="Logo empresa" className="sup-empresa-logo" />
                    )}
                </div>
            )}

            {jornadaActiva && (
                <div style={{
                    background: "rgba(var(--color-success-rgb,0,201,122),.1)",
                    border: "1px solid rgba(var(--color-success-rgb,0,201,122),.3)",
                    borderRadius: "var(--radius-md,12px)", padding: "10px 14px",
                    marginBottom: "var(--space-3)", display: "flex", alignItems: "center", gap: 10,
                    fontSize: "var(--text-sm)", color: "var(--color-success)", fontWeight: 600,
                }}>
                    <span>🟢</span>
                    <span>Jornada activa desde {jornadaActiva.horaInicio || "hoy"} — tocá Continuar</span>
                </div>
            )}


            {/* ══ CARD 1: PLAN DE LA SEMANA ══ */}
            {semana ? (
                <div className="sup-week-banner">
                    {/* Izquierda: número + rango */}
                    <div className="sup-week-left">
                        <div className="sup-week-label">PLAN SEMANA</div>
                        <div className="sup-week-num">{semana}</div>
                        <div className="sup-week-range">Días {WEEK_RANGES[semana]}</div>
                    </div>

                    {/* Derecha: controles planificados */}
                    <div style={{ flex: 1, minWidth: 160 }}>
                        <div className="sup-turnos-title" style={{ marginBottom: 6 }}>
                            CONTROLES PLANIFICADOS
                        </div>
                        {sinPlanIndivid && sinPlanGlobal ? (
                            <div style={{ fontSize: 12, color: "var(--color-muted)", fontStyle: "italic", paddingTop: 6 }}>
                                Sin plan configurado para esta semana
                            </div>
                        ) : (
                            <>
                                <PlanOnlyRow icon="☀️" label="Diurnas"       value={reqDiurnoSem}  color="#d97706" />
                                <PlanOnlyRow icon="🌙" label="Nocturnas"     value={reqNocturnoSem} color="var(--color-primary)" />
                                <PlanOnlyRow icon="📅" label="Fin de semana" value={reqFdsSem}      color="#8b5cf6" />
                                <div style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                    marginTop: 8, paddingTop: 6,
                                    borderTop: "1px solid rgba(var(--color-primary-rgb,0,169,224),.2)",
                                }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)" }}>Total semana</span>
                                    <span style={{
                                        fontSize: 24, fontWeight: 900, lineHeight: 1,
                                        fontFamily: "var(--font-display,'Bebas Neue',sans-serif)",
                                        color: planTotSem > 0 ? "var(--color-primary)" : "var(--color-muted)",
                                    }}>
                                        {planTotSem > 0 ? planTotSem : "—"}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            ) : (
                <div className="sup-no-plan">⚠️ Días 29–31 — Sin plan para estos días.</div>
            )}

            {/* ══ CARD 2: CUMPLIMIENTO DE LA SEMANA — 4 donuts + tabla ══ */}
            {semana && (() => {
                const pctTot = planTotSem > 0
                    ? Math.min(Math.round(controlesSemana.length / planTotSem * 100), 100)
                    : (controlesSemana.length > 0 ? 100 : 0);
                const totClr = pctTot >= 100 ? "var(--color-success)"
                             : pctTot >= 50  ? "#f59e0b"
                             :                 "var(--color-danger)";
                const pctDia = reqDiurnoSem  > 0 ? Math.min(Math.round(diurnosSem  / reqDiurnoSem  * 100), 100) : (diurnosSem  > 0 ? 100 : 0);
                const pctNoc = reqNocturnoSem > 0 ? Math.min(Math.round(nocturnosSem / reqNocturnoSem * 100), 100) : (nocturnosSem > 0 ? 100 : 0);
                const pctFds = reqFdsSem     > 0 ? Math.min(Math.round(fdsSem       / reqFdsSem     * 100), 100) : (fdsSem       > 0 ? 100 : 0);
                return (
                    <div className="sup-week-banner" style={{
                        gap: 0, padding: 0, overflow: "hidden",
                        flexWrap: "nowrap", alignItems: "stretch",
                    }}>

                        {/* ══ LEFT: título + 2×2 donuts ══ */}
                        <div style={{
                            flex: "0 0 46%", display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center",
                            gap: 10, padding: "16px 14px",
                            borderRight: "1px solid rgba(var(--color-primary-rgb,0,169,224),.2)",
                        }}>
                            <div style={{ alignSelf: "flex-start" }}>
                                <div className="sup-week-label">AVANCE SEMANA {semana}</div>
                                <div style={{ fontSize: 11, color: "var(--color-muted)" }}>Días {WEEK_RANGES[semana]}</div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, justifyItems: "center", width: "100%" }}>
                                <MiniDonut pct={pctTot} color={totClr}   label="Total"  real={controlesSemana.length} plan={planTotSem}     size={68} />
                                <MiniDonut pct={pctDia} color="#d97706"  label="☀️ Día" real={diurnosSem}            plan={reqDiurnoSem}   size={68} />
                                <MiniDonut pct={pctNoc} color="#00a9e0"  label="🌙 Noc" real={nocturnosSem}          plan={reqNocturnoSem} size={68} />
                                <MiniDonut pct={pctFds} color="#8b5cf6"  label="📅 FdS" real={fdsSem}                plan={reqFdsSem}      size={68} />
                            </div>
                        </div>

                        {/* ══ RIGHT: tabla PLAN vs REAL ══ */}
                        <div style={{ flex: 1, minWidth: 0, padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                            {/* Encabezado — mismas anchos que PlanMesRow: icon=22 gap=8 label=flex1 plan=30 div=1 real=30 pct=34 */}
                            <div style={{
                                display: "flex", alignItems: "center", gap: 8,
                                paddingBottom: 6,
                                borderBottom: "2px solid rgba(var(--color-primary-rgb,0,169,224),.2)",
                                marginBottom: 2,
                            }}>
                                <span style={{ width: 22, flexShrink: 0 }} />
                                <span style={{ flex: 1 }} />
                                <span style={{ width: 30, textAlign: "center", fontSize: 9, fontWeight: 700,
                                    color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: ".5px" }}>PLAN</span>
                                <div style={{ width: 1 }} />
                                <span style={{ width: 30, textAlign: "center", fontSize: 9, fontWeight: 700,
                                    color: "var(--color-primary)", textTransform: "uppercase", letterSpacing: ".5px" }}>REAL</span>
                                <span style={{ width: 34 }} />
                            </div>
                            <PlanMesRow icon="☀️" label="Diurnas"       plan={reqDiurnoSem}   real={diurnosSem}   color="#d97706" />
                            <PlanMesRow icon="🌙" label="Nocturnas"     plan={reqNocturnoSem}  real={nocturnosSem} color="var(--color-primary)" />
                            <PlanMesRow icon="📅" label="Fin de semana" plan={reqFdsSem}       real={fdsSem}       color="#8b5cf6" />
                            {/* Total — mismos anchos y tamaños que PlanMesRow para alineación exacta */}
                            <div style={{
                                display: "flex", alignItems: "center", gap: 8,
                                paddingTop: 6, paddingBottom: 0,
                                borderTop: "1px solid rgba(var(--color-primary-rgb,0,169,224),.15)",
                            }}>
                                <span style={{ width: 22, flexShrink: 0 }} />
                                <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: "var(--color-text)" }}>Total</span>
                                <span style={{ width: 30, textAlign: "center", fontSize: 14, fontWeight: 700,
                                    color: planTotSem > 0 ? "var(--color-text)" : "var(--color-muted)" }}>
                                    {planTotSem > 0 ? planTotSem : "—"}
                                </span>
                                <div style={{ width: 1, height: 18, background: "var(--color-border)", flexShrink: 0 }} />
                                <span style={{ width: 30, textAlign: "center", fontSize: 14, fontWeight: 800, color: totClr }}>
                                    {controlesSemana.length}
                                </span>
                                <span style={{ width: 34, textAlign: "right", fontSize: 10, fontWeight: 700, color: totClr, flexShrink: 0 }}>
                                    {planTotSem > 0 ? `${pctTot}%` : ""}
                                </span>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── Detalle por objetivo de la semana (cuando hay plan) ── */}
            {semana && !sinPlanIndivid && objIndivSemana.length > 0 && (
                <div className="sup-card sup-card-week">
                    <div className="sup-card-title">📍 Objetivos semana {semana}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {objIndivSemana.map((o, i) => {
                            const realizadas = getVisitas(o.objetivo);
                            const vvO        = getVisitasDesglosadas(o);
                            const requeridas = vvO.diurnas + vvO.nocturnas + vvO.fds || 1;
                            const turnoEf    = vvO.nocturnas > 0 && vvO.diurnas === 0 ? "nocturno"
                                             : vvO.diurnas  > 0 && vvO.nocturnas === 0 ? "diurno" : "mixto";
                            const done = realizadas >= requeridas;
                            return (
                                <div key={i} className="sup-obj-row">
                                    <div className={`sup-obj-status ${done ? "done" : "pending"}`}>
                                        {done ? "✓" : realizadas > 0 ? "~" : "!"}
                                    </div>
                                    <div className="sup-obj-body">
                                        <div className="sup-obj-name">{o.objetivo}</div>
                                        <div className="sup-obj-meta">
                                            <span className="sup-obj-turno" data-turno={turnoEf}>{TURNO_ICON[turnoEf]}</span>
                                            <span className="sup-obj-count">{realizadas}/{requeridas} visitas</span>
                                            {vvO.diurnas   > 0 && <span style={{ fontSize: 10, color: "#d97706" }}>☀️ {vvO.diurnas} día</span>}
                                            {vvO.nocturnas > 0 && <span style={{ fontSize: 10, color: "var(--color-primary)" }}>🌙 {vvO.nocturnas} noc</span>}
                                            {vvO.fds       > 0 && <span style={{ fontSize: 10, color: "#8b5cf6" }}>📅 {vvO.fds} FdS</span>}
                                        </div>
                                        <ProgressBar value={realizadas} max={requeridas} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ══ PANEL 2: MENSUAL ══ */}
            <div className="sup-card sup-panel sup-card-week">
                <div className="sup-card-title">📆 Mes en curso</div>
                <div className="sup-panel-turnos" style={{ paddingBottom: 4 }}>
                    <TurnoRow icon="☀️" label="Diurnas"
                        realizado={diurnosMes}
                        requerido={reqDiurnoMes}
                        color="#d97706" />
                    <TurnoRow icon="🌙" label="Nocturnas"
                        realizado={nocturnosMes}
                        requerido={reqNocturnoMes}
                        color="var(--color-primary)" />
                    <TurnoRow icon="📅" label="Fin de semana"
                        realizado={fdsMes}
                        requerido={0}
                        color="#8b5cf6" />
                </div>
                {/* ── Tarjetas de semana clickeables ── */}
                <div className="sup-mes-semanas" style={{ marginTop: 12 }}>
                    {[1,2,3,4].map(w => {
                        const ctrlsW  = controlesMes.filter(c => getSemanaDeCtrl(c) === w);
                        const realW   = ctrlsW.length;
                        // Plan por semana W (individual > global)
                        const planDiaW = (ps?.objetivos || []).reduce((s, o) => {
                            const vv   = getVisitasDesglosadas(o);
                            const sems = semanasDePatron(o.patron, o.semanasCustom);
                            return sems.includes(w) ? s + vv.diurnas : s;
                        }, 0);
                        const planNocW = (ps?.objetivos || []).reduce((s, o) => {
                            const vv   = getVisitasDesglosadas(o);
                            const sems = semanasDePatron(o.patron, o.semanasCustom);
                            return sems.includes(w) ? s + vv.nocturnas : s;
                        }, 0);
                        const planFdsW = (ps?.objetivos || []).reduce((s, o) => {
                            const vv    = getVisitasDesglosadas(o);
                            const sems  = semanasDePatron(o.patron, o.semanasCustom);
                            const fdsWs = vv.semanasConFdS?.length ? vv.semanasConFdS : sems;
                            return fdsWs.includes(w) ? s + vv.fds : s;
                        }, 0);
                        const reqW   = !sinPlanIndivid ? (planDiaW + planNocW + planFdsW) : reqGlobalSemana;
                        const pctW   = reqW > 0 ? Math.min(Math.round(realW / reqW * 100), 100) : null;
                        const active = semSeleccionada === w;
                        const pctClr = pctW === null ? "var(--color-muted)"
                                     : pctW >= 80 ? "var(--color-success)"
                                     : pctW > 0   ? "#f59e0b"
                                     :              "var(--color-danger)";
                        return (
                            <div
                                key={w}
                                className={`sup-mes-sem ${w === semana ? "current" : ""} ${active ? "expanded" : ""}`}
                                style={{ cursor: "pointer", transition: "all .18s" }}
                                onClick={() => setSemSeleccionada(active ? null : w)}
                            >
                                <div className="sup-mes-sem-title">Sem {w}{w === semana ? " ★" : ""}</div>
                                <div className="sup-mes-sem-range">{WEEK_RANGES[w]}</div>
                                {pctW !== null ? (
                                    <>
                                        <div className={`sup-mes-sem-pct`} style={{ color: pctClr }}>{pctW}%</div>
                                        <div className="sup-mes-sem-count">{realW}/{reqW}</div>
                                    </>
                                ) : <div className="sup-mes-sem-empty">{realW > 0 ? realW : "—"}</div>}
                                <div style={{ fontSize: 9, marginTop: 2, color: active ? "var(--color-primary)" : "transparent", fontWeight: 700 }}>
                                    ▲ ver detalle
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ── Panel expandible: Plan vs Realizado de la semana seleccionada ── */}
                {semSeleccionada !== null && (() => {
                    const w        = semSeleccionada;
                    const ctrlsW   = controlesMes.filter(c => getSemanaDeCtrl(c) === w);
                    const realDiaW = ctrlsW.filter(c => c.turno !== "nocturno" && !c.esFinDeSemana).length;
                    const realNocW = ctrlsW.filter(c => c.turno === "nocturno"  && !c.esFinDeSemana).length;
                    const realFdsW = ctrlsW.filter(c => c.esFinDeSemana).length;
                    const planDiaW = (ps?.objetivos || []).reduce((s, o) => {
                        const vv = getVisitasDesglosadas(o);
                        return semanasDePatron(o.patron, o.semanasCustom).includes(w) ? s + vv.diurnas : s;
                    }, 0);
                    const planNocW = (ps?.objetivos || []).reduce((s, o) => {
                        const vv = getVisitasDesglosadas(o);
                        return semanasDePatron(o.patron, o.semanasCustom).includes(w) ? s + vv.nocturnas : s;
                    }, 0);
                    const planFdsW = (ps?.objetivos || []).reduce((s, o) => {
                        const vv    = getVisitasDesglosadas(o);
                        const sems  = semanasDePatron(o.patron, o.semanasCustom);
                        const fdsWs = vv.semanasConFdS?.length ? vv.semanasConFdS : sems;
                        return fdsWs.includes(w) ? s + vv.fds : s;
                    }, 0);
                    const planTotW = planDiaW + planNocW + planFdsW;
                    const realTotW = ctrlsW.length;
                    const pctTot   = planTotW > 0 ? Math.min(Math.round(realTotW / planTotW * 100), 100) : null;
                    const totClr   = pctTot === null ? "var(--color-primary)"
                                   : pctTot >= 100   ? "var(--color-success)"
                                   : pctTot >= 50    ? "#f59e0b"
                                   :                   "var(--color-danger)";
                    const hasPlanW = planTotW > 0;
                    return (
                        <div style={{
                            marginTop: 8, padding: "12px 14px",
                            background: "rgba(var(--color-primary-rgb,0,169,224),.06)",
                            border: "1px solid rgba(var(--color-primary-rgb,0,169,224),.35)",
                            borderRadius: "var(--radius-lg)", fontSize: 12,
                        }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                <span style={{ fontWeight: 700, color: "var(--color-primary)", fontSize: 12 }}>
                                    Semana {w} — {WEEK_RANGES[w]} &nbsp;·&nbsp; Plan vs Realizado
                                </span>
                                <button
                                    onClick={() => setSemSeleccionada(null)}
                                    style={{ background: "none", border: "none", cursor: "pointer",
                                        color: "var(--color-muted)", fontSize: 14, lineHeight: 1, padding: "0 2px" }}
                                >✕</button>
                            </div>
                            {/* Encabezado columnas */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 0 4px 28px",
                                borderBottom: "2px solid var(--color-border)" }}>
                                <span style={{ flex: 1 }} />
                                <span style={{ width: 30, textAlign: "center", fontSize: 9, fontWeight: 700,
                                    color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: ".5px" }}>PLAN</span>
                                <div style={{ width: 1 }} />
                                <span style={{ width: 30, textAlign: "center", fontSize: 9, fontWeight: 700,
                                    color: "var(--color-primary)", textTransform: "uppercase", letterSpacing: ".5px" }}>REAL</span>
                                <span style={{ width: 34 }} />
                            </div>
                            <PlanMesRow icon="☀️"  label="Diurnas"       plan={planDiaW} real={realDiaW} color="#d97706" />
                            <PlanMesRow icon="🌙"  label="Nocturnas"     plan={planNocW} real={realNocW} color="var(--color-primary)" />
                            <PlanMesRow icon="📅"  label="Fin de semana" plan={planFdsW} real={realFdsW} color="#8b5cf6" />
                            {/* Total semana */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0 0 28px", marginTop: 2 }}>
                                <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: "var(--color-text)" }}>Total semana</span>
                                <span style={{ width: 30, textAlign: "center", fontSize: 14, fontWeight: 900,
                                    color: hasPlanW ? "var(--color-text)" : "var(--color-muted)" }}>
                                    {hasPlanW ? planTotW : "—"}
                                </span>
                                <div style={{ width: 1, height: 18, background: "var(--color-border)", flexShrink: 0 }} />
                                <span style={{ width: 30, textAlign: "center", fontSize: 14, fontWeight: 900, color: totClr }}>
                                    {realTotW}
                                </span>
                                <span style={{ width: 34, textAlign: "right", fontSize: 11, fontWeight: 800, color: totClr, flexShrink: 0 }}>
                                    {pctTot !== null ? `${pctTot}%` : ""}
                                </span>
                            </div>
                        </div>
                    );
                })()}
                {/* ── 4 mini donuts de la semana seleccionada (o semana actual) ── */}
                {(() => {
                    const wD = semSeleccionada ?? semana;
                    if (!wD) return null;
                    const ctrlsD   = controlesMes.filter(c => getSemanaDeCtrl(c) === wD);
                    const realDiaD = ctrlsD.filter(c => c.turno !== "nocturno" && !c.esFinDeSemana).length;
                    const realNocD = ctrlsD.filter(c => c.turno === "nocturno"  && !c.esFinDeSemana).length;
                    const realFdsD = ctrlsD.filter(c => c.esFinDeSemana).length;
                    const planDiaD = (ps?.objetivos || []).reduce((s, o) => {
                        const vv = getVisitasDesglosadas(o);
                        return semanasDePatron(o.patron, o.semanasCustom).includes(wD) ? s + vv.diurnas : s;
                    }, 0);
                    const planNocD = (ps?.objetivos || []).reduce((s, o) => {
                        const vv = getVisitasDesglosadas(o);
                        return semanasDePatron(o.patron, o.semanasCustom).includes(wD) ? s + vv.nocturnas : s;
                    }, 0);
                    const planFdsD = (ps?.objetivos || []).reduce((s, o) => {
                        const vv    = getVisitasDesglosadas(o);
                        const sems  = semanasDePatron(o.patron, o.semanasCustom);
                        const fdsWs = vv.semanasConFdS?.length ? vv.semanasConFdS : sems;
                        return fdsWs.includes(wD) ? s + vv.fds : s;
                    }, 0);
                    const planTotD = planDiaD + planNocD + planFdsD;
                    const realTotD = ctrlsD.length;
                    const mkPct = (r, p) => p > 0 ? Math.min(Math.round(r / p * 100), 100) : (r > 0 ? 100 : 0);
                    const pTot  = mkPct(realTotD, planTotD);
                    const pDia  = mkPct(realDiaD, planDiaD);
                    const pNoc  = mkPct(realNocD, planNocD);
                    const pFds  = mkPct(realFdsD, planFdsD);
                    const totClrD = pTot >= 100 ? "var(--color-success)" : pTot >= 50 ? "#f59e0b" : "var(--color-danger)";
                    return (
                        <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-muted)",
                                textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, textAlign: "center" }}>
                                Semana {wD}{wD === semana ? " (en curso)" : ""}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, justifyItems: "center" }}>
                                <MiniDonut pct={pTot} color={totClrD}  label="Total"  real={realTotD} plan={planTotD}  size={52} />
                                <MiniDonut pct={pDia} color="#d97706"  label="☀️ Día" real={realDiaD} plan={planDiaD}  size={52} />
                                <MiniDonut pct={pNoc} color="#00a9e0"  label="🌙 Noc" real={realNocD} plan={planNocD}  size={52} />
                                <MiniDonut pct={pFds} color="#8b5cf6"  label="📅 FdS" real={realFdsD} plan={planFdsD}  size={52} />
                            </div>
                        </div>
                    );
                })()}

                {/* Avance del mes */}
                <div style={{ marginTop: 12 }}>
                    <DayProgressBar semana={semana} useMes={true} mesActual={new Date().getMonth()} />
                </div>
            </div>

            {/* ══ PANEL 2b: PLAN DEL MES — Plan asignado vs Realizado ══ */}
            {(() => {
                const hasPlan   = objCumplMes.length > 0;
                const planDia   = hasPlan ? objCumplMes.reduce((s, o) => s + o.reqDia, 0) : reqDiurnoMes;
                const planNoc   = hasPlan ? objCumplMes.reduce((s, o) => s + o.reqNoc, 0) : reqNocturnoMes;
                const planFds   = hasPlan ? objCumplMes.reduce((s, o) => s + o.reqFdS, 0) : 0;
                const planTot   = planDia + planNoc + planFds;
                const totalPct  = planTot > 0 ? Math.min(Math.round(controlesMes.length / planTot * 100), 100) : null;
                const totalClr  = totalPct === null ? "var(--color-primary)"
                                : totalPct >= 100   ? "var(--color-success)"
                                : totalPct >= 50    ? "#f59e0b"
                                :                     "var(--color-danger)";
                return (
                    <div className="sup-card sup-card-week">
                        <div className="sup-card-title">
                            📋 Mi plan — {new Date().toLocaleString("es-AR", { month: "long" })}
                            {hasPlan && (
                                <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 400, color: "var(--color-muted)" }}>
                                    {objCumplMes.length} objetivo{objCumplMes.length !== 1 ? "s" : ""}
                                </span>
                            )}
                        </div>

                        {!hasPlan && (
                            <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 10, fontStyle: "italic" }}>
                                Sin plan mensual configurado — actividad libre del mes:
                            </div>
                        )}

                        {/* ── Encabezado de columnas ── */}
                        <div style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "0 0 5px 30px",
                            borderBottom: "2px solid var(--color-border)",
                        }}>
                            <span style={{ flex: 1 }} />
                            <span style={{ width: 30, textAlign: "center", fontSize: 9, fontWeight: 700,
                                color: "var(--color-muted)", letterSpacing: ".5px", textTransform: "uppercase" }}>
                                PLAN
                            </span>
                            <div style={{ width: 1 }} />
                            <span style={{ width: 30, textAlign: "center", fontSize: 9, fontWeight: 700,
                                color: "var(--color-primary)", letterSpacing: ".5px", textTransform: "uppercase" }}>
                                REAL
                            </span>
                            <span style={{ width: 34 }} />
                        </div>

                        {/* ── Filas por turno ── */}
                        <PlanMesRow icon="☀️"  label="Diurnas"       plan={planDia} real={diurnosMes}   color="#d97706" />
                        <PlanMesRow icon="🌙"  label="Nocturnas"     plan={planNoc} real={nocturnosMes} color="var(--color-primary)" />
                        <PlanMesRow icon="📅"  label="Fin de semana" plan={planFds} real={fdsMes}       color="#8b5cf6" />

                        {/* ── Total ── */}
                        <div style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "8px 0 2px 30px", marginTop: 2,
                        }}>
                            <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: "var(--color-text)" }}>
                                Total del mes
                            </span>
                            <span style={{ width: 30, textAlign: "center", fontSize: 15, fontWeight: 900,
                                color: hasPlan && planTot > 0 ? "var(--color-text)" : "var(--color-muted)" }}>
                                {hasPlan && planTot > 0 ? planTot : "—"}
                            </span>
                            <div style={{ width: 1, height: 18, background: "var(--color-border)", flexShrink: 0 }} />
                            <span style={{ width: 30, textAlign: "center", fontSize: 15, fontWeight: 900, color: totalClr }}>
                                {controlesMes.length}
                            </span>
                            <span style={{ width: 34, textAlign: "right", fontSize: 11, fontWeight: 800,
                                color: totalClr, flexShrink: 0 }}>
                                {totalPct !== null ? `${totalPct}%` : ""}
                            </span>
                        </div>

                        {/* ── Detalle por objetivo (solo con plan) ── */}
                        {hasPlan && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                                {objCumplMes.map((o, i) => {
                                    const col = o.pct >= 100 ? "var(--color-success)"
                                              : o.pct >= 60  ? "#f59e0b"
                                              :                "var(--color-danger)";
                                    return (
                                        <div key={i} style={{
                                            background: "transparent",
                                            border: "1px solid rgba(var(--color-primary-rgb,0,169,224),.15)",
                                            borderLeft: `3px solid ${col}`,
                                            borderRadius: "var(--radius-lg)",
                                            padding: "10px 12px",
                                        }}>
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)", flex: 1, marginRight: 8 }}>
                                                    {o.objetivo}
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                                    <span style={{ fontSize: 13, fontWeight: 900, color: col }}>{o.pct}%</span>
                                                    <span style={{ fontSize: 10, color: "var(--color-muted)" }}>{o.real}/{o.reqTot}</span>
                                                </div>
                                            </div>
                                            <div className="sup-prog-bar" style={{ marginBottom: 6 }}>
                                                <div className="sup-prog-fill" style={{ width: Math.min(o.pct, 100) + "%", background: col }} />
                                            </div>
                                            {(o.reqDia > 0 || o.reqNoc > 0 || o.reqFdS > 0) && (
                                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                                    {o.reqDia > 0 && (() => {
                                                        const c = (o.pctDia ?? 0) >= 100 ? "var(--color-success)" : (o.pctDia ?? 0) >= 50 ? "#f59e0b" : "var(--color-danger)";
                                                        return <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: `${c}18`, color: c, border: `1px solid ${c}44`, fontWeight: 700 }}>☀️ {o.realDia}/{o.reqDia}{o.pctDia !== null ? ` (${o.pctDia}%)` : ""}</span>;
                                                    })()}
                                                    {o.reqNoc > 0 && (() => {
                                                        const c = (o.pctNoc ?? 0) >= 100 ? "var(--color-success)" : (o.pctNoc ?? 0) >= 50 ? "#f59e0b" : "var(--color-danger)";
                                                        return <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: `${c}18`, color: c, border: `1px solid ${c}44`, fontWeight: 700 }}>🌙 {o.realNoc}/{o.reqNoc}{o.pctNoc !== null ? ` (${o.pctNoc}%)` : ""}</span>;
                                                    })()}
                                                    {o.reqFdS > 0 && (() => {
                                                        const c = (o.pctFdS ?? 0) >= 100 ? "var(--color-success)" : (o.pctFdS ?? 0) >= 50 ? "#f59e0b" : "var(--color-danger)";
                                                        return <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: `${c}18`, color: c, border: `1px solid ${c}44`, fontWeight: 700 }}>📅 {o.realFdS}/{o.reqFdS}{o.pctFdS !== null ? ` (${o.pctFdS}%)` : ""}</span>;
                                                    })()}
                                                    <span style={{ fontSize: 10, color: "var(--color-muted)", marginLeft: "auto" }}>{o.semsLabel}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* ══ PANEL 3: CONTRIBUCIÓN AL PLAN ZONAL ══ */}
            <div className="sup-card sup-card-week">
                <div className="sup-card-title">🏆 Mi contribución al plan general</div>

                {/* ── Dos donuts: yo vs zonal ── */}
                <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 14 }}>
                    <div style={{ textAlign: "center", flex: "0 0 auto" }}>
                        <MiniDonut pct={miCumplMes ?? 0} color="var(--color-primary)" size={64}
                            label="MI CUMPL." real={miContribucion} plan={miPlanMes} />
                    </div>
                    <div style={{ textAlign: "center", flex: "0 0 auto" }}>
                        <MiniDonut pct={cumplZonalMes ?? 0} color="#8b5cf6" size={64}
                            label="CUMPL. ZONAL" real={totalEquipo} plan={planZonalMes} />
                    </div>
                    <div style={{ flex: 1, borderLeft: "1px solid rgba(var(--color-primary-rgb,0,169,224),.2)", paddingLeft: 14, display: "flex", flexDirection: "column", gap: 7 }}>
                        {/* Mi aporte del real zonal */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: "var(--color-muted)" }}>Mis controles del equipo</span>
                            <span style={{ fontWeight: 700, color: "var(--color-primary)", fontSize: 12 }}>
                                {miContribucion}/{totalEquipo} <span style={{ fontSize: 10, fontWeight: 400 }}>({pctContrib}%)</span>
                            </span>
                        </div>
                        {/* Mi plan del plan zonal */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: "var(--color-muted)" }}>Mi plan del total zonal</span>
                            <span style={{ fontWeight: 700, color: "#8b5cf6", fontSize: 12 }}>
                                {miPlanMes}/{planZonalMes} <span style={{ fontSize: 10, fontWeight: 400 }}>({miPctDeZonal}%)</span>
                            </span>
                        </div>
                        {/* Supervisores con plan */}
                        {cantSuper > 0 && (
                            <div style={{ fontSize: 10, color: "var(--color-muted)", marginTop: 2 }}>
                                {cantSuper} supervisor{cantSuper !== 1 ? "es" : ""} con plan asignado
                            </div>
                        )}
                        {/* Barra de aporte */}
                        <div className="sup-prog-bar" style={{ marginTop: 2 }}>
                            <div className="sup-prog-fill" style={{
                                width: pctContrib + "%",
                                background: "var(--color-primary)",
                            }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Alertas plan ── */}
            {alertasPlan.length > 0 && (
                <div className="sup-card sup-card-danger">
                    <div className="sup-card-title danger">🔴 Semanas con visitas insuficientes</div>
                    {alertasPlan.map((a, i) => (
                        <div key={i} className="sup-alert-row">
                            <span className="sup-alert-icon">⚠️</span>
                            <div>
                                <div className="sup-alert-obj">{a.objetivo}</div>
                                <div className="sup-alert-sem">Semana {a.semana} · {a.realizadas}/{a.requeridas} visitas</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* El aviso se muestra dentro de cada card cuando no hay plan — no hace falta aquí */}

            {/* ── Alertas vehículos ── */}
            {alertasVehiculos.length > 0 && (
                <div className="sup-card sup-card-warn">
                    <div className="sup-card-title warn">🚗 Services próximos o vencidos</div>
                    {alertasVehiculos.slice(0, 3).map((a, i) => {
                        const dias = a.diasRestantes;
                        const lbl  = dias < 0 ? `Vencido hace ${Math.abs(dias)} días` : dias === 0 ? "Vence hoy" : `Vence en ${dias} días`;
                        return (
                            <div key={i} className="sup-alert-row">
                                <span className="sup-alert-icon">{dias < 0 ? "🔴" : dias <= 7 ? "🟠" : "🟡"}</span>
                                <div>
                                    <div className="sup-alert-obj">{a.vehiculo}</div>
                                    <div className="sup-alert-sem">{a.tipo} · <span style={{ color: dias < 0 ? "var(--color-danger)" : "#d97706", fontWeight: 600 }}>{lbl}</span></div>
                                </div>
                            </div>
                        );
                    })}
                    {alertasVehiculos.length > 3 && (
                        <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 6, textAlign: "center" }}>
                            +{alertasVehiculos.length - 3} alertas más
                        </div>
                    )}
                </div>
            )}

            {/* ── Vista Analista (solo si está habilitado) ── */}
            {analista.esAnalista && (
                <button
                    className="btn btn-secondary"
                    style={{ marginBottom: 8, borderColor: "#c9a227", color: "#7a5c00",
                        background: vistaAnalista ? "#fff8d6" : "transparent" }}
                    onClick={() => setVistaAnalista(v => !v)}
                >
                    📊 {vistaAnalista ? "▲ Cerrar vista analista" : "▼ Vista Analista — " + (analista.zona || "Mi zona")}
                </button>
            )}

            {vistaAnalista && analista.esAnalista && (
                <AnalistaDashboard user={{ ...user, ...analista }} />
            )}

            <button className="btn btn-primary" onClick={onIniciarJornada}>
                {jornadaActiva ? "▶ Continuar Jornada" : "▶ Iniciar Jornada"}
            </button>
        </div>
    );
}
