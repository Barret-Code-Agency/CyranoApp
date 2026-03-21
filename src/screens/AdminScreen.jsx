// src/screens/AdminScreen.jsx
import { useState } from "react";
import { useAppData } from "../context/AppDataContext";
import DashboardScreen      from "./gerencia/DashboardScreen";
import PlanSupervisorScreen from "./supervisor/PlanSupervisorScreen";
import UsersScreen          from "./UsersScreen";
import VehiculosScreen      from "./VehiculosScreen";
import ConfigPanel          from "./admin/ConfigPanel";
import CapacitacionesScreen from "./admin/CapacitacionesPanel";
import ExportarScreen       from "./admin/ExportarPanel";
import HistorialAdminScreen from "./admin/HistorialPanel";
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
