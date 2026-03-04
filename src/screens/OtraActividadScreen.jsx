// src/screens/OtraActividadScreen.jsx
// INICIO: guarda hora + GPS
// FINALIZAR: tipo de actividad, observaciones, GPS fin, hora fin
import { useState, useEffect } from "react";
import { nowTime } from "../utils/helpers";
import { useAppData } from "../context/AppDataContext";
import "../styles/OtraActividadScreen.css";

export default function OtraActividadScreen({ geo, onBack }) {
    const { data, iniciarActividad, finalizarActividad, actividadActiva, cancelarActividad } = useAppData();
    const enCurso = actividadActiva?.tipo === "otra";

    // ── Paso 1 ──
    const [gps,        setGps]        = useState("");
    const [loadingGeo, setLoadingGeo] = useState(!enCurso);
    const horaInicio = nowTime();

    // ── Paso 2 ──
    const [actividad,     setActividad]     = useState("");
    const [lugar,         setLugar]         = useState("");
    const [observaciones, setObservaciones] = useState("");

    useEffect(() => {
        if (!enCurso) {
            geo.get().then((l) => { setGps(l); setLoadingGeo(false); });
        }
    }, []);

    const handleIniciar = () => {
        iniciarActividad("otra", {
            horaInicio,
            lugarInicio: gps,
        });
    };

    const handleFinalizar = async () => {
        const lugarFin = await geo.get();
        finalizarActividad({ actividad, lugar, observaciones, lugarFin, horaFin: nowTime() });
        onBack();
    };

    // ════ PASO 2: completar ════
    if (enCurso) {
        return (
            <>
                <div className="screen-title">Otra Actividad</div>
                <div className="screen-sub">Paso 2 — Completar y finalizar</div>

                <div className="act-en-curso-badge">
                    <span className="act-en-curso-dot" />
                    Iniciada a las <strong>{actividadActiva.horaInicio}</strong>
                    &nbsp;·&nbsp; 📍 <small>{actividadActiva.lugarInicio}</small>
                </div>

                <div className="card">
                    <div className="card-title">Detalle de la actividad</div>
                    <div className="field">
                        <label className="label">Lugar / Objetivo <span style={{fontSize:"0.75em",color:"var(--color-muted)",fontWeight:400}}>(opcional)</span></label>
                        <select value={lugar} onChange={(e) => setLugar(e.target.value)}>
                            <option value="">— Sin objetivo específico —</option>
                            {data.objetivos.map((o) => <option key={o}>{o}</option>)}
                        </select>
                    </div>
                    <div className="field">
                        <label className="label">Tipo de Actividad</label>
                        <select value={actividad} onChange={(e) => setActividad(e.target.value)}>
                            <option value="">— Seleccionar tipo —</option>
                            {data.tiposActividad.map((t) => <option key={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="field">
                        <label className="label">Observaciones (opcional)</label>
                        <textarea
                            placeholder="Novedades, inconvenientes, detalles relevantes..."
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            style={{ minHeight: 90 }}
                        />
                    </div>
                    <p className="otra-info-note">
                        Se registrará automáticamente la ubicación GPS y hora de finalización.
                    </p>
                </div>

                <button className="btn btn-success" disabled={!actividad} onClick={handleFinalizar}>
                    ✓ Finalizar Actividad
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
            <div className="screen-title">Otra Actividad</div>
            <div className="screen-sub">Paso 1 — Registrar hora y ubicación de inicio</div>

            <div className="card">
                <div className="card-title">Inicio de actividad</div>

                <div className="ctrl-inicio-info">
                    <div className="ctrl-inicio-row">
                        <span className="ctrl-inicio-icon">🕐</span>
                        <div>
                            <div className="ctrl-inicio-label">Hora de inicio</div>
                            <div className="ctrl-inicio-value">{horaInicio} hs</div>
                        </div>
                    </div>
                    <div className="ctrl-inicio-row">
                        <span className="ctrl-inicio-icon">📍</span>
                        <div>
                            <div className="ctrl-inicio-label">Ubicación GPS</div>
                            <div className="ctrl-inicio-value">
                                {loadingGeo
                                    ? <span className="ctrl-gps-loading">Obteniendo...</span>
                                    : gps
                                }
                            </div>
                        </div>
                    </div>
                </div>

                <div className="alert alert-info" style={{ marginTop: "var(--space-3)" }}>
                    ℹ️ Se guarda la hora y ubicación de inicio. Podés cerrar la app y volver al terminar para completar el tipo y observaciones.
                </div>
            </div>

            <button className="btn btn-primary" disabled={loadingGeo} onClick={handleIniciar}>
                {loadingGeo
                    ? <><div className="spinner" /> Esperando GPS...</>
                    : "💾 Registrar Inicio"
                }
            </button>
            <button className="btn btn-secondary" onClick={onBack}>← Volver al menú</button>
        </>
    );
}
