// src/screens/SupervisorHome.jsx
// Pantalla de inicio del Supervisor — menú de acceso a sus módulos.

import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { MESES_CORTO as MESES_ES } from "../../utils/periodoUtils";
import { useWhatsApp } from "../../hooks/useWhatsApp";
import { buildResumenDiario } from "../../utils/whatsapp";
import { useAuth }              from "../../context/AuthContext";
import { useAppData }           from "../../context/AppDataContext";
import { tieneAcceso }          from "../../config/roles";
import SupervisorDashboard      from "./SupervisorDashboard";
import PlantillasRondaScreen    from "../shared/PlantillasRondaScreen";
import MonitorRondasScreen      from "../shared/MonitorRondasScreen";
import VerInformesScreen           from "../../forms/VerInformesScreen";
import DashboardPersonalScreen     from "../administrativo/DashboardPersonalScreen";
import InformeSencilloScreen       from "../../forms/InformeSencilloScreen";
import InformeNovedadScreen        from "../../forms/InformeNovedadScreen";
import VerComunicacionesScreen     from "../../forms/VerComunicacionesScreen";
import CrearComunicacionScreen     from "../../forms/CrearComunicacionScreen";
import VerProcedimientosScreen     from "../../forms/VerProcedimientosScreen";
import SubirProcedimientoScreen    from "../../forms/SubirProcedimientoScreen";
import VerCapacitacionesScreen     from "../../forms/VerCapacitacionesScreen";
import SubirCapacitacionScreen     from "../../forms/SubirCapacitacionScreen";
import { VistaTurnos }          from "../shared/ProgramacionServiciosScreen";
import ControlClienteScreen     from "../shared/ControlClienteScreen";
import ConsolidadoScreen        from "../shared/ConsolidadoScreen";
import Diagramas14x14Screen     from "../shared/Diagramas14x14Screen";
import PedidoInsumosScreen      from "../shared/PedidoInsumosScreen";
import AppHeader from "../../components/AppHeader";
import "../../styles/ConsolidadoScreen.css";
import "../../styles/SupervisorHome.css";

// ── Calendario semanal ─────────────────────────────────────────────────────
const DIAS_ES   = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES_LARGO = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
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
                    <small>Del 24/{String(mesAnt).padStart(2,"0")}/{añoAnt}&nbsp;al&nbsp;23/{String(mes).padStart(2,"0")}/{año}</small>
                </div>
                <div className="con-sel-campos">
                    <select className="con-select" value={mes} onChange={e => setMes(Number(e.target.value))}>
                        {MESES_LARGO.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                    <select className="con-select con-select--año" value={año} onChange={e => setAño(Number(e.target.value))}>
                        {[2025, 2026, 2027, 2028, 2029, 2030].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button className="con-btn-abrir" onClick={() => onVer(año, mes)}>Ver →</button>
                </div>
            </div>
        </div>
    );
}
function fmtKey(d) { return d.toISOString().slice(0, 10); }

