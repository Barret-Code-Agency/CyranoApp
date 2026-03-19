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

// ── Calendario semanal ─────────────────────────────────────────────────────
const DIAS_ES  = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
function fmtKey(d) { return d.toISOString().slice(0, 10); }

function CalendarioSemanal({ actividades = {} }) {
    const hoy    = new Date();
    const hoyKey = fmtKey(hoy);
    const [selKey, setSelKey] = useState(hoyKey);

    const dias = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(hoy);
        d.setDate(hoy.getDate() + i);
        return d;
    });

    const selDate = new Date(selKey + "T12:00:00");
    const selActs = actividades[selKey] ?? [];

    return (
        <div className="sh-calendario">
            <div className="sh-cal-title">📅 Actividades de la semana</div>
            <div className="sh-cal-strip">
                {dias.map(d => {
                    const key  = fmtKey(d);
                    const acts = actividades[key] ?? [];
                    return (
                        <button
                            key={key}
                            className={`sh-cal-dia ${key === hoyKey ? "sh-cal-dia--hoy" : ""} ${key === selKey ? "sh-cal-dia--sel" : ""}`}
                            onClick={() => setSelKey(key)}
                        >
                            <span className="sh-cal-dayname">{DIAS_ES[d.getDay()]}</span>
                            <span className="sh-cal-daynum">{d.getDate()}</span>
                            <div className="sh-cal-dia-acts">
                                {acts.length === 0
                                    ? <span className="sh-cal-dia-empty">—</span>
                                    : acts.map((a, i) => (
                                        <span key={i} className={`sh-cal-dia-chip sh-cal-dia-chip--${a.tipo ?? "default"}`}>
                                            {a.label}
                                        </span>
                                    ))
                                }
                            </div>
                        </button>
                    );
                })}
            </div>
            <div className="sh-cal-detail">
                <div className="sh-cal-detail-fecha">
                    {DIAS_ES[selDate.getDay()]} {selDate.getDate()} de {MESES_ES[selDate.getMonth()]}
                    {selKey === hoyKey && <span className="sh-cal-hoy-badge">Hoy</span>}
                </div>
                {selActs.length === 0 ? (
                    <div className="sh-cal-empty">Sin actividades programadas</div>
                ) : (
                    <div className="sh-cal-acts">
                        {selActs.map((a, i) => (
                            <div key={i} className={`sh-cal-act sh-cal-act--${a.tipo ?? "default"}`}>
                                {a.hora && <span className="sh-cal-act-hora">{a.hora}</span>}
                                <span className="sh-cal-act-label">{a.label}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

const MODULOS = [
    {
        id:    "muro_comunicacion",
        icon:  "📢",
        titulo: "Muro de Comunicación y Novedades",
        desc:  "Novedades y comunicados de tu empresa",
        color: "blue",
    },
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
    {
        id:    "auditoria_puesto",
        icon:  "🔎",
        titulo: "Auditoría de Puesto",
        desc:  "Realizá auditorías operativas del puesto asignado",
        color: "blue",
    },
    {
        id:    "felicitaciones_sanciones",
        icon:  "📋",
        titulo: "Registro de Felicitaciones y Sanciones",
        desc:  "Registrá felicitaciones o sanciones del personal",
        color: "blue",
    },
    {
        id:    "informe_gestion",
        icon:  "📊",
        titulo: "Informe de Gestión",
        desc:  "Generá el informe de gestión del período",
        color: "blue",
    },
    {
        id:    "informe_visita",
        icon:  "🤝",
        titulo: "Informe de Visita al Cliente",
        desc:  "Registrá las novedades de la visita al cliente",
        color: "blue",
    },
];

export default function SupervisorHome({ user, onIniciarJornada, onExit }) {
    const { logout }        = useAuth();
    const { empresaLogos, empresaNombre, empresaModulos, data } = useAppData();
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

            <div className="sh-role-badge">🔍 Supervisor / Encargado</div>

            <CalendarioSemanal actividades={data?.actividadesSemana ?? {}} />

            <div className="sh-grid">
                {MODULOS.map(m => {
                    const habilitado = empresaModulos == null || empresaModulos[m.id] !== false;
                    return (
                    <button
                        key={m.id}
                        className={`sh-modulo sh-modulo--${m.color} ${!habilitado ? "sh-modulo--disabled" : ""}`}
                        disabled={!habilitado}
                        onClick={() => habilitado && setSeccion(m.id)}
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
