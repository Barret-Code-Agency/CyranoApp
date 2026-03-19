// src/screens/admin/JornadaDetalle.jsx
import { useState } from "react";
import { useAppData } from "../../context/AppDataContext";
import { generarPDFJornada } from "../../utils/generarPDFJornada";
import { fmtMin as _fmtMin, urlToBase64 as _urlToBase64 } from "../../utils/helpers";

const CATS_DEF = [
    { tipo:"ctrl",     label:"Controles",       icon:"🎯", color:"#003087", bg:"#eef2ff", border:"#003087" },
    { tipo:"cap",      label:"Capacitaciones",   icon:"🎓", color:"#7c3aed", bg:"#f5f3ff", border:"#7c3aed" },
    { tipo:"traslado", label:"Traslados",         icon:"🚗", color:"#0369a1", bg:"#f0f9ff", border:"#0ea5e9" },
    { tipo:"admin",    label:"Administrativo",    icon:"📋", color:"#374151", bg:"#f3f4f6", border:"#6b7280" },
    { tipo:"vulnerab", label:"Vuln./Riesgos",     icon:"⚠️", color:"#b45309", bg:"#fffbeb", border:"#d97706" },
    { tipo:"reclamos", label:"Reclamos",           icon:"📣", color:"#dc2626", bg:"#fef2f2", border:"#dc2626" },
    { tipo:"almuerzo", label:"Almuerzo/Cena",     icon:"🍽️", color:"#15803d", bg:"#f0fdf4", border:"#16a34a" },
    { tipo:"taller",   label:"Taller/Rep.",       icon:"🔧", color:"#6b7280", bg:"#f9fafb", border:"#9ca3af" },
    { tipo:"gremial",  label:"Gremial",           icon:"🤝", color:"#6d28d9", bg:"#faf5ff", border:"#a78bfa" },
    { tipo:"otras",    label:"Otras",              icon:"📌", color:"#6b7280", bg:"#f3f4f6", border:"#d1d5db" },
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

    // Datos por categoría (solo las que tienen actividades)
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
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:1000,
            display:"flex", alignItems:"flex-start", justifyContent:"center",
            padding:"16px", overflowY:"auto" }}
            onClick={onClose}>
            <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:700,
                marginTop:8, marginBottom:8,
                boxShadow:"0 20px 60px rgba(0,45,114,0.3)" }}
                onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ background:"linear-gradient(135deg,#002d72,#003f9a)", borderRadius:"16px 16px 0 0",
                    padding:"16px 20px", color:"#fff", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                        <div style={{ fontSize:11, opacity:0.7, fontWeight:600, letterSpacing:1 }}>JORNADA</div>
                        <div style={{ fontSize:20, fontWeight:800, marginTop:2 }}>{j.jornadaID||"—"}</div>
                        <div style={{ fontSize:13, opacity:0.85, marginTop:4 }}>{j.nombre||"—"} · {j.fecha||"—"}</div>
                    </div>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <button onClick={handlePDF} disabled={pdfLoading}
                            style={{ background:"#c9a227", border:"none", color:"#fff",
                                borderRadius:8, padding:"6px 14px", cursor:"pointer",
                                fontSize:12, fontWeight:800, display:"flex", alignItems:"center", gap:6,
                                opacity: pdfLoading ? 0.7 : 1 }}>
                            {pdfLoading ? "⏳" : "⬇"} PDF
                        </button>
                        <button onClick={onClose} style={{ background:"rgba(255,255,255,0.15)", border:"none",
                            color:"#fff", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:13, fontWeight:700 }}>
                            ✕
                        </button>
                    </div>
                </div>
                {/* Métricas */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:1, background:"#e8eaf2" }}>
                    {[
                        { icon:"🚗", label:"Vehículo",    val:(j.vehiculo||"—").split(" ")[0] },
                        { icon:"📍", label:"Km recorridos", val: km>0?km+" km":"—" },
                        { icon:"⏰", label:"Inicio",      val:j.horaInicio||"—" },
                        { icon:"🏁", label:"Fin",         val:j.horaFin||"—" },
                    ].map(m => (
                        <div key={m.label} style={{ background:"#f8f9fc", padding:"12px 8px", textAlign:"center" }}>
                            <div style={{ fontSize:18 }}>{m.icon}</div>
                            <div style={{ fontWeight:800, fontSize:14, color:"#0d1b3e", marginTop:2 }}>{m.val}</div>
                            <div style={{ fontSize:10, color:"#8894ac", fontWeight:600 }}>{m.label}</div>
                        </div>
                    ))}
                </div>
                {/* Km detalle + totales de tiempo */}
                <div style={{ padding:"10px 20px", borderBottom:"1px solid #f0f2f7",
                    display:"flex", gap:20, flexWrap:"wrap", fontSize:12, color:"#555", alignItems:"center" }}>
                    <span>Km inicial: <strong>{j.kmInicial||"—"}</strong></span>
                    <span>Km final: <strong>{j.kmFinal||"—"}</strong></span>
                    {km > 0 && <span style={{ color:"#003087", fontWeight:700 }}>Netos: {km} km</span>}
                </div>
                {/* Resumen tiempos por categoría */}
                {catData.length > 0 && (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:1, background:"#e8eaf2", borderBottom:"1px solid #e8eaf2" }}>
                        {catData.map(c => (
                            <div key={c.tipo} style={{ background:c.bg, padding:"10px 8px", textAlign:"center",
                                flex:"1 1 80px", minWidth:80 }}>
                                <div style={{ fontSize:15 }}>{c.icon}</div>
                                <div style={{ fontWeight:800, fontSize:13, color:c.color, marginTop:1 }}>{c.items.length}</div>
                                <div style={{ fontWeight:700, fontSize:11, color:c.color }}>{_fmtMin(c.totalMin)}</div>
                                <div style={{ fontSize:9, color:"#8894ac", fontWeight:600, marginTop:1 }}>{c.label}</div>
                            </div>
                        ))}
                    </div>
                )}
                {/* Actividades */}
                <div style={{ padding:"16px 20px" }}>
                    {catData.map(cat => (
                        <div key={cat.tipo} style={{ marginBottom:14 }}>
                            <div style={{ fontSize:11, fontWeight:800, color:cat.color, letterSpacing:1,
                                marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                                <span style={{ background:cat.bg, padding:"2px 8px", borderRadius:99 }}>
                                    {cat.icon} {cat.label.toUpperCase()} ({cat.items.length})
                                    {cat.totalMin > 0 ? ` — ${_fmtMin(cat.totalMin)}` : ""}
                                </span>
                            </div>
                            {cat.tipo === "ctrl" && cat.items.map((c, i) => (
                                <div key={i} style={{ background:"#f8f9fc", borderRadius:8, padding:"10px 12px",
                                    marginBottom:6, borderLeft:`3px solid ${c.anomalia==="Sí"||c.anomalia===true?"#dc2626":cat.border}`, fontSize:12 }}>
                                    <div style={{ fontWeight:700, color:"#0d1b3e" }}>{c.objetivo||c.puesto||"—"}</div>
                                    <div style={{ display:"flex", gap:12, flexWrap:"wrap", color:"#8894ac", marginTop:4 }}>
                                        {(c.inicio||c.horaInicio) && <span>⏰ {c.inicio||c.horaInicio}{(c.fin||c.horaFin)?" → "+(c.fin||c.horaFin):""}</span>}
                                        {calcActMin(c) > 0 && <span>🕐 {_fmtMin(calcActMin(c))}</span>}
                                        {(c.anomalia==="Sí"||c.anomalia===true) && <span style={{ color:"#dc2626", fontWeight:700 }}>⚠️ Anomalía</span>}
                                    </div>
                                    {(c.observacion||c.novedad) && (
                                        <div style={{ marginTop:4, fontSize:11, color:"#555", fontStyle:"italic" }}>
                                            {c.observacion||c.novedad}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {cat.tipo === "cap" && cat.items.map((c, i) => (
                                <div key={i} style={{ background:"#f8f9fc", borderRadius:8, padding:"8px 12px",
                                    marginBottom:6, borderLeft:`3px solid ${cat.border}`, fontSize:12 }}>
                                    <div style={{ fontWeight:700 }}>{c.tema||c.descripcion||"Sin tema"}</div>
                                    <div style={{ color:"#8894ac", marginTop:2 }}>
                                        {c.duracion ? c.duracion+" min" : ""}{c.cantPersonas ? " · "+c.cantPersonas+" personas" : ""}
                                    </div>
                                    {c.detalle && <div style={{ color:"#555", marginTop:2, fontSize:11 }}>{c.detalle}</div>}
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
                                    <div key={i} style={{ background:"#f8f9fc", borderRadius:8, padding:"10px 12px",
                                        marginBottom:6, borderLeft:`3px solid ${cat.border}`, fontSize:12 }}>
                                        <div style={{ fontWeight:700, color:"#0d1b3e", marginBottom:2 }}>{nombre}</div>
                                        {detalle && <div style={{ color:"#555", marginBottom:2 }}>{detalle}</div>}
                                        <div style={{ color:"#8894ac", display:"flex", gap:12, flexWrap:"wrap", marginTop:4 }}>
                                            {ini && <span>⏰ {ini}{fin ? " → " + fin : ""}</span>}
                                            {min > 0 ? <span>🕐 {_fmtMin(min)}</span> : dur ? <span>🕐 {dur} min</span> : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                    {acts.length === 0 && (
                        <div style={{ textAlign:"center", color:"#aaa", padding:16, fontSize:13 }}>
                            Sin actividades registradas
                        </div>
                    )}

                    {/* Anomalías */}
                    {anomalias.length > 0 && (
                        <div style={{ marginTop:14 }}>
                            <div style={{ fontSize:11, fontWeight:800, color:"#dc2626", letterSpacing:1, marginBottom:8 }}>
                                <span style={{ background:"#fef2f2", padding:"2px 8px", borderRadius:99 }}>⚠️ ANOMALÍAS ({anomalias.length})</span>
                            </div>
                            {anomalias.map((c,i) => (
                                <div key={i} style={{ background:"#fef2f2", borderRadius:8, padding:"8px 12px",
                                    marginBottom:6, borderLeft:"3px solid #dc2626", fontSize:12 }}>
                                    <div style={{ fontWeight:700, color:"#991b1b" }}>{c.objetivo||c.puesto||"—"}</div>
                                    <div style={{ color:"#8894ac", marginTop:2 }}>{c.observacion||c.novedad||"Sin descripción"}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Novedades */}
                    {novedades && (
                        <div style={{ marginTop:14 }}>
                            <div style={{ fontSize:11, fontWeight:800, color:"#92400e", letterSpacing:1, marginBottom:8 }}>
                                <span style={{ background:"#fffbeb", padding:"2px 8px", borderRadius:99 }}>📝 NOVEDADES</span>
                            </div>
                            <div style={{ background:"#fffbeb", borderRadius:8, padding:"10px 12px",
                                borderLeft:"3px solid #f59e0b", fontSize:12, color:"#1c1917", lineHeight:1.5 }}>
                                {novedades}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
