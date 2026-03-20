// src/screens/AdminContratoHome.jsx
// Pantalla de inicio del Administrador de Contrato

import { useState } from "react";
import { useAuth }             from "../context/AuthContext";
import { useAppData }          from "../context/AppDataContext";
import AdminScreen              from "./AdminScreen";
import PlantillasRondaScreen   from "./PlantillasRondaScreen";
import MonitorRondasScreen     from "./MonitorRondasScreen";
import VerInformesScreen       from "../forms/VerInformesScreen";
import GestionClientesScreen   from "./GestionClientesScreen";
import GestionPersonalScreen   from "./GestionPersonalScreen";
import DashboardPersonalScreen  from "./DashboardPersonalScreen";
import GestionDatosAdminScreen    from "./GestionDatosAdminScreen";
import PlanCapacitacionScreen          from "./PlanCapacitacionScreen";
import ProgramacionServiciosScreen    from "./ProgramacionServiciosScreen";
import ConsolidadoScreen             from "./ConsolidadoScreen";
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
        id:     "gestion_datos",
        icon:   "🗄️",
        titulo: "Gestión de datos",
        desc:   "Clientes, objetivos y datos operativos del contrato",
        color:  "blue",
    },
    {
        id:     "dashboards_gestion",
        icon:   "📊",
        titulo: "Dashboards de gestión",
        desc:   "Métricas y KPIs de la empresa",
        color:  "blue",
    },
    {
        id:     "dashboard_personal",
        icon:   "👥",
        titulo: "Dashboard de personal",
        desc:   "Estado y novedades del personal",
        color:  "blue",
    },
    {
        id:     "turnos",
        icon:   "📅",
        titulo: "Gestión de horas",
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
    {
        id:     "plan_seguridad",
        icon:   "🛡️",
        titulo: "Plan de seguridad",
        desc:   "Cargá y gestioná el plan de seguridad del contrato",
        color:  "blue",
    },
    {
        id:     "plan_capacitacion",
        icon:   "🎓",
        titulo: "Plan de capacitación",
        desc:   "Planificá y registrá las capacitaciones del personal",
        color:  "blue",
    },
    {
        id:     "analisis_riesgos",
        icon:   "⚠️",
        titulo: "Análisis de riesgos",
        desc:   "Relevamiento y gestión de riesgos del objetivo",
        color:  "gold",
    },
];