function CalendarioSemanal({ actividades = {}, legajos = [] }) {
    const hoy    = new Date();
    const hoyKey = fmtKey(hoy);
    const [selKey, setSelKey] = useState(hoyKey);
    const [sending, setSending] = useState(false);
    const [waSent,  setWaSent]  = useState(false);
    const { configurado, enviar } = useWhatsApp();

    const dias = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(hoy);
        d.setDate(hoy.getDate() + i);
        return d;
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
                        <button
                            key={key}
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
                                {acts.length === 0 && !cumplesPorKey[key] && (
                                    <span className="sh-cal-dia-empty">—</span>
                                )}
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

const MODULOS = [
    { id: "muro_comunicacion",          icon: "📢", titulo: "Muro de Comunicación y Novedades",  desc: "Novedades y comunicados de tu empresa",                          color: "blue"  },
    { id: "supervision",                icon: "🔍", titulo: "Supervisión",                        desc: "Accedé a tu panel de supervisión y control de objetivos",         color: "blue"  },
    { id: "rondas_plantillas",          icon: "🗺️", titulo: "Cargar plantillas de ronda",         desc: "Creá y configurá rondas con checkpoints y actividades GPS",       color: "blue"  },
    { id: "control_actividades_vigilador", icon: "👁️", titulo: "Control de Actividades Vigilador", desc: "Monitor de rondas, planillas, actas, vehículos, insumos e informes", color: "blue" },
    { id: "redactar_informe",           icon: "✏️", titulo: "Redactar informe",                   desc: "Creá un informe de supervisión o novedad",                        color: "green" },
    { id: "turnos",                     icon: "📅", titulo: "Gestión de horarios",               desc: "Cargá y gestioná los turnos del personal",                       color: "blue"  },
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
    { id: "ver_pedido_insumos",    icon: "📦", titulo: "Pedido de Insumos",           desc: "Creá o consultá pedidos de insumos del puesto"          },
    { id: "ver_inventarios",       icon: "🗃️", titulo: "Ver Inventarios",             desc: "Consultá el inventario de los puestos"                  },
    { id: "ver_informes",          icon: "📄", titulo: "Ver Informes",                desc: "Consultá los informes redactados"                       },
];

export default function SupervisorHome({ user, onIniciarJornada, onExit }) {
    const { logout }        = useAuth();
    const { empresaModulos, data, empresaNombre, empresaId, userZona } = useAppData();
    const [seccion,    setSeccion]    = useState(null);
    const [subSeccion, setSubSeccion] = useState(null);
    const [subSub,     setSubSub]     = useState(null);
    const [periodoSel, setPeriodoSel] = useState(null);

    const handleLogout = async () => { await logout(); onExit?.(); };

    const [legajos, setLegajos] = useState([]);
    useEffect(() => {
        if (!empresaId) return;
        getDocs(query(collection(db, "legajos"), where("empresaId", "==", empresaId)))
            .then(snap => setLegajos(snap.docs.map(d => d.data())))
            .catch(err => console.error("Error cargando legajos:", err));
    }, [empresaId]);

    const modActivo   = MODULOS.find(m => m.id === seccion);
    const subline     = seccion
        ? `${modActivo?.icon ?? ""} ${modActivo?.titulo ?? seccion}`.trim()
        : "🔍 Supervisor / Encargado";
    const renderHeader = () => <AppHeader onLogout={handleLogout} subline={subline} />;

    const volverBtn = (onClick) => (
        <div style={{ padding: "1rem 1.5rem 0" }}>
            <button className="sh-back-btn" onClick={onClick}>← Volver al panel</button>
        </div>
    );

    // ── Control de Actividades Vigilador (módulo contenedor) ──
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
                <VerInformesScreen onBack={() => setSubSeccion(null)} zonaFija={userZona} />
            </div>
        );
        if (subSeccion === "ver_pedido_insumos") return (
            <div className="sh-supervision-wrapper">
                {renderHeader()}
                <PedidoInsumosScreen onBack={() => setSubSeccion(null)} />
            </div>
        );
        if (subSeccion) {
            const sub = SUB_MODULOS_ACTIVIDADES.find(m => m.id === subSeccion);
            return (
                <div className="sh-root">
                    {renderHeader()}
                    {volverBtn(() => setSubSeccion(null))}
                    <div className="sh-subpanel">
                        <div className="sh-subpanel-title">{sub.icon} {sub.titulo}</div>
                        <div className="sh-coming-soon">Próximamente</div>
                    </div>
                </div>
            );
        }
        return (
            <div className="sh-root">
                {renderHeader()}
                {volverBtn(() => setSeccion(null))}
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
                {renderHeader()}
                {volverBtn(() => setSeccion(null))}
                <div className="sh-section-title-bar">
                    🔍 Plan de supervisión, cumplimiento y carga
                </div>
                <SupervisorDashboard user={user} onIniciarJornada={onIniciarJornada} hideHeader />
            </div>
        );
    }

    // Muro de comunicación → submenú ver / crear
    if (seccion === "muro_comunicacion") {
        if (subSub === "ver")   return <div className="sh-root"><AppHeader onLogout={handleLogout} subline={subline} /><VerComunicacionesScreen  onBack={() => setSubSub(null)} /></div>;
        if (subSub === "crear") return <div className="sh-root"><AppHeader onLogout={handleLogout} subline={subline} /><CrearComunicacionScreen  onBack={() => setSubSub(null)} /></div>;
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
                            <button key={m.id} className="sh-modulo" onClick={() => setSubSub(m.id)}>
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
            </div>
        );
    }

    // Muro de procedimientos → submenú ver / subir
    if (seccion === "muro_procedimientos") {
        if (subSub === "ver")   return <><AppHeader onLogout={handleLogout} subline={subline} /><VerProcedimientosScreen  onBack={() => setSubSub(null)} /></>;
        if (subSub === "subir") return <><AppHeader onLogout={handleLogout} subline={subline} /><SubirProcedimientoScreen onBack={() => setSubSub(null)} /></>;
        const PROC_MENUS = [
            { id: "ver",   icon: "📋", titulo: "Ver procedimientos",   desc: "Consultá los procedimientos operativos vigentes" },
            { id: "subir", icon: "📤", titulo: "Subir procedimiento",  desc: "Publicá un nuevo procedimiento para el personal"  },
        ];
        return (
            <div className="sh-root">
                {renderHeader()}
                {volverBtn(() => setSeccion(null))}
                <div className="sh-grid">
                    {PROC_MENUS.map(m => (
                        <button key={m.id} className="sh-modulo" onClick={() => setSubSub(m.id)}>
                            <span className="sh-modulo-icon">{m.icon}</span>
                            <div className="sh-modulo-info"><strong>{m.titulo}</strong><small>{m.desc}</small></div>
                            <span className="sh-modulo-arrow">›</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // Capacitación → submenú ver / subir
    if (seccion === "capacitacion") {
        if (subSub === "ver")   return <><AppHeader onLogout={handleLogout} subline={subline} /><VerCapacitacionesScreen  onBack={() => setSubSub(null)} /></>;
        if (subSub === "subir") return <><AppHeader onLogout={handleLogout} subline={subline} /><SubirCapacitacionScreen  onBack={() => setSubSub(null)} /></>;
        const CAP_MENUS = [
            { id: "ver",   icon: "📚", titulo: "Ingresar al repositorio", desc: "Accedé a los materiales y cursos disponibles" },
            { id: "subir", icon: "📤", titulo: "Subir capacitación",    desc: "Publicá un nuevo curso o material de entrenamiento" },
        ];
        return (
            <div className="sh-root">
                {renderHeader()}
                {volverBtn(() => setSeccion(null))}
                <div className="sh-grid">
                    {CAP_MENUS.map(m => (
                        <button key={m.id} className="sh-modulo" onClick={() => setSubSub(m.id)}>
                            <span className="sh-modulo-icon">{m.icon}</span>
                            <div className="sh-modulo-info"><strong>{m.titulo}</strong><small>{m.desc}</small></div>
                            <span className="sh-modulo-arrow">›</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // Redactar informe → submenú sencillo / gravedad
    if (seccion === "redactar_informe") {
        if (subSub === "sencillo")  return <><AppHeader onLogout={handleLogout} subline={subline} /><InformeSencilloScreen onBack={() => setSubSub(null)} /></>;
        if (subSub === "gravedad")  return <><AppHeader onLogout={handleLogout} subline={subline} /><InformeNovedadScreen  onBack={() => setSubSub(null)} /></>;
        const CREAR_MENUS = [
            { id: "sencillo", icon: "📝", titulo: "Informe sencillo",   desc: "Redactá un informe no urgente de tu turno o puesto" },
            { id: "gravedad", icon: "🚨", titulo: "Informe de gravedad", desc: "Registrá un incidente con daños a personas o bienes" },
        ];
        return (
            <div className="sh-root">
                {renderHeader()}
                {volverBtn(() => setSeccion(null))}
                <div className="sh-grid">
                    {CREAR_MENUS.map(m => (
                        <button key={m.id} className="sh-modulo" onClick={() => setSubSub(m.id)}>
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

    // Plantillas de ronda
    if (seccion === "rondas_plantillas") {
        return (
            <div className="sh-supervision-wrapper">
                {renderHeader()}
                <PlantillasRondaScreen onBack={() => setSeccion(null)} />
            </div>
        );
    }

    if (seccion === "dashboard_personal") {
        return (
            <div className="sh-supervision-wrapper sh-supervision-wrapper--full">
                {renderHeader()}
                <DashboardPersonalScreen onBack={() => setSeccion(null)} zonaFija={userZona} />
            </div>
        );
    }

    // Gestión de horarios
    if (seccion === "turnos") {
        const HORARIOS_MENUS = [
            { id: "vista",           icon: "📊", titulo: "Vista de horarios",  desc: "Visualizá el estado de la programación mensual"      },
            { id: "consolidado",     icon: "📑", titulo: "Consolidado",         desc: "Resumen consolidado de horas por período"            },
            { id: "diagramas14",     icon: "🔄", titulo: "Diagramas 14 x 14",  desc: "Gestión de grupos y francos del régimen 14x14"       },
            { id: "control_cliente", icon: "🤝", titulo: "Control cliente",     desc: "Seguimiento y control de horas facturadas al cliente" },
        ];
        const CON_PERIODO = ["vista", "diagramas14", "control_cliente"];

        if (subSeccion && CON_PERIODO.includes(subSeccion)) {
            const item = HORARIOS_MENUS.find(m => m.id === subSeccion);
            if (!periodoSel) {
                return (
                    <div className="sh-supervision-wrapper">
                        {renderHeader()}
                        {volverBtn(() => setSubSeccion(null))}
                        <PeriodoCard icono={item.icon} titulo={item.titulo} onVer={(a, m) => setPeriodoSel({ año: a, mes: m })} />
                    </div>
                );
            }
            const { año, mes } = periodoSel;
            const volverPeriodo = () => setPeriodoSel(null);
            if (subSeccion === "vista") return (
                <div className="sh-supervision-wrapper sh-fullscreen">
                    {renderHeader()}
                    {volverBtn(volverPeriodo)}
                    <VistaTurnos año={año} mes={mes} zonaFija={userZona} />
                </div>
            );
            if (subSeccion === "diagramas14") return (
                <div className="sh-supervision-wrapper sh-fullscreen">
                    {renderHeader()}
                    {volverBtn(volverPeriodo)}
                    <Diagramas14x14Screen onBack={volverPeriodo} />
                </div>
            );
            if (subSeccion === "control_cliente") return (
                <div className="sh-supervision-wrapper sh-fullscreen">
                    {renderHeader()}
                    {volverBtn(volverPeriodo)}
                    <ControlClienteScreen año={año} mes={mes} zonaFija={userZona} />
                </div>
            );
        }

        if (subSeccion === "consolidado") return (
            <div className="sh-supervision-wrapper sh-fullscreen">
                {renderHeader()}
                <ConsolidadoScreen onBack={() => setSubSeccion(null)} zonaFija={userZona} />
            </div>
        );

        return (
            <div className="sh-supervision-wrapper">
                {renderHeader()}
                {volverBtn(() => setSeccion(null))}
                <div className="sh-grid">
                    {HORARIOS_MENUS.map(m => (
                        <button key={m.id} className="sh-modulo"
                            onClick={() => { setPeriodoSel(null); setSubSeccion(m.id); }}>
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

    // Otras secciones — placeholder
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

    return (
        <div className="sh-root">
            <AppHeader onLogout={handleLogout} subline={subline} />

            <CalendarioSemanal actividades={data?.actividadesSemana ?? {}} legajos={legajos} />

            <div className="sh-grid">
                {MODULOS.map(m => {
                    const habilitado = tieneAcceso(empresaModulos, user, m.id);
                    return (
                    <button
                        key={m.id}
                        className={`sh-modulo sh-modulo--${m.color} ${!habilitado ? "sh-modulo--disabled" : ""}`}
                        disabled={!habilitado}
                        onClick={() => { if (habilitado) { setSubSub(null); setSubSeccion(null); setPeriodoSel(null); setSeccion(m.id); } }}
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
