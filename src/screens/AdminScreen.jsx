// src/screens/AdminScreen.jsx
import { useState } from "react";
import { useAppData } from "../context/AppDataContext";
import DashboardScreen      from "./DashboardScreen";
import PlanSupervisorScreen from "./PlanSupervisorScreen";
import UsersScreen          from "./UsersScreen";
import VehiculosScreen      from "./VehiculosScreen";
import "../styles/AdminScreen.css";
import { exportarExcel } from "../utils/exportarExcel";

const ADMIN_TABS = [
    { key: "dashboard", icon: "📊", label: "Dashboard" },
    { key: "planes",    icon: "📋", label: "Planes" },
    { key: "usuarios",  icon: "👥", label: "Usuarios" },
    { key: "vehiculos", icon: "🚗", label: "Vehículos" },
    { key: "config",    icon: "⚙️", label: "Configuración" },
    { key: "reportes",  icon: "📥", label: "Exportar" },
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

export default function AdminScreen({ onExit }) {
    const { updateConfig, jornadas, plan, planesSuper, getSupervisoresConEmail, getPlanSupervisor } = useAppData();
    const [activeTab, setActiveTab] = useState("dashboard");
    const [toast, setToast]         = useState("");
    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2100); };
    const [exporting, setExporting] = useState(false);
    const handleExcel = async () => {
        setExporting(true);
        try {
            const fn = await exportarExcel({ jornadas, plan, planesSuper, getSupervisoresConEmail, getPlanSupervisor });
            showToast("✓ Exportado: " + fn);
        } catch (e) {
            showToast("✗ Error: " + e.message);
        } finally {
            setExporting(false);
        }
    };
    const handleUpdate = (key, value) => { updateConfig(key, value); showToast("✓ Guardado"); };

    return (
        <>
            <div className="admin-tab-bar">
                {ADMIN_TABS.map((t) => (
                    <button key={t.key} className={`admin-tab-btn ${activeTab === t.key ? "active" : ""}`} onClick={() => setActiveTab(t.key)}>
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

            {activeTab === "reportes" && (
                <>
                    <div className="admin-header">
                        <div>
                            <div className="screen-title">Exportar</div>
                            <div className="screen-sub">Descargá el reporte mensual en Excel</div>
                        </div>
                    </div>
                    <div style={{ padding: "24px 16px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 480 }}>
                        <div style={{ background: "#f8f9fc", border: "1px solid #e0e4f0", borderRadius: 12, padding: "20px 18px" }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "#0d1b3e", marginBottom: 6 }}>📊 Reporte Mensual Excel</div>
                            <div style={{ fontSize: 12, color: "#6b7a99", marginBottom: 16, lineHeight: 1.6 }}>
                                Incluye 4 hojas:<br />
                                · Resumen mensual por supervisor<br />
                                · Cumplimiento por objetivo/puesto<br />
                                · Detalle de jornadas<br />
                                · Tendencia semanal (últimas 8 semanas)
                            </div>
                            <button
                                className="btn btn-primary"
                                onClick={handleExcel}
                                disabled={exporting}
                                style={{ width: "100%" }}
                            >
                                {exporting ? "⏳ Generando..." : "⬇ Descargar Excel"}
                            </button>
                        </div>
                    </div>
                </>
            )}

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

            <div style={{ marginTop: "var(--space-5)" }}>
                <button className="btn btn-secondary" onClick={onExit}>← Salir del panel admin</button>
            </div>

            {toast && <div className="admin-toast">{toast}</div>}
        </>
    );
}