export default function AdminContratoHome({ onExit }) {
    const { user, logout }                              = useAuth();
    const { empresaLogos, empresaNombre, empresaModulos } = useAppData();
    const [seccion, setSeccion]           = useState(null);
    const [subSeccion, setSubSeccion]     = useState(null);

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
                ? <button className="sh-back-btn sh-back-btn--header" onClick={() => { setSeccion(null); setSubSeccion(null); }}>← Volver al panel</button>
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
            <div className="sh-supervision-wrapper sh-supervision-wrapper--full">
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

    if (seccion === "asig_personal") {
        return (
            <div className="sh-supervision-wrapper">
                <GestionPersonalScreen onBack={() => setSeccion(null)} />
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
                <div className="sh-admin-content">
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

    if (seccion === "gestion_datos") {
        return (
            <div className="sh-supervision-wrapper sh-supervision-wrapper--full">
                <GestionDatosAdminScreen onBack={() => setSeccion(null)} canCreate={true} />
            </div>
        );
    }

    if (seccion === "dashboard_personal") {
        return (
            <div className="sh-supervision-wrapper sh-supervision-wrapper--full">
                <DashboardPersonalScreen onBack={() => setSeccion(null)} />
            </div>
        );
    }

    if (seccion === "plan_capacitacion") {
        if (subSeccion === "santa_cruz") {
            return (
                <div className="sh-supervision-wrapper sh-supervision-wrapper--full">
                    <PlanCapacitacionScreen onBack={() => setSubSeccion(null)} />
                </div>
            );
        }
        if (subSeccion === "bs_as") {
            return (
                <div className="sh-supervision-wrapper sh-supervision-wrapper--full">
                    <div className="sh-proximamente">
                        <div className="sh-proximamente-icon">🚧</div>
                        <div className="sh-proximamente-titulo">Plan Bs As — Próximamente</div>
                        <button className="sh-back-btn sh-back-btn--mt" onClick={() => setSubSeccion(null)}>← Volver</button>
                    </div>
                </div>
            );
        }
        // Menú de zonas
        const ZONAS = [
            { id: "santa_cruz", icon: "🏔️", titulo: "Plan Santa Cruz",   desc: "Plan anual de capacitación zona Patagonia", color: "blue" },
            { id: "bs_as",      icon: "🏙️", titulo: "Plan Buenos Aires", desc: "Plan anual de capacitación zona Buenos Aires", color: "green" },
        ];
        return (
            <div className="sh-supervision-wrapper">
                {renderHeader(true)}
                <div className="sh-grid">
                    {ZONAS.map(z => (
                        <button
                            key={z.id}
                            className={`sh-modulo sh-modulo--${z.color}`}
                            onClick={() => setSubSeccion(z.id)}
                        >
                            <span className="sh-modulo-icon">{z.icon}</span>
                            <div className="sh-modulo-info">
                                <strong>{z.titulo}</strong>
                                <small>{z.desc}</small>
                            </div>
                            <span className="sh-modulo-arrow">›</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // Turnos → submenú: Programación / Vista
    if (seccion === "turnos") {
        if (subSeccion === "programacion") {
            return (
                <div className="sh-supervision-wrapper sh-fullscreen">
                    <ProgramacionServiciosScreen onBack={() => setSubSeccion(null)} />
                </div>
            );
        }
        if (subSeccion === "vista") {
            return (
                <div className="sh-supervision-wrapper">
                    <div className="sh-proximamente">
                        <div className="sh-proximamente-icon">🚧</div>
                        <div className="sh-proximamente-titulo">Vista de turnos — Próximamente</div>
                        <button className="sh-back-btn sh-back-btn--mt" onClick={() => setSubSeccion(null)}>← Volver</button>
                    </div>
                </div>
            );
        }
        if (subSeccion === "consolidado") {
            return (
                <div className="sh-supervision-wrapper sh-fullscreen">
                    <ConsolidadoScreen onBack={() => setSubSeccion(null)} />
                </div>
            );
        }
        const TURNOS_MENUS = [
            { id: "programacion", icon: "📋", titulo: "Programación", desc: "Cargá y editá la planilla de servicios del personal", color: "blue" },
            { id: "vista",        icon: "📊", titulo: "Vista",        desc: "Visualizá el estado de la programación mensual",  color: "blue" },
            { id: "consolidado",  icon: "📑", titulo: "Consolidado",  desc: "Resumen consolidado de horas por período",         color: "blue" },
        ];
        return (
            <div className="sh-supervision-wrapper">
                {renderHeader(true)}
                <div className="sh-grid">
                    {TURNOS_MENUS.map(z => (
                        <button
                            key={z.id}
                            className={`sh-modulo sh-modulo--${z.color}`}
                            onClick={() => setSubSeccion(z.id)}
                        >
                            <span className="sh-modulo-icon">{z.icon}</span>
                            <div className="sh-modulo-info">
                                <strong>{z.titulo}</strong>
                                <small>{z.desc}</small>
                            </div>
                            <span className="sh-modulo-arrow">›</span>
                        </button>
                    ))}
                </div>
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
            <div className="sh-role-badge">🏢 Gerencia de Operaciones</div>
            <div className="sh-grid">
                {MODULOS.map(m => {
                    const habilitado = empresaModulos == null || empresaModulos[m.id] !== false;
                    return (
                        <button
                            key={m.id}
                            className={`sh-modulo sh-modulo--${m.color} ${!habilitado ? "sh-modulo--disabled" : ""}`}
                            disabled={!habilitado}
                            onClick={() => { if (habilitado) { setSubSeccion(null); setSeccion(m.id); } }}
                        >
                            <span className="sh-modulo-icon">{m.icon}</span>
                            <div className="sh-modulo-info">
                                <strong>{m.titulo}</strong>
                                <small>{habilitado ? m.desc : "Sin acceso"}</small>
                            </div>
                            {habilitado && <span className="sh-modulo-arrow">›</span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
