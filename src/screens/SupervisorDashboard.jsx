// src/screens/SupervisorDashboard.jsx
import { useState, useMemo, useEffect } from "react";
import { useAppData } from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import "../styles/SupervisorDashboard.css";
import AnalistaDashboard from "./AnalistaDashboard";

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
    const color = pct >= 80 ? "var(--color-success)" : pct >= 50 ? "var(--color-primary)" : "var(--color-danger)";
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

function ProgressBar({ value, max }) {
    const pct = max > 0 ? Math.min(value / max, 1) * 100 : 0;
    const clr = pct >= 80 ? "var(--color-success)" : pct >= 50 ? "#f59e0b" : "var(--color-danger)";
    return (
        <div className="sup-prog-bar">
            <div className="sup-prog-fill" style={{ width: pct + "%", background: clr }} />
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
    const [vistaAnalista, setVistaAnalista] = useState(false);
    const [firestoreData, setFirestoreData] = useState(null);

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
    } = useAppData();

    const semana = getSemana();
    const ps     = getPlanSupervisor(user.email) || getPlanSupervisor(user.name);

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
        (planGlobal || []).filter(p => (p.visitasPorSemana || 0) > 0),
        [planGlobal]
    );
    const sinPlanGlobal    = objGlobalSemana.length === 0;
    const reqGlobalSemana  = objGlobalSemana.reduce((s, o) => s + (o.visitasPorSemana || 1), 0);
    const realGlobalSemana = controlesSemana.length;
    const pctGlobalSemana  = reqGlobalSemana > 0 ? Math.min(Math.round(realGlobalSemana / reqGlobalSemana * 100), 100) : 0;
    const reqGlobalMes     = reqGlobalSemana * 4;
    const pctGlobalMes     = reqGlobalMes > 0 ? Math.min(Math.round(controlesMes.length / reqGlobalMes * 100), 100) : 0;

    // ── Plan individual ───────────────────────────────────────────────────────
    const sinPlanIndivid = !ps;

    const objIndivSemana = useMemo(() => {
        if (!ps || !semana) return [];
        return getObjetivosSemana(user.email, semana);
    }, [ps, semana, user.email, getObjetivosSemana]);

    const reqIndivSemana = objIndivSemana.reduce((s, o) => s + (o.visitasPorSemana || 1), 0);
    const pctIndivSemana = reqIndivSemana > 0 ? Math.min(Math.round(realGlobalSemana / reqIndivSemana * 100), 100) : 0;
    const reqIndivMes    = (ps?.objetivos || []).reduce((s, o) =>
        s + semanasDePatron(o.patron, o.semanasCustom).length * (o.visitasPorSemana || 1), 0);
    const pctIndivMes    = reqIndivMes > 0 ? Math.min(Math.round(controlesMes.length / reqIndivMes * 100), 100) : 0;

    // Requeridos por turno según plan individual — semana
    const reqDiurnoSem = !sinPlanIndivid
        ? objIndivSemana.filter(o => (o.turnoEfectivo || ps.turnoBase) === "diurno").reduce((s,o) => s + (o.visitasPorSemana||1), 0)
        : reqGlobalSemana;
    const reqNocturnoSem = !sinPlanIndivid
        ? objIndivSemana.filter(o => (o.turnoEfectivo || ps.turnoBase) === "nocturno").reduce((s,o) => s + (o.visitasPorSemana||1), 0)
        : 0;

    // Requeridos por turno según plan individual — mes
    const reqDiurnoMes = (ps?.objetivos || []).reduce((s, o) => {
        const t = (!o.turno || o.turno === "base") ? (ps?.turnoBase || "mixto") : o.turno;
        return t === "diurno" ? s + semanasDePatron(o.patron, o.semanasCustom).length * (o.visitasPorSemana || 1) : s;
    }, 0);
    const reqNocturnoMes = (ps?.objetivos || []).reduce((s, o) => {
        const t = (!o.turno || o.turno === "base") ? (ps?.turnoBase || "mixto") : o.turno;
        return t === "nocturno" ? s + semanasDePatron(o.patron, o.semanasCustom).length * (o.visitasPorSemana || 1) : s;
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

    // Alertas semanas anteriores — usa plan individual si existe, si no plan global
    const alertasPlan = useMemo(() => {
        if (!semana || semana <= 1) return [];

        // Prioridad: plan individual del supervisor
        const usarIndividual = !sinPlanIndivid && (ps?.objetivos || []).length > 0;
        const objetivosBase  = usarIndividual
            ? (ps?.objetivos || []).filter(o => (o.visitasPorSemana || 0) > 0)
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
                const real      = controlesMes.filter(c =>
                    normObj(c.objetivo) === normObj(o.objetivo) && getSemanaDeCtrl(c) === w
                ).length;
                const requeridas = o.visitasPorSemana || 1;
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

            {/* ══ BANNER SEMANA ══ */}
            {semana ? (
                <div className="sup-week-banner">
                    <div className="sup-week-left">
                        <div className="sup-week-label">SEMANA ACTUAL</div>
                        <div className="sup-week-num">{semana}</div>
                        <div className="sup-week-range">Días {WEEK_RANGES[semana]}</div>
                        <div className="sup-week-circles" style={{ marginTop: 10 }}>
                            {!sinPlanGlobal && (
                                <div className="sup-week-circle-item">
                                    <div className="sup-circle-label">Plan gral.</div>
                                    <CircleProgress pct={pctGlobalSemana} size={54} />
                                    <div className="sup-circle-sub">{realGlobalSemana}/{reqGlobalSemana}</div>
                                </div>
                            )}
                            {!sinPlanIndivid && (
                                <div className="sup-week-circle-item">
                                    <div className="sup-circle-label">Mi plan</div>
                                    <CircleProgress pct={pctIndivSemana} size={54} />
                                    <div className="sup-circle-sub">{realGlobalSemana}/{reqIndivSemana}</div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="sup-week-turnos">
                        <div className="sup-turnos-title">DESGLOSE SEMANA</div>
                        <TurnoRow icon="☀️" label="Diurnas"
                            realizado={diurnosSem}
                            requerido={!sinPlanIndivid ? reqDiurnoSem : reqGlobalSemana}
                            color="#d97706" />
                        <TurnoRow icon="🌙" label="Nocturnas"
                            realizado={nocturnosSem}
                            requerido={!sinPlanIndivid ? reqNocturnoSem : 0}
                            color="var(--color-primary)" />
                        <TurnoRow icon="📅" label="Fin de semana"
                            realizado={fdsSem}
                            requerido={0}
                            color="#8b5cf6" />
                    </div>

                </div>
            ) : (
                <div className="sup-no-plan">⚠️ Días 29–31 — Sin plan para estos días.</div>
            )}

            {/* ══ PANEL 2: MENSUAL ══ */}
            <div className="sup-card sup-panel sup-card-week">
                <div className="sup-card-title">📆 Mes en curso</div>
                <div className="sup-panel-body">
                    <div className="sup-panel-circle">
                        <div className="sup-circle-label">Avance mes</div>
                        <CircleProgress pct={!sinPlanIndivid ? pctIndivMes : pctGlobalMes} size={72} />
                        <div className="sup-circle-sub">
                            {controlesMes.length}/{!sinPlanIndivid ? reqIndivMes : reqGlobalMes}
                        </div>
                    </div>
                    <div className="sup-panel-turnos">
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
                </div>
                {/* Mini semanas */}
                <div className="sup-mes-semanas" style={{ marginTop: 12 }}>
                    {[1,2,3,4].map(w => {
                        const realW = controlesMes.filter(c => getSemanaDeCtrl(c) === w).length;
                        const reqW  = !sinPlanIndivid ? reqIndivSemana : reqGlobalSemana;
                        const pctW  = reqW > 0 ? Math.min(Math.round(realW/reqW*100),100) : null;
                        return (
                            <div key={w} className={`sup-mes-sem ${w === semana ? "current" : ""}`}>
                                <div className="sup-mes-sem-title">Sem {w}{w === semana ? " ★" : ""}</div>
                                <div className="sup-mes-sem-range">{WEEK_RANGES[w]}</div>
                                {pctW !== null ? (
                                    <>
                                        <div className={`sup-mes-sem-pct ${pctW >= 80 ? "green" : pctW > 0 ? "orange" : "red"}`}>{pctW}%</div>
                                        <div className="sup-mes-sem-count">{realW}/{reqW}</div>
                                    </>
                                ) : <div className="sup-mes-sem-empty">—</div>}
                            </div>
                        );
                    })}
                </div>
                {/* Avance del mes */}
                <div style={{ marginTop: 12 }}>
                    <DayProgressBar semana={semana} useMes={true} mesActual={new Date().getMonth()} />
                </div>
            </div>

            {/* ══ PANEL 3: CONTRIBUCIÓN AL PLAN MAESTRO ══ */}
            <div className="sup-card sup-panel sup-card-week">
                <div className="sup-card-title">🏆 Mi contribución al plan general</div>
                <div className="sup-panel-body">
                    <div className="sup-panel-circle">
                        <div className="sup-circle-label">Mi aporte</div>
                        <CircleProgress pct={pctContrib} size={72} />
                        <div className="sup-circle-sub">{miContribucion} de {totalEquipo}</div>
                    </div>
                    <div className="sup-panel-turnos">
                        <div className="sup-panel3-row">
                            <span className="sup-panel3-label">Controles realizados por el equipo</span>
                            <span className="sup-panel3-val blue">{totalEquipo}</span>
                        </div>
                        <div className="sup-panel3-row">
                            <span className="sup-panel3-label">Mis controles</span>
                            <span className="sup-panel3-val" style={{ color: "var(--color-primary)" }}>{miContribucion}</span>
                        </div>
                        <div className="sup-panel3-row">
                            <span className="sup-panel3-label">Cumpl. equipo vs plan</span>
                            <span className={`sup-panel3-val ${pctEquipoMes >= 80 ? "green" : pctEquipoMes >= 50 ? "orange" : "red"}`}>{pctEquipoMes}%</span>
                        </div>
                        <div className="sup-prog-bar" style={{ marginTop: 6 }}>
                            <div className="sup-prog-fill" style={{
                                width: pctContrib + "%",
                                background: pctContrib >= 30 ? "var(--color-success)" : pctContrib >= 15 ? "#f59e0b" : "var(--color-danger)"
                            }} />
                        </div>
                        <div style={{ fontSize: 9, color: "var(--color-muted)", marginTop: 3 }}>
                            Aportaste el {pctContrib}% de los controles del equipo este mes
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

            {/* ── Plan individual esta semana ── */}
            {!sinPlanIndivid && semana && (
                <div className="sup-card">
                    <div className="sup-card-title">
                        👤 Mi plan individual — Semana {semana}
                        <span style={{ marginLeft: 6, fontSize: 10, opacity: .7 }}>
                            {TURNO_ICON[ps.turnoBase || "mixto"]} {ps.turnoBase || "mixto"}
                        </span>
                    </div>
                    {objIndivSemana.length === 0 ? (
                        <div className="sup-empty">Sin objetivos esta semana según el patrón asignado.</div>
                    ) : (
                        objIndivSemana.map((o, i) => {
                            const realizadas = getVisitas(o.objetivo);
                            const requeridas = o.visitasPorSemana || 1;
                            const turnoEf    = o.turnoEfectivo || ps.turnoBase || "mixto";
                            return (
                                <div key={i} className="sup-obj-row">
                                    <div className={`sup-obj-status ${realizadas >= requeridas ? "done" : "pending"}`}>
                                        {realizadas >= requeridas ? "✓" : realizadas > 0 ? "~" : "!"}
                                    </div>
                                    <div className="sup-obj-body">
                                        <div className="sup-obj-name">{o.objetivo}</div>
                                        <div className="sup-obj-meta">
                                            <span className="sup-obj-turno" data-turno={turnoEf}>{TURNO_ICON[turnoEf]}</span>
                                            <span className="sup-obj-count">{realizadas}/{requeridas} visitas</span>
                                        </div>
                                        <ProgressBar value={realizadas} max={requeridas} />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {sinPlanGlobal && sinPlanIndivid && (
                <div className="sup-no-plan">
                    ⚠️ El administrador aún no configuró ningún plan de supervisión.
                    Podés iniciar jornada y registrar actividades libremente.
                </div>
            )}

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
