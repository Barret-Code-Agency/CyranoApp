// src/screens/HistorialScreen.jsx
// Historial de jornadas y controles vehiculares — búsqueda y descarga de PDFs
import { useState, useMemo } from "react";
import { useAppData } from "../context/AppDataContext";
import { generarHojaSupervision } from "../utils/generarPDF";
import { generarPDFControlVehicular } from "../utils/generarPDF_ControlVehicular";
import "../styles/HistorialScreen.css";

const fmtFecha = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

function TagEstado({ estado }) {
    const map = {
        cerrada: { txt: "Cerrada", bg: "#f0fdf4", fg: "#16a34a" },
        activa:  { txt: "Activa",  bg: "#eff6ff", fg: "#2563eb" },
    };
    const s = map[estado] || { txt: estado, bg: "#f5f5f5", fg: "#666" };
    return (
        <span style={{ background: s.bg, color: s.fg, borderRadius: 99, padding: "2px 8px", fontSize: 10, fontWeight: 700, border: `1px solid ${s.fg}33` }}>
            {s.txt}
        </span>
    );
}

function DescargaBtn({ label, onClick, loading }) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            style={{
                fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 6,
                border: "1.5px solid #d0d8e8", background: loading ? "#f0f2f8" : "#fff",
                color: loading ? "#aab" : "#0056b3", cursor: loading ? "default" : "pointer",
                display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
            }}
        >
            {loading ? "⏳" : "⬇"} {label}
        </button>
    );
}

