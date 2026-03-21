// src/screens/SuperAdminScreen.jsx
import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import PanelEmpresas      from "./superadmin/PanelEmpresas";
import PanelUsuarios      from "./superadmin/PanelUsuarios";
import PanelPermisos      from "./superadmin/PanelPermisos";
import PanelMantenimiento from "./superadmin/PanelMantenimiento";
import "./SuperAdminScreen.css";

const NAV = [
    { id: "dashboard",    icon: "📊", label: "Dashboard"     },
    { id: "empresas",     icon: "🏛️", label: "Empresas"      },
    { id: "usuarios",     icon: "👥", label: "Usuarios"      },
    { id: "contratos",    icon: "📋", label: "Contratos"     },
    { id: "permisos",     icon: "🔐", label: "Permisos"      },
    { id: "mantenimiento",icon: "🛠️", label: "Mantenimiento" },
];

const SECCIONES = [
    { id: "empresas",  icon: "🏛️", titulo: "Empresas",  descripcion: "Crear y gestionar empresas de seguridad" },
    { id: "usuarios",  icon: "👥", titulo: "Usuarios",   descripcion: "Gestión global de usuarios y roles"      },
    { id: "contratos", icon: "📋", titulo: "Contratos",  descripcion: "Ver contratos y clientes por empresa"    },
    { id: "permisos",  icon: "🔐", titulo: "Permisos",   descripcion: "Configurar roles y permisos del sistema" },
];

