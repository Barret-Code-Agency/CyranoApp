// src/screens/AdminContratoHome.jsx
// Pantalla de inicio del Administrador de Contrato

import { useState } from "react";
import { useAuth }             from "../context/AuthContext";
import { useAppData }          from "../context/AppDataContext";
import AdminScreen             from "./AdminScreen";
import PlantillasRondaScreen   from "./PlantillasRondaScreen";
import MonitorRondasScreen     from "./MonitorRondasScreen";
import VerInformesScreen       from "../forms/VerInformesScreen";
import GestionClientesScreen   from "./GestionClientesScreen";
import "../styles/SupervisorHome.css";

const MODULOS = [
    {
        id:     "supervision",
        icon:   "🔍",
        titulo: "Supervisión",
        desc:   "Panel completo de supervisión, objetivos y cumplimiento",
        color:  "blue",
    },
    {
        id:     "turnos",
        icon:   "📅",
        titulo: "Turnos de trabajo",
        desc:   "Cargá y gestioná los turnos del personal del contrato",
        color:  "blue",
    },
    {
        id:     "informes",
        icon:   "📄",
        titulo: "Informes",
        desc:   "Ver y redactar informes del contrato",
        color:  "blue",
    },
    {
        id:     "asig_personal",
        icon:   "👥",
        titulo: "Asignación de personal",
        desc:   "Asigná vigiladores a los puestos del contrato",
        color:  "blue",
    },
    {
        id:     "horas_extras",
        icon:   "⏰",
        titulo: "Horas extras",
        desc:   "Registrá y gestioná las horas extras del personal",
        color:  "gold",
    },
    {
        id:     "horas_no_prestadas",
        icon:   "🚫",
        titulo: "Horas no prestadas",
        desc:   "Registrá ausencias y horas no cumplidas",
        color:  "red",
    },
    {
        id:     "rondas_plantillas",
        icon:   "🗺️",
        titulo: "Plantillas de Ronda",
        desc:   "Creá y gestioná rondas GPS con checkpoints y actividades",
        color:  "blue",
    },
    {
        id:     "rondas_monitor",
        icon:   "📡",
        titulo: "Monitor de Rondas",
        desc:   "Ver resultados, mapa y cumplimiento en tiempo real",
        color:  "blue",
    },
    {
        id:     "gestion_clientes",
        icon:   "🏢",
        titulo: "Gestión de Clientes",
        desc:   "Cargá clientes, objetivos y puestos con dirección y teléfono",
        color:  "blue",
    },
];

export default function AdminContratoHome({ onExit }) {
    const { user, logout }               = useAuth();
    const { empresaLogos, empresaNombre } = useAppData();
    const [seccion, setSeccion]           = useState(null);

    const handleLogout = async () => { await logout(); onExit?.(); };

    const renderHeader = (conVolver = false) => (
        <header className="sh-header">
            <div className="sh-header-left">
                {empresaLogos?.panel && (
                    <img src={empresaLogos.panel} alt="Logo" className="sh-empresa-logo" />
                )}
                <div>
                    <div className="sh-header-title">Mi Panel — {empresaNombre}</div>
                    <div className="sh-header-sub">{user?.name}</div>
                </div>
            </div>
            {conVolver
                ? <button className="sh-back-btn sh-back-btn--header" onClick={() => setSeccion(null)}>← Volver al panel</button>
                : <button className="sh-logout-btn" onClick={handleLogout}>🚪</button>
            }
        </header>
    );

    // Plantillas de ronda
    if (seccion === "rondas_plantillas") {
        return (
            <div className="sh-supervision-wrapper">
                <PlantillasRondaScreen onBack={() => setSeccion(null)} />
            </div>
        );
    }

    // Monitor de rondas
    if (seccion === "rondas_monitor") {
        return (
            <div className="sh-supervision-wrapper" style={{ maxWidth:"100%" }}>
                <MonitorRondasScreen onBack={() => setSeccion(null)} />
            </div>
        );
    }

    if (seccion === "gestion_clientes") {
        return (
            <div className="sh-supervision-wrapper">
                <GestionClientesScreen onBack={() => setSeccion(null)} />
            </div>
        );
    }

    // Supervisión → AdminScreen completo
    if (seccion === "supervision") {
        return (
            <div className="sh-supervision-wrapper">
                {renderHeader(true)}
                <div className="sh-section-title-bar">
                    🔍 Supervisión — Plan, cumplimiento y carga
                </div>
                <div style={{ padding: "var(--space-4) var(--space-3)" }}>
                    <AdminScreen embedded onExit={() => setSeccion(null)} />
                </div>
            </div>
        );
    }

    if (seccion === "informes") {
        return (
            <div className="sh-supervision-wrapper">
                <VerInformesScreen onBack={() => setSeccion(null)} />
            </div>
        );
    }

    // Resto de secciones — placeholder
    if (seccion) {
        const mod = MODULOS.find(m => m.id === seccion);
        return (
            <div className="sh-root">
                {renderHeader(true)}
                <div className="sh-subpanel">
                    <div className="sh-subpanel-title">{mod.icon} {mod.titulo}</div>
                    <div className="sh-coming-soon">Próximamente</div>
                </div>
            </div>
        );
    }

    // Menú principal
    return (
        <div className="sh-root">
            {renderHeader(false)}
            <div className="sh-role-badge">🏢 Administrador de Contrato</div>
            <div className="sh-grid">
                {MODULOS.map(m => (
                    <button
                        key={m.id}
                        className={`sh-modulo sh-modulo--${m.color}`}
                        onClick={() => setSeccion(m.id)}
                    >
                        <span className="sh-modulo-icon">{m.icon}</span>
                        <div className="sh-modulo-info">
                            <strong>{m.titulo}</strong>
                            <small>{m.desc}</small>
                        </div>
                        <span className="sh-modulo-arrow">›</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
