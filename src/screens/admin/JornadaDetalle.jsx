// src/screens/admin/JornadaDetalle.jsx
import { useState } from "react";
import { useAppData } from "../../context/AppDataContext";
import { generarPDFJornada } from "../../utils/generarPDFJornada";
import { fmtMin as _fmtMin, urlToBase64 as _urlToBase64 } from "../../utils/helpers";
import "../../styles/JornadaDetalle.css";

const CATS_DEF = [
    { tipo:"ctrl",     label:"Controles",       icon:"🎯" },
    { tipo:"cap",      label:"Capacitaciones",   icon:"🎓" },
    { tipo:"traslado", label:"Traslados",         icon:"🚗" },
    { tipo:"admin",    label:"Administrativo",    icon:"📋" },
    { tipo:"vulnerab", label:"Vuln./Riesgos",     icon:"⚠️" },
    { tipo:"reclamos", label:"Reclamos",           icon:"📣" },
    { tipo:"almuerzo", label:"Almuerzo/Cena",     icon:"🍽️" },
    { tipo:"taller",   label:"Taller/Rep.",       icon:"🔧" },
    { tipo:"gremial",  label:"Gremial",           icon:"🤝" },
    { tipo:"otras",    label:"Otras",              icon:"📌" },
];

function calcActMin(a) {
    if (a.tipo === "cap") return Number(a.duracion) || 0;
    return _diffMin(a.inicio||a.horaInicio, a.fin||a.horaFin) + Number(a.duracionMin || 0);
}

function _diffMin(ini, fin) {
    if (!ini || !fin) return 0;
    try {
        const clean = s => s.replace(/[ap]\. ?m\./i, "").trim();
        const [h1, m1] = clean(ini).split(":").map(Number);
        const [h2, m2] = clean(fin).split(":").map(Number);
        if (isNaN(h1) || isNaN(h2)) return 0;
        const t1 = h1 * 60 + (m1 || 0), t2 = h2 * 60 + (m2 || 0);
        return t2 >= t1 ? t2 - t1 : 0;
    } catch { return 0; }
}

