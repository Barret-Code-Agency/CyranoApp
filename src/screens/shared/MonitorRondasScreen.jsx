// src/screens/MonitorRondasScreen.jsx
// Monitor de rondas para Supervisor y Admin de Contrato.
// Muestra historial de rondas con mapa Leaflet y detalle de actividades.

import { useState, useEffect, useRef } from "react";
import { useAuth }    from "../../context/AuthContext";
import { useAppData } from "../../context/AppDataContext";
import { db }         from "../../firebase";
import {
    collection, query, where, orderBy,
    limit, getDocs, onSnapshot,
} from "firebase/firestore";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./MonitorRondasScreen.css";

// ── Fix iconos Leaflet en Vite ─────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl:       "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    shadowUrl:     "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// ── Helpers ────────────────────────────────────────────────────────────────────

const COLOR_COMPLETO  = "#28a745";
const COLOR_PENDIENTE = "#adb5bd";
const COLOR_ANOMALIA  = "#ed1c24";
const COLOR_EN_CURSO  = "#002d72";

function colorCp(cp, progresoMap) {
    const p = progresoMap?.[cp.id];
    if (!p || p.estado !== "completo") return COLOR_PENDIENTE;
    // ¿tiene alguna actividad respondida "no"?
    const tieneAnomalia = Object.values(p.respuestas || {}).some(r => r === false);
    return tieneAnomalia ? COLOR_ANOMALIA : COLOR_COMPLETO;
}

function cpIcon(color, numero) {
    return L.divIcon({
        className: "",
        html: `<div class="mr-marker" style="background:${color}">${numero}</div>`,
        iconSize:   [32, 32],
        iconAnchor: [16, 16],
        popupAnchor:[0, -18],
    });
}