// ── Pantalla principal ─────────────────────────────────────────────────────────
export default function SuperAdminScreen({ onExit }) {
    const { user, logout } = useAuth();
    const [seccion,     setSeccion]     = useState("dashboard");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [stats,       setStats]       = useState({
        empresas: "…", usuarios: "…", contratos: "…", alertas: 0,
    });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Usuarios
                const snapU     = await getDocs(collection(db, "usuarios"));
                const usuarios  = snapU.size;

                // Empresas: primero desde /empresas, fallback desde empresaId en usuarios
                let empresasCnt = 0;
                try {
                    const snapE   = await getDocs(collection(db, "empresas"));
                    const idsFirestore = new Set(snapE.docs.map(d => d.id.toLowerCase()));
                    const idsUsers     = new Set(snapU.docs.map(d => (d.data().empresaId ?? "").toLowerCase()).filter(Boolean));
                    // Unión sin duplicados
                    const idsTotales = new Set([...idsFirestore, ...idsUsers]);
                    empresasCnt = idsTotales.size;
                } catch {
                    const ids = new Set(snapU.docs.map(d => (d.data().empresaId ?? "").toLowerCase()).filter(Boolean));
                    empresasCnt = ids.size;
                }

                setStats({ empresas: empresasCnt, usuarios, contratos: "—", alertas: 0 });
            } catch {
                setStats({ empresas: "—", usuarios: "—", contratos: "—", alertas: 0 });
            }
        };
        fetchStats();
    }, []);

    const handleLogout = async () => { await logout(); onExit?.(); };

    return (
        <div className="sa-root">

            {/* ── Sidebar ── */}
            <aside className={`sa-sidebar ${sidebarOpen ? "sa-sidebar--open" : ""}`}>
                <div className="sa-sidebar-logo">
                    <div className="sa-logo-mark">⚙️</div>
                    <div>
                        <div className="sa-logo-text">CYRANO<span>APP</span></div>
                        <div className="sa-logo-badge">SUPER ADMIN</div>
                    </div>
                </div>

                <nav className="sa-nav">
                    <div className="sa-nav-label">MENÚ</div>
                    {NAV.map(n => (
                        <button
                            key={n.id}
                            className={`sa-nav-item ${seccion === n.id ? "sa-nav-item--active" : ""}`}
                            onClick={() => { setSeccion(n.id); setSidebarOpen(false); }}
                        >
                            <span className="sa-nav-icon">{n.icon}</span>
                            <span className="sa-nav-text">{n.label}</span>
                            {seccion === n.id && <span className="sa-nav-dot" />}
                        </button>
                    ))}
                </nav>

                <div className="sa-sidebar-footer">
                    <div className="sa-user-chip">
                        <div className="sa-user-avatar">
                            {(user?.name ?? "S").charAt(0).toUpperCase()}
                        </div>
                        <div className="sa-user-info">
                            <div className="sa-user-name">{user?.name ?? "Super Admin"}</div>
                            <div className="sa-user-email">{user?.email}</div>
                        </div>
                    </div>
                    <button className="sa-logout-btn" onClick={handleLogout}>
                        <span>🚪</span> Cerrar sesión
                    </button>
                </div>
            </aside>

            {sidebarOpen && <div className="sa-overlay" onClick={() => setSidebarOpen(false)} />}

            {/* ── Main ── */}
            <div className="sa-main">
                <header className="sa-topbar">
                    <div className="sa-topbar-left">
                        <button className="sa-hamburger" onClick={() => setSidebarOpen(s => !s)}>☰</button>
                        <div>
                            <h1 className="sa-page-title">
                                {NAV.find(n => n.id === seccion)?.icon}{" "}
                                {NAV.find(n => n.id === seccion)?.label}
                            </h1>
                            <p className="sa-page-sub">Panel de control global del sistema</p>
                        </div>
                    </div>
                    <div className="sa-topbar-right">
                        <div className="sa-topbar-user">
                            <div className="sa-topbar-avatar">
                                {(user?.name ?? "S").charAt(0).toUpperCase()}
                            </div>
                            <span className="sa-topbar-name">{user?.name ?? "Super Admin"}</span>
                        </div>
                    </div>
                </header>

                <div className="sa-content">

                    {/* Dashboard */}
                    {seccion === "dashboard" && (
                        <>
                            <div className="sa-stats-grid">
                                {[
                                    { icon: "🏛️", label: "Empresas activas",  value: stats.empresas,  color: "blue"  },
                                    { icon: "👥", label: "Usuarios totales",   value: stats.usuarios,  color: "green" },
                                    { icon: "📋", label: "Contratos activos",  value: stats.contratos, color: "gold"  },
                                    { icon: "🔔", label: "Alertas",            value: stats.alertas,   color: "red"   },
                                ].map(s => (
                                    <div key={s.label} className={`sa-stat-card sa-stat-card--${s.color}`}>
                                        <div className="sa-stat-icon">{s.icon}</div>
                                        <div className="sa-stat-value">{s.value}</div>
                                        <div className="sa-stat-label">{s.label}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="sa-section-title">Módulos del sistema</div>
                            <div className="sa-cards-grid">
                                {SECCIONES.map(s => (
                                    <button key={s.id} className="sa-module-card" onClick={() => setSeccion(s.id)}>
                                        <div className="sa-module-icon">{s.icon}</div>
                                        <div className="sa-module-body">
                                            <div className="sa-module-title">{s.titulo}</div>
                                            <div className="sa-module-desc">{s.descripcion}</div>
                                        </div>
                                        <span className="sa-module-arrow">›</span>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Empresas — funcional */}
                    {seccion === "empresas" && <PanelEmpresas />}

                    {/* Usuarios — funcional */}
                    {seccion === "usuarios" && <PanelUsuarios />}

                    {/* Permisos — funcional */}
                    {seccion === "permisos" && <PanelPermisos />}

                    {/* Mantenimiento — funcional */}
                    {seccion === "mantenimiento" && <PanelMantenimiento />}

                    {/* Resto — placeholder */}
                    {seccion !== "dashboard" && seccion !== "empresas" && seccion !== "usuarios" && seccion !== "permisos" && (
                        <div className="sa-placeholder">
                            <div className="sa-placeholder-icon">{SECCIONES.find(s => s.id === seccion)?.icon}</div>
                            <div className="sa-placeholder-title">{SECCIONES.find(s => s.id === seccion)?.titulo}</div>
                            <div className="sa-placeholder-desc">{SECCIONES.find(s => s.id === seccion)?.descripcion}</div>
                            <span className="sa-placeholder-badge">Próximamente</span>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
