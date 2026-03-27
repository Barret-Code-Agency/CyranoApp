// src/screens/AdministrativoHome.jsx
import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { MESES_CORTO as MESES_ES, MESES_ES as MESES_ES_LARGO } from "../../utils/periodoUtils";
import { useWhatsApp } from "../../hooks/useWhatsApp";
import { useActividadesSemana } from "../../hooks/useActividadesSemana";
import { buildResumenDiario } from "../../utils/whatsapp";
import { useAuth }                from "../../context/AuthContext";
import { useAppData }             from "../../context/AppDataContext";
import { tieneAcceso }            from "../../config/roles";
import GestionDatosAdminScreen    from "./GestionDatosAdminScreen";
import DashboardPersonalScreen    from "./DashboardPersonalScreen";
import ControlClienteScreen       from "../shared/ControlClienteScreen";
import { VistaTurnos }            from "../shared/ProgramacionServiciosScreen";
import InformeSencilloScreen      from "../../forms/InformeSencilloScreen";
import InformeNovedadScreen       from "../../forms/InformeNovedadScreen";
import ReporteCondicionInseguraScreen from "../../forms/ReporteCondicionInseguraScreen";
import VerInformesScreen          from "../../forms/VerInformesScreen";
import VerComunicacionesScreen    from "../../forms/VerComunicacionesScreen";
import FacturacionScreen          from "../gerencia/FacturacionScreen";
import CrearComunicacionScreen    from "../../forms/CrearComunicacionScreen";
import PedidoInsumosScreen         from "../shared/PedidoInsumosScreen";
import VerCapacitacionesScreen     from "../../forms/VerCapacitacionesScreen";
import SubirCapacitacionScreen     from "../../forms/SubirCapacitacionScreen";
import AppHeader from "../../components/AppHeader";
import "../../styles/VigHome.css";
import "../../styles/SupervisorHome.css";
import "../../styles/ConsolidadoScreen.css";
import "./GestionDatosAdminScreen.css";

