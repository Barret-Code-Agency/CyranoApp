// src/screens/SupervisorDashboard.jsx
import { useMemo } from "react";
import { useAppData } from "../context/AppDataContext";
import "../styles/SupervisorDashboard.css";

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


// Barra horizontal: fecha de hoy + % avance de la semana por día
function DayProgressBar({ semana }) {
    const hoy      = new Date();
    const fechaFmt = hoy.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });
    const dayInMonth = hoy.getDate();
    const WEEK_RANGES_NUM = { 1:[1,7], 2:[8,14], 3:[15,21], 4:[22,28] };
    const [dIni, dFin] = WEEK_RANGES_NUM[semana] || [1,7];
    const diasHabiles = 5;
    let pasados = 0;
    for (let d = dIni; d <= Math.min(dayInMonth, dFin); d++) {
        const dow = new Date(hoy.getFullYear(), hoy.getMonth(), d).getDay();
        if (dow >= 1 && dow <= 5) pasados++;
    }
    const pct   = Math.round(pasados / diasHabiles * 100);
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
            <div className="sup-day-bar-label">avance de semana</div>
        </div>
    );
}

export default function SupervisorDashboard({ user, onIniciarJornada }) {
    const {
        plan: planGlobal,
        getPlanSupervisor, getObjetivosSemana,
        jornadas,
        getAlertasMantenimiento,
    } = useAppData();

    const semana = getSemana();
    const ps     = getPlanSupervisor(user.email);

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

    const visitasPorObj = useMemo(() => {
        const map = {};
        // Normalizar: trim + lowercase para evitar mismatches
        controlesMes.forEach(c => {
            const key = (c.objetivo || "").trim();
            if (key) map[key] = (map[key] || 0) + 1;
        });
        return map;
    }, [controlesMes]);

    // Helper para buscar visitas normalizando el nombre del objetivo
    const getVisitas = (objName) => {
        const key = (objName || "").trim();
        return map[key] ?? visitasPorObj[key] ?? 0;
    };

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

    // Alertas semanas anteriores
    const alertasPlan = useMemo(() => {
        if (sinPlanGlobal || !semana || semana <= 1) return [];
        const lista = [];
        for (let w = 1; w < semana; w++) {
            objGlobalSemana.forEach(o => {
                const real = controlesMes.filter(c => (c.objetivo||"").trim() === (o.objetivo||"").trim() && getSemanaDeCtrl(c) === w).length;
                if (real < (o.visitasPorSemana || 1))
                    lista.push({ semana: w, objetivo: o.objetivo, realizadas: real, requeridas: o.visitasPorSemana });
            });
        }
        return lista;
    }, [sinPlanGlobal, semana, objGlobalSemana, controlesMes]);


    console.log("=== DEBUG VISITAS ===");
    console.log("controlesMes objetivos:", controlesMes.map(c => c.objetivo));
    console.log("objIndivSemana:", objIndivSemana.map(o => o.objetivo));
    console.log("visitasPorObj:", JSON.stringify(visitasPorObj));

    return (

        <div className="sup-dash">
            <div className="sup-dash-title">Mi Panel</div>
            <div className="sup-dash-sub">{user.name} · {mesNombre()}</div>

            {/* ══ BANNER SEMANA ══ */}
            {semana ? (
                <div className="sup-week-banner">
                    <div className="sup-week-left">
                        <div className="sup-week-label">SEMANA ACTUAL</div>
                        <div className="sup-week-num">{semana}</div>
                        <div className="sup-week-range">Días {WEEK_RANGES[semana]}</div>
                        <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: 10 }}>
                            <div className="sup-week-circles">
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
                            <DayProgressBar semana={semana} />
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

            {/* ── Stats 4 ── */}
            <div className="sup-stats-grid">
                <div className="sup-stat">
                    <div className={`sup-stat-val ${pctGlobalSemana >= 80 ? "green" : "blue"}`}>{pctGlobalSemana}%</div>
                    <div className="sup-stat-label">Plan gral. sem.</div>
                </div>
                <div className="sup-stat">
                    <div className={`sup-stat-val ${pctGlobalMes >= 80 ? "green" : "orange"}`}>{pctGlobalMes}%</div>
                    <div className="sup-stat-label">Plan gral. mes</div>
                </div>
                <div className="sup-stat">
                    <div className={`sup-stat-val ${!sinPlanIndivid && pctIndivSemana >= 80 ? "green" : "blue"}`}>
                        {sinPlanIndivid ? "—" : pctIndivSemana + "%"}
                    </div>
                    <div className="sup-stat-label">Mi plan sem.</div>
                </div>
                <div className="sup-stat">
                    <div className={`sup-stat-val ${!sinPlanIndivid && pctIndivMes >= 80 ? "green" : "orange"}`}>
                        {sinPlanIndivid ? "—" : pctIndivMes + "%"}
                    </div>
                    <div className="sup-stat-label">Mi plan mes</div>
                </div>
            </div>

            {/* ══ AVANCE DEL MES ══ */}
            {!sinPlanGlobal && (
                <div className="sup-card sup-card-week">
                    <div className="sup-card-title">📅 Avance del mes</div>

                    <div className="sup-mes-banner">
                        <div className="sup-mes-circle-wrap">
                            <div className="sup-circle-label" style={{ marginBottom: 4 }}>Total mes</div>
                            <CircleProgress pct={pctGlobalMes} size={70} />
                            <div className="sup-circle-sub">{controlesMes.length}/{reqGlobalMes}</div>
                        </div>

                        <div className="sup-week-turnos" style={{ flex: 1 }}>
                            <div className="sup-turnos-title">DESGLOSE MES</div>
                            <TurnoRow icon="☀️" label="Diurnas"
                                realizado={diurnosMes}
                                requerido={!sinPlanIndivid ? reqDiurnoMes : reqGlobalMes}
                                color="#d97706" />
                            <TurnoRow icon="🌙" label="Nocturnas"
                                realizado={nocturnosMes}
                                requerido={!sinPlanIndivid ? reqNocturnoMes : 0}
                                color="var(--color-primary)" />
                            <TurnoRow icon="📅" label="Fin de semana"
                                realizado={fdsMes}
                                requerido={0}
                                color="#8b5cf6" />
                        </div>
                    </div>

                    <div className="sup-mes-semanas">
                        {[1, 2, 3, 4].map(w => {
                            const realW = controlesMes.filter(c => getSemanaDeCtrl(c) === w).length;
                            const pctW  = reqGlobalSemana > 0 ? Math.min(Math.round(realW / reqGlobalSemana * 100), 100) : null;
                            return (
                                <div key={w} className={`sup-mes-sem ${w === semana ? "current" : ""}`}>
                                    <div className="sup-mes-sem-title">Sem {w}{w === semana ? " ★" : ""}</div>
                                    <div className="sup-mes-sem-range">{WEEK_RANGES[w]}</div>
                                    {pctW !== null ? (
                                        <>
                                            <div className={`sup-mes-sem-pct ${pctW >= 80 ? "green" : pctW > 0 ? "orange" : "red"}`}>{pctW}%</div>
                                            <div className="sup-mes-sem-count">{realW}/{reqGlobalSemana}</div>
                                        </>
                                    ) : (
                                        <div className="sup-mes-sem-empty">—</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

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
                            const realizadas = visitasPorObj[(o.objetivo||"").trim()] || 0;
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

            <button className="btn btn-primary" onClick={onIniciarJornada}>
                ▶ Iniciar Jornada
            </button>
        </div>
    );
}
