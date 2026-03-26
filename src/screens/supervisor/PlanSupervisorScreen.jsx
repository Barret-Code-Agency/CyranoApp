// src/screens/PlanSupervisorScreen.jsx
import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useAppData } from "../../context/AppDataContext";
import "./PlanSupervisorScreen.css";

/** Returns array of working day numbers (1-31) for current month for a 14x14 worker.
 *  grupo: "A" or "B", diagramas: array of { grupo, francos: ["YYYY-MM-DD", ...] } docs */
function getDiasTrabajoMes(grupo, diagramas) {
    if (!grupo || !diagramas?.length) return [];
    const hoy     = new Date();
    const anio    = hoy.getFullYear();
    const mes     = hoy.getMonth(); // 0-based
    const diasMes = new Date(anio, mes + 1, 0).getDate();

    // Collect franco dates for this grupo
    const francos = new Set();
    diagramas
        .filter(d => d.grupo === grupo)
        .forEach(d => (d.francos || []).forEach(f => francos.add(f)));

    // Days of current month that are NOT franco
    const dias = [];
    for (let d = 1; d <= diasMes; d++) {
        const key = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        if (!francos.has(key)) dias.push(d);
    }
    return dias;
}

const WEEK_RANGES  = { 1: "1–7", 2: "8–14", 3: "15–21", 4: "22–28" };
const TURNOS       = ["diurno", "nocturno", "mixto"];
const TURNO_ICON   = { diurno: "☀️", nocturno: "🌙", mixto: "🔄", base: "↑" };
const TURNO_LABEL  = { diurno: "Diurno", nocturno: "Nocturno", mixto: "Mixto" };
const PATRON_LABEL = { todas: "Todas (1,2,3,4)", impares: "Impares (1 y 3)", pares: "Pares (2 y 4)", custom: "Personalizado" };

/** Compatibilidad hacia atrás: extrae diurnas/nocturnas/fds desde un objetivo del plan */
export function getVisitasDesglosadas(obj) {
    if (obj.visitasDiurnas !== undefined || obj.visitasNocturnas !== undefined) {
        return {
            diurnas:      obj.visitasDiurnas   ?? 0,
            nocturnas:    obj.visitasNocturnas  ?? 0,
            fds:          obj.visitasFdS        ?? 0,
            semanasConFdS: obj.semanasConFdS    ?? [],
        };
    }
    // Modelo viejo: inferir desde turno + visitasPorSemana
    const total = obj.visitasPorSemana || 1;
    const turno = obj.turno || "diurno";
    if (turno === "nocturno") return { diurnas: 0, nocturnas: total, fds: 0, semanasConFdS: [] };
    if (turno === "mixto")    return { diurnas: Math.ceil(total/2), nocturnas: Math.floor(total/2), fds: 0, semanasConFdS: [] };
    return { diurnas: total, nocturnas: 0, fds: 0, semanasConFdS: [] };
}

const getSemanaActual = () => {
    const d = new Date().getDate();
    if (d <= 7)  return 1;
    if (d <= 14) return 2;
    if (d <= 21) return 3;
    if (d <= 28) return 4;
    return null;
};

const mesNombre = () =>
    new Date().toLocaleString("es-AR", { month: "long", year: "numeric" });

const semanasDePatron = (patron, custom) => {
    if (patron === "todas")   return [1, 2, 3, 4];
    if (patron === "impares") return [1, 3];
    if (patron === "pares")   return [2, 4];
    if (patron === "custom")  return custom || [];
    return [];
};

