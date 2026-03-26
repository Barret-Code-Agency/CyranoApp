// src/screens/gerencia/AdminContratoHome.jsx
// Pantalla de inicio del Administrador de Contrato

import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { MESES_ES, DIAS_ES, fmtKey } from "../../utils/periodoUtils";
import { useWhatsApp } from "../../hooks/useWhatsApp";
import { useActividadesSemana } from "../../hooks/useActividadesSemana";
import { buildResumenDiario } from "../../utils/whatsapp";
import { useAuth }             from "../../context/AuthContext";
import { useAppData }          from "../../context/AppDataContext";
import PlantillasRondaScreen   from "../shared/PlantillasRondaScreen";
import MonitorRondasScreen     from "../shared/MonitorRondasScreen";
import VerInformesScreen          from "../../forms/VerInformesScreen";
import VerComunicacionesScreen    from "../../forms/VerComunicacionesScreen";
import CrearComunicacionScreen    from "../../forms/CrearComunicacionScreen";
import VerProcedimientosScreen    from "../../forms/VerProcedimientosScreen";
import SubirProcedimientoScreen   from "../../forms/SubirProcedimientoScreen";
import VerCapacitacionesScreen    from "../../forms/VerCapacitacionesScreen";
import SubirCapacitacionScreen    from "../../forms/SubirCapacitacionScreen";
import DashboardPersonalScreen  from "../administrativo/DashboardPersonalScreen";
import GestionDatosAdminScreen    from "../administrativo/GestionDatosAdminScreen";
import DashboardsGestionScreen    from "./DashboardsGestionScreen";
import PlanCapacitacionScreen          from "../shared/PlanCapacitacionScreen";
import { VistaTurnos, ProgramacionTodos } from "../shared/ProgramacionServiciosScreen";
import ImportarRealesPanel           from "../shared/ImportarRealesPanel";
import ConsolidadoScreen             from "../shared/ConsolidadoScreen";
import FacturacionScreen             from "./FacturacionScreen";
import AnalisisHorasPASScreen        from "./AnalisisHorasPASScreen";
import Diagramas14x14Screen          from "../shared/Diagramas14x14Screen";
import ControlClienteScreen          from "../shared/ControlClienteScreen";
import AusentismoScreen              from "../shared/AusentismoScreen";
import GestionPremiosScreen          from "./GestionPremiosScreen";
import AdminScreen                   from "../AdminScreen";
import DesignarSupervisoresPanel     from "./DesignarSupervisoresPanel";
import PedidoInsumosScreen           from "../shared/PedidoInsumosScreen";
import { tieneAcceso }               from "../../config/roles";
import AppHeader                     from "../../components/AppHeader";
import "../../styles/SupervisorHome.css";
import "../../styles/ConsolidadoScreen.css";


