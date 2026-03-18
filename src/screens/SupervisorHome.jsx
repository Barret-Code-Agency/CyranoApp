// src/screens/SupervisorHome.jsx
// Pantalla de inicio del Supervisor — menú de acceso a sus módulos.

import { useState } from "react";
import { useAuth }           from "../context/AuthContext";
import { useAppData }        from "../context/AppDataContext";
import SupervisorDashboard   from "./SupervisorDashboard";
import PlantillasRondaScreen from "./PlantillasRondaScreen";
import MonitorRondasScreen   from "./MonitorRondasScreen";
import VerInformesScreen     from "../forms/VerInformesScreen";
import "../styles/SupervisorHome.css";

const MODULOS = [
    {
        id:    "supervision",
        icon:  "🔍",
        titulo: "Supervisión",
        desc:  "Accedé a tu panel de supervisión y control de objetivos",
        color: "blue",
    },
    {
        id:    "rondas_plantillas",
        icon:  "🗺️",
        titulo: "Cargar plantillas de ronda",
        desc:  "Creá y configurá rondas con checkpoints y actividades GPS",
        color: "blue",
    },
    {
        id:    "rondas_monitor",
        icon:  "📡",
        titulo: "Monitor de rondas",
        desc:  "Ver resultados, mapa y cumplimiento de rondas en tiempo real",
        color: "blue",
    },
    {
        id:    "planillas",
        icon:  "📊",
        titulo: "Ver planillas",
        desc:  "Consultá las planillas operativas del puesto",
        color: "blue",
    },
    {
        id:    "ver_informes",
        icon:  "📄",
        titulo: "Ver informes",
        desc:  "Consultá los informes redactados",
        color: "blue",
    },
    {
        id:    "redactar_informe",
        icon:  "✏️",
        titulo: "Redactar informe",
        desc:  "Creá un informe de supervisión o novedad",
        color: "green",
    },
    {
        id:    "turnos",
        icon:  "📅",
        titulo: "Cargar turnos de trabajo",
        desc:  "Cargá y gestioná los turnos del personal",
        color: "blue",
    },
];

export default function SupervisorHome({ user, onIniciarJornada, onExit }) {
    const { logout }        = useAuth();
    const { empresaLogos, empresaNombre } = useAppData();
    const [seccion, setSeccion] = useState(null);

    const handleLogout = async () => { await logout(); onExit?.(); };

    // Sección Supervisión → usa el dashboard completo existente
    if (seccion === "supervision") {
        return (
            <div className="sh-supervision-wrapper">
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
                    <button className="sh-back-btn sh-back-btn--header" onClick={() => setSeccion(null)}>
                        ← Volver al panel
                    </button>
                </header>
                <div className="sh-section-title-bar">
                    🔍 Plan de supervisión, cumplimiento y carga
                </div>
                <SupervisorDashboard user={user} onIniciarJornada={onIniciarJornada} hideHeader />
            </div>
        );
    }

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

    if (seccion === "ver_informes") {
        return (
            <div className="sh-supervision-wrapper">
                <VerInformesScreen onBack={() => setSeccion(null)} />
            </div>
        );
    }

    // Otras secciones — placeholder
    if (seccion) {
        const mod = MODULOS.find(m => m.id === seccion);
        return (
            <div className="sh-root">
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
                    <button className="sh-back-btn sh-back-btn--header" onClick={() => setSeccion(null)}>
                        ← Volver al panel
                    </button>
                </header>
                <div className="sh-subpanel">
                    <div className="sh-subpanel-title">{mod.icon} {mod.titulo}</div>
                    <div className="sh-coming-soon">Próximamente</div>
                </div>
            </div>
        );
    }

    return (
        <div className="sh-root">
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
                <button className="sh-logout-btn" onClick={handleLogout}>🚪</button>
            </header>

            <div className="sh-role-badge">🔍 Supervisor</div>

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