export default function HistorialScreen({ onBack }) {
    const { jornadas, getSupervisoresConEmail } = useAppData();

    const [busqueda,  setBusqueda]  = useState("");
    const [filtroSup, setFiltroSup] = useState("todos");
    const [filtroTipo, setFiltroTipo] = useState("jornadas"); // "jornadas" | "vehiculares"
    const [loading,   setLoading]   = useState({});
    const [expandida, setExpandida] = useState(null);

    const supervisores = getSupervisoresConEmail();

    // ── Jornadas filtradas ────────────────────────────────────
    const jornadasFiltradas = useMemo(() => {
        return [...jornadas]
            .filter(j => {
                const matchSup = filtroSup === "todos" || j.nombre === filtroSup || j.email === filtroSup;
                const matchBus = !busqueda ||
                    (j.jornadaID || "").toLowerCase().includes(busqueda.toLowerCase()) ||
                    (j.nombre    || "").toLowerCase().includes(busqueda.toLowerCase()) ||
                    (j.fecha     || "").includes(busqueda) ||
                    (j.vehiculo  || "").toLowerCase().includes(busqueda.toLowerCase());
                return matchSup && matchBus;
            })
            .sort((a, b) => new Date(b.creadaEn || 0) - new Date(a.creadaEn || 0));
    }, [jornadas, busqueda, filtroSup]);

    // ── Controles vehiculares filtrados ───────────────────────
    const controlesFiltrados = useMemo(() => {
        const todos = jornadas
            .filter(j => j.controlVehicular)
            .map(j => ({ ...j.controlVehicular, jornadaID: j.jornadaID, supervisor: j.nombre }));
        return todos
            .filter(c => {
                const matchSup = filtroSup === "todos" || c.supervisor === filtroSup;
                const matchBus = !busqueda ||
                    (c.jornadaID || "").toLowerCase().includes(busqueda.toLowerCase()) ||
                    (c.supervisor || "").toLowerCase().includes(busqueda.toLowerCase()) ||
                    (c.vehiculo  || "").toLowerCase().includes(busqueda.toLowerCase()) ||
                    (c.fecha     || "").includes(busqueda);
                return matchSup && matchBus;
            })
            .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    }, [jornadas, busqueda, filtroSup]);

    const handleDescargarJornada = async (jornada) => {
        const key = "j_" + jornada.jornadaID;
        setLoading(p => ({ ...p, [key]: true }));
        try {
            const result = await generarHojaSupervision(jornada);
            const a = document.createElement("a");
            a.href = result.dataUrl;
            a.download = result.filename;
            a.click();
        } catch (e) {
            alert("Error al generar PDF: " + e.message);
        } finally {
            setLoading(p => ({ ...p, [key]: false }));
        }
    };

    const handleDescargarControl = async (control) => {
        const key = "cv_" + control.jornadaID;
        setLoading(p => ({ ...p, [key]: true }));
        try {
            const result = await generarPDFControlVehicular(control);
            const a = document.createElement("a");
            a.href = result.dataUrl;
            a.download = result.filename;
            a.click();
        } catch (e) {
            alert("Error al generar PDF: " + e.message);
        } finally {
            setLoading(p => ({ ...p, [key]: false }));
        }
    };

    return (
        <div className="hist-root">
            {/* Header */}
            <div className="hist-header">
                <div>
                    <div className="hist-title">📁 Historial</div>
                    <div className="hist-sub">Buscá y descargá documentos anteriores</div>
                </div>
                {onBack && (
                    <button className="btn btn-secondary" onClick={onBack} style={{ padding: "8px 14px", fontSize: 12 }}>
                        ← Volver
                    </button>
                )}
            </div>

            {/* Tipo de documento */}
            <div className="hist-tipo-tabs">
                <button
                    className={`hist-tipo-tab ${filtroTipo === "jornadas" ? "active" : ""}`}
                    onClick={() => setFiltroTipo("jornadas")}
                >
                    📄 Hojas de recorrido <span className="hist-badge">{jornadas.length}</span>
                </button>
                <button
                    className={`hist-tipo-tab ${filtroTipo === "vehiculares" ? "active" : ""}`}
                    onClick={() => setFiltroTipo("vehiculares")}
                >
                    🚗 Controles vehiculares <span className="hist-badge">{controlesFiltrados.length}</span>
                </button>
            </div>

            {/* Filtros */}
            <div className="hist-filtros">
                <input
                    className="hist-input"
                    placeholder="🔍 Buscar por ID, supervisor, fecha, vehículo..."
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                />
                <select
                    className="hist-select"
                    value={filtroSup}
                    onChange={e => setFiltroSup(e.target.value)}
                >
                    <option value="todos">Todos los supervisores</option>
                    {supervisores.map(s => (
                        <option key={s.email || s.nombre} value={s.email || s.nombre}>{s.nombre}</option>
                    ))}
                </select>
            </div>

            {/* Lista jornadas */}
            {filtroTipo === "jornadas" && (
                <div className="hist-lista">
                    {jornadasFiltradas.length === 0 ? (
                        <div className="hist-empty">Sin jornadas que coincidan con la búsqueda</div>
                    ) : (
                        jornadasFiltradas.map(j => {
                            const key     = "j_" + j.jornadaID;
                            const abierta = expandida === key;
                            const ctrls   = (j.actividades || []).filter(a => a.tipo === "ctrl").length;
                            const caps    = (j.actividades || []).filter(a => a.tipo === "cap").length;
                            const otras   = (j.actividades || []).filter(a => a.tipo === "otra").length;

                            return (
                                <div key={j.jornadaID} className={`hist-item ${abierta ? "abierta" : ""}`}>
                                    <div className="hist-item-header" onClick={() => setExpandida(abierta ? null : key)}>
                                        <div className="hist-item-main">
                                            <span className="hist-item-id">{j.jornadaID}</span>
                                            <span className="hist-item-nombre">{j.nombre}</span>
                                        </div>
                                        <div className="hist-item-meta">
                                            <span className="hist-item-fecha">{j.fecha || fmtFecha(j.creadaEn)}</span>
                                            <TagEstado estado={j.estado} />
                                            <span className="hist-chevron">{abierta ? "▲" : "▼"}</span>
                                        </div>
                                    </div>
                                    {abierta && (
                                        <div className="hist-item-detalle">
                                            <div className="hist-detalle-grid">
                                                <div><span className="hist-dl">Vehículo</span><span className="hist-dv">{j.vehiculo || "—"}</span></div>
                                                <div><span className="hist-dl">Horario</span><span className="hist-dv">{j.horaInicio} → {j.horaFin || "—"}</span></div>
                                                <div><span className="hist-dl">Controles</span><span className="hist-dv" style={{ color: "#0056b3", fontWeight: 700 }}>{ctrls}</span></div>
                                                <div><span className="hist-dl">Capacit.</span><span className="hist-dv">{caps}</span></div>
                                                <div><span className="hist-dl">Otras</span><span className="hist-dv">{otras}</span></div>
                                                <div><span className="hist-dl">Km</span><span className="hist-dv">{j.kmFinal && j.kmInicial ? Math.max(Number(j.kmFinal) - Number(j.kmInicial), 0) + " km" : "—"}</span></div>
                                            </div>
                                            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                                                <DescargaBtn
                                                    label="Hoja de Recorrido PDF"
                                                    loading={loading[key]}
                                                    onClick={() => handleDescargarJornada(j)}
                                                />
                                                {j.controlVehicular && (
                                                    <DescargaBtn
                                                        label="Control Vehicular PDF"
                                                        loading={loading["cv_" + j.jornadaID]}
                                                        onClick={() => handleDescargarControl({ ...j.controlVehicular, jornadaID: j.jornadaID, supervisor: j.nombre })}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Lista controles vehiculares */}
            {filtroTipo === "vehiculares" && (
                <div className="hist-lista">
                    {controlesFiltrados.length === 0 ? (
                        <div className="hist-empty">Sin controles vehiculares registrados</div>
                    ) : (
                        controlesFiltrados.map((c, i) => {
                            const key     = "cv_" + c.jornadaID + "_" + i;
                            const abierta = expandida === key;
                            return (
                                <div key={key} className={`hist-item ${abierta ? "abierta" : ""}`}>
                                    <div className="hist-item-header" onClick={() => setExpandida(abierta ? null : key)}>
                                        <div className="hist-item-main">
                                            <span className="hist-item-id">{c.jornadaID}</span>
                                            <span className="hist-item-nombre">{c.supervisor}</span>
                                        </div>
                                        <div className="hist-item-meta">
                                            <span className="hist-item-fecha">{c.fecha}</span>
                                            <span style={{
                                                background: c.sinNovedad ? "#f0fdf4" : "#fef2f2",
                                                color: c.sinNovedad ? "#16a34a" : "#dc2626",
                                                borderRadius: 99, padding: "2px 8px", fontSize: 10, fontWeight: 700,
                                                border: `1px solid ${c.sinNovedad ? "#16a34a" : "#dc2626"}33`
                                            }}>
                                                {c.sinNovedad ? "✓ Sin novedades" : "⚠ Con novedades"}
                                            </span>
                                            <span className="hist-chevron">{abierta ? "▲" : "▼"}</span>
                                        </div>
                                    </div>
                                    {abierta && (
                                        <div className="hist-item-detalle">
                                            <div className="hist-detalle-grid">
                                                <div><span className="hist-dl">Vehículo</span><span className="hist-dv">{c.vehiculo || "—"}</span></div>
                                                <div><span className="hist-dl">Hora</span><span className="hist-dv">{c.hora || "—"}</span></div>
                                                <div><span className="hist-dl">Ítems resp.</span><span className="hist-dv">{c.respondidos || 0}</span></div>
                                                <div><span className="hist-dl">Con novedad</span><span className="hist-dv" style={{ color: "#dc2626", fontWeight: 700 }}>{c.conNovedad || 0}</span></div>
                                                <div><span className="hist-dl">Fotos</span><span className="hist-dv">{c.fotos?.length || 0}</span></div>
                                            </div>
                                            {c.novedades && (
                                                <div style={{ marginTop: 8, padding: "8px 10px", background: "#fffbeb", borderRadius: 6, border: "1px solid #fde68a", fontSize: 12, color: "#92400e" }}>
                                                    <strong>Novedades:</strong> {c.novedades}
                                                </div>
                                            )}
                                            <div style={{ marginTop: 10 }}>
                                                <DescargaBtn
                                                    label="Control Vehicular PDF"
                                                    loading={loading[key]}
                                                    onClick={() => handleDescargarControl(c)}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
