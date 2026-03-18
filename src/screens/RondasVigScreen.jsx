// src/screens/RondasVigScreen.jsx
// Pantalla de ejecución de rondas para el Vigilador.
// Carga plantillas desde Firestore, inicia ronda, trackea GPS,
// detecta geofences y abre el checklist por checkpoint.

import { useState, useEffect, useCallback } from "react";
import { useAuth }    from "../context/AuthContext";
import { useAppData } from "../context/AppDataContext";
import { db }         from "../firebase";
import {
    collection, query, where, getDocs,
    addDoc, updateDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { distanciaMetros, formatearHora } from "../utils/geoUtils";
import ChecklistModal from "./ChecklistModal";
import "../styles/RondasVigScreen.css";

// ── Helpers ────────────────────────────────────────────────────────────────────

function freqLabel(freq) {
    if (!freq) return null;
    if (freq.tipo === "por_turno")       return `🔁 ${freq.cantidad} ronda${freq.cantidad !== 1 ? "s" : ""} por turno`;
    if (freq.tipo === "cada_horas")      return `⏱ Cada ${freq.horas}h`;
    if (freq.tipo === "horarios_fijos")  return `🕐 ${(freq.horarios || []).join(" · ")}`;
    return null;
}

function iconEstado(estado, esCercano) {
    if (estado === "completo") return "✅";
    if (esCercano)             return "📍";
    return "⭕";
}

function labelDistancia(dist, radio) {
    if (dist === null) return null;
    if (dist <= radio) return `📍 Estás aquí (${Math.round(dist)}m)`;
    if (dist < 200)    return `${Math.round(dist)}m — ¡Casi llegás!`;
    if (dist < 1000)   return `${Math.round(dist)}m`;
    return `${(dist / 1000).toFixed(1)}km`;
}

function gpsStatus(pos, error) {
    if (error)                       return { key: "error",   label: error };
    if (!pos)                        return { key: "loading", label: "Obteniendo señal GPS..." };
    if (pos.accuracy <= 15)          return { key: "ok",      label: `GPS preciso ±${Math.round(pos.accuracy)}m` };
    if (pos.accuracy <= 50)          return { key: "warn",    label: `GPS moderado ±${Math.round(pos.accuracy)}m` };
    return                                  { key: "warn",    label: `GPS impreciso ±${Math.round(pos.accuracy)}m` };
}

// ── Componente principal ────────────────────────────────────────────────────────

export default function RondasVigScreen({ onBack }) {
    const { user }                    = useAuth();
    const { empresaNombre }           = useAppData();

    // Estado general
    const [plantillas, setPlantillas]     = useState([]);
    const [loading, setLoading]           = useState(true);

    // Estado de ronda activa
    const [rondaActiva, setRondaActiva]   = useState(null); // { plantilla, rondaId, inicio }
    const [progreso, setProgreso]         = useState({});   // { [cpId]: { estado, llegada, respuestas } }
    const [terminada, setTerminada]       = useState(false);

    // GPS
    const [posicion, setPosicion]         = useState(null); // { lat, lng, accuracy }
    const [cpCercano, setCpCercano]       = useState(null); // checkpoint en geofence
    const [gpsError, setGpsError]         = useState(null);

    // Checklist
    const [checklistCp, setChecklistCp]   = useState(null);

    // ── Cargar plantillas ─────────────────────────────────────────────────────

    useEffect(() => {
        if (!user?.empresaId) { setLoading(false); return; }
        getDocs(query(
            collection(db, "plantillas_ronda"),
            where("empresa", "==", user.empresaId),
            where("activa",  "==", true),
        )).then(snap => {
            setPlantillas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }).catch(console.error).finally(() => setLoading(false));
    }, [user?.empresaId]);

    // ── GPS watchPosition ─────────────────────────────────────────────────────

    useEffect(() => {
        if (!rondaActiva || terminada) return;
        if (!navigator.geolocation) {
            setGpsError("GPS no disponible en este dispositivo");
            return;
        }

        const wid = navigator.geolocation.watchPosition(
            ({ coords }) => {
                const { latitude: lat, longitude: lng, accuracy } = coords;
                setPosicion({ lat, lng, accuracy });
                setGpsError(null);

                // Verificar proximidad a checkpoints pendientes
                const cps = rondaActiva.plantilla.checkpoints || [];
                let encontrado = null;

                for (const cp of cps) {
                    if (progreso[cp.id]?.estado === "completo") continue;
                    if (!cp.lat || !cp.lng) continue;

                    const dist = distanciaMetros(lat, lng, Number(cp.lat), Number(cp.lng));
                    if (dist <= (cp.radio || 30)) {
                        encontrado = { ...cp, dist };
                        break;
                    }
                }

                setCpCercano(prev => {
                    // Vibrar solo al entrar en un geofence nuevo
                    if (encontrado && prev?.id !== encontrado.id) {
                        navigator.vibrate?.([200, 100, 200, 100, 200]);
                    }
                    return encontrado;
                });
            },
            err => setGpsError(err.message),
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
        );

        return () => navigator.geolocation.clearWatch(wid);
    }, [rondaActiva, terminada, progreso]);

    // ── Iniciar ronda ─────────────────────────────────────────────────────────

    const iniciarRonda = async (plantilla) => {
        const progresoInicial = {};
        (plantilla.checkpoints || []).forEach(cp => {
            progresoInicial[cp.id] = { estado: "pendiente" };
        });

        const docRef = await addDoc(collection(db, "rondas_ejecucion"), {
            plantillaId:     plantilla.id,
            plantillaNombre: plantilla.nombre,
            guardiaId:       user.uid,
            guardiaNombre:   user.name || user.email || "—",
            empresa:         user.empresaId,
            inicio:          serverTimestamp(),
            fin:             null,
            estado:          "en_curso",
            frecuencia:      plantilla.frecuencia || null,
            cpDefs:          plantilla.checkpoints || [], // definiciones completas para el monitor
            checkpoints:     progresoInicial,
        });

        setProgreso(progresoInicial);
        setRondaActiva({ plantilla, rondaId: docRef.id, inicio: new Date() });
        setTerminada(false);
        setPosicion(null);
        setCpCercano(null);
        setGpsError(null);
    };

    // ── Completar checkpoint ──────────────────────────────────────────────────

    const completarCheckpoint = useCallback(async ({ cpId, respuestas, llegada }) => {
        const cpData = {
            estado:    "completo",
            llegada:   llegada?.toISOString?.() || new Date().toISOString(),
            respuestas,
            coords:    posicion || null,
        };

        const nuevoProgreso = { ...progreso, [cpId]: cpData };
        setProgreso(nuevoProgreso);
        setChecklistCp(null);
        setCpCercano(null);

        // Vibrar para confirmar
        navigator.vibrate?.([100, 50, 100]);

        // Actualizar Firestore
        if (rondaActiva?.rondaId) {
            updateDoc(doc(db, "rondas_ejecucion", rondaActiva.rondaId), {
                [`checkpoints.${cpId}`]: cpData,
            }).catch(console.error);
        }

        // ¿Todos completos? → finalizar automáticamente
        const cps         = rondaActiva.plantilla.checkpoints || [];
        const todosCompletos = cps.every(cp =>
            cp.id === cpId ? true : nuevoProgreso[cp.id]?.estado === "completo"
        );
        if (todosCompletos) {
            await finalizarRonda(nuevoProgreso, "completa");
        }
    }, [progreso, rondaActiva, posicion]);

    // ── Finalizar ronda ───────────────────────────────────────────────────────

    const finalizarRonda = async (progresoFinal, estado = "completa") => {
        if (rondaActiva?.rondaId) {
            await updateDoc(doc(db, "rondas_ejecucion", rondaActiva.rondaId), {
                estado,
                fin: serverTimestamp(),
            }).catch(console.error);
        }
        setTerminada(true);
    };

    const abandonarRonda = () => {
        if (!confirm("¿Seguro que querés abandonar la ronda?\nQuedará registrada como incompleta.")) return;
        finalizarRonda(progreso, "incompleta");
    };

    // ── Render: ronda finalizada ──────────────────────────────────────────────

    if (terminada) {
        const cps      = rondaActiva?.plantilla?.checkpoints || [];
        const completos = cps.filter(cp => progreso[cp.id]?.estado === "completo").length;
        const completo  = completos === cps.length;

        return (
            <div className="rv-root">
                <div className="rv-header">
                    <div className="rv-header-title">🗺️ Ronda finalizada</div>
                </div>
                <div className="rv-done">
                    <div className="rv-done-icon">{completo ? "🎉" : "⚠️"}</div>
                    <div className={`rv-done-title${completo ? "" : " rv-done-title--parcial"}`}>
                        {completo ? "¡Ronda completa!" : "Ronda finalizada"}
                    </div>

                    <div className="rv-done-stats">
                        <div className="rv-done-stat">
                            <div className="rv-done-stat-val">{completos}</div>
                            <div className="rv-done-stat-label">Completados</div>
                        </div>
                        <div className="rv-done-stat">
                            <div className="rv-done-stat-val">{cps.length - completos}</div>
                            <div className="rv-done-stat-label">Pendientes</div>
                        </div>
                        <div className="rv-done-stat">
                            <div className="rv-done-stat-val">
                                {Math.round((completos / Math.max(cps.length, 1)) * 100)}%
                            </div>
                            <div className="rv-done-stat-label">Cumplimiento</div>
                        </div>
                    </div>

                    <div className="rv-done-meta">
                        {rondaActiva?.plantilla?.nombre}<br />
                        Iniciada a las {rondaActiva?.inicio
                            ? new Date(rondaActiva.inicio).toLocaleTimeString("es-AR",
                                { hour: "2-digit", minute: "2-digit" })
                            : "—"}
                    </div>

                    <button
                        className="rv-done-btn"
                        onClick={() => {
                            setRondaActiva(null);
                            setTerminada(false);
                            setProgreso({});
                            setCpCercano(null);
                            setPosicion(null);
                        }}
                    >
                        Volver al menú
                    </button>
                </div>
            </div>
        );
    }

    // ── Render: ronda en curso ────────────────────────────────────────────────

    if (rondaActiva) {
        const cps      = rondaActiva.plantilla.checkpoints || [];
        const completos = cps.filter(cp => progreso[cp.id]?.estado === "completo").length;
        const pct       = cps.length > 0 ? (completos / cps.length) * 100 : 0;
        const gps       = gpsStatus(posicion, gpsError);

        return (
            <div className="rv-root">
                {/* Header */}
                <div className="rv-header">
                    <div className="rv-header-title">📍 {rondaActiva.plantilla.nombre}</div>
                </div>

                {/* Barra de progreso */}
                <div className="rv-progress-bar">
                    <div className="rv-progress-track">
                        <div className="rv-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="rv-progress-text">{completos}/{cps.length} checkpoints</div>
                </div>

                {/* GPS status */}
                <div className="rv-gps-bar">
                    <div className={`rv-gps-dot rv-gps-dot--${gps.key}`} />
                    <span>{gps.label}</span>
                </div>

                {/* Lista checkpoints */}
                <div className="rv-cp-list">
                    {cps.map((cp, idx) => {
                        const estado    = progreso[cp.id]?.estado || "pendiente";
                        const esCercano = cpCercano?.id === cp.id;
                        const dist      = posicion && cp.lat && cp.lng
                            ? distanciaMetros(posicion.lat, posicion.lng, Number(cp.lat), Number(cp.lng))
                            : null;
                        const claseItem = esCercano ? "cercano" : estado;

                        return (
                            <div key={cp.id} className={`rv-cp-item rv-cp-item--${claseItem}`}>
                                <div className="rv-cp-header">
                                    <div className="rv-cp-estado-icon">
                                        {iconEstado(estado, esCercano)}
                                    </div>
                                    <div className="rv-cp-info">
                                        <div className="rv-cp-nombre">
                                            {rondaActiva.plantilla.ordenFijo && (
                                                <span style={{
                                                    fontSize: "var(--text-xs)",
                                                    color: "var(--color-muted)",
                                                    marginRight: 6,
                                                    fontWeight: 600,
                                                }}>
                                                    #{idx + 1}
                                                </span>
                                            )}
                                            {cp.nombre}
                                        </div>
                                        <div className={`rv-cp-dist${esCercano ? " rv-cp-dist--cerca" : ""}`}>
                                            {estado === "completo"
                                                ? `✅ Completado · ${cp.tareas?.length || 0} tareas`
                                                : dist !== null
                                                    ? labelDistancia(dist, cp.radio || 30)
                                                    : `${cp.tareas?.length || 0} tarea${cp.tareas?.length !== 1 ? "s" : ""}`
                                            }
                                        </div>
                                    </div>
                                    {esCercano && estado !== "completo" && (
                                        <span className="rv-cp-badge rv-cp-badge--cercano">¡Cerca!</span>
                                    )}
                                    {estado === "completo" && (
                                        <span className="rv-cp-badge rv-cp-badge--completo">✓ OK</span>
                                    )}
                                </div>

                                {/* Botón de checklist cuando está cerca */}
                                {esCercano && estado !== "completo" && (
                                    <div className="rv-cp-cta">
                                        <button
                                            className="rv-cp-checklist-btn rv-cp-checklist-btn--warn"
                                            onClick={() => setChecklistCp(cp)}
                                        >
                                            📋 Completar checklist — {cp.nombre}
                                        </button>
                                    </div>
                                )}

                                {/* Fallback manual si no hay GPS */}
                                {!esCercano && estado === "pendiente" && (!posicion || gpsError) && (
                                    <div className="rv-cp-cta">
                                        <button
                                            className="rv-cp-checklist-btn"
                                            onClick={() => setChecklistCp(cp)}
                                        >
                                            📋 Completar manualmente
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Barra inferior */}
                <div className="rv-bottom-bar">
                    <button
                        className="rv-complete-btn"
                        disabled={completos === 0}
                        onClick={() => finalizarRonda(
                            progreso,
                            completos === cps.length ? "completa" : "incompleta"
                        )}
                    >
                        {completos === cps.length
                            ? "✅ Finalizar ronda"
                            : `Finalizar (${cps.length - completos} pendiente${cps.length - completos !== 1 ? "s" : ""})`
                        }
                    </button>
                    <button className="rv-abandon-btn" onClick={abandonarRonda}>
                        Abandonar
                    </button>
                </div>

                {/* Modal de checklist */}
                {checklistCp && (
                    <ChecklistModal
                        cp={checklistCp}
                        onComplete={completarCheckpoint}
                        onClose={() => setChecklistCp(null)}
                    />
                )}
            </div>
        );
    }

    // ── Render: lista de plantillas disponibles ────────────────────────────────

    return (
        <div className="rv-root">
            <div className="rv-header">
                <button className="rv-header-back" onClick={onBack}>← Volver</button>
                <div className="rv-header-title">🗺️ Realizar Ronda</div>
            </div>

            {loading ? (
                <div className="rv-list">
                    <div className="rv-empty">
                        <span className="rv-empty-icon">⏳</span>
                        Cargando rondas disponibles...
                    </div>
                </div>
            ) : (
                <div className="rv-list">
                    {plantillas.length === 0 ? (
                        <div className="rv-empty">
                            <span className="rv-empty-icon">🗺️</span>
                            <div>No hay rondas asignadas para tu empresa.</div>
                            <div style={{ fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
                                Consultá con tu supervisor o administrador de contrato.
                            </div>
                        </div>
                    ) : plantillas.map(p => (
                        <div key={p.id} className="rv-plantilla-card">
                            <div className="rv-plantilla-icon">🗺️</div>
                            <div className="rv-plantilla-info">
                                <div className="rv-plantilla-nombre">{p.nombre}</div>
                                <div className="rv-plantilla-meta">
                                    {p.checkpoints?.length || 0} checkpoint{p.checkpoints?.length !== 1 ? "s" : ""}
                                    {p.objetivo ? ` · ${p.objetivo}` : ""}
                                    {p.ordenFijo ? " · Orden fijo" : " · Orden libre"}
                                </div>
                                {freqLabel(p.frecuencia) && (
                                    <div style={{ fontSize:"var(--text-xs)", color:"var(--color-primary)", fontWeight:700, marginTop:2 }}>
                                        {freqLabel(p.frecuencia)}
                                    </div>
                                )}
                            </div>
                            <button
                                className="rv-iniciar-btn"
                                onClick={() => iniciarRonda(p)}
                            >
                                ▶ Iniciar
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
