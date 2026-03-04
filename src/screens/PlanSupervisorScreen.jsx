// src/screens/PlanSupervisorScreen.jsx
import { useState } from "react";
import { useAppData } from "../context/AppDataContext";
import "../styles/PlanSupervisorScreen.css";

const WEEK_RANGES  = { 1: "1–7", 2: "8–14", 3: "15–21", 4: "22–28" };
const TURNOS       = ["diurno", "nocturno", "mixto"];
const TURNO_ICON   = { diurno: "☀️", nocturno: "🌙", mixto: "🔄", base: "↑" };
const TURNO_LABEL  = { diurno: "Diurno", nocturno: "Nocturno", mixto: "Mixto" };
const PATRON_LABEL = { todas: "Todas (1,2,3,4)", impares: "Impares (1 y 3)", pares: "Pares (2 y 4)", custom: "Personalizado" };

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
function ObjetivoRow({ obj, turnoBase, onChange, onRemove }) {
    const [expanded, setExpanded] = useState(false);

    const turnoEfectivo = (!obj.turno || obj.turno === "base") ? turnoBase : obj.turno;
    const semanasActivas = semanasDePatron(obj.patron, obj.semanasCustom);

    const toggleSemanaCustom = (w) => {
        const cur = obj.semanasCustom || [];
        const next = cur.includes(w) ? cur.filter(x => x !== w) : [...cur, w].sort();
        onChange({ ...obj, semanasCustom: next });
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
                    <span className={`ps-badge ps-badge-turno turno-${turnoEfectivo}`}>
                        {TURNO_ICON[turnoEfectivo]} {TURNO_LABEL[turnoEfectivo]}
                    </span>
                    <span className="ps-badge ps-badge-visitas">
                        {obj.visitasPorSemana || 1}×/sem
                    </span>
                    <span className="ps-badge ps-badge-patron">
                        {obj.patron === "custom"
                            ? `Sem ${semanasActivas.join(",")}`
                            : PATRON_LABEL[obj.patron]}
                    </span>
                </div>
                <div className="ps-obj-actions">
                    <button className="ps-obj-expand-btn" onClick={e => { e.stopPropagation(); setExpanded(e2 => !e2); }}>
                        {expanded ? "▲" : "▼"}
                    </button>
                    <button className="ps-obj-remove-btn" onClick={e => { e.stopPropagation(); onRemove(); }}>✕</button>
                </div>
            </div>

            {expanded && (
                <div className="ps-obj-detail">
                    {/* Visitas por semana */}
                    <div className="ps-detail-row">
                        <label className="ps-detail-label">Visitas por semana activa</label>
                        <div className="ps-visitas-ctrl">
                            <button onClick={() => onChange({ ...obj, visitasPorSemana: Math.max(1, (obj.visitasPorSemana || 1) - 1) })}>−</button>
                            <span className="ps-visitas-num">{obj.visitasPorSemana || 1}</span>
                            <button onClick={() => onChange({ ...obj, visitasPorSemana: (obj.visitasPorSemana || 1) + 1 })}>+</button>
                        </div>
                    </div>

                    {/* Turno */}
                    <div className="ps-detail-row">
                        <label className="ps-detail-label">Turno para este objetivo</label>
                        <div className="ps-turno-opts">
                            <button
                                className={`ps-turno-btn ${(!obj.turno || obj.turno === "base") ? "active" : ""} turno-${turnoBase}`}
                                onClick={() => onChange({ ...obj, turno: "base" })}
                            >
                                {TURNO_ICON[turnoBase]} Igual al supervisor ({TURNO_LABEL[turnoBase]})
                            </button>
                            {TURNOS.map(t => (
                                <button
                                    key={t}
                                    className={`ps-turno-btn ${obj.turno === t ? "active" : ""} turno-${t}`}
                                    onClick={() => onChange({ ...obj, turno: t })}
                                >
                                    {TURNO_ICON[t]} {TURNO_LABEL[t]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Patrón */}
                    <div className="ps-detail-row">
                        <label className="ps-detail-label">Patrón de semanas</label>
                        <div className="ps-patron-opts">
                            {Object.entries(PATRON_LABEL).map(([k, v]) => (
                                <button
                                    key={k}
                                    className={`ps-patron-btn ${obj.patron === k ? "active" : ""}`}
                                    onClick={() => onChange({ ...obj, patron: k })}
                                >
                                    {v}
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
                        Activo en: {semanasActivas.length > 0
                            ? semanasActivas.map(w => `Sem ${w}`).join(", ")
                            : <span style={{ color: "var(--color-danger)" }}>Ninguna semana seleccionada</span>}
                        {semanasActivas.length > 0 && (
                            <> · <strong>{semanasActivas.length * (obj.visitasPorSemana || 1)} visitas/mes</strong></>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Editor ────────────────────────────────────────────────────────────────────
function EditorSupervisor({ sup, onBack, onSaved }) {
    const { data, getPlanSupervisor, savePlanSupervisor, jornadas } = useAppData();

    const planActual = getPlanSupervisor(sup.email) || { nombre: sup.nombre, turnoBase: "mixto", objetivos: [] };

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
        return s + semanasDePatron(o.patron, o.semanasCustom).length * (o.visitasPorSemana || 1);
    }, 0);

    const updateObj = (idx, v) => { setSaved(false); setObjetivos(p => p.map((o, i) => i === idx ? v : o)); };
    const removeObj = (idx)    => { setSaved(false); setObjetivos(p => p.filter((_, i) => i !== idx)); };

    const addObj = () => {
        if (!objToAdd || objetivos.some(o => o.objetivo === objToAdd)) return;
        setObjetivos(p => [...p, { objetivo: objToAdd, visitasPorSemana: 1, turno: "base", patron: "todas", semanasCustom: [] }]);
        setObjToAdd(""); setShowAdd(false); setSaved(false);
    };

    const handleSave = () => {
        savePlanSupervisor(sup.email, { nombre: sup.nombre, turnoBase, objetivos });
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
                            const requeridas  = sems.length * (obj.visitasPorSemana || 1);
                            const pct         = requeridas > 0 ? Math.min(realizadas / requeridas, 1) : 0;
                            return (
                                <div key={idx} className="ps-obj-wrap">
                                    <ObjetivoRow
                                        obj={obj}
                                        turnoBase={turnoBase}
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
function ListaSupervisores({ onEdit }) {
    const { getSupervisoresConEmail, getPlanSupervisor, savePlanSupervisor, data, jornadas } = useAppData();
    const [showForm, setShowForm] = useState(false);
    const [nuevoNombre, setNuevoNombre] = useState("");
    const [nuevoEmail,  setNuevoEmail]  = useState("");

    const semanaActual = getSemanaActual();
    const supervisores = getSupervisoresConEmail();
    const mesInicio    = new Date(); mesInicio.setDate(1); mesInicio.setHours(0,0,0,0);

    const registrar = () => {
        if (!nuevoEmail.includes("@") || !nuevoNombre.trim()) return;
        savePlanSupervisor(nuevoEmail.trim(), { nombre: nuevoNombre.trim(), turnoBase: "mixto", objetivos: [] });
        setNuevoNombre(""); setNuevoEmail(""); setShowForm(false);
    };

    return (
        <div className="ps-list-wrap">
            <div className="screen-title">Planes de Supervisión</div>
            <div className="screen-sub">
                {mesNombre()}
                {semanaActual && ` · Semana ${semanaActual} activa (días ${WEEK_RANGES[semanaActual]})`}
            </div>

            {supervisores.map((sup, i) => {
                const plan     = getPlanSupervisor(sup.email || "");
                const objCount = plan?.objetivos?.length || 0;
                const totalReq = plan?.objetivos?.reduce((s, o) =>
                    s + semanasDePatron(o.patron, o.semanasCustom).length * (o.visitasPorSemana || 1), 0) || 0;

                const controlesMes = sup.email ? jornadas
                    .filter(j => j.email === sup.email && new Date(j.creadaEn || 0) >= mesInicio)
                    .flatMap(j => (j.actividades || []).filter(a => a.tipo === "ctrl")).length : 0;

                const pct = totalReq > 0 ? Math.min(Math.round(controlesMes / totalReq * 100), 100) : null;
                const turnoIcon = plan ? TURNO_ICON[plan.turnoBase || "mixto"] : "";

                return (
                    <div key={i} className={`ps-sup-row ${!sup.email ? "no-email" : ""}`} onClick={() => sup.email && onEdit(sup)}>
                        <div className="ps-sup-avatar">{sup.nombre[0]}</div>
                        <div className="ps-sup-info">
                            <div className="ps-sup-name">{sup.nombre}</div>
                            <div className="ps-sup-email">
                                {sup.email ? <>{turnoIcon} {sup.email}</> : "⚠️ Sin email asignado"}
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
                                <div className="ps-sup-pct-label">{sup.email ? "Sin plan" : "—"}</div>
                            )}
                            {sup.email && <div className="ps-sup-arrow">›</div>}
                        </div>
                    </div>
                );
            })}

            {!showForm ? (
                <button className="btn btn-secondary" style={{ marginTop: "var(--space-3)" }} onClick={() => setShowForm(true)}>
                    + Asociar supervisor al sistema
                </button>
            ) : (
                <div className="ps-new-form">
                    <div className="ps-new-title">Registrar supervisor</div>
                    <div className="field">
                        <label className="label">Nombre</label>
                        <select value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}>
                            <option value="">-- Seleccionar --</option>
                            {(data.supervisores || []).map(n => <option key={n}>{n}</option>)}
                        </select>
                    </div>
                    <div className="field">
                        <label className="label">Email (ID de login)</label>
                        <input type="email" placeholder="fsupervisor@empresa.com" value={nuevoEmail} onChange={e => setNuevoEmail(e.target.value)} />
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-2)" }}>
                        <button className="btn btn-primary" disabled={!nuevoEmail.includes("@") || !nuevoNombre.trim()} onClick={registrar}>Registrar</button>
                        <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function PlanSupervisorScreen() {
    const [supSel, setSupSel] = useState(null);
    const [toast,  setToast]  = useState("");
    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2000); };
    return (
        <div style={{ position: "relative" }}>
            {supSel
                ? <EditorSupervisor sup={supSel} onBack={() => setSupSel(null)} onSaved={() => { setSupSel(null); showToast("✓ Plan guardado"); }} />
                : <ListaSupervisores onEdit={setSupSel} />
            }
            {toast && <div className="admin-toast">{toast}</div>}
        </div>
    );
}
