// src/screens/PlantillasRondaScreen.jsx
// Panel para crear y gestionar plantillas de ronda con:
// - 40 actividades predefinidas seleccionables por checkpoint
// - Frecuencia de ronda (por turno / cada X horas / horarios fijos)
// - Reorden de checkpoints (↑↓)
// Accesible desde Supervisor y Admin de Contrato.

import { useState, useEffect } from "react";
import { useAuth }  from "../../context/AuthContext";
import { db }       from "../../firebase";
import {
    collection, query, where, getDocs,
    addDoc, doc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { ACTIVIDADES_RONDA, CATS_ACTIVIDADES } from "../../data/actividadesRonda";
import "./PlantillasRondaScreen.css";

// ── Utilidades ─────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

const nuevoCp = (orden) => ({
    id:          uid(),
    nombre:      "",
    lat:         "",
    lng:         "",
    radio:       30,
    orden,
    expandido:   true,
    actividades: [],  // array de { id, cat, nombre, icono, requerido }
});

const FREQ_INIT = { tipo: "por_turno", cantidad: 3, horas: 2, horarios: [] };

const FORM_INIT = {
    nombre:      "",
    objetivo:    "",
    ordenFijo:   true,
    activa:      true,
    frecuencia:  { ...FREQ_INIT },
    checkpoints: [],
};

// ── Toggle switch ──────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }) {
    return (
        <div className="pr-toggle-row">
            <span className="pr-toggle-label">{label}</span>
            <label className="pr-toggle">
                <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} />
                <span className="pr-toggle-slider" />
            </label>
        </div>
    );
}

// ── Selector de actividades (overlay) ─────────────────────────────────────────

