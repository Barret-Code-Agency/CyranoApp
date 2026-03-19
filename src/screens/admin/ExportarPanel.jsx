// src/screens/admin/ExportarPanel.jsx
import { useState } from "react";
import { exportarExcel } from "../../utils/exportarExcel";

export default function ExportarScreen({ jornadas, plan, planesSuper, getSupervisoresConEmail, getPlanSupervisor }) {
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
