// src/screens/ControlScreen.jsx
// INICIO: guarda hora + GPS solamente → puede cerrar app
// FINALIZAR: completa todos los datos (identificación + evaluación + anomalías)
import { useState, useEffect, useRef } from "react";
import { nowTime } from "../utils/helpers";
import { useAppData } from "../context/AppDataContext";
import "../styles/ControlScreen.css";

const CRITERIOS = [
    "Presencia",
    "Cumplimiento de horarios",
    "Completado de libro y registros",
    "Estado del equipamiento",
    "Orden y aseo del puesto",
    "Conocimiento de consignas",
];

export default function ControlScreen({ geo, onBack }) {
    const { data, iniciarActividad, finalizarActividad, actividadActiva, cancelarActividad } = useAppData();
    const enCurso = actividadActiva?.tipo === "ctrl";
    const fileRef = useRef();

    // ── Estado GPS (solo paso 1) ──
    const [gps,        setGps]        = useState("");
    const [loadingGeo, setLoadingGeo] = useState(!enCurso);

    // ── Estado paso 2 — identificación ──
    const [objetivo,    setObjetivo]    = useState("");
    const [vigilador,   setVigilador]   = useState("");
    const [vigFiltro,   setVigFiltro]   = useState("");
    const [paginaLibro, setPaginaLibro] = useState("");

    // ── Estado paso 2 — evaluación ──
    const [evalStep, setEvalStep] = useState(1); // 1=identificacion, 2=evaluacion, 3=anomalias
    const [ratings, setRatings]   = useState(
        Object.fromEntries(CRITERIOS.map((c) => [c, 0]))
    );

    // ── Estado paso 2 — anomalías ──
    const [anomalia,        setAnomalia]        = useState("");
    const [informeAnomalia, setInformeAnomalia] = useState("");
    const [fotos,           setFotos]           = useState([]);

    useEffect(() => {
        if (!enCurso) {
            geo.get().then((l) => { setGps(l); setLoadingGeo(false); });
        }
    }, []);

    // ── Validaciones ──
    const allRated = CRITERIOS.every((c) => ratings[c] > 0);
    const photosOk = true; // fotos opcionales
    const reportOk = anomalia !== "Sí" || informeAnomalia.trim().length > 10;

    const avgRating = allRated
        ? (Object.values(ratings).reduce((s, v) => s + v, 0) / CRITERIOS.length).toFixed(1)
        : null;
    const avgClass = !avgRating ? "" : Number(avgRating) >= 8 ? "high" : Number(avgRating) <= 4 ? "low" : "";

    const getStarClass = (n, val) => {
        if (val < n)  return "";
        if (val <= 4) return "on low";
        if (val <= 7) return "on";
        return "on high";
    };

    const setR = (c, v) => setRatings((r) => ({ ...r, [c]: v }));

    const handlePhoto = (e) => {
        Array.from(e.target.files).forEach((f) => {
            const r  = new FileReader();
            r.onload = (ev) => setFotos((prev) => [...prev, ev.target.result]);
            r.readAsDataURL(f);
        });
    };

    // ── PASO 1: solo guarda hora inicio + GPS ──
    const handleIniciar = () => {
        iniciarActividad("ctrl", {
            horaInicio:   nowTime(),
            ubicacionGPS: gps,
        });
    };

    // ── PASO 2 final: guarda todos los datos de identificación + evaluación ──
    const handleFinalizar = () => {
        finalizarActividad({
            objetivo, vigilador, paginaLibro,
            ratings, anomalia, informeAnomalia, fotos,
            horaFin: nowTime(),
        });
        onBack();
    };

    // ════════════════════════════════════════════════
    // VISTA PASO 1 — Iniciar (solo hora + GPS)
    // ════════════════════════════════════════════════
    if (!enCurso) {
        return (
            <>
                <div className="screen-title">Control de Objetivo</div>
                <div className="screen-sub">Paso 1 — Registrar llegada al puesto</div>

                <div className="card">
                    <div className="card-title">Inicio del control</div>

                    <div className="ctrl-inicio-info">
                        <div className="ctrl-inicio-row">
                            <span className="ctrl-inicio-icon">🕐</span>
                            <div>
                                <div className="ctrl-inicio-label">Hora de llegada</div>
                                <div className="ctrl-inicio-value">{nowTime()} hs</div>
                            </div>
                        </div>
                        <div className="ctrl-inicio-row">
                            <span className="ctrl-inicio-icon">📍</span>
                            <div>
                                <div className="ctrl-inicio-label">Ubicación GPS</div>
                                <div className="ctrl-inicio-value">
                                    {loadingGeo
                                        ? <><span className="ctrl-gps-loading">Obteniendo...</span></>
                                        : gps
                                    }
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="alert alert-info" style={{ marginTop: "var(--space-3)" }}>
                        ℹ️ Se guarda la hora y ubicación de llegada. Podés cerrar la app y volver después para completar la evaluación.
                    </div>
                </div>

                <button
                    className="btn btn-primary"
                    disabled={loadingGeo}
                    onClick={handleIniciar}
                >
                    {loadingGeo ? <><div className="spinner" /> Esperando GPS...</> : "💾 Registrar Llegada"}
                </button>
                <button className="btn btn-secondary" onClick={onBack}>← Volver al menú</button>
            </>
        );
    }

    // ════════════════════════════════════════════════
    // VISTA PASO 2 — Completar evaluación (3 sub-pasos)
    // ════════════════════════════════════════════════
    return (
        <>
            <div className="screen-title">Control de Objetivo</div>
            <div className="screen-sub">
                Paso 2 —{" "}
                {evalStep === 1 ? "Identificación del puesto"
                    : evalStep === 2 ? "Evaluación del vigilador"
                    : "Registro de anomalías"}
            </div>

            {/* Banner de actividad en curso */}
            <div className="act-en-curso-badge">
                <span className="act-en-curso-dot" />
                Llegada registrada a las <strong>{actividadActiva.horaInicio}</strong>
                &nbsp;·&nbsp; GPS: <small>{actividadActiva.ubicacionGPS}</small>
            </div>

            {/* Sub-progreso */}
            <div className="progress-wrap">
                <div className="progress-steps">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className={`progress-step ${i < evalStep ? "done" : i === evalStep ? "active" : ""}`} />
                    ))}
                </div>
            </div>

            {/* ── Sub-paso 1: Identificación ── */}
            {evalStep === 1 && (
                <>
                    <div className="card">
                        <div className="step-header">
                            <div className="step-num">1</div>
                            <div className="step-title">Identificación del Puesto</div>
                        </div>
                        <div className="field">
                            <label className="label">Objetivo</label>
                            <select value={objetivo} onChange={(e) => setObjetivo(e.target.value)}>
                                <option value="">— Seleccionar objetivo —</option>
                                {data.objetivos.map((o) => <option key={o}>{o}</option>)}
                            </select>
                        </div>
                        <div className="row">
                            <div className="field">
                                <label className="label">Vigilador</label>
                                <input
                                    type="text"
                                    placeholder="Filtrar por nombre..."
                                    value={vigFiltro}
                                    onChange={(e) => {
                                        setVigFiltro(e.target.value);
                                        setVigilador("");
                                    }}
                                    style={{ marginBottom: 4 }}
                                />
                                <select
                                    value={vigilador}
                                    onChange={(e) => setVigilador(e.target.value)}
                                    size={vigFiltro.length >= 3 ? Math.min(
                                        (data.vigiladores.filter(v =>
                                            v.toLowerCase().includes(vigFiltro.toLowerCase())
                                        ).length || 1), 5) : 1}
                                >
                                    <option value="">— Seleccionar —</option>
                                    {(vigFiltro.length >= 3
                                        ? data.vigiladores.filter(v =>
                                            v.toLowerCase().includes(vigFiltro.toLowerCase()))
                                        : data.vigiladores
                                    ).map((v) => <option key={v}>{v}</option>)}
                                </select>
                            </div>
                            <div className="field">
                                <label className="label">Página del libro</label>
                                <input type="number" placeholder="Nº" value={paginaLibro}
                                    onChange={(e) => setPaginaLibro(e.target.value)} />
                            </div>
                        </div>
                    </div>
                    <button className="btn btn-primary"
                        disabled={!objetivo || !vigilador || !paginaLibro}
                        onClick={() => setEvalStep(2)}>
                        Continuar → Evaluación
                    </button>
                    <button className="btn btn-secondary" onClick={onBack}>← Volver al menú</button>
                </>
            )}

            {/* ── Sub-paso 2: Evaluación ── */}
            {evalStep === 2 && (
                <>
                    <div className="card">
                        <div className="step-header">
                            <div className="step-num">2</div>
                            <div className="step-title">Evaluación del Vigilador</div>
                        </div>
                        <div className="criterios-hint">
                            <span className="hint-low" /> 1–4 Deficiente &nbsp;
                            <span className="hint-mid" /> 5–7 Regular &nbsp;
                            <span className="hint-high" /> 8–10 Bueno
                        </div>
                        {CRITERIOS.map((c) => {
                            const v = ratings[c];
                            return (
                                <div key={c} className="rating-row">
                                    <span className="rating-label">{c}</span>
                                    <div className="rating-stars">
                                        {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                                            <div key={n}
                                                className={`star ${v >= n ? getStarClass(n, v) : ""}`}
                                                onClick={() => setR(c, n)}>
                                                {n}
                                            </div>
                                        ))}
                                    </div>
                                    <span className="rating-val">{v > 0 ? v : "—"}</span>
                                </div>
                            );
                        })}
                        {avgRating && (
                            <div className="eval-average">
                                <span className="eval-average-label">Promedio general</span>
                                <span className={`eval-average-value ${avgClass}`}>{avgRating} / 10</span>
                            </div>
                        )}
                    </div>
                    <button className="btn btn-primary" disabled={!allRated} onClick={() => setEvalStep(3)}>
                        Continuar → Anomalías
                    </button>
                    <button className="btn btn-secondary" onClick={() => setEvalStep(1)}>← Atrás</button>
                </>
            )}

            {/* ── Sub-paso 3: Anomalías ── */}
            {evalStep === 3 && (
                <>
                    <div className="card">
                        <div className="step-header">
                            <div className="step-num">3</div>
                            <div className="step-title">Registro de Anomalías</div>
                        </div>
                        <div className="field">
                            <label className="label">¿Observó alguna anomalía?</label>
                            <select value={anomalia} onChange={(e) => setAnomalia(e.target.value)}>
                                <option value="">— Seleccionar —</option>
                                <option>No</option>
                                <option>Sí</option>
                            </select>
                        </div>
                        {anomalia === "Sí" && (
                            <>
                                <div className="anomaly-warning">
                                    ⚠️ Se requiere informe detallado. Podés adjuntar fotos de evidencia (opcional).
                                </div>
                                <div className="field">
                                    <label className="label">Informe de la anomalía</label>
                                    <textarea
                                        placeholder="Describí detalladamente la anomalía observada, acciones tomadas y recomendaciones..."
                                        value={informeAnomalia}
                                        onChange={(e) => setInformeAnomalia(e.target.value)}
                                        style={{ minHeight: 120 }}
                                    />
                                </div>
                                <div className="field">
                                    <div className="photos-counter">
                                        <span className="photos-counter-label">Fotos de evidencia</span>
                                        <span className={`photos-counter-badge ${fotos.length >= 5 ? "ok" : "pending"}`}>
                                            {fotos.length}/5 {fotos.length >= 5 ? "✓" : "mínimo"}
                                        </span>
                                    </div>
                                    <div className="photo-grid">
                                        {[...Array(Math.max(5, fotos.length + 1))].map((_, i) => (
                                            <div key={i}
                                                className={`photo-cell ${fotos[i] ? "filled" : ""}`}
                                                onClick={() => !fotos[i] && fileRef.current.click()}>
                                                {fotos[i] ? <img src={fotos[i]} alt="" /> : "📷"}
                                            </div>
                                        ))}
                                    </div>
                                    <input type="file" ref={fileRef} multiple accept="image/*" onChange={handlePhoto} />
                                </div>
                            </>
                        )}
                    </div>
                    <button className="btn btn-success"
                        disabled={!anomalia || !photosOk || !reportOk}
                        onClick={handleFinalizar}>
                        ✓ Guardar y Finalizar Control
                    </button>
                    <button className="btn btn-secondary" onClick={() => setEvalStep(2)}>← Atrás</button>
                </>
            )}
        </>
    );
}
