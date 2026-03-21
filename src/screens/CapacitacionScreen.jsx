// src/screens/CapacitacionScreen.jsx
// INICIO: guarda hora solamente (caps no requieren GPS)
// FINALIZAR: tema, hora fin
import { useState } from "react";
import { nowTime, todayDate } from "../utils/helpers";
import { useAppData } from "../context/AppDataContext";
import "./CapacitacionScreen.css";

export default function CapacitacionScreen({ onBack }) {
    const { iniciarActividad, finalizarActividad, actividadActiva, cancelarActividad } = useAppData();
    const enCurso = actividadActiva?.tipo === "cap";

    const [tema, setTema] = useState("");

    // ── PASO 1 ──
    const handleIniciar = () => {
        iniciarActividad("cap", {
            fecha:      todayDate(),
            horaInicio: nowTime(),
        });
    };

    // ── PASO 2 ──
    const handleFinalizar = () => {
        finalizarActividad({ tema, horaFin: nowTime() });
        onBack();
    };

    // ════ PASO 2: completar ════
    if (enCurso) {
        return (
            <>
                <div className="screen-title">Capacitación</div>
                <div className="screen-sub">Paso 2 — Completar y finalizar</div>

                <div className="act-en-curso-badge">
                    <span className="act-en-curso-dot" />
                    En curso desde las <strong>{actividadActiva.horaInicio}</strong>
                    &nbsp;·&nbsp; {actividadActiva.fecha}
                </div>

                <div className="card">
                    <div className="card-title">Contenido de la sesión</div>
                    <div className="cap-time-display">
                        📅 {actividadActiva.fecha} &nbsp;·&nbsp;
                        Inicio: <span>{actividadActiva.horaInicio}</span>
                    </div>
                    <div className="field">
                        <label className="label">Tema desarrollado</label>
                        <textarea
                            placeholder="Describí el contenido de la capacitación, temas abordados, participantes..."
                            value={tema}
                            onChange={(e) => setTema(e.target.value)}
                            style={{ minHeight: 130 }}
                        />
                    </div>
                </div>

                <button className="btn btn-success" disabled={!tema.trim()} onClick={handleFinalizar}>
                    ✓ Finalizar y Guardar Capacitación
                </button>
                <button className="btn btn-secondary"
                    onClick={() => { cancelarActividad(); onBack(); }}>
                    ✕ Cancelar actividad
                </button>
            </>
        );
    }

    // ════ PASO 1: registrar inicio ════
    return (
        <>
            <div className="screen-title">Capacitación</div>
            <div className="screen-sub">Paso 1 — Registrar inicio de sesión</div>

            <div className="card">
                <div className="card-title">Inicio de la capacitación</div>

                <div className="ctrl-inicio-info">
                    <div className="ctrl-inicio-row">
                        <span className="ctrl-inicio-icon">🕐</span>
                        <div>
                            <div className="ctrl-inicio-label">Hora de inicio</div>
                            <div className="ctrl-inicio-value">{nowTime()} hs</div>
                        </div>
                    </div>
                    <div className="ctrl-inicio-row">
                        <span className="ctrl-inicio-icon">📅</span>
                        <div>
                            <div className="ctrl-inicio-label">Fecha</div>
                            <div className="ctrl-inicio-value">{todayDate()}</div>
                        </div>
                    </div>
                </div>

                <div className="alert alert-info" style={{ marginTop: "var(--space-3)" }}>
                    ℹ️ Se guarda la hora de inicio. Podés cerrar la app y volver cuando termine la sesión para completar el tema.
                </div>
            </div>

            <button className="btn btn-primary" onClick={handleIniciar}>
                💾 Registrar Inicio
            </button>
            <button className="btn btn-secondary" onClick={onBack}>
                ← Volver al menú
            </button>
        </>
    );
}
