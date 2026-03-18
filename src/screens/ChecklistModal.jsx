// src/screens/ChecklistModal.jsx
// Modal bottom-sheet de checklist para el guardia.
// Renderiza las actividades predefinidas del checkpoint (boolean + observación si NO).

import { useState, useRef } from "react";
import "../styles/ChecklistModal.css";

export default function ChecklistModal({ cp, onComplete, onClose }) {
    const [respuestas, setRespuestas] = useState({});
    const [error, setError]           = useState("");

    // Soporta tanto campo "actividades" (nuevo) como "tareas" (legado)
    const items = cp.actividades || cp.tareas || [];

    const setResp = (id, val) => {
        setRespuestas(prev => ({ ...prev, [id]: val }));
        setError("");
    };

    const setObs = (id, txt) =>
        setRespuestas(prev => ({ ...prev, [`${id}_obs`]: txt }));

    const completadas = items.filter(it => respuestas[it.id] !== undefined).length;
    const pct         = items.length > 0 ? (completadas / items.length) * 100 : 100;

    const handleSubmit = () => {
        const pendiente = items.find(it => it.requerido && respuestas[it.id] === undefined);
        if (pendiente) {
            setError(`Falta responder: "${pendiente.nombre || pendiente.pregunta || "ítem obligatorio"}"`);
            navigator.vibrate?.(300);
            return;
        }
        onComplete({ cpId: cp.id, respuestas, llegada: new Date() });
    };

    return (
        <div className="cm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="cm-modal">
                <div className="cm-handle" />

                {/* Header */}
                <div className="cm-header">
                    <div className="cm-cp-nombre">📍 {cp.nombre}</div>
                    <div className="cm-cp-meta">
                        {items.length} actividad{items.length !== 1 ? "es" : ""} a verificar
                        {items.some(it => it.requerido) && " · * obligatorias"}
                    </div>
                </div>

                {/* Progreso */}
                {items.length > 0 && (
                    <div className="cm-progress">
                        <div className="cm-progress-track">
                            <div className="cm-progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="cm-progress-label">{completadas}/{items.length}</div>
                    </div>
                )}

                {/* Lista de actividades */}
                <div className="cm-tasks">
                    {items.length === 0 && (
                        <div style={{ textAlign:"center", color:"var(--color-muted)", padding:"var(--space-10) 0" }}>
                            <div style={{ fontSize:40, marginBottom:"var(--space-3)" }}>📋</div>
                            Sin actividades definidas.<br />Podés confirmar el checkpoint directamente.
                        </div>
                    )}

                    {items.map(item => {
                        const id         = item.id;
                        const nombre     = item.nombre || item.pregunta || "Sin descripción";
                        const icono      = item.icono  || "✔️";
                        const resp       = respuestas[id];
                        const obs        = respuestas[`${id}_obs`] || "";
                        const respondida = resp !== undefined;

                        return (
                            <div key={id} className="cm-task">
                                {/* Pregunta */}
                                <div className="cm-task-pregunta">
                                    <span style={{ fontSize:18, flexShrink:0 }}>{icono}</span>
                                    <span style={{ flex:1 }}>{nombre}</span>
                                    {item.requerido && !respondida && (
                                        <span className="cm-task-req-badge">obligatorio</span>
                                    )}
                                    {respondida && <span className="cm-task-ok-badge">✓</span>}
                                </div>

                                {/* Botones SÍ / NO */}
                                <div className="cm-bool-btns">
                                    <button
                                        className={`cm-bool-btn cm-bool-btn--si${resp === true ? " cm-selected" : ""}`}
                                        onClick={() => setResp(id, true)}
                                    >
                                        ✅ SÍ
                                    </button>
                                    <button
                                        className={`cm-bool-btn cm-bool-btn--no${resp === false ? " cm-selected" : ""}`}
                                        onClick={() => setResp(id, false)}
                                    >
                                        ❌ NO
                                    </button>
                                </div>

                                {/* Observación cuando la respuesta es NO */}
                                {resp === false && (
                                    <textarea
                                        className="cm-text-input"
                                        placeholder="Describí la anomalía o novedad detectada..."
                                        value={obs}
                                        onChange={e => setObs(id, e.target.value)}
                                        style={{ marginTop: "var(--space-1)" }}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="cm-footer">
                    {error && <div className="cm-error">⚠️ {error}</div>}
                    <button className="cm-submit-btn" onClick={handleSubmit}>
                        ✅ Confirmar checkpoint
                    </button>
                </div>
            </div>
        </div>
    );
}
