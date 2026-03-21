// src/screens/AdminEmpresaScreen.jsx
// Panel de Administrador de Empresa — acceso rol "admin_empresa"
// Gestiona clientes, dashboards, contratos, usuarios e informes de la empresa.

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS, ROLE_ICONS } from "../config/roles";
import "./AdminEmpresaScreen.css";

const SECCIONES = [
    {
        id:          "clientes",
        icon:        "🤝",
        titulo:      "Clientes",
        descripcion: "Gestión de clientes y cuentas de la empresa",
    },
    {
        id:          "dashboards",
        icon:        "📊",
        titulo:      "Dashboards",
        descripcion: "Métricas, KPIs y estadísticas operativas",
    },
    {
        id:          "contratos",
        icon:        "📋",
        titulo:      "Contratos",
        descripcion: "Administrar contratos activos y vigencias",
    },
    {
        id:          "usuarios",
        icon:        "👥",
        titulo:      "Usuarios",
        descripcion: "Gestión de personal y roles de la empresa",
    },
    {
        id:          "informes",
        icon:        "📄",
        titulo:      "Informes",
        descripcion: "Reportes y documentos operativos",
    },
];

export default function AdminEmpresaScreen({ onExit }) {
    const { user, logout } = useAuth();
    const [seccionActiva, setSeccionActiva] = useState("clientes");

    const handleLogout = async () => {
        await logout();
        onExit?.();
    };

    const seccion = SECCIONES.find(s => s.id === seccionActiva);

    return (
        <div className="ae-root">

            {/* ── Sidebar ── */}
            <aside className="ae-sidebar">
                <div className="ae-sidebar-header">
                    <div className="ae-logo">CYRANO<span>APP</span></div>
                    <div className="ae-badge">ADMIN EMPRESA</div>
                </div>

                <nav className="ae-nav">
                    {SECCIONES.map(s => (
                        <button
                            key={s.id}
                            className={`ae-nav-item${seccionActiva === s.id ? " ae-nav-item--active" : ""}`}
                            onClick={() => setSeccionActiva(s.id)}
                        >
                            <span className="ae-nav-icon">{s.icon}</span>
                            {s.titulo}
                        </button>
                    ))}
                </nav>

                <div className="ae-sidebar-footer">
                    <div className="ae-user-info">
                        <span className="ae-user-icon">
                            {ROLE_ICONS[user?.rol] ?? "🏛️"}
                        </span>
                        <div>
                            <div className="ae-user-name">{user?.name ?? "Admin"}</div>
                            <div className="ae-user-role">
                                {ROLE_LABELS[user?.rol] ?? "Admin Empresa"}
                            </div>
                        </div>
                    </div>
                    <button className="ae-logout" onClick={handleLogout}>
                        🚪 Salir
                    </button>
                </div>
            </aside>

            {/* ── Contenido principal ── */}
            <main className="ae-main">
                <div className="ae-topbar">
                    <h1 className="ae-page-title">
                        {seccion?.icon} {seccion?.titulo}
                    </h1>
                    <p className="ae-page-sub">{seccion?.descripcion}</p>
                </div>

                {/* Placeholder de contenido */}
                <div className="ae-placeholder">
                    <div className="ae-placeholder-icon">{seccion?.icon}</div>
                    <div className="ae-placeholder-text">{seccion?.titulo}</div>
                    <span className="ae-placeholder-badge">Próximamente</span>
                </div>

                {/* Panel de resumen */}
                <div className="ae-info-panel">
                    <div className="ae-info-title">Resumen de empresa</div>
                    <div className="ae-info-grid">
                        <div className="ae-info-item">
                            <span className="ae-info-label">Clientes activos</span>
                            <span className="ae-info-value">—</span>
                        </div>
                        <div className="ae-info-item">
                            <span className="ae-info-label">Contratos vigentes</span>
                            <span className="ae-info-value">—</span>
                        </div>
                        <div className="ae-info-item">
                            <span className="ae-info-label">Personal activo</span>
                            <span className="ae-info-value">—</span>
                        </div>
                        <div className="ae-info-item">
                            <span className="ae-info-label">Empresa</span>
                            <span className="ae-info-value ae-info-value--sm">
                                {user?.empresaId ?? "—"}
                            </span>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
