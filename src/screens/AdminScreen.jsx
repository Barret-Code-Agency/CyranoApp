// src/screens/AdminScreen.jsx
import { useState, useMemo } from "react";
import { useAppData } from "../context/AppDataContext";
import { exportarExcel } from "../utils/exportarExcel";
import DashboardScreen      from "./DashboardScreen";
import PlanSupervisorScreen from "./PlanSupervisorScreen";
import UsersScreen          from "./UsersScreen";
import VehiculosScreen      from "./VehiculosScreen";
import "../styles/AdminScreen.css";

const ADMIN_TABS = [
    { key: "dashboard", icon: "📊", label: "Dashboard" },
    { key: "planes",    icon: "📋", label: "Planes" },
    { key: "usuarios",  icon: "👥", label: "Usuarios" },
    { key: "vehiculos", icon: "🚗", label: "Vehículos" },
    { key: "config",     icon: "⚙️", label: "Configuración" },
    { key: "exportar",   icon: "📤", label: "Exportar" },
    { key: "historial",  icon: "🗂️", label: "Historial" },
];

function EditableList({ icon, title, dataKey, items, onUpdate }) {
    const [newItem, setNewItem] = useState("");
    const handleAdd = () => { const t = newItem.trim(); if (!t || items.includes(t)) return; onUpdate(dataKey, [...items, t]); setNewItem(""); };
    const handleDelete = (idx) => onUpdate(dataKey, items.filter((_, i) => i !== idx));
    const handleEdit   = (idx, value) => { const u = [...items]; u[idx] = value; onUpdate(dataKey, u); };
    return (
        <div className="admin-section">
            <div className="admin-section-header">
                <div className="admin-section-title"><span className="admin-section-icon">{icon}</span>{title}</div>
                <span className="admin-item-count">{items.length} ítem{items.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="admin-list">
                {items.length === 0 && <div className="admin-empty">Sin ítems. Agregá uno abajo.</div>}
                {items.map((item, idx) => (
                    <div key={idx} className="admin-item">
                        <span className="admin-item-drag" title="Reordenar">⠿</span>
                        <input className="admin-item-input" value={item} onChange={(e) => handleEdit(idx, e.target.value)} placeholder="Ítem vacío..." />
                        <button className="admin-btn-delete" onClick={() => handleDelete(idx)} title="Eliminar">✕</button>
                    </div>
                ))}
            </div>
            <div className="admin-add-row">
                <input className="admin-add-input" placeholder={`Nuevo ítem para "${title}"...`} value={newItem}
                    onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
                <button className="admin-btn-add" onClick={handleAdd} disabled={!newItem.trim()} title="Agregar">+</button>
            </div>
        </div>
    );
}

function ConfigPanel({ onUpdate, showToast }) {
    const { data, resetToDefaults } = useAppData();
    const [email, setEmail]         = useState(data.supervisorEmail);
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
                <p style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)", marginTop: "var(--space-2)" }}>
                    A este email se envían los informes de cada jornada.
                </p>
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
                    <p>¿Restaurar <strong>todos los datos</strong> a los valores por defecto? Esta acción no se puede deshacer.</p>
                    <div className="admin-reset-confirm-actions">
                        <button className="btn btn-secondary" onClick={() => setShowReset(false)}>Cancelar</button>
                        <button className="btn btn-danger" onClick={() => { resetToDefaults(); setShowReset(false); showToast("↺ Restaurado"); }}>Sí, restaurar</button>
                    </div>
                </div>
            )}
        </>
    );
}