export default function JornadaDetalle({ j, onClose }) {
    const { empresaNombre, empresaLogos } = useAppData();
    const [pdfLoading, setPdfLoading] = useState(false);
    const km        = Math.max(0, Number(j.kmFinal||0) - Number(j.kmInicial||0));
    const acts      = j.actividades || [];
    const ctrls     = acts.filter(a => a.tipo==="ctrl");
    const anomalias = ctrls.filter(c => c.anomalia==="Sí" || c.anomalia===true);
    const novedades = j.novedades || j.observaciones || j.novedad;

    const catData = CATS_DEF.map(cat => ({
        ...cat,
        items:    acts.filter(a => a.tipo === cat.tipo),
        totalMin: acts.filter(a => a.tipo === cat.tipo).reduce((s, a) => s + calcActMin(a), 0),
    })).filter(c => c.items.length > 0);

    const handlePDF = async () => {
        setPdfLoading(true);
        try {
            const logo = empresaLogos?.panel ? await _urlToBase64(empresaLogos.panel) : null;
            generarPDFJornada(j, empresaNombre, logo);
        } finally { setPdfLoading(false); }
    };

    return (
        <div className="jd-overlay" onClick={onClose}>
            <div className="jd-modal" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="jd-header">
                    <div>
                        <div className="jd-header-label">JORNADA</div>
                        <div className="jd-header-id">{j.jornadaID||"—"}</div>
                        <div className="jd-header-sub">{j.nombre||"—"} · {j.fecha||"—"}</div>
                    </div>
                    <div className="jd-header-actions">
                        <button onClick={handlePDF} disabled={pdfLoading}
                            className={`jd-btn-pdf${pdfLoading ? " jd-btn-pdf--loading" : ""}`}>
                            {pdfLoading ? "⏳" : "⬇"} PDF
                        </button>
                        <button onClick={onClose} className="jd-btn-close">✕</button>
                    </div>
                </div>

                {/* Métricas */}
                <div className="jd-metrics">
                    {[
                        { icon:"🚗", label:"Vehículo",      val:(j.vehiculo||"—").split(" ")[0] },
                        { icon:"📍", label:"Km recorridos",  val: km>0?km+" km":"—" },
                        { icon:"⏰", label:"Inicio",         val:j.horaInicio||"—" },
                        { icon:"🏁", label:"Fin",            val:j.horaFin||"—" },
                    ].map(m => (
                        <div key={m.label} className="jd-metric-cell">
                            <div className="jd-metric-icon">{m.icon}</div>
                            <div className="jd-metric-val">{m.val}</div>
                            <div className="jd-metric-lbl">{m.label}</div>
                        </div>
                    ))}
                </div>

                {/* Km detalle */}
                <div className="jd-km-bar">
                    <span>Km inicial: <strong>{j.kmInicial||"—"}</strong></span>
                    <span>Km final: <strong>{j.kmFinal||"—"}</strong></span>
                    {km > 0 && <span className="jd-km-netos">Netos: {km} km</span>}
                </div>

                {/* Resumen por categoría */}
                {catData.length > 0 && (
                    <div className="jd-resumen">
                        {catData.map(c => (
                            <div key={c.tipo} className={`jd-resumen-cell jd-cat--${c.tipo}`}>
                                <div className="jd-resumen-icon">{c.icon}</div>
                                <div className="jd-resumen-count">{c.items.length}</div>
                                <div className="jd-resumen-time">{_fmtMin(c.totalMin)}</div>
                                <div className="jd-resumen-label">{c.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Actividades */}
                <div className="jd-acts">
                    {catData.map(cat => (
                        <div key={cat.tipo} className={`jd-cat-group jd-cat--${cat.tipo}`}>
                            <div className="jd-cat-title">
                                <span className="jd-cat-badge">
                                    {cat.icon} {cat.label.toUpperCase()} ({cat.items.length})
                                    {cat.totalMin > 0 ? ` — ${_fmtMin(cat.totalMin)}` : ""}
                                </span>
                            </div>

                            {cat.tipo === "ctrl" && cat.items.map((c, i) => (
                                <div key={i} className={`jd-card${c.anomalia==="Sí"||c.anomalia===true ? " jd-card--anomalia" : ""}`}>
                                    <div className="jd-card-title">{c.objetivo||c.puesto||"—"}</div>
                                    <div className="jd-card-meta">
                                        {(c.inicio||c.horaInicio) && <span>⏰ {c.inicio||c.horaInicio}{(c.fin||c.horaFin)?" → "+(c.fin||c.horaFin):""}</span>}
                                        {calcActMin(c) > 0 && <span>🕐 {_fmtMin(calcActMin(c))}</span>}
                                        {(c.anomalia==="Sí"||c.anomalia===true) && <span className="jd-card-anomaly-tag">⚠️ Anomalía</span>}
                                    </div>
                                    {(c.observacion||c.novedad) && (
                                        <div className="jd-card-obs">{c.observacion||c.novedad}</div>
                                    )}
                                </div>
                            ))}

                            {cat.tipo === "cap" && cat.items.map((c, i) => (
                                <div key={i} className="jd-card">
                                    <div className="jd-card-title">{c.tema||c.descripcion||"Sin tema"}</div>
                                    <div className="jd-card-meta">
                                        {c.duracion ? c.duracion+" min" : ""}{c.cantPersonas ? " · "+c.cantPersonas+" personas" : ""}
                                    </div>
                                    {c.detalle && <div className="jd-card-obs">{c.detalle}</div>}
                                </div>
                            ))}

                            {cat.tipo !== "ctrl" && cat.tipo !== "cap" && cat.items.map((a, i) => {
                                const nombre  = a.actividad || a.descripcion || a.detalle || a.tipo || "—";
                                const detalle = a.actividad ? (a.descripcion || a.detalle || "") : "";
                                const ini     = a.inicio || a.horaInicio || "";
                                const fin     = a.fin    || a.horaFin    || "";
                                const min     = calcActMin(a);
                                const dur     = a.duracionMin || a.duracion || "";
                                return (
                                    <div key={i} className="jd-card">
                                        <div className="jd-card-title--mb">{nombre}</div>
                                        {detalle && <div className="jd-card-detail">{detalle}</div>}
                                        <div className="jd-card-meta">
                                            {ini && <span>⏰ {ini}{fin ? " → " + fin : ""}</span>}
                                            {min > 0 ? <span>🕐 {_fmtMin(min)}</span> : dur ? <span>🕐 {dur} min</span> : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}

                    {acts.length === 0 && (
                        <div className="jd-empty">Sin actividades registradas</div>
                    )}

                    {/* Anomalías */}
                    {anomalias.length > 0 && (
                        <div className="jd-anomalias">
                            <div className="jd-anomalias-title">
                                <span className="jd-anomalias-badge">⚠️ ANOMALÍAS ({anomalias.length})</span>
                            </div>
                            {anomalias.map((c,i) => (
                                <div key={i} className="jd-anomalia-card">
                                    <div className="jd-anomalia-nombre">{c.objetivo||c.puesto||"—"}</div>
                                    <div className="jd-anomalia-obs">{c.observacion||c.novedad||"Sin descripción"}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Novedades */}
                    {novedades && (
                        <div className="jd-novedades">
                            <div className="jd-novedades-title">
                                <span className="jd-novedades-badge">📝 NOVEDADES</span>
                            </div>
                            <div className="jd-novedades-text">{novedades}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