function CalendarioSemanal({ actividades = {}, legajos = [] }) {
    const hoy    = new Date();
    const hoyKey = fmtKey(hoy);
    const [selKey, setSelKey] = useState(hoyKey);
    const [sending, setSending] = useState(false);
    const [waSent,  setWaSent]  = useState(false);
    const { configurado, enviar } = useWhatsApp();

    const dias = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(hoy); d.setDate(hoy.getDate() + i); return d;
    });

    const cumplesPorKey = {};
    legajos.forEach(p => {
        if (!p.nacimiento) return;
        const [dd, mm] = p.nacimiento.split("/").map(Number);
        dias.forEach(d => {
            if (d.getDate() === dd && d.getMonth() + 1 === mm) {
                const key = fmtKey(d);
                const ap = (p.nombre || "").trim().split(" ")[0];
                cumplesPorKey[key] = [...(cumplesPorKey[key] || []), ap];
            }
        });
    });

    const selDate  = new Date(selKey + "T12:00:00");
    const selActs  = actividades[selKey] ?? [];
    const selCumps = cumplesPorKey[selKey] ?? [];

    return (
        <div className="sh-calendario">
            <div className="sh-cal-title">📅 Actividades de la semana</div>
            <div className="sh-cal-strip">
                {dias.map(d => {
                    const key  = fmtKey(d);
                    const acts = actividades[key] ?? [];
                    return (
                        <button key={key}
                            className={`sh-cal-dia ${key === hoyKey ? "sh-cal-dia--hoy" : ""} ${key === selKey ? "sh-cal-dia--sel" : ""}`}
                            onClick={() => setSelKey(key)}
                        >
                            <span className="sh-cal-dayname">{DIAS_ES[d.getDay()]}</span>
                            <span className="sh-cal-daynum">{d.getDate()}</span>
                            <div className="sh-cal-dia-acts">
                                {acts.map((a, i) => (
                                    <span key={i} className={`sh-cal-dia-chip sh-cal-dia-chip--${a.tipo ?? "default"}`}>{a.label}</span>
                                ))}
                                {(cumplesPorKey[key] || []).map((ap, i) => (
                                    <span key={`c${i}`} className="sh-cal-dia-chip sh-cal-dia-chip--cumple">🎂 {ap}</span>
                                ))}
                                {acts.length === 0 && !cumplesPorKey[key] && <span className="sh-cal-dia-empty">—</span>}
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
                {selActs.length === 0 && selCumps.length === 0 ? (
                    <div className="sh-cal-empty">Sin actividades programadas</div>
                ) : (
                    <div className="sh-cal-acts">
                        {selActs.map((a, i) => (
                            <div key={i} className={`sh-cal-act sh-cal-act--${a.tipo ?? "default"}`}>
                                {a.hora && <span className="sh-cal-act-hora">{a.hora}</span>}
                                <span className="sh-cal-act-label">{a.label}</span>
                            </div>
                        ))}
                        {selCumps.map((ap, i) => (
                            <div key={`c${i}`} className="sh-cal-act sh-cal-act--cumple">
                                <span className="sh-cal-act-hora">🎂</span>
                                <span className="sh-cal-act-label">Cumpleaños de {ap}</span>
                            </div>
                        ))}
                    </div>
                )}
                {configurado && (
                    <button
                        className="sh-cal-wa-btn"
                        disabled={sending || waSent}
                        onClick={async () => {
                            setSending(true);
                            const selDate = new Date(selKey + "T12:00:00");
                            await enviar(buildResumenDiario(selDate, selActs, selCumps));
                            setSending(false); setWaSent(true);
                            setTimeout(() => setWaSent(false), 4000);
                        }}
                    >
                        {waSent ? "✅ Enviado" : sending ? "Enviando…" : "📱 Enviar por WhatsApp"}
                    </button>
                )}
            </div>
        </div>
    );
}

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
                        {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button className="con-btn-abrir" onClick={() => onVer(año, mes)}>Ver →</button>
                </div>
            </div>
        </div>
    );
}

const MODULOS = {
    "muro_comunicacion":  { icon: "📢", titulo: "Comunicación",         desc: "Publicar y ver novedades para todo el personal",       color: "purple"  },
    "supervision":        { icon: "🔍", titulo: "Supervisión",           desc: "Planes, cumplimiento y dashboard de supervisores",     color: "blue"    },
    "rondas_monitor":     { icon: "📡", titulo: "Monitor de Rondas",     desc: "Resultados y cumplimiento en tiempo real",             color: "green"   },
    "informes":           { icon: "📄", titulo: "Informes",              desc: "Ver y redactar informes del contrato",                 color: "slate"   },
    "gestion_datos":      { icon: "🗄️", titulo: "Gestión de datos",      desc: "Personal, clientes, objetivos y vehículos",            color: "teal"    },
    "turnos":             { icon: "📅", titulo: "Gestión de horas",      desc: "Turnos, programación y control del personal",          color: "indigo"  },
    "dashboard_personal": { icon: "👥", titulo: "Dashboard de personal", desc: "Estado, novedades y métricas del personal",            color: "cyan"    },
    "dashboards_gestion": { icon: "📊", titulo: "Dashboards de gestión", desc: "KPIs y métricas de la empresa",                       color: "orange"  },
    "plan_capacitacion":  { icon: "🎓", titulo: "Plan de capacitación",  desc: "Planificá las capacitaciones del personal",            color: "amber"   },
    "muro_procedimientos":{ icon: "📌", titulo: "Procedimientos",        desc: "Ver y publicar procedimientos operativos",             color: "navy"    },
    "capacitacion":       { icon: "🎒", titulo: "Capacitación",          desc: "Ver y subir cursos y materiales de formación",         color: "amber"   },
    "plan_seguridad":              { icon: "🛡️", titulo: "Plan de seguridad",          desc: "Cargá y gestioná el plan de seguridad del contrato",        color: "red"     },
    "analisis_riesgos":            { icon: "⚠️", titulo: "Análisis de riesgos",          desc: "Relevamiento y gestión de riesgos del objetivo",            color: "gold"    },
    "gestion_premios":             { icon: "🎁", titulo: "Premios y Tokens",             desc: "Catálogo y aprobación de canjes del personal",              color: "pink"    },
    "felicitaciones_sanciones":    { icon: "📋", titulo: "Felicitaciones/Sanciones",     desc: "Registrá felicitaciones o sanciones del personal",           color: "amber"   },
    "control_actividades_vigilador":{ icon: "👁️", titulo: "Control de Actividades",      desc: "Rondas, planillas, actas, vehículos e informes",            color: "cyan"    },
};

const GRUPOS_MENU = [
    { label: "Operaciones",   ids: ["supervision", "rondas_monitor", "muro_comunicacion", "control_actividades_vigilador"] },
    { label: "Gestión",       ids: ["gestion_datos", "turnos", "dashboard_personal", "dashboards_gestion", "felicitaciones_sanciones"] },
    { label: "Formación",     ids: ["plan_capacitacion", "capacitacion", "muro_procedimientos"] },
    { label: "Otros",         ids: ["plan_seguridad", "analisis_riesgos", "gestion_premios"] },
];


export default function AdminContratoHome({ onExit }) {
    const { user, logout }                              = useAuth();
    const { empresaModulos, empresaId, data, updateConfig, userZona } = useAppData();
    const [seccion, setSeccion]               = useState(null);
    const [subSeccion, setSubSeccion]         = useState(null);
    const [periodoSel, setPeriodoSel]         = useState(null);
    const [consolidadoFull, setConsolidadoFull] = useState(false);

    const handleLogout = async () => { await logout(); onExit?.(); };

    const [legajos, setLegajos] = useState([]);
    useEffect(() => {
        if (!empresaId) return;
        getDocs(query(collection(db, "legajos"), where("empresaId", "==", empresaId)))
            .then(snap => setLegajos(snap.docs.map(d => d.data())))
            .catch(err => console.error("Error cargando legajos:", err));
    }, [empresaId]);
    const actividadesSemana = useActividadesSemana(empresaId, legajos);

    const modActivo   = MODULOS[seccion];
    const subline     = seccion
        ? `${modActivo?.icon ?? ""} ${modActivo?.titulo ?? seccion}`.trim()
        : "🏢 Gerencia de Operaciones";
    const renderHeader = () => <AppHeader onLogout={handleLogout} subline={subline} />;

    const volverBtn = (onClick) => (
        <div style={{ padding: "1rem 1.5rem 0" }}>
            <button className="sh-back-btn" onClick={onClick}>← Volver al panel</button>
        </div>
    );

    // Control de actividades vigilador
    const SUB_MODULOS_ACTIVIDADES = [
        { id: "rondas_monitor",        icon: "📡", titulo: "Monitor de Rondas",         desc: "Ver resultados y cumplimiento de rondas en tiempo real" },
        { id: "planillas",             icon: "📊", titulo: "Ver Planillas",              desc: "Consultá las planillas operativas del puesto"           },
        { id: "ver_libro_actas",       icon: "📖", titulo: "Ver Libro de Actas",         desc: "Consultá el libro de actas digital de los puestos"      },
        { id: "ver_control_vehicular", icon: "🚗", titulo: "Ver Controles de Vehículos", desc: "Consultá los controles vehiculares registrados"          },
        { id: "ver_pedido_insumos",    icon: "📦", titulo: "Pedido de Insumos",          desc: "Creá o consultá pedidos de insumos del puesto"          },
        { id: "ver_inventarios",       icon: "🗃️", titulo: "Ver Inventarios",            desc: "Consultá el inventario de los puestos"                  },
        { id: "ver_informes",          icon: "📄", titulo: "Ver Informes",               desc: "Consultá los informes redactados"                       },
    ];
    if (seccion === "control_actividades_vigilador") {
        if (subSeccion === "rondas_monitor") return (
            <div className="sh-supervision-wrapper sh-supervision-wrapper--full">
                {renderHeader()}
                <MonitorRondasScreen onBack={() => setSubSeccion(null)} />
            </div>
        );
        if (subSeccion === "ver_informes") return (
            <div className="sh-supervision-wrapper">
                {renderHeader()}
                <VerInformesScreen onBack={() => setSubSeccion(null)} />
            </div>
        );
        if (subSeccion === "ver_pedido_insumos") return (
            <div className="sh-supervision-wrapper">
                {renderHeader()}
                <PedidoInsumosScreen onBack={() => setSubSeccion(null)} />
            </div>
        );
        return (
            <div className="sh-root">
                {renderHeader()}
                <div className="vh-subpanel">
                    <button className="vh-back" onClick={() => setSeccion(null)}>← Volver al panel</button>
                    <div className="vh-subpanel-title">👁️ Control de Actividades Vigilador</div>
                    <div className="sh-grid">
                        {SUB_MODULOS_ACTIVIDADES.map(m => (
                            <button key={m.id} className="sh-modulo sh-modulo--cyan" onClick={() => setSubSeccion(m.id)}>
                                <span className="sh-modulo-icon sh-modulo-icon--cyan">{m.icon}</span>
                                <div className="sh-modulo-info"><strong>{m.titulo}</strong><small>{m.desc}</small></div>
                                <span className="sh-modulo-arrow">›</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Felicitaciones y sanciones
    if (seccion === "felicitaciones_sanciones") {
        return (
            <div className="vh-root">
                {renderHeader()}
                <div className="vh-subpanel">
                    <button className="vh-back" onClick={() => setSeccion(null)}>← Volver al panel</button>
                    <div className="vh-subpanel-title">📋 Felicitaciones / Sanciones</div>
                    <div className="vh-coming-soon">Próximamente</div>
                </div>
            </div>
        );
    }

    // Muro de comunicación → submenú ver / crear
    if (seccion === "muro_comunicacion") {
        if (subSeccion === "ver")   return <div className="sh-root">{renderHeader()}<VerComunicacionesScreen onBack={() => setSubSeccion(null)} /></div>;
        if (subSeccion === "crear") return <div className="sh-root">{renderHeader()}<CrearComunicacionScreen onBack={() => setSubSeccion(null)} /></div>;
        const MURO_MENUS = [
            { id: "ver",   icon: "📋", titulo: "Ver novedades y comunicaciones", desc: "Consultá las comunicaciones publicadas para el personal" },
            { id: "crear", icon: "✏️", titulo: "Crear comunicación",             desc: "Publicá una comunicación o novedad para todo el personal" },
        ];
        return (
            <div className="sh-root">
                {renderHeader()}
                <div className="vh-subpanel">
                    <button className="vh-back" onClick={() => setSeccion(null)}>← Volver al panel</button>
                    <div className="vh-subpanel-title">📢 Muro de Comunicación y Novedades</div>
                    <div className="sh-grid">
                        {MURO_MENUS.map(m => (
                            <button key={m.id} className="sh-modulo sh-modulo--purple" onClick={() => setSubSeccion(m.id)}>
                                <span className="sh-modulo-icon sh-modulo-icon--purple">{m.icon}</span>
                                <div className="sh-modulo-info"><strong>{m.titulo}</strong><small>{m.desc}</small></div>
                                <span className="sh-modulo-arrow">›</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Muro de procedimientos → submenú ver / subir
    if (seccion === "muro_procedimientos") {
        if (subSeccion === "ver")   return <div className="sh-root">{renderHeader()}<div className="vh-subpanel"><button className="vh-back" onClick={() => setSubSeccion(null)}>← Volver al panel</button><div className="vh-subpanel-title">📋 Ver Procedimientos</div></div><VerProcedimientosScreen  onBack={() => setSubSeccion(null)} /></div>;
        if (subSeccion === "subir") return <div className="sh-root">{renderHeader()}<div className="vh-subpanel"><button className="vh-back" onClick={() => setSubSeccion(null)}>← Volver al panel</button><div className="vh-subpanel-title">📤 Subir Procedimiento</div></div><SubirProcedimientoScreen onBack={() => setSubSeccion(null)} /></div>;
        const PROC_MENUS = [
            { id: "ver",   icon: "📋", titulo: "Ver procedimientos",  desc: "Consultá los procedimientos operativos vigentes" },
            { id: "subir", icon: "📤", titulo: "Subir procedimiento", desc: "Publicá un nuevo procedimiento para el personal" },
        ];
        return (
            <div className="sh-root">
                {renderHeader()}
                <div className="vh-subpanel">
                    <button className="vh-back" onClick={() => setSeccion(null)}>← Volver al panel</button>
                    <div className="vh-subpanel-title">📌 Muro de Procedimientos</div>
                    <div className="sh-grid">
                        {PROC_MENUS.map(m => (
                            <button key={m.id} className="sh-modulo sh-modulo--navy" onClick={() => setSubSeccion(m.id)}>
                                <span className="sh-modulo-icon sh-modulo-icon--navy">{m.icon}</span>
                                <div className="sh-modulo-info"><strong>{m.titulo}</strong><small>{m.desc}</small></div>
                                <span className="sh-modulo-arrow">›</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Capacitación → submenú repositorio / subir
    if (seccion === "capacitacion") {
        if (subSeccion === "ver")   return <div className="sh-root">{renderHeader()}<div className="vh-subpanel"><button className="vh-back" onClick={() => setSubSeccion(null)}>← Volver al panel</button><div className="vh-subpanel-title">📚 Repositorio de Capacitaciones</div></div><VerCapacitacionesScreen  onBack={() => setSubSeccion(null)} /></div>;
        if (subSeccion === "subir") return <div className="sh-root">{renderHeader()}<div className="vh-subpanel"><button className="vh-back" onClick={() => setSubSeccion(null)}>← Volver al panel</button><div className="vh-subpanel-title">📤 Subir Capacitación</div></div><SubirCapacitacionScreen  onBack={() => setSubSeccion(null)} /></div>;
        const CAP_MENUS = [
            { id: "ver",   icon: "📚", titulo: "Ingresar al repositorio", desc: "Consultá los cursos y materiales de formación"      },
            { id: "subir", icon: "📤", titulo: "Subir capacitación",      desc: "Publicá un nuevo curso o material de entrenamiento" },
        ];
        return (
            <div className="sh-root">
                {renderHeader()}
                <div className="vh-subpanel">
                    <button className="vh-back" onClick={() => setSeccion(null)}>← Volver al panel</button>
                    <div className="vh-subpanel-title">🎓 Capacitación y Entrenamiento</div>
                    <div className="sh-grid">
                        {CAP_MENUS.map(m => (
                            <button key={m.id} className="sh-modulo sh-modulo--amber" onClick={() => setSubSeccion(m.id)}>
                                <span className="sh-modulo-icon sh-modulo-icon--amber">{m.icon}</span>
                                <div className="sh-modulo-info"><strong>{m.titulo}</strong><small>{m.desc}</small></div>
                                <span className="sh-modulo-arrow">›</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Plantillas de ronda
    if (seccion === "rondas_plantillas") {
        return (
            <div className="sh-supervision-wrapper">
                {renderHeader()}
                <PlantillasRondaScreen onBack={() => setSeccion(null)} />
            </div>
        );
    }

    // Monitor de rondas
    if (seccion === "rondas_monitor") {
        return (
            <div className="sh-supervision-wrapper sh-supervision-wrapper--full">
                {renderHeader()}
                <MonitorRondasScreen onBack={() => { setSeccion(null); setSubSeccion(null); }} />
            </div>
        );
    }



    // Supervisión → AdminScreen completo
    if (seccion === "supervision") {
        return (
            <div className="sh-supervision-wrapper sh-supervision-wrapper--full">
                <div style={{ maxWidth: "50%", margin: "0 auto", boxShadow: "var(--shadow-xl)", border: "2px solid var(--color-border2)", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
                    {renderHeader()}
                    <div className="vh-subpanel">
                        <button className="vh-back" onClick={() => setSeccion(null)}>← Volver al panel</button>
                        <div className="vh-subpanel-title">🔍 Supervisión — Plan, cumplimiento y carga</div>
                    </div>
                    <div style={{ padding: "0 var(--space-5, 1.5rem)", flex: 1 }}>
                        <AdminScreen onExit={() => setSeccion(null)} />
                    </div>
                </div>
            </div>
        );
    }

    if (seccion === "informes") {
        return (
            <div className="vh-root">
                {renderHeader()}
                <VerInformesScreen onBack={() => setSeccion(null)} />
            </div>
        );
    }

    if (seccion === "gestion_datos") {
        // Sub-sección: datos maestros (legajos, clientes, objetivos, vehículos)
        if (subSeccion === "datos_maestros" || subSeccion === "datos_operativos") return (
            <div className="sh-supervision-wrapper sh-supervision-wrapper--full">
                {renderHeader()}
                <GestionDatosAdminScreen onBack={() => setSubSeccion(null)} canCreate={true} />
            </div>
        );
        // Sub-sección: designar supervisores
        if (subSeccion === "config_operativa") return (
            <div className="sh-supervision-wrapper sh-supervision-wrapper--full">
                {renderHeader()}
                <div className="vh-subpanel">
                    <DesignarSupervisoresPanel
                        empresaId={empresaId}
                        onBack={() => setSubSeccion(null)}
                    />
                </div>
            </div>
        );
        // Menú de Gestión de datos
        const SUB_GESTION = [
            { id: "datos_maestros",   icon: "🗄️", titulo: "Datos maestros",          desc: "Personal (legajos), clientes, objetivos y vehículos — importar Excel o editar uno por uno", color: "teal" },
            { id: "config_operativa", icon: "👤", titulo: "Supervisores",              desc: "Designar qué personas del personal actúan como supervisores", color: "teal" },
        ];
        return (
            <div className="vh-root">
                {renderHeader()}
                <div className="vh-subpanel">
                    <button className="vh-back" onClick={() => setSeccion(null)}>← Volver al panel</button>
                    <div className="vh-subpanel-title">🗄️ Gestión de datos</div>
                    <div className="sh-grid">
                        {SUB_GESTION.map(m => (
                            <button key={m.id} className={`sh-modulo sh-modulo--${m.color}`} onClick={() => setSubSeccion(m.id)}>
                                <span className={`sh-modulo-icon sh-modulo-icon--${m.color}`}>{m.icon}</span>
                                <div className="sh-modulo-info"><strong>{m.titulo}</strong><small>{m.desc}</small></div>
                                <span className="sh-modulo-arrow">›</span>
                            </button>
                        ))}
                    </div>
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
                {renderHeader()}
                <DashboardPersonalScreen onBack={() => setSeccion(null)} />
            </div>
        );
    }

    if (seccion === "plan_capacitacion") {
        if (subSeccion === "santa_cruz") {
            return (
                <div className="sh-supervision-wrapper sh-supervision-wrapper--full">
                    {renderHeader()}
                    <div className="vh-subpanel">
                        <button className="vh-back" onClick={() => setSubSeccion(null)}>← Volver al panel</button>
                    </div>
                    <PlanCapacitacionScreen onBack={() => setSubSeccion(null)} />
                </div>
            );
        }
        if (subSeccion === "bs_as") {
            return (
                <div className="vh-root">
                    {renderHeader()}
                    <div className="vh-subpanel">
                        <button className="vh-back" onClick={() => setSubSeccion(null)}>← Volver al panel</button>
                        <div className="vh-subpanel-title">🏙️ Plan Buenos Aires</div>
                        <div className="vh-coming-soon">Próximamente</div>
                    </div>
                </div>
            );
        }
        const ZONAS = [
            { id: "santa_cruz", icon: "🏔️", titulo: "Plan Santa Cruz",   desc: "Plan anual de capacitación zona Patagonia",    color: "blue"  },
            { id: "bs_as",      icon: "🏙️", titulo: "Plan Buenos Aires", desc: "Plan anual de capacitación zona Buenos Aires",  color: "green" },
        ];
        return (
            <div className="vh-root">
                {renderHeader()}
                <div className="vh-subpanel">
                    <button className="vh-back" onClick={() => { setSeccion(null); setSubSeccion(null); }}>← Volver al panel</button>
                    <div className="vh-subpanel-title">🎓 Plan de Capacitación</div>
                    <div className="sh-grid">
                        {ZONAS.map(z => (
                            <button key={z.id} className={`sh-modulo sh-modulo--${z.color}`} onClick={() => setSubSeccion(z.id)}>
                                <span className="sh-modulo-icon">{z.icon}</span>
                                <div className="sh-modulo-info"><strong>{z.titulo}</strong><small>{z.desc}</small></div>
                                <span className="sh-modulo-arrow">›</span>
                            </button>
                        ))}
                    </div>
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
            { id: "ausentismo",      icon: "📉", titulo: "Ausentismo",                 desc: "Registro y análisis de ausentismo del período",          color: "blue" },
        ];
        const CON_PERIODO = ["programacion", "real", "vista", "diagramas14", "control_cliente", "facturacion", "analisis_pas", "importacion"];

        // Items con selector de período
        if (subSeccion && CON_PERIODO.includes(subSeccion)) {
            const item = TURNOS_MENUS.find(t => t.id === subSeccion);

            // Paso 1: selector de período
            if (!periodoSel) {
                return (
                    <div className="sh-supervision-wrapper">
                        {renderHeader()}
                        <div className="vh-subpanel">
                            <button className="vh-back" onClick={() => setSubSeccion(null)}>← Volver al panel</button>
                            <div className="vh-subpanel-title">{item.icon} {item.titulo}</div>
                            <PeriodoCard icono={item.icon} titulo={item.titulo} onVer={(a, m) => setPeriodoSel({ año: a, mes: m })} />
                        </div>
                    </div>
                );
            }

            // Paso 2: contenido con período seleccionado
            const { año, mes } = periodoSel;
            const volverPeriodo = () => setPeriodoSel(null);
            const subpanelVolver = (
                <div className="vh-subpanel">
                    <button className="vh-back" onClick={volverPeriodo}>← Volver al panel</button>
                    <div className="vh-subpanel-title">{item.icon} {item.titulo}</div>
                </div>
            );

            if (subSeccion === "programacion") return (
                <div className="sh-supervision-wrapper sh-fullscreen">
                    {renderHeader()}{subpanelVolver}
                    <ProgramacionTodos año={año} mes={mes} modo="programado" />
                </div>
            );
            if (subSeccion === "real") return (
                <div className="sh-supervision-wrapper sh-fullscreen">
                    {renderHeader()}{subpanelVolver}
                    <ProgramacionTodos año={año} mes={mes} modo="real" />
                </div>
            );
            if (subSeccion === "vista") return (
                <div className="sh-supervision-wrapper sh-fullscreen">
                    {renderHeader()}{subpanelVolver}
                    <VistaTurnos año={año} mes={mes} zonaFija={userZona} />
                </div>
            );
            if (subSeccion === "diagramas14") return (
                <div className="sh-supervision-wrapper sh-fullscreen">
                    {renderHeader()}{subpanelVolver}
                    <Diagramas14x14Screen onBack={volverPeriodo} />
                </div>
            );
            if (subSeccion === "control_cliente") return (
                <div className="sh-supervision-wrapper sh-fullscreen">
                    {renderHeader()}{subpanelVolver}
                    <ControlClienteScreen año={año} mes={mes} />
                </div>
            );
            if (subSeccion === "facturacion") return (
                <div className="sh-supervision-wrapper">
                    {renderHeader()}{subpanelVolver}
                    <FacturacionScreen año={año} mes={mes} onBack={volverPeriodo} />
                </div>
            );
            if (subSeccion === "analisis_pas") return (
                <div className="sh-supervision-wrapper">
                    {renderHeader()}{subpanelVolver}
                    <AnalisisHorasPASScreen año={año} mes={mes} />
                </div>
            );
            if (subSeccion === "importacion") return (
                <div className="sh-supervision-wrapper">
                    {renderHeader()}{subpanelVolver}
                    <ImportarRealesPanel año={año} mes={mes} />
                </div>
            );
        }

        // Consolidado sin PeriodoCard (gestiona su propio período)
        if (subSeccion === "consolidado") {
            return (
                <div className={`sh-supervision-wrapper${consolidadoFull ? " sh-supervision-wrapper--full" : ""}`}>
                    {renderHeader()}
                    <div style={{ padding: "12px 16px" }}>
                        <button className="vh-back" onClick={() => { setSubSeccion(null); setConsolidadoFull(false); }}>← Volver al panel</button>
                    </div>
                    <ConsolidadoScreen
                        onBack={() => { setSubSeccion(null); setConsolidadoFull(false); }}
                        onEnterGrilla={() => setConsolidadoFull(true)}
                        onExitGrilla={() => setConsolidadoFull(false)}
                    />
                </div>
            );
        }

        // Ausentismo sin PeriodoCard (gestiona su propio período)
        if (subSeccion === "ausentismo") {
            return (
                <div className="sh-supervision-wrapper sh-fullscreen">
                    {renderHeader()}
                    <div style={{ padding: "12px 16px" }}>
                        <button className="vh-back" onClick={() => setSubSeccion(null)}>← Volver al panel</button>
                    </div>
                    <AusentismoScreen />
                </div>
            );
        }

        // Menú principal de turnos
        return (
            <div className="sh-supervision-wrapper">
                {renderHeader()}
                <div className="vh-subpanel">
                    <button className="vh-back" onClick={() => { setSeccion(null); setSubSeccion(null); setPeriodoSel(null); }}>← Volver al panel</button>
                    <div className="vh-subpanel-title">📅 Gestión de Horas</div>
                    <div className="sh-grid">
                        {TURNOS_MENUS.map(z => (
                            <button key={z.id} className={`sh-modulo sh-modulo--${z.color}`} onClick={() => { setPeriodoSel(null); setSubSeccion(z.id); }}>
                                <span className="sh-modulo-icon">{z.icon}</span>
                                <div className="sh-modulo-info"><strong>{z.titulo}</strong><small>{z.desc}</small></div>
                                <span className="sh-modulo-arrow">›</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }


    if (seccion === "gestion_premios") {
        return (
            <div className="vh-root">
                {renderHeader()}
                <GestionPremiosScreen onBack={() => setSeccion(null)} />
            </div>
        );
    }

    // Resto de secciones — placeholder
    if (seccion) {
        const mod = MODULOS[seccion];
        return (
            <div className="vh-root">
                {renderHeader()}
                <div className="vh-subpanel">
                    <button className="vh-back" onClick={() => setSeccion(null)}>← Volver al panel</button>
                    <div className="vh-subpanel-title">{mod?.icon} {mod?.titulo}</div>
                    <div className="vh-coming-soon">Próximamente</div>
                </div>
            </div>
        );
    }

    // Menú principal
    return (
        <div className="sh-root">
            {renderHeader()}
            <CalendarioSemanal actividades={actividadesSemana} legajos={legajos} />
            <div style={{ padding: "var(--space-4) var(--space-5) var(--space-8)" }}>
                {GRUPOS_MENU.map(grupo => {
                    const items = grupo.ids
                        .map(id => ({ id, ...MODULOS[id] }))
                        .filter(m => m.titulo);
                    if (!items.length) return null;
                    return (
                        <div key={grupo.label} className="sh-grupo">
                            <div className="sh-grupo-label">{grupo.label}</div>
                            {items.map(m => {
                                const habilitado = tieneAcceso(empresaModulos, user, m.id);
                                return (
                                    <button
                                        key={m.id}
                                        className={`sh-modulo sh-modulo--${m.color} ${!habilitado ? "sh-modulo--disabled" : ""}`}
                                        disabled={!habilitado}
                                        onClick={() => { if (habilitado) { setSubSeccion(null); setSeccion(m.id); } }}
                                    >
                                        <span className={`sh-modulo-icon sh-modulo-icon--${m.color}`}>{m.icon}</span>
                                        <div className="sh-modulo-info">
                                            <strong>{m.titulo}</strong>
                                            <small>{habilitado ? m.desc : "Sin acceso"}</small>
                                        </div>
                                        {habilitado && <span className="sh-modulo-arrow">›</span>}
                                    </button>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
