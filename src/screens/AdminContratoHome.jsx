// src/screens/AdminContratoHome.jsx
// Pantalla de inicio del Administrador de Contrato

import { useState } from "react";
import { useAuth }             from "../context/AuthContext";
import { useAppData }          from "../context/AppDataContext";
import AdminScreen              from "./AdminScreen";
import UsersScreen              from "./UsersScreen";
import PlantillasRondaScreen   from "./PlantillasRondaScreen";
import MonitorRondasScreen     from "./MonitorRondasScreen";
import VerInformesScreen          from "../forms/VerInformesScreen";
import VerComunicacionesScreen    from "../forms/VerComunicacionesScreen";
import CrearComunicacionScreen    from "../forms/CrearComunicacionScreen";
import VerProcedimientosScreen    from "../forms/VerProcedimientosScreen";
import SubirProcedimientoScreen   from "../forms/SubirProcedimientoScreen";
import VerCapacitacionesScreen    from "../forms/VerCapacitacionesScreen";
import SubirCapacitacionScreen    from "../forms/SubirCapacitacionScreen";
import GestionClientesScreen   from "./GestionClientesScreen";
import GestionPersonalScreen   from "./GestionPersonalScreen";
import DashboardPersonalScreen  from "./DashboardPersonalScreen";
import GestionDatosAdminScreen    from "./GestionDatosAdminScreen";
import DashboardsGestionScreen    from "./DashboardsGestionScreen";
import PlanCapacitacionScreen          from "./PlanCapacitacionScreen";
import { VistaTurnos, ProgramacionTodos } from "./ProgramacionServiciosScreen";
import ConsolidadoScreen             from "./ConsolidadoScreen";
import FacturacionScreen             from "./FacturacionScreen";
import AnalisisHorasPASScreen        from "./AnalisisHorasPASScreen";
import Diagramas14x14Screen          from "./Diagramas14x14Screen";
import ControlClienteScreen          from "./ControlClienteScreen";
import "../styles/SupervisorHome.css";
import "../styles/ConsolidadoScreen.css";

