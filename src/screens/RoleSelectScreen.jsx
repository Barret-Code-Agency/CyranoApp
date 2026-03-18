// src/screens/RoleSelectScreen.jsx
import "../styles/RoleSelectScreen.css";

const ROLES_UI = [
    {
        key:     "admin_empresa",
        icon:    "🏛️",
        titulo:  "Administrador de Empresa",
        variant: "empresa",
        modulos: [
            { icon: "🤝", label: "Clientes" },
            { icon: "📊", label: "Dashboards" },
            { icon: "📋", label: "Gestión de contratos" },
            { icon: "👥", label: "Gestión de usuarios" },
            { icon: "📄", label: "Informes" },
        ],
    },
    {
        key:     "admin",
        icon:    "🏢",
        titulo:  "Administrador de Contrato",
        variant: "admin",
        modulos: [
            { icon: "🗺️", label: "Control de rondas" },
            { icon: "📋", label: "Plan de seguridad" },
            { icon: "🎓", label: "Plan de capacitación" },
            { icon: "⚠️", label: "Análisis de riesgos" },
            { icon: "🕐", label: "Turnos de trabajo" },
            { icon: "👥", label: "Gestión de personal" },
        ],
    },
    {
        key:     "supervisor",
        icon:    "🔍",
        titulo:  "Supervisor",
        variant: "supervisor",
        modulos: [
            { icon: "🔍", label: "Supervisión" },
            { icon: "🗺️", label: "Control de rondas" },
            { icon: "📊", label: "Planillas" },
            { icon: "📄", label: "Informes" },
            { icon: "🕐", label: "Turnos de trabajo" },
        ],
    },
    {
        key:     "user",
        icon:    "👷",
        titulo:  "Vigilador",
        variant: "user",
        modulos: [
            { icon: "📖", label: "Libro de actas digital" },
            { icon: "🗺️", label: "Realizar ronda" },
            { icon: "📊", label: "Planillas" },
            { icon: "📄", label: "Informes" },
            { icon: "🕐", label: "Turnos de trabajo" },
        ],
    },
];

export default function RoleSelectScreen({ onSelect, onBack, country }) {
    return (
        <div className="rs-root">
            <div className="rs-topbar" />

            <div className="rs-card">

                {/* ── Header ── */}
                <div className="rs-header">
                    <div className="rs-deco-1" />
                    <div className="rs-deco-2" />
                    <div className="rs-deco-3" />

                    {/* Bienvenido centrado sobre la línea roja */}
                    <div className="rs-welcome-bar">
                        <span className="rs-welcome-text">Bienvenido</span>
                    </div>

                    <div className="rs-header-content">
                        <div className="rs-logo-row">
                            <div className="rs-logo-ring">
                                {country
                                    ? <img className="rs-flag-main" src={country.src} alt={country.name} />
                                    : <span className="rs-flag-placeholder">🌎</span>
                                }
                            </div>
                            <div className="rs-brand-block">
                                <div className="rs-brand">CYRANO<span>APP</span></div>
                                <div className="rs-divider-line" />
                                <div className="rs-tagline">Sistema de Gestión de Seguridad</div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* ── Body ── */}
                <div className="rs-body">
                    <div className="rs-title">Seleccioná tu perfil</div>
                    <div className="rs-sub">Elegí cómo querés ingresar al sistema</div>

                    <div className="rs-cards">
                        {ROLES_UI.map(r => (
                            <button
                                key={r.key}
                                className={`rs-role-card rs-role-card--${r.variant}`}
                                onClick={() => onSelect(r.key)}
                            >
                                <div className="rs-role-header">
                                    <span className={`rs-role-icon rs-role-icon--${r.variant}`}>
                                        {r.icon}
                                    </span>
                                    <div className="rs-role-info">
                                        <strong>{r.titulo}</strong>
                                    </div>
                                    <span className="rs-role-arrow">›</span>
                                </div>
                                <ul className="rs-modules">
                                    {r.modulos.map(m => (
                                        <li key={m.label}>
                                            <span className="rs-mod-icon">{m.icon}</span>
                                            {m.label}
                                        </li>
                                    ))}
                                </ul>
                            </button>
                        ))}
                    </div>

                    <button className="rs-back" onClick={onBack}>
                        ← Volver
                    </button>
                </div>
            </div>
        </div>
    );
}
