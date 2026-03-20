// src/screens/SupervisorHome.jsx
// Pantalla de inicio del Supervisor — menú de acceso a sus módulos.

import { useState } from "react";
import { useAuth }           from "../context/AuthContext";
import { useAppData }        from "../context/AppDataContext";
import SupervisorDashboard     from "./SupervisorDashboard";
import PlantillasRondaScreen   from "./PlantillasRondaScreen";
import MonitorRondasScreen     from "./MonitorRondasScreen";
import VerInformesScreen       from "../forms/VerInformesScreen";
import DashboardPersonalScreen from "./DashboardPersonalScreen";
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
    { id: "muro_comunicacion",          icon: "📢", titulo: "Muro de Comunicación y Novedades",  desc: "Novedades y comunicados de tu empresa",                          color: "blue"  },
    { id: "supervision",                icon: "🔍", titulo: "Supervisión",                        desc: "Accedé a tu panel de supervisión y control de objetivos",         color: "blue"  },
    { id: "rondas_plantillas",          icon: "🗺️", titulo: "Cargar plantillas de ronda",         desc: "Creá y configurá rondas con checkpoints y actividades GPS",       color: "blue"  },
    { id: "control_actividades_vigilador", icon: "👁️", titulo: "Control de Actividades Vigilador", desc: "Monitor de rondas, planillas, actas, vehículos, insumos e informes", color: "blue" },
    { id: "redactar_informe",           icon: "✏️", titulo: "Redactar informe",                   desc: "Creá un informe de supervisión o novedad",                        color: "green" },
    { id: "turnos",                     icon: "📅", titulo: "Cargar turnos de trabajo",           desc: "Cargá y gestioná los turnos del personal",                       color: "blue"  },
    { id: "auditoria_puesto",           icon: "🔎", titulo: "Auditoría de Puesto",                desc: "Realizá auditorías operativas del puesto asignado",               color: "blue"  },
    { id: "dashboard_personal",         icon: "👥", titulo: "Dashboard de personal",              desc: "Estado y novedades del personal",                                 color: "blue"  },
    { id: "felicitaciones_sanciones",   icon: "📋", titulo: "Registro de Felicitaciones y Sanciones", desc: "Registrá felicitaciones o sanciones del personal",           color: "blue"  },
    { id: "informe_gestion",            icon: "📊", titulo: "Informe de Gestión",                 desc: "Generá el informe de gestión del período",                        color: "blue"  },
    { id: "informe_visita",             icon: "🤝", titulo: "Informe de Visita al Cliente",       desc: "Registrá las novedades de la visita al cliente",                  color: "blue"  },
    { id: "muro_procedimientos",        icon: "📌", titulo: "Muro de Procedimientos",             desc: "Consultá los procedimientos operativos vigentes",                  color: "blue"  },
    { id: "capacitacion",               icon: "🎓", titulo: "Capacitación y Entrenamiento",       desc: "Accedé a los cursos y materiales de formación",                   color: "blue"  },
];

const SUB_MODULOS_ACTIVIDADES = [
    { id: "rondas_monitor",        icon: "📡", titulo: "Monitor de Rondas",          desc: "Ver resultados y cumplimiento de rondas en tiempo real" },
    { id: "planillas",             icon: "📊", titulo: "Ver Planillas",               desc: "Consultá las planillas operativas del puesto"           },
    { id: "ver_libro_actas",       icon: "📖", titulo: "Ver Libro de Actas",          desc: "Consultá el libro de actas digital de los puestos"      },
    { id: "ver_control_vehicular", icon: "🚗", titulo: "Ver Controles de Vehículos",  desc: "Consultá los controles vehiculares registrados"          },
    { id: "ver_pedido_insumos",    icon: "📦", titulo: "Ver Pedido de Insumos",       desc: "Consultá los pedidos de insumos del puesto"             },
    { id: "ver_inventarios",       icon: "🗃️", titulo: "Ver Inventarios",             desc: "Consultá el inventario de los puestos"                  },
    { id: "ver_informes",          icon: "📄", titulo: "Ver Informes",                desc: "Consultá los informes redactados"                       },
];

export default function SupervisorHome({ user, onIniciarJornada, onExit }) {
    const { logout }        = useAuth();
    const { empresaLogos, empresaNombre, empresaModulos, data } = useAppData();
    const [seccion,    setSeccion]    = useState(null);
    const [subSeccion, setSubSeccion] = useState(null);

    const handleLogout = async () => { await logout(); onExit?.(); };

    const renderHeader = (onBack) => (
        <header className="sh-header">
            <div className="sh-header-left">
                {empresaLogos?.panel && <img src={empresaLogos.panel} alt="Logo" className="sh-empresa-logo" />}
                <div>
                    <div className="sh-header-title">Mi Panel — {empresaNombre}</div>
                    <div className="sh-header-sub">{user?.name}</div>
                </div>
            </div>
            <button className="sh-back-btn sh-back-btn--header" onClick={onBack}>← Volver</button>
        </header>
    );

    // ── Control de Actividades Vigilador (módulo contenedor) ──
    if (seccion === "control_actividades_vigilador") {
        if (subSeccion === "rondas_monitor") return (
            <div className="sh-supervision-wrapper sh-supervision-wrapper--full">
                <MonitorRondasScreen onBack={() => setSubSeccion(null)} />
            </div>
        );
        if (subSeccion === "ver_informes") return (
            <div className="sh-supervision-wrapper">
                <VerInformesScreen onBack={() => setSubSeccion(null)} />
            </div>
        );
        if (subSeccion) {
            const sub = SUB_MODULOS_ACTIVIDADES.find(m => m.id === subSeccion);
            return (
                <div className="sh-root">
                    {renderHeader(() => setSubSeccion(null))}
                    <div className="sh-subpanel">
                        <div className="sh-subpanel-title">{sub.icon} {sub.titulo}</div>
                        <div className="sh-coming-soon">Próximamente</div>
                    </div>
                </div>
            );
        }
        return (
            <div className="sh-root">
                {renderHeader(() => setSeccion(null))}
                <div className="sh-section-title-bar">👁️ Control de Actividades Vigilador</div>
                <div className="sh-grid" style={{ padding: "var(--space-3)" }}>
                    {SUB_MODULOS_ACTIVIDADES.map(m => (
                        <button
                            key={m.id}
                            className="sh-modulo sh-modulo--blue"
                            onClick={() => setSubSeccion(m.id)}
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

    if (seccion === "dashboard_personal") {
        return (
            <div className="sh-supervision-wrapper">
                <DashboardPersonalScreen onBack={() => setSeccion(null)} />
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
                    const habilitado = (empresaModulos == null || empresaModulos[m.id] !== false)
                        && (user?.permisosModulos == null || user.permisosModulos.includes(m.id));
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