const MESES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function PeriodoCard({ icono, titulo, onVer }) {
    const hoy = new Date();
    const [mes, setMes] = useState(hoy.getMonth() + 1);
    const [año, setAño] = useState(hoy.getFullYear());
    const mesAnt = mes === 1 ? 12 : mes - 1;
    const añoAnt = mes === 1 ? año - 1 : año;
    return (
        <div className="con-sel-list">
            <div className="sh-modulo con-sel-item">
                <span className="sh-modulo-icon">{icono}</span>
                <div className="sh-modulo-info">
                    <strong>{titulo}</strong>
                    <small>
                        Del 24/{String(mesAnt).padStart(2,"0")}/{añoAnt}&nbsp;al&nbsp;23/{String(mes).padStart(2,"0")}/{año}
                    </small>
                </div>
                <div className="con-sel-campos">
                    <select className="con-select" value={mes} onChange={e => setMes(Number(e.target.value))}>
                        {MESES_ES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                    <select className="con-select con-select--año" value={año} onChange={e => setAño(Number(e.target.value))}>
                        {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button className="con-btn-abrir" onClick={() => onVer(año, mes)}>Ver →</button>
                </div>
            </div>
        </div>
    );
}

const MODULOS = [
    {
        id:     "muro_comunicacion",
        icon:   "📢",
        titulo: "Muro de Comunicación y Novedades",
        desc:   "Ver y publicar comunicaciones para todo el personal",
        color:  "blue",
    },
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
        id:     "muro_procedimientos",
        icon:   "📌",
        titulo: "Muro de Procedimientos",
        desc:   "Ver y publicar procedimientos operativos vigentes",
        color:  "blue",
    },
    {
        id:     "capacitacion",
        icon:   "🎓",
        titulo: "Capacitación y Entrenamiento",
        desc:   "Ver y subir cursos y materiales de formación",
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
    const [periodoSel, setPeriodoSel]     = useState(null);

    const handleLogout = async () => { await logout(); onExit?.(); };

    const renderHeader = () => (
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
    );

    const volverBtn = (onClick) => (
        <div style={{ padding: "1rem 1.5rem 0" }}>
            <button className="sh-back-btn" onClick={onClick}>← Volver</button>
        </div>
    );

    // Muro de comunicación → submenú ver / crear
    if (seccion === "muro_comunicacion") {
        if (subSeccion === "ver")   return <VerComunicacionesScreen onBack={() => setSubSeccion(null)} />;
        if (subSeccion === "crear") return <CrearComunicacionScreen onBack={() => setSubSeccion(null)} />;
        const MURO_MENUS = [
            { id: "ver",   icon: "📋", titulo: "Ver novedades y comunicaciones", desc: "Consultá las comunicaciones publicadas para el personal" },
            { id: "crear", icon: "✏️", titulo: "Crear comunicación",             desc: "Publicá una comunicación o novedad para todo el personal" },
        ];
        return (
            <div className="sh-root">
                {renderHeader()}
                {volverBtn(() => setSeccion(null))}
                <div className="sh-grid">
                    {MURO_MENUS.map(m => (
                        <button key={m.id} className="sh-modulo" onClick={() => setSubSeccion(m.id)}>
                            <span className="sh-modulo-icon">{m.icon}</span>
                            <div className="sh-modulo-info"><strong>{m.titulo}</strong><small>{m.desc}</small></div>
                            <span className="sh-modulo-arrow">›</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // Muro de procedimientos → submenú ver / subir
    if (seccion === "muro_procedimientos") {
        if (subSeccion === "ver")   return <VerProcedimientosScreen  onBack={() => setSubSeccion(null)} />;
        if (subSeccion === "subir") return <SubirProcedimientoScreen onBack={() => setSubSeccion(null)} />;
        const PROC_MENUS = [
            { id: "ver",   icon: "📋", titulo: "Ver procedimientos",  desc: "Consultá los procedimientos operativos vigentes"     },
            { id: "subir", icon: "📤", titulo: "Subir procedimiento", desc: "Publicá un nuevo procedimiento para el personal"     },
        ];
        return (
            <div className="sh-root">
                {renderHeader()}
                {volverBtn(() => setSeccion(null))}
                <div className="sh-grid">
                    {PROC_MENUS.map(m => (
                        <button key={m.id} className="sh-modulo" onClick={() => setSubSeccion(m.id)}>
                            <span className="sh-modulo-icon">{m.icon}</span>
                            <div className="sh-modulo-info"><strong>{m.titulo}</strong><small>{m.desc}</small></div>
                            <span className="sh-modulo-arrow">›</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // Capacitación → submenú cursos disponibles / subir
    if (seccion === "capacitacion") {
        if (subSeccion === "ver")   return <VerCapacitacionesScreen  onBack={() => setSubSeccion(null)} />;
        if (subSeccion === "subir") return <SubirCapacitacionScreen  onBack={() => setSubSeccion(null)} />;
        const CAP_MENUS = [
            { id: "ver",   icon: "📋", titulo: "Cursos disponibles",  desc: "Consultá los cursos y materiales de formación"      },
            { id: "subir", icon: "📤", titulo: "Subir capacitación",  desc: "Publicá un nuevo curso o material de entrenamiento" },
        ];
        return (
            <div className="sh-root">
                {renderHeader()}
                {volverBtn(() => setSeccion(null))}
                <div className="sh-grid">
                    {CAP_MENUS.map(m => (
                        <button key={m.id} className="sh-modulo" onClick={() => setSubSeccion(m.id)}>
                            <span className="sh-modulo-icon">{m.icon}</span>
                            <div className="sh-modulo-info"><strong>{m.titulo}</strong><small>{m.desc}</small></div>
                            <span className="sh-modulo-arrow">›</span>
                        </button>
                    ))}
                </div>
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
                {renderHeader()}
                {volverBtn(() => { setSeccion(null); setSubSeccion(null); })}
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
        if (subSeccion === "datos_operativos") return (
            <div className="sh-supervision-wrapper sh-supervision-wrapper--full">
                <GestionDatosAdminScreen onBack={() => setSubSeccion(null)} canCreate={true} />
            </div>
        );
        if (subSeccion === "usuarios") return (
            <div className="sh-supervision-wrapper">
                {renderHeader()}
                {volverBtn(() => setSubSeccion(null))}
                <div className="sh-section-title-bar">👤 Usuarios del sistema</div>
                <div className="sh-admin-content">
                    <UsersScreen />
                </div>
            </div>
        );
        const GESTION_MENUS = [
            { id: "datos_operativos", icon: "🗄️", titulo: "Datos operativos", desc: "Legajos, clientes, objetivos, vehículos y más" },
            { id: "usuarios",         icon: "👤", titulo: "Usuarios del sistema", desc: "Alta, baja y gestión de accesos al sistema" },
        ];
        return (
            <div className="sh-root">
                {renderHeader()}
                {volverBtn(() => { setSeccion(null); setSubSeccion(null); })}
                <div className="sh-grid">
                    {GESTION_MENUS.map(m => (
                        <button key={m.id} className="sh-modulo" onClick={() => setSubSeccion(m.id)}>
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

    if (seccion === "dashboards_gestion") {
        return (
            <div className="sh-supervision-wrapper sh-supervision-wrapper--full">
                {renderHeader()}
                {volverBtn(() => setSeccion(null))}
                <div className="sh-section-title-bar">📊 Dashboards de gestión</div>
                <div className="sh-admin-content">
                    <DashboardsGestionScreen onBack={() => setSeccion(null)} />
                </div>
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
                    {renderHeader()}
                    {volverBtn(() => setSubSeccion(null))}
                    <div className="sh-proximamente">
                        <div className="sh-proximamente-icon">🚧</div>
                        <div className="sh-proximamente-titulo">Plan Bs As — Próximamente</div>
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
                {renderHeader()}
                {volverBtn(() => { setSeccion(null); setSubSeccion(null); })}
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

    // Turnos → submenú con selector de período
    if (seccion === "turnos") {
        const TURNOS_MENUS = [
            { id: "programacion",    icon: "📋", titulo: "Programación de Objetivos", desc: "Cargá y editá la planilla de servicios del personal", color: "blue" },
            { id: "real",            icon: "✅", titulo: "Horarios Trabajados",        desc: "Cargá las horas reales trabajadas por el personal",   color: "blue" },
            { id: "vista",           icon: "📊", titulo: "Vista de horarios",          desc: "Visualizá el estado de la programación mensual",      color: "blue" },
            { id: "consolidado",     icon: "📑", titulo: "Consolidado",                desc: "Resumen consolidado de horas por período",             color: "blue" },
            { id: "diagramas14",     icon: "🔄", titulo: "Diagramas 14 x 14",         desc: "Gestión de grupos y francos del régimen 14x14",        color: "blue" },
            { id: "control_cliente", icon: "🤝", titulo: "Control cliente",            desc: "Seguimiento y control de horas facturadas al cliente",  color: "blue" },
            { id: "facturacion",     icon: "💰", titulo: "Facturación",               desc: "Generá y gestioná la facturación mensual al cliente",  color: "blue" },
            { id: "analisis_pas",    icon: "📊", titulo: "Análisis de horas PAS",      desc: "Análisis de cobertura y horas por puesto del período", color: "blue" },
            { id: "importacion",     icon: "📥", titulo: "Importación de horarios",    desc: "Importación de horarios desde archivo externo",         color: "gold" },
        ];
        const CON_PERIODO = ["programacion", "real", "vista", "diagramas14", "control_cliente", "facturacion", "analisis_pas"];

        // Items con selector de período
        if (subSeccion && CON_PERIODO.includes(subSeccion)) {
            const item = TURNOS_MENUS.find(t => t.id === subSeccion);

            // Paso 1: selector de período
            if (!periodoSel) {
                return (
                    <div className="sh-supervision-wrapper">
                        {renderHeader()}
                        {volverBtn(() => setSubSeccion(null))}
                        <PeriodoCard
                            icono={item.icon}
                            titulo={item.titulo}
                            onVer={(a, m) => setPeriodoSel({ año: a, mes: m })}
                        />
                    </div>
                );
            }

            // Paso 2: contenido con período seleccionado
            const { año, mes } = periodoSel;
            const volverPeriodo = () => setPeriodoSel(null);

            if (subSeccion === "programacion") {
                return (
                    <div className="sh-supervision-wrapper sh-fullscreen">
                        <div style={{ padding: "1rem 1.5rem 0" }}>
                            <button className="sh-back-btn" onClick={volverPeriodo}>← Volver</button>
                        </div>
                        <ProgramacionTodos año={año} mes={mes} modo="programado" />
                    </div>
                );
            }
            if (subSeccion === "real") {
                return (
                    <div className="sh-supervision-wrapper sh-fullscreen">
                        <div style={{ padding: "1rem 1.5rem 0" }}>
                            <button className="sh-back-btn" onClick={volverPeriodo}>← Volver</button>
                        </div>
                        <ProgramacionTodos año={año} mes={mes} modo="real" />
                    </div>
                );
            }
            if (subSeccion === "vista") {
                return (
                    <div className="sh-supervision-wrapper sh-fullscreen">
                        <div style={{ padding: "1rem 1.5rem 0" }}>
                            <button className="sh-back-btn" onClick={volverPeriodo}>← Volver</button>
                        </div>
                        <VistaTurnos año={año} mes={mes} />
                    </div>
                );
            }
            if (subSeccion === "diagramas14") {
                return (
                    <div className="sh-supervision-wrapper sh-fullscreen">
                        <div style={{ padding: "1rem 1.5rem 0" }}>
                            <button className="sh-back-btn" onClick={volverPeriodo}>← Volver</button>
                        </div>
                        <Diagramas14x14Screen onBack={volverPeriodo} />
                    </div>
                );
            }
            if (subSeccion === "control_cliente") {
                return (
                    <div className="sh-supervision-wrapper sh-fullscreen">
                        <div style={{ padding: "1rem 1.5rem 0" }}>
                            <button className="sh-back-btn" onClick={volverPeriodo}>← Volver</button>
                        </div>
                        <ControlClienteScreen año={año} mes={mes} />
                    </div>
                );
            }
            if (subSeccion === "facturacion") {
                return (
                    <div className="sh-supervision-wrapper">
                        {renderHeader()}
                        {volverBtn(volverPeriodo)}
                        <div className="sh-admin-content">
                            <FacturacionScreen año={año} mes={mes} onBack={volverPeriodo} />
                        </div>
                    </div>
                );
            }
            if (subSeccion === "analisis_pas") {
                return (
                    <div className="sh-supervision-wrapper">
                        {renderHeader()}
                        {volverBtn(volverPeriodo)}
                        <div className="sh-admin-content">
                            <AnalisisHorasPASScreen año={año} mes={mes} />
                        </div>
                    </div>
                );
            }
        }

        // Importación — provisional, próximamente
        if (subSeccion === "importacion") {
            return (
                <div className="sh-supervision-wrapper">
                    {renderHeader()}
                    {volverBtn(() => setSubSeccion(null))}
                    <div className="sh-proximamente">
                        <div className="sh-proximamente-icon">📥</div>
                        <div className="sh-proximamente-titulo">Importación de horarios — Próximamente</div>
                        <button className="sh-back-btn sh-back-btn--mt" onClick={() => setSubSeccion(null)}>← Volver</button>
                    </div>
                </div>
            );
        }

        // Consolidado sin PeriodoCard (gestiona su propio período)
        if (subSeccion === "consolidado") {
            return (
                <div className="sh-supervision-wrapper sh-fullscreen">
                    <ConsolidadoScreen onBack={() => setSubSeccion(null)} />
                </div>
            );
        }

        // Menú principal de turnos
        return (
            <div className="sh-supervision-wrapper">
                {renderHeader()}
                {volverBtn(() => setSeccion(null))}
                <div className="sh-grid">
                    {TURNOS_MENUS.map(z => (
                        <button
                            key={z.id}
                            className={`sh-modulo sh-modulo--${z.color}`}
                            onClick={() => { setPeriodoSel(null); setSubSeccion(z.id); }}
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
                {renderHeader()}
                {volverBtn(() => setSeccion(null))}
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
            {renderHeader()}
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
