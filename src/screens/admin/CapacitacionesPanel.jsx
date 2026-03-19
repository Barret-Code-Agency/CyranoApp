// src/screens/admin/CapacitacionesPanel.jsx
import { useState, useMemo } from "react";
import { PERIODOS_FILTRO as PERIODOS } from "../../utils/helpers";

export default function CapacitacionesScreen({ jornadas }) {
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

    const totalMin = useMemo(() => filtradas.reduce((s, r) => s + (Number(r.duracion) || 0), 0), [filtradas]);

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
                    {icon:"👤",label:"Supervisores",val:supervisores.length - 1,color:"#7c3aed"},
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
