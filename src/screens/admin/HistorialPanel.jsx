// src/screens/admin/HistorialPanel.jsx
import { useState, useMemo } from "react";
import { useAppData } from "../../context/AppDataContext";
import { generarPDFMultiple } from "../../utils/generarPDFJornada";
import JornadaDetalle from "./JornadaDetalle";
import { urlToBase64 as _urlToBase64, PERIODOS_FILTRO as PERIODOS } from "../../utils/helpers";

export default function HistorialAdminScreen({ jornadas }) {
    const { empresaNombre, empresaLogos } = useAppData();
    const [busqueda,   setBusqueda]   = useState("");
    const [filtroSup,  setFiltroSup]  = useState("todos");
    const [periodo,    setPeriodo]    = useState("todo");
    const [detalle,    setDetalle]    = useState(null);
    const [descargando, setDescargando] = useState(false);

    const supervisores = useMemo(() =>
        ["todos", ...[...new Set(jornadas.map(j => j.nombre).filter(Boolean))].sort()], [jornadas]);

    const filtradas = useMemo(() => {
        const hoy = new Date(); hoy.setHours(23,59,59,999);
        return [...jornadas]
            .filter(j => {
                if (periodo !== "todo") {
                    const desde = new Date(hoy); desde.setDate(hoy.getDate() - Number(periodo)); desde.setHours(0,0,0,0);
                    const jFecha = new Date(j.creadaEn || j.fecha || 0);
                    if (jFecha < desde) return false;
                }
                if (filtroSup !== "todos" && j.nombre !== filtroSup) return false;
                if (busqueda.trim()) {
                    const b = busqueda.toLowerCase();
                    return (j.nombre||"").toLowerCase().includes(b)
                        || (j.jornadaID||"").toLowerCase().includes(b)
                        || (j.vehiculo||"").toLowerCase().includes(b)
                        || (j.fecha||"").includes(b);
                }
                return true;
            })
            .sort((a,b) => (b.fecha||"")>(a.fecha||"") ? 1 : -1)
            .slice(0, 200)
            .map(j => ({
                ...j,
                _km:    Math.max(0, Number(j.kmFinal||0) - Number(j.kmInicial||0)),
                _ctrls: (j.actividades||[]).filter(a=>a.tipo==="ctrl").length,
                _caps:  (j.actividades||[]).filter(a=>a.tipo==="cap").length,
            }));
    }, [jornadas, busqueda, filtroSup, periodo]);

    // Stats de filtradas
    const stats = useMemo(() => {
        const kmTotal  = filtradas.reduce((s,j) => s + Math.max(0, Number(j.kmFinal||0) - Number(j.kmInicial||0)), 0);
        const ctrlTotal= filtradas.reduce((s,j) => s + (j.actividades||[]).filter(a=>a.tipo==="ctrl").length, 0);
        const capTotal = filtradas.reduce((s,j) => s + (j.actividades||[]).filter(a=>a.tipo==="cap").length, 0);
        const sups     = [...new Set(filtradas.map(j=>j.nombre).filter(Boolean))].length;
        return { kmTotal, ctrlTotal, capTotal, sups };
    }, [filtradas]);

    return (
        <>
            {detalle && <JornadaDetalle j={detalle} onClose={() => setDetalle(null)} />}

            <div className="admin-header">
                <div>
                    <div className="screen-title">Historial de jornadas</div>
                    <div className="screen-sub">{jornadas.length} jornadas en total</div>
                </div>
                <button
                    disabled={descargando || filtradas.length === 0}
                    onClick={async () => {
                        setDescargando(true);
                        try {
                            const logo = empresaLogos?.panel ? await _urlToBase64(empresaLogos.panel) : null;
                            generarPDFMultiple(filtradas, empresaNombre, logo);
                        } finally { setDescargando(false); }
                    }}
                    style={{ background:"#003087", border:"none", color:"#fff", borderRadius:8,
                        padding:"8px 16px", cursor:"pointer", fontSize:12, fontWeight:800,
                        display:"flex", alignItems:"center", gap:6, opacity: filtradas.length===0?0.5:1 }}>
                    ⬇ {descargando ? "Generando…" : `Descargar ${filtradas.length} PDF${filtradas.length!==1?"s":""}`}
                </button>
            </div>

            {/* KPIs */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:16 }}>
                {[
                    { icon:"📋", label:"Jornadas",     val:filtradas.length,    color:"#003087" },
                    { icon:"🎯", label:"Controles",    val:stats.ctrlTotal,     color:"#003087" },
                    { icon:"🎓", label:"Capacitaciones",val:stats.capTotal,     color:"#7c3aed" },
                    { icon:"🚗", label:"Km totales",   val:stats.kmTotal>0?stats.kmTotal+" km":"—", color:"#10b981" },
                ].map(k => (
                    <div key={k.label} style={{ background:"#fff", border:"1px solid var(--color-border)",
                        borderRadius:10, padding:"10px 8px", textAlign:"center",
                        boxShadow:"0 1px 4px rgba(0,45,114,0.07)" }}>
                        <div style={{ fontSize:20 }}>{k.icon}</div>
                        <div style={{ fontWeight:800, fontSize:18, color:k.color, lineHeight:1.1 }}>{k.val}</div>
                        <div style={{ fontSize:10, color:"#8894ac", fontWeight:600, marginTop:2 }}>{k.label}</div>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
                <div style={{ display:"flex", gap:3, background:"#f0f2f8", borderRadius:8, padding:3 }}>
                    {PERIODOS.map(p => (
                        <button key={p.k} onClick={() => setPeriodo(p.k)}
                            style={{ padding:"5px 10px", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer",
                                border:"none", background:periodo===p.k?"#003087":"transparent",
                                color:periodo===p.k?"#fff":"var(--color-muted)" }}>
                            {p.l}
                        </button>
                    ))}
                </div>
                <input placeholder="🔍 Buscar nombre, ID, vehículo..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
                    style={{ flex:1, minWidth:160, padding:"7px 12px", borderRadius:8,
                        border:"1.5px solid var(--color-border)", fontSize:12 }} />
                <select value={filtroSup} onChange={e => setFiltroSup(e.target.value)}
                    style={{ padding:"7px 10px", borderRadius:8, border:"1.5px solid var(--color-border)", fontSize:12 }}>
                    {supervisores.map(s => <option key={s} value={s}>{s==="todos"?"👤 Todos":s}</option>)}
                </select>
            </div>

            {/* Tarjetas de jornadas */}
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {filtradas.length === 0 ? (
                    <div style={{ textAlign:"center", padding:40, color:"#8894ac", fontSize:14,
                        background:"#f8f9fc", borderRadius:12 }}>
                        Sin jornadas para los filtros seleccionados
                    </div>
                ) : filtradas.map((j, i) => {
                    const { _km: km, _ctrls: ctrls, _caps: caps } = j;
                    const cerrada = j.estado === "cerrada" || !!j.horaFin;
                    return (
                        <div key={j.jornadaID ?? j.id ?? i}
                            onClick={() => setDetalle(j)}
                            style={{ background:"#fff", border:"1px solid var(--color-border)", borderRadius:10,
                                padding:"12px 14px", cursor:"pointer", transition:"all 0.1s ease",
                                boxShadow:"0 1px 3px rgba(0,45,114,0.06)",
                                borderLeft:`4px solid ${cerrada?"#10b981":"#f59e0b"}` }}
                            onMouseEnter={e => e.currentTarget.style.boxShadow="0 4px 12px rgba(0,45,114,0.15)"}
                            onMouseLeave={e => e.currentTarget.style.boxShadow="0 1px 3px rgba(0,45,114,0.06)"}
                        >
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                                {/* Left */}
                                <div style={{ flex:1, minWidth:0 }}>
                                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                                        <span style={{ fontWeight:800, fontSize:13, color:"#003087" }}>
                                            {j.jornadaID||"—"}
                                        </span>
                                        <span style={{ fontSize:12, color:"#555", fontWeight:600 }}>
                                            {j.fecha||"—"}
                                        </span>
                                        <span style={{ fontSize:11, background: cerrada?"#f0fdf4":"#fef3c7",
                                            color: cerrada?"#16a34a":"#92400e", fontWeight:700,
                                            padding:"1px 7px", borderRadius:99 }}>
                                            {cerrada?"✓ Cerrada":"⏳ Activa"}
                                        </span>
                                    </div>
                                    <div style={{ fontSize:13, fontWeight:700, color:"#0d1b3e", marginTop:4 }}>
                                        {j.nombre||"—"}
                                    </div>
                                    <div style={{ fontSize:11, color:"#8894ac", marginTop:2 }}>
                                        🚗 {(j.vehiculo||"—").split(" ").slice(0,3).join(" ")}
                                        {j.horaInicio ? " · ⏰ "+j.horaInicio : ""}
                                        {j.horaFin    ? " → "+j.horaFin      : ""}
                                    </div>
                                </div>
                                {/* Right — badges */}
                                <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end", flexShrink:0 }}>
                                    {km > 0 && (
                                        <span style={{ background:"#f0fdf4", color:"#16a34a", fontWeight:800,
                                            padding:"3px 9px", borderRadius:99, fontSize:12 }}>
                                            {km} km
                                        </span>
                                    )}
                                    <div style={{ display:"flex", gap:4 }}>
                                        {ctrls > 0 && (
                                            <span style={{ background:"#eef2ff", color:"#003087", fontWeight:800,
                                                padding:"3px 9px", borderRadius:99, fontSize:11 }}>
                                                🎯 {ctrls}
                                            </span>
                                        )}
                                        {caps > 0 && (
                                            <span style={{ background:"#f5f3ff", color:"#7c3aed", fontWeight:800,
                                                padding:"3px 9px", borderRadius:99, fontSize:11 }}>
                                                🎓 {caps}
                                            </span>
                                        )}
                                    </div>
                                    <span style={{ fontSize:10, color:"#b0b8cc" }}>Ver detalle →</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            {filtradas.length===200 && (
                <div style={{ textAlign:"center", fontSize:12, color:"#8894ac", marginTop:12, padding:8,
                    background:"#f8f9fc", borderRadius:8 }}>
                    Mostrando las 200 más recientes — usá los filtros para acotar
                </div>
            )}
        </>
    );
}