function ActivityPicker({ seleccionadas, onSave, onClose }) {
    const [catActiva, setCatActiva]   = useState("Todas");
    const [busqueda, setBusqueda]     = useState("");
    const [elegidas, setElegidas]     = useState(() => new Set(seleccionadas.map(a => a.id)));

    const cats = ["Todas", ...CATS_ACTIVIDADES];

    const lista = ACTIVIDADES_RONDA.filter(a => {
        const porCat = catActiva === "Todas" || a.cat === catActiva;
        const porBus = !busqueda || a.nombre.toLowerCase().includes(busqueda.toLowerCase());
        return porCat && porBus;
    });

    const toggle = (id) =>
        setElegidas(prev => {
            const s = new Set(prev);
            s.has(id) ? s.delete(id) : s.add(id);
            return s;
        });

    const confirmar = () => {
        const result = ACTIVIDADES_RONDA
            .filter(a => elegidas.has(a.id))
            .map(a => ({ ...a, requerido: true }));
        onSave(result);
    };

    return (
        <div className="pr-picker-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="pr-picker-modal">
                <div className="pr-picker-header">
                    <div className="pr-picker-title">📋 Seleccionar actividades</div>
                    <button className="pr-picker-close" onClick={onClose}>✕</button>
                </div>

                {/* Buscador */}
                <div className="pr-picker-search-row">
                    <input
                        className="pr-input pr-picker-search"
                        placeholder="🔍 Buscar actividad..."
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        autoFocus
                    />
                </div>

                {/* Categorías */}
                <div className="pr-picker-cats">
                    {cats.map(cat => (
                        <button
                            key={cat}
                            className={`pr-picker-cat${catActiva === cat ? " pr-picker-cat--active" : ""}`}
                            onClick={() => setCatActiva(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Lista */}
                <div className="pr-picker-list">
                    {lista.map(act => {
                        const sel = elegidas.has(act.id);
                        return (
                            <label key={act.id} className={`pr-picker-act${sel ? " pr-picker-act--sel" : ""}`}>
                                <input
                                    type="checkbox"
                                    checked={sel}
                                    onChange={() => toggle(act.id)}
                                    style={{ display: "none" }}
                                />
                                <span className="pr-picker-act-icon">{act.icono}</span>
                                <div className="pr-picker-act-info">
                                    <span className="pr-picker-act-nombre">{act.nombre}</span>
                                    <span className="pr-picker-act-cat">{act.cat}</span>
                                </div>
                                <span className="pr-picker-act-check">{sel ? "✅" : "☐"}</span>
                            </label>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="pr-picker-footer">
                    <span className="pr-picker-count">{elegidas.size} actividad{elegidas.size !== 1 ? "es" : ""} seleccionada{elegidas.size !== 1 ? "s" : ""}</span>
                    <button className="pr-save-btn" style={{ flex: "none", padding: "var(--space-2) var(--space-5)" }} onClick={confirmar}>
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Checkpoint ─────────────────────────────────────────────────────────────────

function CheckpointItem({ cp, index, total, onUpdate, onDelete, onMoveUp, onMoveDown }) {
    const [showPicker, setShowPicker] = useState(false);
    const upd = (field, val) => onUpdate(cp.id, { ...cp, [field]: val });

    const toggleActReq = (actId) => {
        const acts = (cp.actividades || []).map(a =>
            a.id === actId ? { ...a, requerido: !a.requerido } : a
        );
        upd("actividades", acts);
    };

    const removeAct = (actId) => {
        upd("actividades", (cp.actividades || []).filter(a => a.id !== actId));
    };

    return (
        <div className="pr-cp-item">
            {/* Header */}
            <div className="pr-cp-header" onClick={() => upd("expandido", !cp.expandido)}>
                {/* Reorden */}
                <div className="pr-cp-reorder" onClick={e => e.stopPropagation()}>
                    <button className="pr-cp-arrow" disabled={index === 0}        onClick={() => onMoveUp(index)}>▲</button>
                    <button className="pr-cp-arrow" disabled={index === total - 1} onClick={() => onMoveDown(index)}>▼</button>
                </div>
                <div className="pr-cp-num">{index + 1}</div>
                <input
                    className="pr-cp-name-input"
                    placeholder="Nombre del punto de control..."
                    value={cp.nombre}
                    onClick={e => e.stopPropagation()}
                    onChange={e => upd("nombre", e.target.value)}
                />
                <span className="pr-cp-acts-count" onClick={e => e.stopPropagation()}>
                    {cp.actividades?.length || 0} act.
                </span>
                <span className={`pr-cp-chevron${cp.expandido ? " pr-cp-chevron--open" : ""}`}>▼</span>
                <button
                    className="pr-cp-del"
                    title="Eliminar checkpoint"
                    onClick={e => { e.stopPropagation(); onDelete(cp.id); }}
                >🗑</button>
            </div>

            {/* Body */}
            {cp.expandido && (
                <div className="pr-cp-body">
                    {/* Coordenadas */}
                    <div className="pr-coords-row">
                        <div className="pr-field">
                            <label className="pr-label">Latitud GPS</label>
                            <input className="pr-input" type="number" step="0.000001" placeholder="-34.603000"
                                value={cp.lat} onChange={e => upd("lat", e.target.value)} />
                        </div>
                        <div className="pr-field">
                            <label className="pr-label">Longitud GPS</label>
                            <input className="pr-input" type="number" step="0.000001" placeholder="-58.381500"
                                value={cp.lng} onChange={e => upd("lng", e.target.value)} />
                        </div>
                    </div>

                    {/* Radio */}
                    <div className="pr-radio-row">
                        <div className="pr-field">
                            <label className="pr-label">Radio de activación GPS</label>
                            <input className="pr-input" type="number" min="5" max="500"
                                value={cp.radio} onChange={e => upd("radio", Number(e.target.value))} />
                        </div>
                        <span className="pr-radio-unit">metros</span>
                    </div>

                    {/* Actividades */}
                    <div className="pr-acts-section">
                        <div className="pr-acts-header">
                            <span className="pr-label">
                                ACTIVIDADES A VERIFICAR ({cp.actividades?.length || 0})
                            </span>
                            <button className="pr-add-btn" style={{ width:"auto", padding:"4px 12px" }}
                                onClick={() => setShowPicker(true)}>
                                + Seleccionar
                            </button>
                        </div>

                        {(cp.actividades || []).length === 0 && (
                            <div className="pr-acts-empty">
                                Sin actividades. Hacé clic en "Seleccionar" para agregar desde las 40 actividades predefinidas.
                            </div>
                        )}

                        {(cp.actividades || []).map(act => (
                            <div key={act.id} className="pr-act-row">
                                <span className="pr-act-icon">{act.icono}</span>
                                <span className="pr-act-nombre">{act.nombre}</span>
                                <label className="pr-act-req" title="¿Obligatoria?">
                                    <input type="checkbox" checked={!!act.requerido}
                                        onChange={() => toggleActReq(act.id)} />
                                    Oblig.
                                </label>
                                <button className="pr-task-del" onClick={() => removeAct(act.id)}>✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Selector de actividades */}
            {showPicker && (
                <ActivityPicker
                    seleccionadas={cp.actividades || []}
                    onSave={acts => { upd("actividades", acts); setShowPicker(false); }}
                    onClose={() => setShowPicker(false)}
                />
            )}
        </div>
    );
}

// ── Frecuencia ─────────────────────────────────────────────────────────────────

function FrecuenciaEditor({ freq, onChange }) {
    const upd = (field, val) => onChange({ ...freq, [field]: val });

    const addHorario = () => {
        const hora = prompt("Horario de ronda (HH:MM):", "22:00");
        if (!hora || !/^\d{2}:\d{2}$/.test(hora)) return;
        upd("horarios", [...(freq.horarios || []), hora]);
    };

    const removeHorario = (i) =>
        upd("horarios", (freq.horarios || []).filter((_, j) => j !== i));

    return (
        <div className="pr-freq-body">
            {/* Tipo */}
            <div className="pr-field">
                <label className="pr-label">Tipo de frecuencia</label>
                <div className="pr-freq-tipos">
                    {[
                        { v:"por_turno",     label:"🔁 Veces por turno" },
                        { v:"cada_horas",    label:"⏱ Cada X horas" },
                        { v:"horarios_fijos",label:"🕐 Horarios fijos" },
                    ].map(op => (
                        <button
                            key={op.v}
                            className={`pr-freq-tipo-btn${freq.tipo === op.v ? " pr-freq-tipo-btn--active" : ""}`}
                            onClick={() => upd("tipo", op.v)}
                        >
                            {op.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Por turno */}
            {freq.tipo === "por_turno" && (
                <div className="pr-field">
                    <label className="pr-label">Cantidad de rondas por turno</label>
                    <div className="pr-radio-row" style={{ alignItems:"center" }}>
                        <input
                            className="pr-input"
                            type="number" min="1" max="20"
                            value={freq.cantidad}
                            onChange={e => upd("cantidad", Number(e.target.value))}
                            style={{ maxWidth: 100 }}
                        />
                        <span className="pr-radio-unit">ronda{freq.cantidad !== 1 ? "s" : ""} por turno</span>
                    </div>
                </div>
            )}

            {/* Cada X horas */}
            {freq.tipo === "cada_horas" && (
                <div className="pr-field">
                    <label className="pr-label">Intervalo entre rondas</label>
                    <div className="pr-radio-row" style={{ alignItems:"center" }}>
                        <input
                            className="pr-input"
                            type="number" min="1" max="12"
                            value={freq.horas}
                            onChange={e => upd("horas", Number(e.target.value))}
                            style={{ maxWidth: 100 }}
                        />
                        <span className="pr-radio-unit">hora{freq.horas !== 1 ? "s" : ""} entre rondas</span>
                    </div>
                </div>
            )}

            {/* Horarios fijos */}
            {freq.tipo === "horarios_fijos" && (
                <div className="pr-field">
                    <label className="pr-label">Horarios de ronda</label>
                    <div className="pr-horarios-list">
                        {(freq.horarios || []).map((h, i) => (
                            <div key={i} className="pr-horario-chip">
                                🕐 {h}
                                <button className="pr-horario-del" onClick={() => removeHorario(i)}>✕</button>
                            </div>
                        ))}
                        <button className="pr-add-btn" style={{ width:"auto", padding:"4px 14px" }} onClick={addHorario}>
                            + Agregar horario
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Componente principal ────────────────────────────────────────────────────────

export default function PlantillasRondaScreen({ onBack }) {
    const { user } = useAuth();

    const [plantillas, setPlantillas] = useState([]);
    const [loading, setLoading]       = useState(true);
    const [editando, setEditando]     = useState(null);
    const [form, setForm]             = useState(FORM_INIT);
    const [saving, setSaving]         = useState(false);

    // ── Cargar ────────────────────────────────────────────────────────────────

    const cargar = async () => {
        if (!user?.empresaId) return;
        setLoading(true);
        try {
            const snap = await getDocs(query(
                collection(db, "plantillas_ronda"),
                where("empresa", "==", user.empresaId),
            ));
            setPlantillas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { cargar(); }, [user?.empresaId]);

    // ── Acciones lista ────────────────────────────────────────────────────────

    const nuevaPlantilla = () => {
        setForm({ ...FORM_INIT, checkpoints: [], frecuencia: { ...FREQ_INIT } });
        setEditando("nueva");
    };

    const editarPlantilla = (p) => {
        setForm({
            ...p,
            frecuencia:  p.frecuencia  || { ...FREQ_INIT },
            checkpoints: (p.checkpoints || []).map(cp => ({ ...cp, expandido: false })),
        });
        setEditando(p.id);
    };

    const toggleActiva = async (p) => {
        await updateDoc(doc(db, "plantillas_ronda", p.id), { activa: !p.activa });
        setPlantillas(prev => prev.map(x => x.id === p.id ? { ...x, activa: !x.activa } : x));
    };

    // ── Guardar ───────────────────────────────────────────────────────────────

    const guardar = async () => {
        if (!form.nombre.trim()) { alert("El nombre es obligatorio"); return; }
        setSaving(true);
        try {
            const cpsClean = (form.checkpoints || []).map(({ expandido, ...cp }) => ({
                ...cp,
                lat:   Number(cp.lat)   || 0,
                lng:   Number(cp.lng)   || 0,
                radio: Number(cp.radio) || 30,
            }));
            const data = {
                nombre:      form.nombre.trim(),
                objetivo:    form.objetivo?.trim() || "",
                ordenFijo:   !!form.ordenFijo,
                activa:      form.activa !== false,
                frecuencia:  form.frecuencia || FREQ_INIT,
                empresa:     user.empresaId,
                checkpoints: cpsClean,
                updatedAt:   serverTimestamp(),
            };
            if (editando === "nueva") {
                await addDoc(collection(db, "plantillas_ronda"), { ...data, createdAt: serverTimestamp() });
            } else {
                await updateDoc(doc(db, "plantillas_ronda", editando), data);
            }
            await cargar();
            setEditando(null);
        } catch (e) { alert("Error al guardar: " + e.message); }
        finally { setSaving(false); }
    };

    // ── Handlers formulario ───────────────────────────────────────────────────

    const updForm = (field, val) => setForm(f => ({ ...f, [field]: val }));

    const addCp = () =>
        setForm(f => ({
            ...f,
            checkpoints: [...(f.checkpoints || []), nuevoCp((f.checkpoints?.length || 0) + 1)],
        }));

    const updateCp = (cpId, updated) =>
        setForm(f => ({ ...f, checkpoints: f.checkpoints.map(c => c.id === cpId ? updated : c) }));

    const deleteCp = (cpId) =>
        setForm(f => ({
            ...f,
            checkpoints: f.checkpoints.filter(c => c.id !== cpId)
                .map((c, i) => ({ ...c, orden: i + 1 })),
        }));

    const moveCp = (idx, dir) =>
        setForm(f => {
            const arr = [...f.checkpoints];
            const swap = idx + dir;
            if (swap < 0 || swap >= arr.length) return f;
            [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
            return { ...f, checkpoints: arr.map((c, i) => ({ ...c, orden: i + 1 })) };
        });

    // ── Vista formulario ──────────────────────────────────────────────────────

    if (editando !== null) {
        const cpCount    = form.checkpoints?.length || 0;
        const totalActs  = (form.checkpoints || []).reduce((s, c) => s + (c.actividades?.length || 0), 0);

        return (
            <div className="pr-root">
                <div className="pr-header">
                    <button className="pr-header-back" onClick={() => setEditando(null)}>← Volver</button>
                    <div className="pr-header-title">
                        {editando === "nueva" ? "Nueva plantilla de ronda" : "Editar plantilla"}
                    </div>
                </div>

                <div className="pr-form">
                    {/* Datos generales */}
                    <div className="pr-form-section">
                        <div className="pr-form-section-header">📋 Datos generales</div>
                        <div className="pr-form-body">
                            <div className="pr-field">
                                <label className="pr-label">Nombre de la ronda *</label>
                                <input className="pr-input" placeholder="Ej: Ronda Nocturna — Sector A"
                                    value={form.nombre} onChange={e => updForm("nombre", e.target.value)} />
                            </div>
                            <div className="pr-field">
                                <label className="pr-label">Objetivo / Ubicación</label>
                                <input className="pr-input" placeholder="Ej: Edificio Central — Planta baja"
                                    value={form.objetivo} onChange={e => updForm("objetivo", e.target.value)} />
                            </div>
                            <Toggle checked={form.ordenFijo} onChange={v => updForm("ordenFijo", v)}
                                label="Orden fijo (el guardia debe seguir la secuencia numerada)" />
                            <Toggle checked={form.activa !== false} onChange={v => updForm("activa", v)}
                                label="Plantilla activa (visible para los guardias)" />
                        </div>
                    </div>

                    {/* Frecuencia */}
                    <div className="pr-form-section">
                        <div className="pr-form-section-header">🔁 Frecuencia de ronda</div>
                        <FrecuenciaEditor
                            freq={form.frecuencia || FREQ_INIT}
                            onChange={f => updForm("frecuencia", f)}
                        />
                    </div>

                    {/* Checkpoints */}
                    <div className="pr-form-section">
                        <div className="pr-form-section-header">
                            <span>📍 Checkpoints ({cpCount}) — {totalActs} actividades</span>
                        </div>
                        <div className="pr-cp-list">
                            {cpCount === 0 && (
                                <div style={{ textAlign:"center", color:"var(--color-muted)", padding:"var(--space-5) 0", fontSize:"var(--text-sm)" }}>
                                    Sin checkpoints. Agregá los puntos que el guardia debe visitar.
                                </div>
                            )}
                            {(form.checkpoints || []).map((cp, idx) => (
                                <CheckpointItem
                                    key={cp.id}
                                    cp={cp}
                                    index={idx}
                                    total={cpCount}
                                    onUpdate={updateCp}
                                    onDelete={deleteCp}
                                    onMoveUp={i => moveCp(i, -1)}
                                    onMoveDown={i => moveCp(i, 1)}
                                />
                            ))}
                        </div>
                        <button className="pr-add-btn pr-add-btn--cp" onClick={addCp}>
                            + Agregar checkpoint
                        </button>
                    </div>
                </div>

                <div className="pr-save-bar">
                    <button className="pr-cancel-btn" onClick={() => setEditando(null)}>Cancelar</button>
                    <button className="pr-save-btn" onClick={guardar} disabled={saving}>
                        {saving ? "Guardando..." : "💾 Guardar plantilla"}
                    </button>
                </div>
            </div>
        );
    }

    // ── Vista lista ───────────────────────────────────────────────────────────

    const freqLabel = (freq) => {
        if (!freq) return "";
        if (freq.tipo === "por_turno")      return `${freq.cantidad}x por turno`;
        if (freq.tipo === "cada_horas")     return `Cada ${freq.horas}h`;
        if (freq.tipo === "horarios_fijos") return `Horarios: ${(freq.horarios || []).join(", ") || "—"}`;
        return "";
    };

    return (
        <div className="pr-root">
            <div className="pr-header">
                <button className="pr-header-back" onClick={onBack}>← Volver</button>
                <div className="pr-header-title">🗺️ Plantillas de Ronda</div>
                <button className="pr-header-action" onClick={nuevaPlantilla}>+ Nueva</button>
            </div>

            {loading ? (
                <div className="pr-list"><div className="pr-empty"><span className="pr-empty-icon">⏳</span>Cargando...</div></div>
            ) : (
                <div className="pr-list">
                    {plantillas.length === 0 ? (
                        <div className="pr-empty">
                            <span className="pr-empty-icon">🗺️</span>
                            <div>No hay plantillas de ronda aún.</div>
                            <div style={{ fontSize:"var(--text-sm)", marginTop:"var(--space-2)" }}>
                                Creá la primera para que los guardias puedan hacer rondas guiadas con GPS.
                            </div>
                        </div>
                    ) : plantillas.map(p => (
                        <div key={p.id} className="pr-card">
                            <div className="pr-card-icon">🗺️</div>
                            <div className="pr-card-body">
                                <div className="pr-card-nombre">{p.nombre}</div>
                                <div className="pr-card-meta">
                                    {p.objetivo && <span>📍 {p.objetivo}</span>}
                                    <span>🔲 {p.checkpoints?.length || 0} checkpoints</span>
                                    <span>📋 {(p.checkpoints || []).reduce((s, c) => s + (c.actividades?.length || 0), 0)} actividades</span>
                                    {p.frecuencia && <span>🔁 {freqLabel(p.frecuencia)}</span>}
                                    {p.ordenFijo && <span>🔒 Orden fijo</span>}
                                </div>
                                <div className="pr-card-actions">
                                    <button className="pr-btn-edit" onClick={() => editarPlantilla(p)}>✏️ Editar</button>
                                    <button
                                        className={`pr-btn-toggle${p.activa ? "" : " pr-btn-toggle--off"}`}
                                        onClick={() => toggleActiva(p)}
                                    >
                                        {p.activa ? "✅ Activa" : "⛔ Inactiva"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