// ── Calendario semanal (idéntico al de VigHome) ────────────────────────────
const DIAS_ES  = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
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

    // Cumpleaños de la semana
    const cumplesPorKey = {};
    legajos.forEach(p => {
        if (!p.nacimiento && p.nacimiento !== 0) return;
        let dd, mm;
        const n = Number(p.nacimiento);
        if (typeof p.nacimiento === "number" || (n > 20000 && n < 60000 && !isNaN(n))) {
            const dt = new Date((n - 25569) * 86400000);
            dd = dt.getUTCDate(); mm = dt.getUTCMonth() + 1;
        } else {
            const s = String(p.nacimiento);
            const sep = s.includes("/") ? "/" : "-";
            const parts = s.split(sep).map(Number);
            if (parts.length < 2 || parts.some(isNaN)) return;
            dd = parts[0] > 31 ? parts[2] : parts[0];
            mm = parts[1];
        }
        dias.forEach(d => {
            if (d.getDate() === dd && d.getMonth() + 1 === mm) {
                const key = fmtKey(d);
                const ap = ((p.apellido || "") + " " + (p.nombre || "")).trim().split(/\s+/).slice(0, 2).join(" ") || p.nombre || "—";
                cumplesPorKey[key] = [...(cumplesPorKey[key] || []), ap];
            }
        });
    });

    const selDate  = new Date(selKey + "T12:00:00");
    const selActs  = actividades[selKey] ?? [];
    const selCumps = cumplesPorKey[selKey] ?? [];

    return (
        <div className="vh-calendario">
            <div className="vh-cal-title">📅 Actividades de la semana</div>
            <div className="vh-cal-strip">
                {dias.map(d => {
                    const key  = fmtKey(d);
                    const acts = actividades[key] ?? [];
                    return (
                        <button
                            key={key}
                            className={`vh-cal-dia ${key === hoyKey ? "vh-cal-dia--hoy" : ""} ${key === selKey ? "vh-cal-dia--sel" : ""}`}
                            onClick={() => setSelKey(key)}
                        >
                            <span className="vh-cal-dayname">{DIAS_ES[d.getDay()]}</span>
                            <span className="vh-cal-daynum">{d.getDate()}</span>
                            <div className="vh-cal-dia-acts">
                                {acts.map((a, i) => (
                                    <span key={i} className={`vh-cal-dia-chip vh-cal-dia-chip--${a.tipo ?? "default"}`}>
                                        {a.label}
                                    </span>
                                ))}
                                {(cumplesPorKey[key] || []).map((ap, i) => (
                                    <span key={`c${i}`} className="vh-cal-dia-chip vh-cal-dia-chip--cumple">
                                        🎂 {ap}
                                    </span>
                                ))}
                                {acts.length === 0 && !cumplesPorKey[key] && (
                                    <span className="vh-cal-dia-empty">—</span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
            <div className="vh-cal-detail">
                <div className="vh-cal-detail-fecha">
                    {DIAS_ES[selDate.getDay()]} {selDate.getDate()} de {MESES_ES[selDate.getMonth()]}
                    {selKey === hoyKey && <span className="vh-cal-hoy-badge">Hoy</span>}
                </div>
                {selActs.length === 0 && selCumps.length === 0 ? (
                    <div className="vh-cal-empty">Sin actividades programadas</div>
                ) : (
                    <div className="vh-cal-acts">
                        {selActs.map((a, i) => (
                            <div key={i} className={`vh-cal-act vh-cal-act--${a.tipo ?? "default"}`}>
                                {a.hora && <span className="vh-cal-act-hora">{a.hora}</span>}
                                <span className="vh-cal-act-label">{a.label}</span>
                            </div>
                        ))}
                        {selCumps.map((ap, i) => (
                            <div key={`c${i}`} className="vh-cal-act vh-cal-act--cumple">
                                <span className="vh-cal-act-hora">🎂</span>
                                <span className="vh-cal-act-label">Cumpleaños de {ap}</span>
                            </div>
                        ))}
                    </div>
                )}
                {configurado && (
                    <button
                        className="vh-cal-wa-btn"
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

// ── Selector de período (mismo estilo que Consolidado) ─────────────────────
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
                        {MESES_ES_LARGO.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
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

// ── Módulos ────────────────────────────────────────────────────────────────
const MODULOS = {
    "muro_comunicacion":   { icon: "📢", titulo: "Comunicación",           desc: "Novedades y comunicados de tu empresa",               color: "purple"  },
    "planillas":           { icon: "📊", titulo: "Planillas",               desc: "Consultá las planillas operativas",                   color: "slate"   },
    "informes":            { icon: "📄", titulo: "Informes",                desc: "Ver o crear informes",                                color: "teal"    },
    "turnos":              { icon: "🕐", titulo: "Turnos de trabajo",       desc: "Visualizá los horarios del personal",                 color: "indigo"  },
    "actualizacion_datos": { icon: "🗂️", titulo: "Actualización de Datos",  desc: "Editá legajos, clientes, objetivos y vehículos",      color: "blue"    },
    "dashboard_personal":  { icon: "👥", titulo: "Dashboard de personal",   desc: "Estado y novedades del personal",                     color: "cyan"    },
    "facturacion":         { icon: "💰", titulo: "Facturación",             desc: "Gestión de facturación",                              color: "green"   },
    "control_horas":       { icon: "⏱️", titulo: "Control de horas",        desc: "Control de horas y facturación al cliente",           color: "orange"  },
    "ausentismo":          { icon: "📉", titulo: "Ausentismo",              desc: "Registro y seguimiento de ausentismo",                color: "red"     },
    "pedido_insumos":      { icon: "📦", titulo: "Pedido de Insumos",       desc: "Solicitá materiales o insumos para el puesto",        color: "cyan"    },
    "capacitacion":        { icon: "🎓", titulo: "Capacitación",            desc: "Accedé a los cursos y materiales de formación",       color: "amber"   },
};

const GRUPOS_MENU = [
    { label: "Operaciones",  ids: ["turnos", "planillas", "informes", "ausentismo"] },
    { label: "Personal",     ids: ["dashboard_personal", "actualizacion_datos"] },
    { label: "Finanzas",     ids: ["facturacion", "control_horas", "pedido_insumos"] },
    { label: "Comunicación", ids: ["muro_comunicacion"] },
    { label: "Formación",   ids: ["capacitacion"] },
];

export default function AdministrativoHome({ user: propUser, onLogout }) {
    const { user: authUser, logout } = useAuth();
    const { data, empresaModulos, empresaNombre, empresaId, userZona } = useAppData();
    const [seccion,    setSeccion]    = useState(null);
    const [subSeccion, setSubSeccion] = useState(null);
    const [periodoSel, setPeriodoSel] = useState(null);

    const user = authUser || propUser;
    const handleLogout = async () => { await logout(); onLogout?.(); };

    // Carga legajos para cumpleaños en el calendario
    const [legajos, setLegajos] = useState([]);
    useEffect(() => {
        if (!empresaId) return;
        getDocs(query(collection(db, "legajos"), where("empresaId", "==", empresaId)))
            .then(snap => setLegajos(snap.docs.map(d => d.data())))
            .catch(err => console.error("Error cargando legajos:", err));
    }, [empresaId]);
    const actividadesSemana = useActividadesSemana(empresaId, legajos);

    const modActivo = MODULOS[seccion];
    const subline   = seccion
        ? `${modActivo?.icon ?? ""} ${modActivo?.titulo ?? seccion}`.trim()
        : "🗂️ Administrativo";
    const header = <AppHeader onLogout={handleLogout} subline={subline} />;

    const volverBtn = (onClick) => (
        <div style={{ padding: "1rem 1.5rem 0" }}>
            <button className="sh-back-btn" onClick={onClick}>← Volver</button>
        </div>
    );

    // ── Muro de comunicación ───────────────────────────────────────────────
    if (seccion === "muro_comunicacion") {
        if (subSeccion === "ver")   return <div className="vh-root">{header}<VerComunicacionesScreen  onBack={() => setSubSeccion(null)} /></div>;
        if (subSeccion === "crear") return <div className="vh-root">{header}<CrearComunicacionScreen  onBack={() => setSubSeccion(null)} /></div>;
        const MURO_MENUS = [
            { id: "ver",   icon: "📋", titulo: "Ver novedades y comunicaciones", desc: "Consultá las comunicaciones publicadas para el personal" },
            { id: "crear", icon: "✏️", titulo: "Crear comunicación",             desc: "Publicá una comunicación o novedad para todo el personal" },
        ];
        return (
            <div className="vh-root">
                {header}
                <div className="vh-subpanel">
                    <button className="vh-back" onClick={() => setSeccion(null)}>← Volver al panel</button>
                    <div className="vh-subpanel-title">📢 Muro de Comunicación y Novedades</div>
                    <div className="sh-grid">
                        {MURO_MENUS.map(m => (
                            <button key={m.id} className="sh-modulo sh-modulo--purple" onClick={() => setSubSeccion(m.id)}>
                                <span className="sh-modulo-icon sh-modulo-icon--purple">{m.icon}</span>
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

    // ── Actualización de datos ─────────────────────────────────────────────
    if (seccion === "actualizacion_datos") {
        return (
            <div className="vh-root vh-root--full">
                {header}
                <GestionDatosAdminScreen onBack={() => setSeccion(null)} noDelete={true} />
            </div>
        );
    }

    // ── Dashboard de personal (filtrado por zona del usuario) ──────────────
    if (seccion === "dashboard_personal") {
        return (
            <div className="vh-root vh-root--full">
                {header}
                <DashboardPersonalScreen
                    onBack={() => setSeccion(null)}
                />
            </div>
        );
    }

    // ── Control de horas ───────────────────────────────────────────────────
    if (seccion === "control_horas") {
        const CONTROL_HORAS_MENUS = [
            { id: "control_cliente", icon: "🤝", titulo: "Control cliente",  desc: "Seguimiento y control de horas facturadas al cliente" },
            { id: "carga_horas",     icon: "⏱️", titulo: "Carga de horas",    desc: "Cargá las horas trabajadas del período"              },
        ];

        if (subSeccion === "control_cliente") {
            if (!periodoSel) {
                return (
                    <div className="vh-root">
                        {header}
                        <div className="vh-subpanel">
                            <button className="vh-back" onClick={() => setSubSeccion(null)}>← Volver al panel</button>
                            <div className="vh-subpanel-title">🤝 Control Cliente</div>
                            <PeriodoCard icono="🤝" titulo="Control cliente" onVer={(a, m) => setPeriodoSel({ año: a, mes: m })} />
                        </div>
                    </div>
                );
            }
            return (
                <div className="vh-root">
                    {header}
                    <div className="vh-subpanel">
                        <button className="vh-back" onClick={() => setPeriodoSel(null)}>← Volver al panel</button>
                        <div className="vh-subpanel-title">🤝 Control Cliente</div>
                    </div>
                    <ControlClienteScreen año={periodoSel.año} mes={periodoSel.mes} zonaFija={userZona} />
                </div>
            );
        }

        if (subSeccion === "carga_horas") {
            return (
                <div className="vh-root">
                    {header}
                    <div className="vh-subpanel">
                        <button className="vh-back" onClick={() => setSubSeccion(null)}>← Volver al panel</button>
                        <div className="vh-subpanel-title">⏱️ Carga de Horas</div>
                        <div className="vh-coming-soon">Próximamente</div>
                    </div>
                </div>
            );
        }

        return (
            <div className="vh-root">
                {header}
                <div className="vh-subpanel">
                    <button className="vh-back" onClick={() => { setSeccion(null); setSubSeccion(null); setPeriodoSel(null); }}>← Volver al panel</button>
                    <div className="vh-subpanel-title">⏱️ Control de Horas</div>
                </div>
                <div className="sh-grid">
                    {CONTROL_HORAS_MENUS.map(m => (
                        <button key={m.id} className="sh-modulo sh-modulo--orange" onClick={() => { setPeriodoSel(null); setSubSeccion(m.id); }}>
                            <span className="sh-modulo-icon sh-modulo-icon--orange">{m.icon}</span>
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

    // ── Turnos de trabajo → Vista de horarios ──────────────────────────────
    if (seccion === "turnos") {
        if (!periodoSel) {
            return (
                <div className="vh-root">
                    {header}
                    <div className="vh-subpanel">
                        <button className="vh-back" onClick={() => setSeccion(null)}>← Volver al panel</button>
                        <div className="vh-subpanel-title">🕐 Turnos de Trabajo</div>
                        <PeriodoCard icono="🕐" titulo="Vista de horarios" onVer={(a, m) => setPeriodoSel({ año: a, mes: m })} />
                    </div>
                </div>
            );
        }
        return (
            <div className="vh-root">
                {header}
                <div className="vh-subpanel">
                    <button className="vh-back" onClick={() => setPeriodoSel(null)}>← Volver al panel</button>
                    <div className="vh-subpanel-title">🕐 Turnos de Trabajo</div>
                </div>
                <VistaTurnos año={periodoSel.año} mes={periodoSel.mes} zonaFija={userZona} />
            </div>
        );
    }

    // ── Informes ───────────────────────────────────────────────────────────
    if (seccion === "informes") {
        if (subSeccion === "ver_informes") {
            return (
                <div className="vh-root">
                    {header}
                    <VerInformesScreen onBack={() => setSubSeccion(null)} zonaFija={userZona} />
                </div>
            );
        }
        if (subSeccion === "informe_sencillo") {
            return <div className="vh-root">{header}<InformeSencilloScreen onBack={() => setSubSeccion(null)} /></div>;
        }
        if (subSeccion === "informe_gravedad") {
            return <div className="vh-root">{header}<InformeNovedadScreen onBack={() => setSubSeccion(null)} /></div>;
        }
        if (subSeccion === "condicion_insegura") {
            return <div className="vh-root">{header}<ReporteCondicionInseguraScreen onBack={() => setSubSeccion(null)} /></div>;
        }
        if (subSeccion === "crear_informes") {
            const CREAR_MENUS = [
                { id: "informe_sencillo",  icon: "📝", titulo: "Informe sencillo",    desc: "Redactá un informe no urgente" },
                { id: "informe_gravedad",  icon: "🚨", titulo: "Informe de gravedad",  desc: "Registrá un incidente con daños a personas o bienes" },
                { id: "condicion_insegura",icon: "⚠️", titulo: "Condición Insegura",  desc: "Reportá una condición insegura detectada en el puesto" },
            ];
            return (
                <div className="vh-root">
                    {header}
                    <div className="vh-subpanel">
                        <button className="vh-back" onClick={() => setSubSeccion(null)}>← Volver al panel</button>
                        <div className="vh-subpanel-title">✏️ Crear Informe</div>
                        <div className="sh-grid">
                            {CREAR_MENUS.map(m => (
                                <button key={m.id} className="sh-modulo sh-modulo--teal" onClick={() => setSubSeccion(m.id)}>
                                    <span className="sh-modulo-icon sh-modulo-icon--teal">{m.icon}</span>
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

        // Menú principal de informes
        const INFORMES_MENUS = [
            { id: "ver_informes",    icon: "🔍", titulo: "Ver informes",    desc: "Consultá los informes redactados" },
            { id: "crear_informes",  icon: "✏️", titulo: "Crear informe",   desc: "Redactá un nuevo informe" },
        ];
        return (
            <div className="vh-root">
                {header}
                <div className="vh-subpanel">
                    <button className="vh-back" onClick={() => { setSeccion(null); setSubSeccion(null); }}>← Volver al panel</button>
                    <div className="vh-subpanel-title">📄 Informes</div>
                    <div className="sh-grid">
                        {INFORMES_MENUS.map(m => (
                            <button key={m.id} className="sh-modulo sh-modulo--teal" onClick={() => setSubSeccion(m.id)}>
                                <span className="sh-modulo-icon sh-modulo-icon--teal">{m.icon}</span>
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

    // ── Facturación ────────────────────────────────────────────────────────
    if (seccion === "facturacion") {
        if (periodoSel) {
            return (
                <div className="vh-root">
                    {header}
                    <div className="vh-subpanel">
                        <button className="vh-back" onClick={() => setPeriodoSel(null)}>← Volver al panel</button>
                        <div className="vh-subpanel-title">Horas Brinks Seguridad Corporativa</div>
                    </div>
                    <FacturacionScreen año={periodoSel.año} mes={periodoSel.mes} onBack={() => setPeriodoSel(null)} zonaFija={userZona} titulo="Horas Brinks Seguridad Corporativa" />
                </div>
            );
        }
        return (
            <div className="vh-root">
                {header}
                <div className="vh-subpanel">
                    <button className="vh-back" onClick={() => setSeccion(null)}>← Volver al panel</button>
                    <div className="vh-subpanel-title">Horas Brinks Seguridad Corporativa</div>
                    <PeriodoCard icono="" titulo="Horas Brinks Seguridad Corporativa" onVer={(a, m) => setPeriodoSel({ año: a, mes: m })} />
                </div>
            </div>
        );
    }

    if (seccion === "pedido_insumos") {
        return (
            <div className="vh-root">
                {header}
                <PedidoInsumosScreen onBack={() => setSeccion(null)} />
            </div>
        );
    }

    // ── Capacitación ───────────────────────────────────────────────────────
    if (seccion === "capacitacion") {
        if (subSeccion === "repositorio") return <div className="vh-root">{header}<VerCapacitacionesScreen onBack={() => setSubSeccion(null)} /></div>;
        return (
            <div className="sh-supervision-wrapper">
                {header}
                {volverBtn(() => setSeccion(null))}
                <div className="sh-grid">
                    <button className="sh-modulo sh-modulo--amber" onClick={() => setSubSeccion("repositorio")}>
                        <span className="sh-modulo-icon sh-modulo-icon--amber">📚</span>
                        <div className="sh-modulo-info"><strong>Acceder al repositorio</strong><small>Consultá los cursos y materiales de formación disponibles</small></div>
                        <span className="sh-modulo-arrow">›</span>
                    </button>
                </div>
            </div>
        );
    }

    // ── Secciones próximamente ─────────────────────────────────────────────
    if (seccion) {
        const mod = MODULOS[seccion];
        return (
            <div className="vh-root">
                {header}
                <div className="vh-subpanel">
                    <button className="vh-back" onClick={() => setSeccion(null)}>← Volver al panel</button>
                    <div className="vh-subpanel-title">{mod?.icon} {mod?.titulo}</div>
                    <div className="vh-coming-soon">Próximamente</div>
                </div>
            </div>
        );
    }

    // ── Menú principal ─────────────────────────────────────────────────────
    return (
        <div className="vh-root">
            {header}

            <CalendarioSemanal actividades={actividadesSemana} legajos={legajos} />

            <div style={{ padding: "var(--space-4) var(--space-5) var(--space-8)" }}>
                {GRUPOS_MENU.map(grupo => {
                    const items = grupo.ids.map(id => ({ id, ...MODULOS[id] })).filter(m => m.titulo);
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
                                        onClick={() => { if (habilitado) { setSubSeccion(null); setPeriodoSel(null); setSeccion(m.id); } }}
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