// ── Pantalla Exportar ─────────────────────────────────────────────────────────
function ExportarScreen({ jornadas, plan, planesSuper, getSupervisoresConEmail, getPlanSupervisor }) {
    const [loading, setLoading] = useState(false);
    const [ok, setOk] = useState(false);

    const handleExport = async () => {
        setLoading(true);
        try {
            await exportarExcel({ jornadas, plan, planesSuper, getSupervisoresConEmail, getPlanSupervisor });
            setOk(true);
            setTimeout(() => setOk(false), 3000);
        } catch (e) {
            alert("Error al exportar: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const totalJornadas = jornadas.length;
    const supervisores  = [...new Set(jornadas.map(j => j.nombre).filter(Boolean))];
    const controles     = jornadas.reduce((s, j) => s + (j.actividades || []).filter(a => a.tipo === "ctrl").length, 0);

    return (
        <>
            <div className="admin-header">
                <div>
                    <div className="screen-title">Exportar datos</div>
                    <div className="screen-sub">Descargá el historial completo en Excel</div>
                </div>
            </div>
            <div className="admin-section" style={{ textAlign: "center", padding: "32px 16px" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                <div style={{ fontWeight: 800, fontSize: 18, color: "#0d1b3e", marginBottom: 8 }}>
                    Exportar a Excel
                </div>
                <div style={{ color: "var(--color-muted)", fontSize: 13, marginBottom: 24 }}>
                    {totalJornadas} jornadas · {controles} controles · {supervisores.length} supervisores
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
                    {["📋 Resumen general","👤 Por supervisor","🎯 Por puesto","🚗 Km & vehículos"].map(l => (
                        <span key={l} style={{ background: "#f0f4ff", color: "#003087", border: "1px solid #c8d4f0",
                            borderRadius: 99, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>{l}</span>
                    ))}
                </div>
                <button className="btn btn-primary" disabled={loading} onClick={handleExport}
                    style={{ padding: "12px 32px", fontSize: 15 }}>
                    {loading ? "⏳ Generando..." : ok ? "✓ Descargado" : "📤 Descargar Excel"}
                </button>
            </div>
        </>
    );
}

// ── Pantalla Historial ────────────────────────────────────────────────────────
function HistorialAdminScreen({ jornadas }) {
    const [busqueda, setBusqueda] = useState("");
    const [filtroSup, setFiltroSup] = useState("todos");

    const supervisores = useMemo(() =>
        ["todos", ...[...new Set(jornadas.map(j => j.nombre).filter(Boolean))].sort()],
        [jornadas]
    );

    const filtradas = useMemo(() => {
        return [...jornadas]
            .filter(j => {
                if (filtroSup !== "todos" && j.nombre !== filtroSup) return false;
                if (busqueda.trim()) {
                    const b = busqueda.toLowerCase();
                    return (j.nombre || "").toLowerCase().includes(b)
                        || (j.jornadaID || "").toLowerCase().includes(b)
                        || (j.vehiculo || "").toLowerCase().includes(b)
                        || (j.fecha || "").includes(b);
                }
                return true;
            })
            .sort((a, b) => (b.fecha || "") > (a.fecha || "") ? 1 : -1)
            .slice(0, 100);
    }, [jornadas, busqueda, filtroSup]);

    return (
        <>
            <div className="admin-header">
                <div>
                    <div className="screen-title">Historial</div>
                    <div className="screen-sub">{jornadas.length} jornadas registradas</div>
                </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <input
                    placeholder="🔍 Buscar por nombre, ID, vehículo..."
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    style={{ flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 8,
                        border: "1.5px solid var(--color-border)", fontSize: 13 }}
                />
                <select value={filtroSup} onChange={e => setFiltroSup(e.target.value)}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--color-border)", fontSize: 13 }}>
                    {supervisores.map(s => (
                        <option key={s} value={s}>{s === "todos" ? "— Todos los supervisores —" : s}</option>
                    ))}
                </select>
            </div>
            <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                        <tr style={{ background: "#002d72", color: "#fff" }}>
                            {["ID","Fecha","Supervisor","Vehículo","Km ini","Km fin","Km rec.","Controles","Inicio","Fin"].map(h => (
                                <th key={h} style={{ padding: "8px 6px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtradas.length === 0 ? (
                            <tr><td colSpan={10} style={{ textAlign: "center", padding: 24, color: "#8894ac" }}>Sin resultados</td></tr>
                        ) : filtradas.map((j, i) => {
                            const km = Math.max(0, Number(j.kmFinal||0) - Number(j.kmInicial||0));
                            const ctrls = (j.actividades||[]).filter(a => a.tipo === "ctrl").length;
                            return (
                                <tr key={i} style={{ background: i % 2 === 0 ? "#f8f9fc" : "#fff",
                                    borderBottom: "1px solid #e8eaf2" }}>
                                    <td style={{ padding: "6px", fontWeight: 700, color: "#003087", fontSize: 11 }}>{j.jornadaID || "—"}</td>
                                    <td style={{ padding: "6px", whiteSpace: "nowrap" }}>{j.fecha || "—"}</td>
                                    <td style={{ padding: "6px", fontWeight: 600 }}>{(j.nombre||"").split(" ").slice(0,2).join(" ")}</td>
                                    <td style={{ padding: "6px", fontSize: 11 }}>{(j.vehiculo||"—").split("—")[0].trim()}</td>
                                    <td style={{ padding: "6px" }}>{j.kmInicial || "—"}</td>
                                    <td style={{ padding: "6px" }}>{j.kmFinal || "—"}</td>
                                    <td style={{ padding: "6px" }}>
                                        {km > 0 ? <span style={{ background: "#f0fdf4", color: "#16a34a", fontWeight: 700,
                                            padding: "2px 6px", borderRadius: 99, fontSize: 11 }}>{km} km</span> : "—"}
                                    </td>
                                    <td style={{ padding: "6px", textAlign: "center" }}>
                                        {ctrls > 0 ? <span style={{ background: "#eef2ff", color: "#003087", fontWeight: 700,
                                            padding: "2px 6px", borderRadius: 99, fontSize: 11 }}>{ctrls}</span> : "0"}
                                    </td>
                                    <td style={{ padding: "6px", color: "#6b7280", whiteSpace: "nowrap" }}>{j.horaInicio || "—"}</td>
                                    <td style={{ padding: "6px", color: "#6b7280", whiteSpace: "nowrap" }}>{j.horaFin || "—"}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {filtradas.length === 100 && (
                <div style={{ textAlign: "center", fontSize: 12, color: "#8894ac", marginTop: 8 }}>
                    Mostrando los 100 más recientes
                </div>
            )}
        </>
    );
}

export default function AdminScreen({ onExit }) {
    const { updateConfig } = useAppData();
    const [activeTab, setActiveTab] = useState("dashboard");
    const [toast, setToast]         = useState("");
    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2100); };
    const handleUpdate = (key, value) => { updateConfig(key, value); showToast("✓ Guardado"); };

    return (
        <>
            <div style={{
                display: "flex", gap: 0, borderBottom: "2px solid var(--color-border)",
                marginBottom: 20, overflowX: "auto", scrollbarWidth: "none", flexShrink: 0
            }}>
                {ADMIN_TABS.map((t) => (
                    <button key={t.key}
                        onClick={() => setActiveTab(t.key)}
                        style={{
                            border: "none", background: "transparent",
                            padding: "9px 14px", fontSize: 12, fontWeight: 600,
                            cursor: "pointer", whiteSpace: "nowrap",
                            display: "flex", alignItems: "center", gap: 5,
                            borderBottom: activeTab === t.key ? "2px solid #c9a227" : "2px solid transparent",
                            marginBottom: -2,
                            color: activeTab === t.key ? "#c9a227" : "var(--color-muted)",
                            transition: "all 0.12s ease",
                        }}
                    >
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

            {activeTab === "planes"    && <PlanSupervisorScreen />}
            {activeTab === "usuarios"  && <UsersScreen />}
            {activeTab === "vehiculos" && <VehiculosScreen canEdit={true} />}

            {activeTab === "config" && (
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

            {/* ══ EXPORTAR ══ */}
            {activeTab === "exportar" && (
                <ExportarScreen jornadas={jornadas} plan={plan} planesSuper={planesSuper}
                    getSupervisoresConEmail={getSupervisoresConEmail} getPlanSupervisor={getPlanSupervisor} />
            )}

            {/* ══ HISTORIAL ══ */}
            {activeTab === "historial" && (
                <HistorialAdminScreen jornadas={jornadas} />
            )}

            <div style={{ marginTop: "var(--space-5)" }}>
                <button className="btn btn-secondary" onClick={onExit}>← Salir del panel admin</button>
            </div>

            {toast && <div className="admin-toast">{toast}</div>}
        </>
    );
}
