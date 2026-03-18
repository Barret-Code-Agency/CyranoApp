// src/screens/AdminScreen.jsx
import { useState, useMemo } from "react";
import { useAppData } from "../context/AppDataContext";
import { exportarExcel } from "../utils/exportarExcel";
import { generarPDFJornada, generarPDFMultiple } from "../utils/generarPDFJornada";
import DashboardScreen      from "./DashboardScreen";
import PlanSupervisorScreen from "./PlanSupervisorScreen";
import UsersScreen          from "./UsersScreen";
import VehiculosScreen      from "./VehiculosScreen";
import "../styles/AdminScreen.css";

const ADMIN_TABS = [
    { key: "dashboard",      icon: "📊", label: "Dashboard" },
    { key: "planes",         icon: "📋", label: "Planes" },
    { key: "usuarios",       icon: "👥", label: "Usuarios" },
    { key: "vehiculos",      icon: "🚗", label: "Vehículos" },
    { key: "capacitaciones", icon: "🎓", label: "Capacitaciones" },
    { key: "exportar",       icon: "📤", label: "Exportar" },
    { key: "historial",      icon: "🗂️",  label: "Historial" },
    { key: "config",         icon: "⚙️",  label: "Config" },
];

function EditableList({ icon, title, dataKey, items, onUpdate }) {
    const [newItem, setNewItem] = useState("");
    const handleAdd    = () => { const t = newItem.trim(); if (!t || items.includes(t)) return; onUpdate(dataKey, [...items, t]); setNewItem(""); };
    const handleDelete = (idx) => onUpdate(dataKey, items.filter((_, i) => i !== idx));
    const handleEdit   = (idx, value) => { const u = [...items]; u[idx] = value; onUpdate(dataKey, u); };
    return (
        <div className="admin-section">
            <div className="admin-section-header">
                <div className="admin-section-title"><span className="admin-section-icon">{icon}</span>{title}</div>
                <span className="admin-item-count">{items.length} ítem{items.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="admin-list">
                {items.length === 0 && <div className="admin-empty">Sin ítems.</div>}
                {items.map((item, idx) => (
                    <div key={idx} className="admin-item">
                        <span className="admin-item-drag">⠿</span>
                        <input className="admin-item-input" value={item} onChange={(e) => handleEdit(idx, e.target.value)} placeholder="Ítem vacío..." />
                        <button className="admin-btn-delete" onClick={() => handleDelete(idx)}>✕</button>
                    </div>
                ))}
            </div>
            <div className="admin-add-row">
                <input className="admin-add-input" placeholder={`Nuevo ${title.toLowerCase()}...`} value={newItem}
                    onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
                <button className="admin-btn-add" onClick={handleAdd} disabled={!newItem.trim()}>+</button>
            </div>
        </div>
    );
}

function ConfigPanel({ onUpdate, showToast }) {
    const { data, resetToDefaults } = useAppData();
    const [email, setEmail] = useState(data.supervisorEmail);
    const [showReset, setShowReset] = useState(false);
    const handleSaveEmail = () => { if (!email.includes("@")) return; onUpdate("supervisorEmail", email.trim()); showToast("✓ Email guardado"); };
    return (
        <>
            <div className="admin-email-section">
                <div className="admin-email-label"><span>📧</span> Email del supervisor</div>
                <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-end" }}>
                    <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="supervisor@empresa.com" />
                    </div>
                    <button className="btn btn-primary" style={{ width: "auto", padding: "10px 18px" }} onClick={handleSaveEmail} disabled={!email.includes("@")}>Guardar</button>
                </div>
            </div>
            <EditableList icon="🚗" title="Vehículos"           dataKey="vehiculos"      items={data.vehiculos}          onUpdate={onUpdate} />
            <EditableList icon="🎯" title="Objetivos / Puestos" dataKey="objetivos"      items={data.objetivos}          onUpdate={onUpdate} />
            <EditableList icon="👮" title="Vigiladores"         dataKey="vigiladores"    items={data.vigiladores}        onUpdate={onUpdate} />
            <EditableList icon="🔧" title="Tipos de actividad"  dataKey="tiposActividad" items={data.tiposActividad}     onUpdate={onUpdate} />
            <EditableList icon="👤" title="Supervisores"        dataKey="supervisores"   items={data.supervisores || []} onUpdate={onUpdate} />
            {!showReset ? (
                <button className="btn btn-secondary" style={{ color: "var(--color-danger)", borderColor: "rgba(226,1,19,0.3)", marginTop: "var(--space-2)" }} onClick={() => setShowReset(true)}>
                    Restaurar configuración por defecto
                </button>
            ) : (
                <div className="admin-reset-confirm">
                    <p>¿Restaurar <strong>todos los datos</strong> a los valores por defecto?</p>
                    <div className="admin-reset-confirm-actions">
                        <button className="btn btn-secondary" onClick={() => setShowReset(false)}>Cancelar</button>
                        <button className="btn btn-danger" onClick={() => { resetToDefaults(); setShowReset(false); showToast("↺ Restaurado"); }}>Sí, restaurar</button>
                    </div>
                </div>
            )}
        </>
    );
}

// ── Capacitaciones ────────────────────────────────────────────────────────────
function CapacitacionesScreen({ jornadas }) {
    const [busqueda,  setBusqueda]  = useState("");
    const [filtroSup, setFiltroSup] = useState("todos");
    const [periodo,   setPeriodo]   = useState("30");

    const todas = useMemo(() => {
        const hoy   = new Date(); hoy.setHours(23,59,59,999);
        const desde = new Date(hoy);
        if (periodo !== "todo") { desde.setDate(hoy.getDate() - Number(periodo)); desde.setHours(0,0,0,0); }
        const rows = [];
        jornadas.forEach(j => {
            const jFecha = new Date(j.creadaEn || j.fecha || 0);
            if (periodo !== "todo" && jFecha < desde) return;
            (j.actividades || []).forEach(a => {
                if (a.tipo !== "cap") return;
                rows.push({
                    supervisor: j.nombre || "—",
                    fecha:      j.fecha  || "—",
                    tema:       a.tema || a.descripcion || a.detalle || "Sin tema",
                    duracion:   a.duracion || a.duracionMin || null,
                    inicio:     a.inicio  || null,
                    fin:        a.fin     || null,
                    cantidad:   a.cantPersonas || a.cantidad || null,
                    jornadaID:  j.jornadaID || "—",
                });
            });
        });
        return rows.sort((a, b) => (b.fecha > a.fecha ? 1 : -1));
    }, [jornadas, periodo]);

    const supervisores = useMemo(() =>
        ["todos", ...[...new Set(todas.map(r => r.supervisor))].sort()], [todas]);

    const filtradas = useMemo(() =>
        todas.filter(r => {
            if (filtroSup !== "todos" && r.supervisor !== filtroSup) return false;
            if (busqueda.trim()) {
                const b = busqueda.toLowerCase();
                return r.tema.toLowerCase().includes(b) || r.supervisor.toLowerCase().includes(b);
            }
            return true;
        }), [todas, filtroSup, busqueda]);

    const totalMin = filtradas.reduce((s, r) => s + (Number(r.duracion) || 0), 0);

    const exportarCSV = () => {
        const header = "Fecha,Supervisor,Tema,Duración (min),Participantes,Jornada ID\n";
        const rows   = filtradas.map(r =>
            `${r.fecha},"${r.supervisor}","${r.tema}",${r.duracion||""},${r.cantidad||""},${r.jornadaID}`
        ).join("\n");
        const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href = url; a.download = `capacitaciones_${new Date().toISOString().slice(0,10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
    };

    const PERIODOS = [{k:"7",l:"7 días"},{k:"30",l:"30 días"},{k:"90",l:"3 meses"},{k:"todo",l:"Todo"}];

    return (
        <>
            <div className="admin-header">
                <div>
                    <div className="screen-title">Capacitaciones</div>
                    <div className="screen-sub">{filtradas.length} registros · {totalMin} min totales</div>
                </div>
                <button onClick={exportarCSV} disabled={filtradas.length === 0}
                    style={{ background:"#003087", color:"#fff", border:"none", borderRadius:8,
                        padding:"8px 16px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                    📥 Descargar CSV
                </button>
            </div>

            <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
                <div style={{ display:"flex", gap:3, background:"#f0f2f8", borderRadius:8, padding:3 }}>
                    {PERIODOS.map(p => (
                        <button key={p.k} onClick={() => setPeriodo(p.k)}
                            style={{ padding:"4px 10px", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer",
                                border:"none", background: periodo===p.k?"#003087":"transparent",
                                color: periodo===p.k?"#fff":"var(--color-muted)" }}>
                            {p.l}
                        </button>
                    ))}
                </div>
                <input placeholder="🔍 Buscar tema o supervisor..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
                    style={{ flex:1, minWidth:180, padding:"7px 12px", borderRadius:8,
                        border:"1.5px solid var(--color-border)", fontSize:12 }} />
                <select value={filtroSup} onChange={e => setFiltroSup(e.target.value)}
                    style={{ padding:"7px 10px", borderRadius:8, border:"1.5px solid var(--color-border)", fontSize:12 }}>
                    {supervisores.map(s => <option key={s} value={s}>{s==="todos"?"— Todos —":s}</option>)}
                </select>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14 }}>
                {[
                    {icon:"🎓",label:"Capacitaciones",val:filtradas.length,color:"#003087"},
                    {icon:"⏱️",label:"Minutos totales",val:totalMin,color:"#10b981"},
                    {icon:"👤",label:"Supervisores",val:[...new Set(filtradas.map(r=>r.supervisor))].length,color:"#7c3aed"},
                ].map(k => (
                    <div key={k.label} style={{ background:"#fff", border:"1px solid var(--color-border)",
                        borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
                        <div style={{ fontSize:18 }}>{k.icon}</div>
                        <div style={{ fontWeight:800, fontSize:20, color:k.color }}>{k.val}</div>
                        <div style={{ fontSize:10, color:"var(--color-muted)", fontWeight:600 }}>{k.label}</div>
                    </div>
                ))}
            </div>

            <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                    <thead>
                        <tr style={{ background:"#002d72", color:"#fff" }}>
                            {["Fecha","Supervisor","Tema","Duración","Participantes","Jornada"].map(h => (
                                <th key={h} style={{ padding:"8px 8px", textAlign:"left", fontWeight:700, whiteSpace:"nowrap" }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtradas.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign:"center", padding:32, color:"#8894ac" }}>
                                Sin capacitaciones en este período
                            </td></tr>
                        ) : filtradas.map((r, i) => (
                            <tr key={i} style={{ background:i%2===0?"#f8f9fc":"#fff", borderBottom:"1px solid #eef0f7" }}>
                                <td style={{ padding:"7px 8px", whiteSpace:"nowrap", color:"#555" }}>{r.fecha}</td>
                                <td style={{ padding:"7px 8px", fontWeight:600 }}>{(r.supervisor||"").split(" ").slice(0,2).join(" ")}</td>
                                <td style={{ padding:"7px 8px", maxWidth:220 }}>{r.tema}</td>
                                <td style={{ padding:"7px 8px", textAlign:"center" }}>
                                    {r.duracion
                                        ? <span style={{ background:"#f0fdf4",color:"#16a34a",fontWeight:700,padding:"2px 7px",borderRadius:99,fontSize:11 }}>{r.duracion} min</span>
                                        : <span style={{ color:"#aaa" }}>—</span>}
                                </td>
                                <td style={{ padding:"7px 8px", textAlign:"center" }}>
                                    {r.cantidad
                                        ? <span style={{ background:"#eef2ff",color:"#003087",fontWeight:700,padding:"2px 7px",borderRadius:99,fontSize:11 }}>{r.cantidad}</span>
                                        : <span style={{ color:"#aaa" }}>—</span>}
                                </td>
                                <td style={{ padding:"7px 8px", fontSize:10, color:"#8894ac" }}>{r.jornadaID}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}

// ── Exportar ──────────────────────────────────────────────────────────────────
function ExportarScreen({ jornadas, plan, planesSuper, getSupervisoresConEmail, getPlanSupervisor }) {
    const [loading, setLoading] = useState(false);
    const [ok,      setOk]      = useState(false);

    const handleExport = async () => {
        setLoading(true);
        try {
            await exportarExcel({ jornadas, plan, planesSuper, getSupervisoresConEmail, getPlanSupervisor });
            setOk(true); setTimeout(() => setOk(false), 3000);
        } catch (e) { alert("Error al exportar: " + e.message); }
        finally { setLoading(false); }
    };

    const totalJornadas = jornadas.length;
    const sups  = [...new Set(jornadas.map(j => j.nombre).filter(Boolean))];
    const ctrls = jornadas.reduce((s, j) => s + (j.actividades||[]).filter(a => a.tipo==="ctrl").length, 0);
    const caps  = jornadas.reduce((s, j) => s + (j.actividades||[]).filter(a => a.tipo==="cap").length, 0);

    return (
        <>
            <div className="admin-header">
                <div>
                    <div className="screen-title">Exportar datos</div>
                    <div className="screen-sub">Descargá el historial completo en Excel</div>
                </div>
            </div>
            <div className="admin-section" style={{ textAlign:"center", padding:"32px 16px" }}>
                <div style={{ fontSize:48, marginBottom:12 }}>📊</div>
                <div style={{ fontWeight:800, fontSize:18, color:"#0d1b3e", marginBottom:8 }}>Exportar a Excel</div>
                <div style={{ color:"var(--color-muted)", fontSize:13, marginBottom:20 }}>
                    {totalJornadas} jornadas · {ctrls} controles · {caps} capacitaciones · {sups.length} supervisores
                </div>
                <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap", marginBottom:24 }}>
                    {["📋 Resumen general","👤 Por supervisor","🎯 Por puesto","🚗 Km & vehículos","🎓 Capacitaciones"].map(l => (
                        <span key={l} style={{ background:"#f0f4ff",color:"#003087",border:"1px solid #c8d4f0",
                            borderRadius:99, padding:"4px 12px", fontSize:12, fontWeight:600 }}>{l}</span>
                    ))}
                </div>
                <button className="btn btn-primary" disabled={loading} onClick={handleExport} style={{ padding:"12px 32px", fontSize:15 }}>
                    {loading ? "⏳ Generando..." : ok ? "✓ Descargado" : "📤 Descargar Excel"}
                </button>
            </div>
        </>
    );
}

// ── Historial ─────────────────────────────────────────────────────────────────
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
function _fmtMin(m) {
    if (!m || m <= 0) return "—";
    const h = Math.floor(m / 60), min = m % 60;
    return h > 0 ? `${h}h ${min > 0 ? min + "m" : ""}`.trim() : `${min}m`;
}
async function _urlToBase64(url) {
    try {
        const res  = await fetch(url);
        const blob = await res.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror  = reject;
            reader.readAsDataURL(blob);
        });
    } catch { return null; }
}

function JornadaDetalle({ j, onClose }) {
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

function HistorialAdminScreen({ jornadas }) {
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
            .slice(0, 200);
    }, [jornadas, busqueda, filtroSup, periodo]);

    // Stats de filtradas
    const stats = useMemo(() => {
        const kmTotal  = filtradas.reduce((s,j) => s + Math.max(0, Number(j.kmFinal||0) - Number(j.kmInicial||0)), 0);
        const ctrlTotal= filtradas.reduce((s,j) => s + (j.actividades||[]).filter(a=>a.tipo==="ctrl").length, 0);
        const capTotal = filtradas.reduce((s,j) => s + (j.actividades||[]).filter(a=>a.tipo==="cap").length, 0);
        const sups     = [...new Set(filtradas.map(j=>j.nombre).filter(Boolean))].length;
        return { kmTotal, ctrlTotal, capTotal, sups };
    }, [filtradas]);

    const PERIODOS = [{k:"7",l:"7 días"},{k:"30",l:"30 días"},{k:"90",l:"3 meses"},{k:"todo",l:"Todo"}];

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
                    const km    = Math.max(0, Number(j.kmFinal||0) - Number(j.kmInicial||0));
                    const ctrls = (j.actividades||[]).filter(a=>a.tipo==="ctrl").length;
                    const caps  = (j.actividades||[]).filter(a=>a.tipo==="cap").length;
                    const cerrada = j.estado === "cerrada" || !!j.horaFin;
                    return (
                        <div key={i}
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

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function AdminScreen({ onExit }) {
    // ✅ CORREGIDO: todos los datos necesarios extraídos de useAppData
    const {
        data, updateConfig,
        jornadas,
        plan, planesSuper,
        getSupervisoresConEmail,
        getPlanSupervisor,
    } = useAppData();

    const [activeTab, setActiveTab] = useState("dashboard");
    const [toast,     setToast]     = useState("");
    const showToast   = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2100); };
    const handleUpdate = (key, value) => { updateConfig(key, value); showToast("✓ Guardado"); };

    return (
        <>
            {/* Tab bar — wraps en mobile para que no se corten */}
            <div style={{ display:"flex", flexWrap:"wrap", gap:4,
                borderBottom:"2px solid var(--color-border)",
                marginBottom:20, paddingBottom:8 }}>
                {ADMIN_TABS.map(t => (
                    <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                        border: activeTab===t.key ? "1.5px solid #c9a227" : "1.5px solid var(--color-border)",
                        borderRadius: 8,
                        background: activeTab===t.key ? "#fff8d6" : "#f8f9fc",
                        padding:"7px 12px", fontSize:12, fontWeight:700,
                        cursor:"pointer", whiteSpace:"nowrap",
                        display:"flex", alignItems:"center", gap:5,
                        color: activeTab===t.key ? "#7a5c00" : "var(--color-muted)",
                        transition:"all 0.12s ease",
                        boxShadow: activeTab===t.key ? "0 1px 4px rgba(201,162,39,0.2)" : "none",
                    }}>
                        <span>{t.icon}</span>{t.label}
                    </button>
                ))}
            </div>

            {activeTab === "dashboard" && (
                <>
                    <div className="admin-header">
                        <div>
                            <div className="screen-title">Dashboard</div>
                            <div className="screen-sub">Métricas y reportes operativos</div>
                        </div>
                    </div>
                    <DashboardScreen />
                </>
            )}
            {activeTab === "planes"         && <PlanSupervisorScreen />}
            {activeTab === "usuarios"       && <UsersScreen />}
            {activeTab === "vehiculos"      && <VehiculosScreen canEdit={true} />}
            {activeTab === "capacitaciones" && <CapacitacionesScreen jornadas={jornadas} />}
            {activeTab === "exportar"       && (
                <ExportarScreen jornadas={jornadas} plan={plan} planesSuper={planesSuper}
                    getSupervisoresConEmail={getSupervisoresConEmail} getPlanSupervisor={getPlanSupervisor} />
            )}
            {activeTab === "historial"      && <HistorialAdminScreen jornadas={jornadas} />}
            {activeTab === "config"         && (
                <>
                    <div className="admin-header">
                        <div>
                            <div className="screen-title">Configuración</div>
                            <div className="screen-sub">Listas y parámetros del sistema</div>
                        </div>
                        <span className="admin-badge">Administrador</span>
                    </div>
                    <ConfigPanel onUpdate={handleUpdate} showToast={showToast} />
                </>
            )}

            <div style={{ marginTop:"var(--space-5)" }}>
                <button className="btn btn-secondary" onClick={onExit}>← Salir del panel admin</button>
            </div>
            {toast && <div className="admin-toast">{toast}</div>}
        </>
    );
}
