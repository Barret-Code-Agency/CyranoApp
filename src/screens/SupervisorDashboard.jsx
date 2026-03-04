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
    return [];
};

const mesNombre = () =>
    new Date().toLocaleString("es-AR", { month: "long", year: "numeric" });

// ── Círculo de progreso ───────────────────────────────────────────────────────
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

// ── Barra de progreso ─────────────────────────────────────────────────────────
function ProgressBar({ value, max, color }) {
    const pct = max > 0 ? Math.min(value / max, 1) * 100 : 0;
    const clr = color || (pct >= 80 ? "var(--color-success)" : pct >= 50 ? "#f59e0b" : "var(--color-danger)");
    return (
        <div className="sup-prog-bar">
            <div className="sup-prog-fill" style={{ width: pct + "%", background: clr }} />
        </div>
    );
}

export default function SupervisorDashboard({ user, onIniciarJornada }) {
    const { getPlanSupervisor, getObjetivosSemana, jornadas, plan: planGeneral, getAlertasMantenimiento, mantenimiento } = useAppData();

    const semana = getSemana();
    const ps     = getPlanSupervisor(user.email);

    // ── Controles del supervisor este mes ─────────────────────────────────────
    const mesInicio = useMemo(() => {
        const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d;
    }, []);

    const alertasVehiculos = getAlertasMantenimiento();

    const jornadasMes = useMemo(() =>
        jornadas.filter(j => j.email === user.email && new Date(j.creadaEn || 0) >= mesInicio),
        [jornadas, user.email, mesInicio]
    );

    const controlesMes = useMemo(() =>
        jornadasMes.flatMap(j => (j.actividades || []).filter(a => a.tipo === "ctrl")),
        [jornadasMes]
    );

    const getSemanaDeCtrl = (c) => getSemana(new Date(c.iniciadaEn || 0));

    // ── Cumplimiento PERSONAL ─────────────────────────────────────────────────
    const cumplPersonal = useMemo(() => {
        if (!ps) return { semana: null, mes: null };

        // Por semana: objetivos activos esta semana × visitas requeridas
        const objSemana = semana ? getObjetivosSemana(user.email, semana) : [];
        const reqSemana = objSemana.reduce((s, o) => s + (o.visitasPorSemana || 1), 0);
        const realSemana = controlesMes.filter(c => getSemanaDeCtrl(c) === semana).length;

        // Por mes: suma de todos los objetivos activos × semanas × visitas
        const reqMes = (ps.objetivos || []).reduce((s, o) =>
            s + semanasDePatron(o.patron, o.semanasCustom).length * (o.visitasPorSemana || 1), 0);
        const realMes = controlesMes.length;

        return {
            semana: {
                requeridas: reqSemana,
                realizadas: realSemana,
                pct: reqSemana > 0 ? Math.min(Math.round(realSemana / reqSemana * 100), 100) : 0,
                objetivos: objSemana,
            },
            mes: {
                requeridas: reqMes,
                realizadas: realMes,
                pct: reqMes > 0 ? Math.min(Math.round(realMes / reqMes * 100), 100) : 0,
            },
        };
    }, [ps, semana, controlesMes, user.email, getObjetivosSemana]);

    // ── Cumplimiento PLAN GENERAL (todos los supervisores) ───────────────────
    const cumplGeneral = useMemo(() => {
        if (!planGeneral || planGeneral.length === 0) return null;

        const todosControlesMes = jornadas
            .filter(j => new Date(j.creadaEn || 0) >= mesInicio)
            .flatMap(j => (j.actividades || []).filter(a => a.tipo === "ctrl"));

        // Por semana actual
        const ctrlSemana = todosControlesMes.filter(c => getSemana(new Date(c.iniciadaEn || 0)) === semana);

        // Cumplimiento por objetivo del plan general
        const porObjetivo = planGeneral.map(p => {
            const visitas = todosControlesMes.filter(c => c.objetivo === p.objetivo).length;
            const req     = (p.visitasPorSemana || 1) * 4; // aprox mensual
            return { ...p, visitas, pct: Math.min(Math.round(visitas / req * 100), 100) };
        });

        const pctGenMes = porObjetivo.length > 0
            ? Math.round(porObjetivo.reduce((s, p) => s + p.pct, 0) / porObjetivo.length)
            : 0;

        // Semana
        const reqGenSemana = planGeneral.reduce((s, p) => s + (p.visitasPorSemana || 1), 0);
        const pctGenSemana = reqGenSemana > 0
            ? Math.min(Math.round(ctrlSemana.length / reqGenSemana * 100), 100) : 0;

        return { pctMes: pctGenMes, pctSemana: pctGenSemana, porObjetivo };
    }, [planGeneral, jornadas, mesInicio, semana]);

    // ── Alertas: semanas pasadas con incumplimiento ───────────────────────────
    const alertas = useMemo(() => {
        if (!ps || !semana || semana <= 1) return [];
        const lista = [];
        for (let w = 1; w < semana; w++) {
            const objW = getObjetivosSemana(user.email, w);
            objW.forEach(o => {
                const realizadas = controlesMes.filter(c => c.objetivo === o.objetivo && getSemanaDeCtrl(c) === w).length;
                const requeridas = o.visitasPorSemana || 1;
                if (realizadas < requeridas) {
                    lista.push({ semana: w, objetivo: o.objetivo, realizadas, requeridas });
                }
            });
        }
        return lista;
    }, [ps, semana, controlesMes, user.email, getObjetivosSemana]);

    const sinPlan = !ps;

    return (
        <div className="sup-dash">
            <div className="sup-dash-title">Mi Plan</div>
            <div className="sup-dash-sub">{user.name} · {mesNombre()}</div>

            {sinPlan ? (
                <div className="sup-no-plan">
                    ⚠️ El administrador aún no configuró tu plan de supervisión.
                    Podés iniciar jornada y registrar actividades libremente.
                </div>
            ) : (
                <>
                    {/* ── Semana actual + cumplimiento personal ── */}
                    {semana ? (
                        <div className="sup-week-banner">
                            <div className="sup-week-left">
                                <div className="sup-week-label">SEMANA ACTUAL</div>
                                <div className="sup-week-num">{semana}</div>
                                <div className="sup-week-range">Días {WEEK_RANGES[semana]}</div>
                                <div className="sup-turno-badge" data-turno={ps.turnoBase || "mixto"}>
                                    {TURNO_ICON[ps.turnoBase || "mixto"]} {ps.turnoBase || "Mixto"}
                                </div>
                            </div>
                            <div className="sup-week-right">
                                <div className="sup-circle-label">Personal</div>
                                <CircleProgress pct={cumplPersonal.semana?.pct || 0} size={70} />
                                <div className="sup-circle-sub">
                                    {cumplPersonal.semana?.realizadas || 0}/{cumplPersonal.semana?.requeridas || 0} visitas
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="sup-no-plan">⚠️ Días 29–31 — Sin plan asignado esta semana.</div>
                    )}

                    {/* ── Stats 4 ── */}
                    <div className="sup-stats-grid">
                        <div className="sup-stat">
                            <div className={`sup-stat-val ${(cumplPersonal.semana?.pct || 0) >= 80 ? "green" : "blue"}`}>
                                {cumplPersonal.semana?.pct || 0}%
                            </div>
                            <div className="sup-stat-label">Mi cumpl. semana</div>
                        </div>
                        <div className="sup-stat">
                            <div className={`sup-stat-val ${(cumplPersonal.mes?.pct || 0) >= 80 ? "green" : "orange"}`}>
                                {cumplPersonal.mes?.pct || 0}%
                            </div>
                            <div className="sup-stat-label">Mi cumpl. mes</div>
                        </div>
                        <div className="sup-stat">
                            <div className={`sup-stat-val ${(cumplGeneral?.pctSemana || 0) >= 80 ? "green" : "blue"}`}>
                                {cumplGeneral?.pctSemana || 0}%
                            </div>
                            <div className="sup-stat-label">Plan gral. semana</div>
                        </div>
                        <div className="sup-stat">
                            <div className={`sup-stat-val ${(cumplGeneral?.pctMes || 0) >= 80 ? "green" : "orange"}`}>
                                {cumplGeneral?.pctMes || 0}%
                            </div>
                            <div className="sup-stat-label">Plan gral. mes</div>
                        </div>
                    </div>

                    {/* ── Alertas ── */}
                    {alertas.length > 0 && (
                        <div className="sup-card sup-card-danger">
                            <div className="sup-card-title danger">🔴 Objetivos con visitas insuficientes</div>
                            {alertas.map((a, i) => (
                                <div key={i} className="sup-alert-row">
                                    <span className="sup-alert-icon">⚠️</span>
                                    <div>
                                        <div className="sup-alert-obj">{a.objetivo}</div>
                                        <div className="sup-alert-sem">
                                            Semana {a.semana} (días {WEEK_RANGES[a.semana]}) — {a.realizadas}/{a.requeridas} visitas realizadas
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Mis objetivos esta semana ── */}
                    {semana && (
                        <div className="sup-card">
                            <div className="sup-card-title">
                                Mis objetivos — Semana {semana}
                            </div>
                            {(cumplPersonal.semana?.objetivos || []).length === 0 ? (
                                <div className="sup-empty">Sin objetivos asignados esta semana.</div>
                            ) : (
                                (cumplPersonal.semana?.objetivos || []).map((o, i) => {
                                    const realizadas = controlesMes.filter(c => c.objetivo === o.objetivo && getSemanaDeCtrl(c) === semana).length;
                                    const requeridas = o.visitasPorSemana || 1;
                                    const pct = Math.min(realizadas / requeridas, 1);
                                    const turnoEf = o.turnoEfectivo || ps.turnoBase || "mixto";
                                    return (
                                        <div key={i} className="sup-obj-row">
                                            <div className={`sup-obj-status ${realizadas >= requeridas ? "done" : "pending"}`}>
                                                {realizadas >= requeridas ? "✓" : realizadas > 0 ? "~" : "!"}
                                            </div>
                                            <div className="sup-obj-body">
                                                <div className="sup-obj-name">{o.objetivo}</div>
                                                <div className="sup-obj-meta">
                                                    <span className="sup-obj-turno" data-turno={turnoEf}>
                                                        {TURNO_ICON[turnoEf]}
                                                    </span>
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

                    {/* ── Cumplimiento mensual personal ── */}
                    <div className="sup-card">
                        <div className="sup-card-title">Mi cumplimiento mensual</div>
                        <div className="sup-mes-summary">
                            <CircleProgress pct={cumplPersonal.mes?.pct || 0} size={80} />
                            <div className="sup-mes-detail">
                                <div className="sup-mes-line">
                                    <span>Visitas realizadas</span>
                                    <strong>{cumplPersonal.mes?.realizadas || 0}</strong>
                                </div>
                                <div className="sup-mes-line">
                                    <span>Visitas requeridas</span>
                                    <strong>{cumplPersonal.mes?.requeridas || 0}</strong>
                                </div>
                                <div className="sup-mes-line">
                                    <span>Objetivos en plan</span>
                                    <strong>{ps?.objetivos?.length || 0}</strong>
                                </div>
                            </div>
                        </div>
                        {/* Por semana */}
                        <div className="sup-mes-semanas">
                            {[1, 2, 3, 4].map(w => {
                                const objW    = getObjetivosSemana(user.email, w);
                                const reqW    = objW.reduce((s, o) => s + (o.visitasPorSemana || 1), 0);
                                const realW   = controlesMes.filter(c => getSemanaDeCtrl(c) === w).length;
                                const pctW    = reqW > 0 ? Math.min(Math.round(realW / reqW * 100), 100) : null;
                                const isCurr  = w === semana;
                                return (
                                    <div key={w} className={`sup-mes-sem ${isCurr ? "current" : ""}`}>
                                        <div className="sup-mes-sem-title">
                                            Sem {w}{isCurr ? " ★" : ""}
                                        </div>
                                        <div className="sup-mes-sem-range">{WEEK_RANGES[w]}</div>
                                        {reqW > 0 ? (
                                            <>
                                                <div className={`sup-mes-sem-pct ${pctW >= 80 ? "green" : pctW > 0 ? "orange" : "red"}`}>
                                                    {pctW}%
                                                </div>
                                                <div className="sup-mes-sem-count">{realW}/{reqW}</div>
                                            </>
                                        ) : (
                                            <div className="sup-mes-sem-empty">Sin plan</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Cumplimiento plan general ── */}
                    {cumplGeneral && (
                        <div className="sup-card">
                            <div className="sup-card-title">Cumplimiento plan general</div>
                            <div className="sup-gral-summary">
                                <div className="sup-gral-item">
                                    <CircleProgress pct={cumplGeneral.pctSemana} size={60} />
                                    <div className="sup-gral-label">Semana {semana || "—"}</div>
                                </div>
                                <div className="sup-gral-item">
                                    <CircleProgress pct={cumplGeneral.pctMes} size={60} />
                                    <div className="sup-gral-label">Mes completo</div>
                                </div>
                            </div>
                            <div className="sup-gral-objs">
                                {(cumplGeneral.porObjetivo || []).slice(0, 8).map((p, i) => (
                                    <div key={i} className="sup-gral-obj-row">
                                        <span className="sup-gral-obj-name" title={p.objetivo}>
                                            {p.objetivo.split("—").slice(-1)[0].trim()}
                                        </span>
                                        <ProgressBar value={p.visitas} max={Math.max((p.visitasPorSemana || 1) * 4, 1)} />
                                        <span className={`sup-gral-obj-pct ${p.pct >= 80 ? "green" : p.pct >= 50 ? "orange" : "red"}`}>
                                            {p.pct}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ── Alertas de vehículos ── */}
            {alertasVehiculos.length > 0 && (
                <div className="sup-card sup-card-warn">
                    <div className="sup-card-title warn">🚗 Services próximos o vencidos</div>
                    {alertasVehiculos.slice(0, 3).map((a, i) => {
                        const dias = a.diasRestantes;
                        const cls  = dias < 0 ? "vencido" : dias <= 7 ? "urgente" : "proximo";
                        const lbl  = dias < 0 ? `Vencido hace ${Math.abs(dias)} días` : dias === 0 ? "Vence hoy" : `Vence en ${dias} días`;
                        return (
                            <div key={i} className="sup-alert-row">
                                <span className="sup-alert-icon">{dias < 0 ? "🔴" : dias <= 7 ? "🟠" : "🟡"}</span>
                                <div>
                                    <div className="sup-alert-obj">{a.vehiculo}</div>
                                    <div className="sup-alert-sem">{a.tipo} · <span style={{color: dias < 0 ? "var(--color-danger)" : "#d97706", fontWeight:600}}>{lbl}</span></div>
                                </div>
                            </div>
                        );
                    })}
                    {alertasVehiculos.length > 3 && (
                        <div style={{fontSize:11, color:"var(--color-muted)", marginTop:6, textAlign:"center"}}>
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