// ── Fila de objetivo expandible ───────────────────────────────────────────────
function ObjetivoRow({ obj, onChange, onRemove }) {
    const [expanded, setExpanded] = useState(false);

    const v            = getVisitasDesglosadas(obj);
    const { diurnas, nocturnas, fds } = v;
    const semasConFdS  = v.semanasConFdS;
    const semanasActivas = semanasDePatron(obj.patron, obj.semanasCustom);
    const totalMes = semanasActivas.length * (diurnas + nocturnas)
                   + (semasConFdS.length || semanasActivas.length) * fds;

    const toggleSemanaCustom = (w) => {
        const cur = obj.semanasCustom || [];
        const next = cur.includes(w) ? cur.filter(x => x !== w) : [...cur, w].sort();
        onChange({ ...obj, semanasCustom: next });
    };
    const toggleSemanaFdS = (w) => {
        const cur = obj.semanasConFdS || [];
        const next = cur.includes(w) ? cur.filter(x => x !== w) : [...cur, w].sort();
        onChange({ ...obj, semanasConFdS: next });
    };

    return (
        <div className={`ps-obj-row ${expanded ? "expanded" : ""}`}>
            <div className="ps-obj-header" onClick={() => setExpanded(e => !e)}>
                <div className="ps-obj-name">
                    <span className="ps-obj-name-main">{obj.objetivo.split("—")[0].trim()}</span>
                    {obj.objetivo.includes("—") && (
                        <span className="ps-obj-name-sub"> — {obj.objetivo.split("—").slice(1).join("—").trim()}</span>
                    )}
                </div>
                <div className="ps-obj-badges">
                    {diurnas > 0   && <span className="ps-badge ps-badge-turno turno-diurno">☀️ {diurnas}×</span>}
                    {nocturnas > 0 && <span className="ps-badge ps-badge-turno turno-nocturno">🌙 {nocturnas}×</span>}
                    {fds > 0       && <span className="ps-badge ps-badge-turno" style={{ background: "rgba(236,72,153,0.12)", color: "#9d174d" }}>📅 {fds} FdS</span>}
                    <span className="ps-badge ps-badge-patron">
                        {obj.patron === "custom"
                            ? `Sem ${semanasActivas.join(",")}`
                            : PATRON_LABEL[obj.patron]}
                    </span>
                </div>
                <div className="ps-obj-actions">
                    <button className="ps-obj-expand-btn" onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}>
                        {expanded ? "▲" : "▼"}
                    </button>
                    <button className="ps-obj-remove-btn" onClick={e => { e.stopPropagation(); onRemove(); }}>✕</button>
                </div>
            </div>

            {expanded && (
                <div className="ps-obj-detail">
                    {/* ── Visitas diurnas ── */}
                    <div className="ps-detail-row">
                        <label className="ps-detail-label">☀️ Visitas diurnas por semana activa</label>
                        <div className="ps-visitas-ctrl">
                            <button onClick={() => onChange({ ...obj, visitasDiurnas: Math.max(0, diurnas - 1) })}>−</button>
                            <span className="ps-visitas-num">{diurnas}</span>
                            <button onClick={() => onChange({ ...obj, visitasDiurnas: diurnas + 1 })}>+</button>
                        </div>
                    </div>

                    {/* ── Visitas nocturnas ── */}
                    <div className="ps-detail-row">
                        <label className="ps-detail-label">🌙 Visitas nocturnas por semana activa</label>
                        <div className="ps-visitas-ctrl">
                            <button onClick={() => onChange({ ...obj, visitasNocturnas: Math.max(0, nocturnas - 1) })}>−</button>
                            <span className="ps-visitas-num">{nocturnas}</span>
                            <button onClick={() => onChange({ ...obj, visitasNocturnas: nocturnas + 1 })}>+</button>
                        </div>
                    </div>

                    {/* ── Visitas fin de semana ── */}
                    <div className="ps-detail-row">
                        <label className="ps-detail-label">📅 Visitas fin de semana por mes</label>
                        <div className="ps-visitas-ctrl">
                            <button onClick={() => onChange({ ...obj, visitasFdS: Math.max(0, fds - 1) })}>−</button>
                            <span className="ps-visitas-num">{fds}</span>
                            <button onClick={() => onChange({ ...obj, visitasFdS: fds + 1 })}>+</button>
                        </div>
                    </div>

                    {/* ── Semanas con FdS (solo si fds > 0) ── */}
                    {fds > 0 && (
                        <div className="ps-detail-row">
                            <label className="ps-detail-label">Semanas que incluyen FdS <span style={{ fontWeight: 400, color: "var(--color-muted)" }}>(vacío = todas las activas)</span></label>
                            <div className="ps-semanas-check">
                                {[1, 2, 3, 4].map(w => (
                                    <button
                                        key={w}
                                        className={`ps-sem-btn ${semasConFdS.includes(w) ? "active" : ""}`}
                                        onClick={() => toggleSemanaFdS(w)}
                                    >
                                        <div className="ps-sem-num">Sem {w}</div>
                                        <div className="ps-sem-range">{WEEK_RANGES[w]}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Patrón de semanas ── */}
                    <div className="ps-detail-row">
                        <label className="ps-detail-label">Patrón de semanas activas</label>
                        <div className="ps-patron-opts">
                            {Object.entries(PATRON_LABEL).map(([k, vv]) => (
                                <button
                                    key={k}
                                    className={`ps-patron-btn ${obj.patron === k ? "active" : ""}`}
                                    onClick={() => onChange({ ...obj, patron: k })}
                                >
                                    {vv}
                                </button>
                            ))}
                        </div>
                    </div>

                    {obj.patron === "custom" && (
                        <div className="ps-detail-row">
                            <label className="ps-detail-label">Semanas activas</label>
                            <div className="ps-semanas-check">
                                {[1, 2, 3, 4].map(w => (
                                    <button
                                        key={w}
                                        className={`ps-sem-btn ${(obj.semanasCustom || []).includes(w) ? "active" : ""}`}
                                        onClick={() => toggleSemanaCustom(w)}
                                    >
                                        <div className="ps-sem-num">Sem {w}</div>
                                        <div className="ps-sem-range">{WEEK_RANGES[w]}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="ps-semanas-preview">
                        {semanasActivas.length === 0
                            ? <span style={{ color: "var(--color-danger)" }}>Ninguna semana seleccionada</span>
                            : <>
                                {diurnas > 0   && <span>☀️ {diurnas}×{semanasActivas.length}={diurnas * semanasActivas.length}</span>}
                                {nocturnas > 0 && <span> · 🌙 {nocturnas}×{semanasActivas.length}={nocturnas * semanasActivas.length}</span>}
                                {fds > 0       && <span> · 📅 {fds}×{semasConFdS.length || semanasActivas.length}={fds * (semasConFdS.length || semanasActivas.length)}</span>}
                                <strong> · Total: {totalMes} visitas/mes</strong>
                            </>
                        }
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Editor ────────────────────────────────────────────────────────────────────
function EditorSupervisor({ sup, onBack, onSaved, legajoMap = {}, diagramas14 = [] }) {
    const { data, getPlanSupervisor, savePlanSupervisor, jornadas } = useAppData();

    const planActual = getPlanSupervisor(sup.email || sup.nombre) || { nombre: sup.nombre, turnoBase: "mixto", objetivos: [] };

    const [turnoBase, setTurnoBase] = useState(planActual.turnoBase || "mixto");
    const [objetivos, setObjetivos] = useState(planActual.objetivos || []);
    const [saved,     setSaved]     = useState(false);
    const [showAdd,   setShowAdd]   = useState(false);
    const [objToAdd,  setObjToAdd]  = useState("");

    const semanaActual = getSemanaActual();

    const mesInicio = new Date(); mesInicio.setDate(1); mesInicio.setHours(0,0,0,0);
    const controlesDelMes = jornadas
        .filter(j => j.email === sup.email && new Date(j.creadaEn || 0) >= mesInicio)
        .flatMap(j => (j.actividades || []).filter(a => a.tipo === "ctrl"));

    const visitasPorObj = {};
    controlesDelMes.forEach(c => { visitasPorObj[c.objetivo] = (visitasPorObj[c.objetivo] || 0) + 1; });

    const totalRequeridas = objetivos.reduce((s, o) => {
        const v = getVisitasDesglosadas(o);
        const sems = semanasDePatron(o.patron, o.semanasCustom);
        const fdsWeeks = v.semanasConFdS.length || sems.length;
        return s + sems.length * (v.diurnas + v.nocturnas) + fdsWeeks * v.fds;
    }, 0);

    const updateObj = (idx, v) => { setSaved(false); setObjetivos(p => p.map((o, i) => i === idx ? v : o)); };
    const removeObj = (idx)    => { setSaved(false); setObjetivos(p => p.filter((_, i) => i !== idx)); };

    const addObj = () => {
        if (!objToAdd || objetivos.some(o => o.objetivo === objToAdd)) return;
        setObjetivos(p => [...p, {
            objetivo: objToAdd,
            visitasDiurnas: 1, visitasNocturnas: 0, visitasFdS: 0,
            semanasConFdS: [], patron: "todas", semanasCustom: [],
        }]);
        setObjToAdd(""); setShowAdd(false); setSaved(false);
    };

    const handleSave = () => {
        const payload = { nombre: sup.nombre, turnoBase, objetivos };
        // Guardar siempre bajo el email si existe (para que SupervisorDashboard lo encuentre)
        if (sup.email) savePlanSupervisor(sup.email, payload);
        // También bajo el nombre (compatibilidad con planes viejos)
        if (sup.nombre) savePlanSupervisor(sup.nombre, payload);
        setSaved(true);
        setTimeout(onSaved, 700);
    };

    const objetivosDisponibles = data.objetivos.filter(o => !objetivos.some(p => p.objetivo === o));

    return (
        <div className="ps-editor">
            <div className="ps-back" onClick={onBack}>← Volver</div>

            <div className="ps-editor-header">
                <div className="ps-editor-avatar">{sup.nombre[0]}</div>
                <div className="ps-editor-info">
                    <div className="ps-editor-name">{sup.nombre}</div>
                    <div className="ps-editor-email">{sup.email}</div>
                    {(() => {
                        const legajo = legajoMap[sup.nombre.toUpperCase()];
                        const es14x14 = legajo && (legajo.regimen === "14 x 14 x 8" || legajo.regimen === "14 x 14 x 12");
                        const dias = es14x14 ? getDiasTrabajoMes(legajo.grupoTurno14, diagramas14) : [];
                        return es14x14 && dias.length > 0 ? (
                            <div style={{ fontSize: "0.7rem", color: "var(--color-muted)", marginTop: 3, lineHeight: 1.4 }}>
                                📅 Días de trabajo: <strong>{dias.join(", ")}</strong>
                            </div>
                        ) : null;
                    })()}
                </div>
                <div className="ps-editor-mes">{mesNombre()}</div>
            </div>

            {/* Turno base */}
            <div className="ps-section-card">
                <div className="ps-section-title">Turno base del supervisor</div>
                <p className="ps-section-hint">Se aplica a todos los objetivos salvo que se sobreescriba individualmente.</p>
                <div className="ps-turno-base-opts">
                    {TURNOS.map(t => (
                        <button
                            key={t}
                            className={`ps-turno-base-btn ${turnoBase === t ? "active" : ""} turno-${t}`}
                            onClick={() => { setTurnoBase(t); setSaved(false); }}
                        >
                            {TURNO_ICON[t]} {TURNO_LABEL[t]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Resumen */}
            <div className="ps-resumen">
                {[
                    { val: objetivos.length, label: "Objetivos", cls: "" },
                    { val: totalRequeridas,  label: "Visitas req./mes", cls: "blue" },
                    { val: controlesDelMes.length, label: "Realizadas", cls: controlesDelMes.length >= totalRequeridas ? "green" : "orange" },
                    { val: totalRequeridas > 0 ? Math.round(controlesDelMes.length / totalRequeridas * 100) + "%" : "—", label: "Cumplimiento", cls: totalRequeridas > 0 && controlesDelMes.length / totalRequeridas >= 0.8 ? "green" : "orange" },
                ].map((s, i) => (
                    <div key={i} className="ps-resumen-item">
                        <div className={`ps-resumen-val ${s.cls}`}>{s.val}</div>
                        <div className="ps-resumen-label">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Objetivos */}
            <div className="ps-section-card">
                <div className="ps-section-title">
                    Objetivos asignados
                    <span className="ps-count">{objetivos.length}</span>
                </div>

                {objetivos.length === 0 ? (
                    <div className="ps-empty">Sin objetivos. Agregá uno abajo.</div>
                ) : (
                    <div className="ps-obj-list">
                        {objetivos.map((obj, idx) => {
                            const realizadas  = visitasPorObj[obj.objetivo] || 0;
                            const sems        = semanasDePatron(obj.patron, obj.semanasCustom);
                            const vvR         = getVisitasDesglosadas(obj);
                            const fdsWR       = vvR.semanasConFdS.length || sems.length;
                            const requeridas  = sems.length * (vvR.diurnas + vvR.nocturnas) + fdsWR * vvR.fds;
                            const pct         = requeridas > 0 ? Math.min(realizadas / requeridas, 1) : 0;
                            return (
                                <div key={idx} className="ps-obj-wrap">
                                    <ObjetivoRow
                                        obj={obj}
                                        onChange={v => updateObj(idx, v)}
                                        onRemove={() => removeObj(idx)}
                                    />
                                    <div className="ps-obj-progress-bar">
                                        <div
                                            className="ps-obj-progress-fill"
                                            style={{
                                                width: pct * 100 + "%",
                                                background: pct >= 1 ? "var(--color-success)" : pct > 0 ? "#f59e0b" : "transparent",
                                            }}
                                        />
                                        <span className="ps-obj-progress-txt">
                                            {realizadas}/{requeridas} este mes
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {!showAdd ? (
                    <button className="ps-add-btn" onClick={() => setShowAdd(true)}>+ Agregar objetivo</button>
                ) : (
                    <div className="ps-add-form">
                        <select value={objToAdd} onChange={e => setObjToAdd(e.target.value)}>
                            <option value="">-- Seleccionar objetivo --</option>
                            {objetivosDisponibles.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <button className="btn btn-primary" style={{ width: "auto", padding: "8px 16px", fontSize: 13 }} disabled={!objToAdd} onClick={addObj}>Agregar</button>
                            <button className="btn btn-secondary" style={{ width: "auto", padding: "8px 16px", fontSize: 13 }} onClick={() => { setShowAdd(false); setObjToAdd(""); }}>Cancelar</button>
                        </div>
                    </div>
                )}
            </div>

            <button className={`btn ${saved ? "btn-success" : "btn-primary"}`} disabled={saved} onClick={handleSave}>
                {saved ? "✓ Guardado" : "💾 Guardar plan"}
            </button>
        </div>
    );
}

// ── Lista supervisores ────────────────────────────────────────────────────────
function ListaSupervisores({ onEdit, legajoMap = {}, diagramas14 = [] }) {
    const { getSupervisoresConEmail, getPlanSupervisor, jornadas } = useAppData();

    const semanaActual = getSemanaActual();
    const supervisores = getSupervisoresConEmail();
    const mesInicio    = new Date(); mesInicio.setDate(1); mesInicio.setHours(0,0,0,0);

    return (
        <div className="ps-list-wrap">
            <div className="screen-title">Planes de Supervisión</div>
            <div className="screen-sub">
                {mesNombre()}
                {semanaActual && ` · Semana ${semanaActual} activa (días ${WEEK_RANGES[semanaActual]})`}
            </div>

            {supervisores.length === 0 && (
                <div className="alert alert-info" style={{ marginTop: "var(--space-3)" }}>
                    Sin supervisores designados. Ir a Gestión de datos → Supervisores para designarlos.
                </div>
            )}

            {supervisores.map((sup, i) => {
                const plan     = getPlanSupervisor(sup.email || sup.nombre);
                const objCount = plan?.objetivos?.length || 0;
                const totalReq = plan?.objetivos?.reduce((s, o) => {
                    const vv = getVisitasDesglosadas(o);
                    const sems = semanasDePatron(o.patron, o.semanasCustom);
                    const fdsW = vv.semanasConFdS.length || sems.length;
                    return s + sems.length * (vv.diurnas + vv.nocturnas) + fdsW * vv.fds;
                }, 0) || 0;

                const controlesMes = sup.email ? jornadas
                    .filter(j => j.email === sup.email && new Date(j.creadaEn || 0) >= mesInicio)
                    .flatMap(j => (j.actividades || []).filter(a => a.tipo === "ctrl")).length : 0;

                const pct = totalReq > 0 ? Math.min(Math.round(controlesMes / totalReq * 100), 100) : null;
                const turnoIcon = plan ? TURNO_ICON[plan.turnoBase || "mixto"] : "";

                const legajoKey = sup.nombre.toUpperCase();
                const legajo = legajoMap[legajoKey];
                const es14x14 = legajo && (legajo.regimen === "14 x 14 x 8" || legajo.regimen === "14 x 14 x 12");
                const diasTrabajo = es14x14 ? getDiasTrabajoMes(legajo.grupoTurno14, diagramas14) : [];

                return (
                    <div key={i} className="ps-sup-row" onClick={() => onEdit(sup)}>
                        <div className="ps-sup-avatar">{sup.nombre[0]}</div>
                        <div className="ps-sup-info">
                            <div className="ps-sup-name">{sup.nombre}</div>
                            <div className="ps-sup-email">
                                {sup.email
                                    ? <>{turnoIcon} {sup.email}</>
                                    : <span style={{ color: "var(--color-muted)", fontSize: 11 }}>Sin cuenta de usuario vinculada</span>
                                }
                            </div>
                            <div className="ps-sup-detail">
                                {plan
                                    ? `${objCount} objetivo${objCount !== 1 ? "s" : ""} · ${totalReq} visitas/mes requeridas`
                                    : "Sin plan configurado"}
                            </div>
                        </div>
                        <div className="ps-sup-right">
                            {pct !== null ? (
                                <>
                                    <div className={`ps-sup-pct ${pct >= 80 ? "green" : pct >= 50 ? "orange" : "red"}`}>{pct}%</div>
                                    <div className="ps-sup-pct-label">mes actual</div>
                                </>
                            ) : (
                                <div className="ps-sup-pct-label">Sin plan</div>
                            )}
                            <div className="ps-sup-arrow">›</div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function PlanSupervisorScreen() {
    const [supSel, setSupSel] = useState(null);
    const [toast,  setToast]  = useState("");
    const [legajoMap,   setLegajoMap]   = useState({});
    const [diagramas14, setDiagramas14] = useState([]);

    const { empresaId } = useAppData();

    useEffect(() => {
        if (!empresaId) return;
        // Load legajos
        getDocs(query(collection(db, "legajos"), where("empresaId", "==", empresaId)))
            .then(snap => {
                const map = {};
                snap.docs.forEach(d => {
                    const l = d.data();
                    const key = `${l.apellido || ""} ${l.nombre || ""}`.trim().toUpperCase();
                    map[key] = l;
                });
                setLegajoMap(map);
            }).catch(() => {});
        // Load diagramas14x14
        getDocs(query(collection(db, "diagramas14x14"), where("empresaId", "==", empresaId)))
            .then(snap => setDiagramas14(snap.docs.map(d => d.data())))
            .catch(() => {});
    }, [empresaId]);

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2000); };
    return (
        <div style={{ position: "relative" }}>
            {supSel
                ? <EditorSupervisor sup={supSel} onBack={() => setSupSel(null)} onSaved={() => { setSupSel(null); showToast("✓ Plan guardado"); }} legajoMap={legajoMap} diagramas14={diagramas14} />
                : <ListaSupervisores onEdit={setSupSel} legajoMap={legajoMap} diagramas14={diagramas14} />
            }
            {toast && <div className="admin-toast">{toast}</div>}
        </div>
    );
}