function fmtTs(ts) {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("es-AR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
}

function fmtDuracion(ini, fin) {
    if (!ini || !fin) return null;
    const a = ini.toDate ? ini.toDate() : new Date(ini);
    const b = fin.toDate ? fin.toDate() : new Date(fin);
    const m = Math.round((b - a) / 60000);
    if (m < 60) return `${m}min`;
    return `${Math.floor(m/60)}h ${m%60}min`;
}

function pctCompleto(ronda) {
    const cps = ronda.cpDefs || [];
    if (!cps.length) return 0;
    const ok = cps.filter(cp => ronda.checkpoints?.[cp.id]?.estado === "completo").length;
    return Math.round((ok / cps.length) * 100);
}

function countAnomalias(ronda) {
    let n = 0;
    Object.values(ronda.checkpoints || {}).forEach(cp => {
        Object.values(cp.respuestas || {}).forEach(r => { if (r === false) n++; });
    });
    return n;
}

// Centra el mapa en los checkpoints disponibles
function MapCenterer({ cps }) {
    const map = useMap();
    useEffect(() => {
        const validos = cps.filter(cp => cp.lat && cp.lng);
        if (!validos.length) return;
        if (validos.length === 1) {
            map.setView([Number(validos[0].lat), Number(validos[0].lng)], 16);
        } else {
            const bounds = L.latLngBounds(validos.map(cp => [Number(cp.lat), Number(cp.lng)]));
            map.fitBounds(bounds, { padding: [40, 40] });
        }
    }, [cps]);
    return null;
}

// ── Detalle de una ronda ──────────────────────────────────────────────────────

function RondaDetalle({ ronda }) {
    const cps = ronda.cpDefs || [];
    if (!cps.length) {
        return <div style={{ padding: "var(--space-3)", color: "var(--color-muted)", fontSize: "var(--text-sm)" }}>Sin checkpoints registrados.</div>;
    }
    return (
        <div className="mr-ronda-detalle">
            <div className="mr-detalle-titulo">Detalle por checkpoint</div>
            {cps.map((cp, idx) => {
                const prog       = ronda.checkpoints?.[cp.id];
                const completo   = prog?.estado === "completo";
                const respuestas = prog?.respuestas || {};
                const acts       = cp.actividades || [];
                const anomalias  = Object.values(respuestas).filter(r => r === false).length;
                const dotClass   = !completo ? "pendiente" : anomalias > 0 ? "anomalia" : "completo";

                return (
                    <div key={cp.id} className="mr-cp-detalle-row">
                        <div className="mr-cp-detalle-header">
                            <div className={`mr-cp-dot mr-cp-dot--${dotClass}`} />
                            <span>#{idx + 1} {cp.nombre}</span>
                            {completo && anomalias > 0 && (
                                <span style={{ marginLeft:"auto", color:"var(--color-danger)", fontSize:"var(--text-xs)", fontWeight:700 }}>
                                    ⚠️ {anomalias} anomalía{anomalias !== 1 ? "s" : ""}
                                </span>
                            )}
                            {!completo && (
                                <span style={{ marginLeft:"auto", color:"var(--color-muted)", fontSize:"var(--text-xs)" }}>
                                    No visitado
                                </span>
                            )}
                        </div>

                        {completo && acts.length > 0 && (
                            <div className="mr-cp-acts">
                                {acts.map(act => {
                                    const resp = respuestas[act.id];
                                    const obs  = respuestas[`${act.id}_obs`];
                                    return (
                                        <div key={act.id} className="mr-act-row">
                                            <span>{act.icono}</span>
                                            <span style={{ flex:1 }}>{act.nombre}</span>
                                            {resp === true  && <span className="mr-act-result mr-act-result--si">✅ SÍ</span>}
                                            {resp === false && <span className="mr-act-result mr-act-result--no">❌ NO</span>}
                                            {resp === undefined && <span className="mr-act-result mr-act-result--obs">—</span>}
                                            {obs && <span className="mr-act-result mr-act-result--obs" style={{ display:"block", width:"100%" }}>↳ {obs}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ── Componente principal ────────────────────────────────────────────────────────

export default function MonitorRondasScreen({ onBack }) {
    const { user }          = useAuth();
    const { empresaNombre } = useAppData();

    const [rondas, setRondas]           = useState([]);
    const [loading, setLoading]         = useState(true);
    const [seleccionada, setSeleccionada] = useState(null); // ronda seleccionada
    const [filtroFecha, setFiltroFecha] = useState(
        new Date().toISOString().slice(0, 10)  // hoy por defecto
    );
    const [mostrarTodas, setMostrarTodas] = useState(false);

    // Cargar rondas de Firestore
    useEffect(() => {
        if (!user?.empresaId) { setLoading(false); return; }

        const q = query(
            collection(db, "rondas_ejecucion"),
            where("empresa", "==", user.empresaId),
            orderBy("inicio", "desc"),
            limit(100),
        );

        const unsub = onSnapshot(q, snap => {
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setRondas(docs);
            setLoading(false);
        }, err => {
            console.error(err);
            setLoading(false);
        });

        return () => unsub();
    }, [user?.empresaId]);

    // Filtrar por fecha
    const rondasFiltradas = mostrarTodas
        ? rondas
        : rondas.filter(r => {
            if (!r.inicio) return true;
            const d = r.inicio.toDate ? r.inicio.toDate() : new Date(r.inicio);
            return d.toISOString().slice(0, 10) === filtroFecha;
        });

    // Stats del día
    const stats = {
        total:     rondasFiltradas.length,
        completas: rondasFiltradas.filter(r => r.estado === "completa").length,
        anomalias: rondasFiltradas.reduce((s, r) => s + countAnomalias(r), 0),
        enCurso:   rondasFiltradas.filter(r => r.estado === "en_curso").length,
    };

    // Checkpoints de la ronda seleccionada (para el mapa)
    const cpsMapa = seleccionada?.cpDefs?.filter(cp => cp.lat && cp.lng) || [];
    const polyline = cpsMapa.map(cp => [Number(cp.lat), Number(cp.lng)]);

    // Centro del mapa — Buenos Aires como fallback
    const mapCenter = cpsMapa.length
        ? [Number(cpsMapa[0].lat), Number(cpsMapa[0].lng)]
        : [-34.6037, -58.3816];

    return (
        <div className="mr-root">
            {/* Header */}
            <div className="mr-header">
                <button className="mr-header-back" onClick={onBack}>← Volver</button>
                <div className="mr-header-title">📡 Monitor de Rondas — {empresaNombre}</div>
            </div>

            {/* Stats */}
            <div className="mr-stats-bar">
                <div className="mr-stat">
                    <div className="mr-stat-val">{stats.total}</div>
                    <div className="mr-stat-label">Total</div>
                </div>
                <div className="mr-stat">
                    <div className="mr-stat-val">{stats.completas}</div>
                    <div className="mr-stat-label">Completas</div>
                </div>
                <div className="mr-stat">
                    <div className="mr-stat-val">{stats.enCurso}</div>
                    <div className="mr-stat-label">En curso</div>
                </div>
                <div className="mr-stat">
                    <div className="mr-stat-val" style={{ color: stats.anomalias > 0 ? "#ffc107" : "white" }}>
                        {stats.anomalias}
                    </div>
                    <div className="mr-stat-label">Anomalías</div>
                </div>
            </div>

            {/* Filtros */}
            <div className="mr-filters">
                <span className="mr-filter-label">Fecha:</span>
                <input
                    type="date"
                    className="mr-filter-input"
                    value={filtroFecha}
                    onChange={e => { setFiltroFecha(e.target.value); setMostrarTodas(false); }}
                />
                <button
                    style={{
                        background: mostrarTodas ? "var(--color-primary)" : "var(--color-bg-alt)",
                        color:      mostrarTodas ? "white" : "var(--color-text)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-md)",
                        padding: "var(--space-2) var(--space-3)",
                        cursor: "pointer",
                        fontSize: "var(--text-sm)",
                        fontWeight: 600,
                    }}
                    onClick={() => setMostrarTodas(v => !v)}
                >
                    {mostrarTodas ? "✓ Todas las fechas" : "Ver todas"}
                </button>
                {seleccionada && (
                    <button
                        style={{
                            background: "var(--color-red-ghost)",
                            color: "var(--color-danger)",
                            border: "none",
                            borderRadius: "var(--radius-md)",
                            padding: "var(--space-2) var(--space-3)",
                            cursor: "pointer",
                            fontSize: "var(--text-sm)",
                            fontWeight: 600,
                            marginLeft: "auto",
                        }}
                        onClick={() => setSeleccionada(null)}
                    >
                        ✕ Deseleccionar ronda
                    </button>
                )}
            </div>

            {/* Body split: mapa | lista */}
            <div className="mr-body">

                {/* ── Columna Mapa ── */}
                <div className="mr-map-col">
                    {!seleccionada ? (
                        <div className="mr-map-empty">
                            <div style={{ fontSize: 48 }}>🗺️</div>
                            <div>Seleccioná una ronda de la lista<br />para ver el mapa de checkpoints</div>
                        </div>
                    ) : (
                        <MapContainer
                            key={seleccionada.id}
                            center={mapCenter}
                            zoom={15}
                            className="mr-map-container"
                            style={{ height: "100%", width: "100%" }}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <MapCenterer cps={cpsMapa} />

                            {/* Línea de ruta */}
                            {polyline.length > 1 && (
                                <Polyline
                                    positions={polyline}
                                    color={COLOR_EN_CURSO}
                                    weight={3}
                                    opacity={0.5}
                                    dashArray="8 6"
                                />
                            )}

                            {/* Markers de checkpoints */}
                            {cpsMapa.map((cp, idx) => {
                                const color   = colorCp(cp, seleccionada.checkpoints);
                                const prog    = seleccionada.checkpoints?.[cp.id];
                                const acts    = cp.actividades || [];
                                const resps   = prog?.respuestas || {};
                                const anomN   = Object.values(resps).filter(r => r === false).length;

                                return (
                                    <Marker
                                        key={cp.id}
                                        position={[Number(cp.lat), Number(cp.lng)]}
                                        icon={cpIcon(color, idx + 1)}
                                    >
                                        <Popup minWidth={220}>
                                            <div style={{ fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}>
                                                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>
                                                    #{idx + 1} {cp.nombre}
                                                </div>
                                                <div style={{ fontSize: 12, color: prog?.estado === "completo" ? "#28a745" : "#888" }}>
                                                    {prog?.estado === "completo" ? "✅ Completado" : "⭕ No visitado"}
                                                    {anomN > 0 && ` · ⚠️ ${anomN} anomalía${anomN !== 1 ? "s" : ""}`}
                                                </div>
                                                {prog?.llegada && (
                                                    <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                                                        Llegada: {new Date(prog.llegada).toLocaleTimeString("es-AR", { hour:"2-digit", minute:"2-digit" })}
                                                    </div>
                                                )}
                                                {acts.length > 0 && prog?.estado === "completo" && (
                                                    <div style={{ marginTop: 6, fontSize: 11 }}>
                                                        {acts.slice(0, 5).map(act => (
                                                            <div key={act.id} style={{ display:"flex", justifyContent:"space-between", gap:8 }}>
                                                                <span>{act.icono} {act.nombre}</span>
                                                                <span style={{ color: resps[act.id] === true ? "#28a745" : resps[act.id] === false ? "#ed1c24" : "#888" }}>
                                                                    {resps[act.id] === true ? "✅" : resps[act.id] === false ? "❌" : "—"}
                                                                </span>
                                                            </div>
                                                        ))}
                                                        {acts.length > 5 && <div style={{ color:"#888" }}>...y {acts.length - 5} más</div>}
                                                    </div>
                                                )}
                                            </div>
                                        </Popup>
                                    </Marker>
                                );
                            })}
                        </MapContainer>
                    )}
                    {seleccionada && (
                        <div className="mr-map-hint">
                            🟢 Completo · 🔴 Anomalía · ⚫ No visitado
                        </div>
                    )}
                </div>

                {/* ── Columna Lista ── */}
                <div className="mr-list-col">
                    <div className="mr-list-header">
                        <span>Rondas ({rondasFiltradas.length})</span>
                        {loading && <span style={{ fontSize:"var(--text-xs)", color:"var(--color-muted)" }}>Actualizando...</span>}
                    </div>

                    <div className="mr-list-scroll">
                        {!loading && rondasFiltradas.length === 0 && (
                            <div className="mr-empty">
                                <div style={{ fontSize: 40 }}>📋</div>
                                <div>No hay rondas para esta fecha.</div>
                            </div>
                        )}

                        {rondasFiltradas.map(r => {
                            const pct       = pctCompleto(r);
                            const anomN     = countAnomalias(r);
                            const duracion  = fmtDuracion(r.inicio, r.fin);
                            const isSelected = seleccionada?.id === r.id;

                            return (
                                <div key={r.id}>
                                    <div
                                        className={`mr-ronda-item${isSelected ? " mr-ronda-item--selected" : ""}`}
                                        onClick={() => setSeleccionada(isSelected ? null : r)}
                                    >
                                        <div className="mr-ronda-top">
                                            <div className="mr-ronda-icon">
                                                {r.estado === "completa" ? "✅" : r.estado === "en_curso" ? "🔄" : "⚠️"}
                                            </div>
                                            <div className="mr-ronda-info">
                                                <div className="mr-ronda-nombre">{r.plantillaNombre || "Ronda"}</div>
                                                <div className="mr-ronda-guardia">👷 {r.guardiaNombre || "—"}</div>
                                                <div className="mr-ronda-meta">
                                                    <span>{fmtTs(r.inicio)}</span>
                                                    {duracion && <span>⏱ {duracion}</span>}
                                                    {anomN > 0 && (
                                                        <span style={{ color:"var(--color-danger)", fontWeight:700 }}>
                                                            ⚠️ {anomN} anomalía{anomN !== 1 ? "s" : ""}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <span className={`mr-estado-badge mr-estado-badge--${r.estado || "en_curso"}`}>
                                                    {r.estado === "completa"   ? "✓ Completa"   :
                                                     r.estado === "incompleta" ? "Incompleta" : "En curso"}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="mr-ronda-progress">
                                            <div style={{ display:"flex", justifyContent:"space-between", fontSize:"var(--text-xs)", color:"var(--color-muted)", marginBottom:4 }}>
                                                <span>{pct}% de checkpoints</span>
                                                <span>{(r.cpDefs || []).filter(cp => r.checkpoints?.[cp.id]?.estado === "completo").length}/{(r.cpDefs || []).length}</span>
                                            </div>
                                            <div className="mr-progress-track">
                                                <div
                                                    className={`mr-progress-fill mr-progress-fill--${r.estado || "en_curso"}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Detalle expandido al seleccionar */}
                                    {isSelected && <RondaDetalle ronda={r} />}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
