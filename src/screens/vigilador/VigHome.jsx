// src/screens/VigHome.jsx
// Pantalla de inicio del Vigilador — muestra sus módulos disponibles.
// Los módulos se irán implementando en etapas posteriores.

import { useState, useEffect } from "react";
import { useAuth }    from "../../context/AuthContext";
import { useAppData } from "../../context/AppDataContext";
import { tieneAcceso } from "../../config/roles";
import RondasVigScreen from "./RondasVigScreen";
import InformeSencilloScreen from "../../forms/InformeSencilloScreen";
import InformeNovedadScreen from "../../forms/InformeNovedadScreen";
import VerInformesScreen from "../../forms/VerInformesScreen";
import VerComunicacionesScreen from "../../forms/VerComunicacionesScreen";
import MisTurnosVigScreen from "./MisTurnosVigScreen";
import ControlVehicularScreen from "./ControlVehicularScreen";
import { collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { OPCIONES, MESES_CORTO as MESES_ES } from "../../utils/periodoUtils";
import { useWhatsApp } from "../../hooks/useWhatsApp";
import { useActividadesSemana } from "../../hooks/useActividadesSemana";
import { buildResumenDiario } from "../../utils/whatsapp";
import { db } from "../../firebase";
import { useClientesData } from "../../hooks/useClientesData";
import { fmtObjetivo } from "../../utils/formatters";
import ReporteCondicionInseguraScreen from "../../forms/ReporteCondicionInseguraScreen";
import TokensScreen from "./TokensScreen";
import PedidoInsumosScreen from "../shared/PedidoInsumosScreen";
import AppHeader from "../../components/AppHeader";
import "../../styles/VigHome.css";
import "../../styles/SupervisorHome.css";

// Turnos disponibles para check-in: misma fuente que ProgramacionServiciosScreen
const TURNOS = OPCIONES
    .filter(o => o.cls === "dia" || o.cls === "tard" || o.cls === "noch" || o.cls === "g24")
    .map(o => o.val);

// ── Selector de vehículo antes del checklist ──────────────────────────────────
function SelectorVehiculo({ vehiculos = [], supervisor, onBack }) {
    const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState(null);
    const [iniciado, setIniciado] = useState(false);

    if (iniciado && vehiculoSeleccionado) {
        return (
            <ControlVehicularScreen
                vehiculo={vehiculoSeleccionado}
                supervisor={supervisor}
                onConfirmar={() => setIniciado(false)}
                onOmitir={onBack}
            />
        );
    }

    return (
        <div className="vh-subpanel">
            <button className="vh-back" onClick={onBack}>← Volver al panel</button>
            <div className="vh-subpanel-title">🚗 Control de Vehículo</div>
            <div className="vh-opciones vh-vehiculo-col">
                <label style={{ fontWeight: 600, marginBottom: 4 }}>Seleccioná el vehículo a controlar:</label>
                <select
                    className="vig-select vh-vehiculo-select"
                    value={vehiculoSeleccionado || ""}
                    onChange={e => setVehiculoSeleccionado(e.target.value)}
                >
                    <option value="">-- Seleccionar vehículo --</option>
                    {vehiculos.map(v => (
                        <option key={v} value={v}>{v}</option>
                    ))}
                </select>
                <button
                    className={`vh-opcion vh-opcion--blue vh-btn-submit ${vehiculoSeleccionado ? "" : "vh-btn-submit--inactive"}`}
                    disabled={!vehiculoSeleccionado}
                    onClick={() => setIniciado(true)}
                >
                    <span className="vh-opcion-icon">✅</span>
                    <div className="vh-opcion-info">
                        <strong>Iniciar checklist</strong>
                        <small>{vehiculoSeleccionado || "Seleccioná un vehículo primero"}</small>
                    </div>
                    <span className="vh-modulo-arrow">›</span>
                </button>
            </div>
        </div>
    );
}

const MODULOS = {
    "muro_comunicacion":   { icon: "📢", titulo: "Comunicación",         desc: "Novedades y comunicados de tu empresa",             permiso: "muro_comunicacion",   color: "purple"  },
    "libro_actas":         { icon: "📖", titulo: "Libro de Actas",       desc: "Registrá novedades y actas de tu turno",            permiso: "libro_actas",         color: "blue"    },
    "realizar_ronda":      { icon: "🗺️", titulo: "Realizar Ronda",       desc: "Iniciá y registrá tu ronda de vigilancia",          permiso: "realizar_ronda",      color: "green"   },
    "control_vehicular":   { icon: "🚗", titulo: "Control de Vehículo",  desc: "Realizá el checklist de tu vehículo asignado",      permiso: "control_vehicular",   color: "orange"  },
    "planillas":           { icon: "📊", titulo: "Planillas",             desc: "Consultá tus planillas operativas",                 permiso: "planillas",           color: "slate"   },
    "informes":            { icon: "📄", titulo: "Informes",              desc: "Creá o consultá informes de tu puesto",             permiso: "informes",            color: "teal"    },
    "turnos_ver":          { icon: "🕐", titulo: "Mis Turnos",            desc: "Consultá tu calendario de turnos",                  permiso: "turnos_ver",          color: "indigo"  },
    "pedido_insumos":      { icon: "📦", titulo: "Pedido de Insumos",     desc: "Solicitá materiales o insumos para tu puesto",      permiso: "pedido_insumos",      color: "cyan"    },
    "inventarios":         { icon: "🗃️", titulo: "Inventarios",           desc: "Consultá y gestioná el inventario de tu puesto",    permiso: "inventarios",         color: "amber"   },
    "muro_procedimientos": { icon: "📌", titulo: "Procedimientos",        desc: "Consultá los procedimientos operativos vigentes",   permiso: "muro_procedimientos", color: "navy"    },
    "capacitacion":        { icon: "🎓", titulo: "Capacitación",          desc: "Accedé a tus cursos y materiales de formación",     permiso: "capacitacion",        color: "amber"   },
};

const GRUPOS_MENU = [
    { label: "Operaciones", ids: ["libro_actas", "realizar_ronda", "control_vehicular", "planillas"] },
    { label: "Reportes",    ids: ["informes", "turnos_ver", "pedido_insumos", "inventarios"] },
    { label: "Formación",   ids: ["muro_comunicacion", "muro_procedimientos", "capacitacion"] },
];

// ── Calendario semanal ─────────────────────────────────────────────────────────
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
                                    <span key={i} className={`vh-cal-dia-chip vh-cal-dia-chip--${a.tipo ?? "default"}`}>{a.label}</span>
                                ))}
                                {(cumplesPorKey[key] || []).map((ap, i) => (
                                    <span key={`c${i}`} className="vh-cal-dia-chip vh-cal-dia-chip--cumple">🎂 {ap}</span>
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
                            const texto = buildResumenDiario(selDate, selActs, selCumps);
                            await enviar(texto);
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

// ── Sub-pantalla Informes ──────────────────────────────────────────────────────
const OPCIONES_INFORMES = [
    {
        id:    "ver",
        icon:  "🔍",
        titulo: "Ver informes redactados",
        desc:  "Consultá los informes que ya redactaste",
        color: "blue",
    },
    {
        id:    "sencillo",
        icon:  "📝",
        titulo: "Crear informe sencillo",
        desc:  "Redactá un informe no urgente de tu turno o puesto",
        color: "green",
    },
    {
        id:    "novedad",
        icon:  "🚨",
        titulo: "Crear informe de novedad",
        desc:  "Registrá un incidente con daños a personas o bienes",
        color: "red",
    },
    {
        id:    "reporte_condiciones",
        icon:  "⚠️",
        titulo: "Reporte de condiciones inseguras",
        desc:  "Reportá condiciones del puesto que representan un riesgo",
        color: "orange",
    },
];

function PanelInformes({ onBack }) {
    const [vista, setVista] = useState(null);

    if (vista === "sencillo") {
        return <InformeSencilloScreen onBack={() => setVista(null)} />;
    }

    if (vista === "novedad") {
        return <InformeNovedadScreen onBack={() => setVista(null)} />;
    }

    if (vista === "ver") {
        return <VerInformesScreen onBack={() => setVista(null)} soloPropio={true} />;
    }

    if (vista === "reporte_condiciones") {
        return <ReporteCondicionInseguraScreen onBack={() => setVista(null)} />;
    }

    if (vista) {
        const op = OPCIONES_INFORMES.find(o => o.id === vista);
        return (
            <div className="vh-subpanel">
                <button className="vh-back" onClick={() => setVista(null)}>← Volver al panel</button>
                <div className="vh-subpanel-title">{op.icon} {op.titulo}</div>
                <div className="vh-coming-soon">Próximamente</div>
            </div>
        );
    }

    return (
        <div className="vh-subpanel">
            <button className="vh-back" onClick={onBack}>← Volver al panel</button>
            <div className="vh-subpanel-title">📄 Informes</div>
            <div className="sh-grid" style={{ padding: "var(--space-3) 0 0" }}>
                {OPCIONES_INFORMES.map(op => (
                    <button key={op.id} className="sh-modulo sh-modulo--teal" onClick={() => setVista(op.id)}>
                        <span className="sh-modulo-icon sh-modulo-icon--teal">{op.icon}</span>
                        <div className="sh-modulo-info">
                            <strong>{op.titulo}</strong>
                            <small>{op.desc}</small>
                        </div>
                        <span className="sh-modulo-arrow">›</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── Sub-pantalla Planillas ─────────────────────────────────────────────────────
const OPCIONES_PLANILLAS = [
    { id: "llaves",          icon: "🔑", titulo: "Control de llaves",      desc: "Registrá la entrega y recepción de llaves",       color: "blue"   },
    { id: "visitas",         icon: "🧑‍💼", titulo: "Visitas",                desc: "Registrá el ingreso y egreso de visitas",         color: "blue"   },
    { id: "personal_propio", icon: "👷", titulo: "Personal propio",        desc: "Registrá novedades del personal del puesto",      color: "blue"   },
    { id: "vehiculos",       icon: "🚗", titulo: "Vehículos",              desc: "Registrá el ingreso y egreso de vehículos",       color: "blue"   },
    { id: "vehiculos_carga", icon: "🚛", titulo: "Vehículos de carga",     desc: "Registrá el ingreso y egreso de vehículos pesados", color: "blue" },
    { id: "caudales",        icon: "💰", titulo: "Ingreso de caudales",    desc: "Registrá el movimiento de caudales en el puesto", color: "red"    },
];

function PanelPlanillas({ onBack }) {
    const [vista, setVista] = useState(null);

    if (vista) {
        const op = OPCIONES_PLANILLAS.find(o => o.id === vista);
        return (
            <div className="vh-subpanel">
                <button className="vh-back" onClick={() => setVista(null)}>← Volver al panel</button>
                <div className="vh-subpanel-title">{op.icon} {op.titulo}</div>
                <div className="vh-coming-soon">Próximamente</div>
            </div>
        );
    }

    return (
        <div className="vh-subpanel">
            <button className="vh-back" onClick={onBack}>← Volver al panel</button>
            <div className="vh-subpanel-title">📊 Planillas</div>
            <div className="sh-grid" style={{ padding: "var(--space-3) 0 0" }}>
                {OPCIONES_PLANILLAS.map(op => (
                    <button key={op.id} className="sh-modulo sh-modulo--slate" onClick={() => setVista(op.id)}>
                        <span className="sh-modulo-icon sh-modulo-icon--slate">{op.icon}</span>
                        <div className="sh-modulo-info">
                            <strong>{op.titulo}</strong>
                            <small>{op.desc}</small>
                        </div>
                        <span className="sh-modulo-arrow">›</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── Sub-pantalla Capacitación ─────────────────────────────────────────────────
const OPCIONES_CAPACITACION = [
    { id: "repositorio",    icon: "📚", titulo: "Ingresar al repositorio",  desc: "Accedé a los materiales y cursos disponibles" },
    { id: "cambiar_tokens", icon: "🎟️", titulo: "Mis Tokens",              desc: "Consultá tu saldo y canjeá premios con tus tokens" },
];

function PanelCapacitacion({ onBack }) {
    const [vista, setVista] = useState(null);

    if (vista === "cambiar_tokens") {
        return <TokensScreen onBack={() => setVista(null)} />;
    }

    if (vista) {
        const op = OPCIONES_CAPACITACION.find(o => o.id === vista);
        return (
            <div className="vh-subpanel">
                <button className="vh-back" onClick={() => setVista(null)}>← Volver al panel</button>
                <div className="vh-subpanel-title">{op.icon} {op.titulo}</div>
                <div className="vh-coming-soon">Próximamente</div>
            </div>
        );
    }
    return (
        <div className="vh-subpanel">
            <button className="vh-back" onClick={onBack}>← Volver al panel</button>
            <div className="vh-subpanel-title">🎓 Capacitación y Entrenamiento</div>
            <div className="sh-grid" style={{ padding: "var(--space-3) 0 0" }}>
                {OPCIONES_CAPACITACION.map(op => (
                    <button key={op.id} className="sh-modulo sh-modulo--amber" onClick={() => setVista(op.id)}>
                        <span className="sh-modulo-icon sh-modulo-icon--amber">{op.icon}</span>
                        <div className="sh-modulo-info">
                            <strong>{op.titulo}</strong>
                            <small>{op.desc}</small>
                        </div>
                        <span className="sh-modulo-arrow">›</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── Sub-pantalla Inventarios ───────────────────────────────────────────────────
const OPCIONES_INVENTARIOS = [
    { id: "ht",        icon: "📻", titulo: "Inventario de HT",         desc: "Handies y radios portátiles del puesto" },
    { id: "celulares", icon: "📱", titulo: "Inventario de celulares",  desc: "Teléfonos asignados al puesto" },
    { id: "armamento", icon: "🔫", titulo: "Inventario de armamento",  desc: "Registro de armamento y material asignado" },
    { id: "puesto",    icon: "🏢", titulo: "Inventario del puesto",    desc: "Equipamiento y materiales generales del puesto" },
];

function PanelInventarios({ onBack }) {
    const [vista, setVista] = useState(null);
    if (vista) {
        const op = OPCIONES_INVENTARIOS.find(o => o.id === vista);
        return (
            <div className="vh-subpanel">
                <button className="vh-back" onClick={() => setVista(null)}>← Volver al panel</button>
                <div className="vh-subpanel-title">{op.icon} {op.titulo}</div>
                <div className="vh-coming-soon">Próximamente</div>
            </div>
        );
    }
    return (
        <div className="vh-subpanel">
            <button className="vh-back" onClick={onBack}>← Volver al panel</button>
            <div className="vh-subpanel-title">🗃️ Inventarios</div>
            <div className="sh-grid" style={{ padding: "var(--space-3) 0 0" }}>
                {OPCIONES_INVENTARIOS.map(op => (
                    <button key={op.id} className="sh-modulo sh-modulo--amber" onClick={() => setVista(op.id)}>
                        <span className="sh-modulo-icon sh-modulo-icon--amber">{op.icon}</span>
                        <div className="sh-modulo-info">
                            <strong>{op.titulo}</strong>
                            <small>{op.desc}</small>
                        </div>
                        <span className="sh-modulo-arrow">›</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── Sub-pantalla Pedido de Insumos ─────────────────────────────────────────────
const SECCIONES_INSUMOS = [
    { id: "libreria",    icon: "✏️", titulo: "Librería",             items: [
        "Lapiceras negras (caja x 50)",
        "Corrector líquido (caja x 12)",
        "Resaltadores flúor (caja x 12)",
        "Adhesivo en barra (caja x 30)",
        "Cinta de embalar transparente (pack x 36)",
        "Ganchos para abrochadora N°24/6 (caja x 1000)",
        "Ganchos para abrochadora N°26/6 (caja x 1000)",
        "Papel carbónico negro (sobre x 50)",
        "Papel taco adhesivo color 9x9cm (taco x 10)",
        "Hojas A4 para plastificado (pack x 50)",
        "Hojas A3 para plastificado (pack x 50)",
        "Folios A4 reforzados 70 micrones (pack x 10)",
        "Regla 30cm (unidad)",
        "Abrochadora grande (unidad)",
        "Resma papel carta 75g x 500h (caja x 10)",
        "Tóner de impresora",
        "Cartucho de impresora",
        "Tabla portablock con tapa oficio (unidad)",
    ] },
    { id: "comestibles", icon: "🍎", titulo: "Insumos comestibles",  items: ["Café instantáneo","Café de filtro","Azúcar","Edulcorante","Yerba","Agua (bidón)","Leche en polvo","Mate cocido / Saquitos","Té / Saquitos"] },
    { id: "vehiculo",    icon: "⛽", titulo: "Para vehículo",        items: ["Tarjeta YPF en ruta","Aceite de motor","Agua destilada","Líquido de frenos","Limpiaparabrisas","Kit de herramientas","Mantenimiento preventivo","Mantenimiento correctivo"] },
];

function PlanillaInsumos({ onBack }) {
    const { user } = useAuth();
    const { data }  = useAppData();
    const vehiculos = data?.vehiculos ?? [];
    const ITEMS_CON_MODELO = new Set(["Tóner de impresora", "Cartucho de impresora"]);
    const initEntradas     = () => [{ modelo: "", cantidad: 1 }];

    const [cantidades,    setCantidades]    = useState({});
    const [multiEntradas, setMultiEntradas] = useState({});   // { key: [{modelo, cantidad}] }
    const [vehiculoRef,   setVehiculoRef]   = useState("");
    const [observaciones, setObservaciones] = useState("");
    const [enviando,      setEnviando]      = useState(false);
    const [enviado,       setEnviado]       = useState(false);

    const getQty      = (secId, item) => cantidades[`${secId}__${item}`] ?? 0;
    const setQty      = (secId, item, val) => {
        const v = Math.max(0, Number(val));
        setCantidades(prev => ({ ...prev, [`${secId}__${item}`]: v }));
    };
    const getEntradas = (secId, item) => multiEntradas[`${secId}__${item}`] ?? initEntradas();
    const updEntradas = (secId, item, fn) =>
        setMultiEntradas(prev => {
            const key  = `${secId}__${item}`;
            return { ...prev, [key]: fn(prev[key] ?? initEntradas()) };
        });
    const addEntrada  = (secId, item) =>
        updEntradas(secId, item, list => [...list, { modelo: "", cantidad: 1 }]);
    const setEntrada  = (secId, item, idx, field, val) =>
        updEntradas(secId, item, list =>
            list.map((e, i) => i === idx ? { ...e, [field]: field === "cantidad" ? Math.max(0, Number(val)) : val } : e)
        );
    const delEntrada  = (secId, item, idx) =>
        updEntradas(secId, item, list => list.filter((_, i) => i !== idx));

    const totalRegular = Object.values(cantidades).filter(v => v > 0).length;
    const totalMulti   = Object.values(multiEntradas).flat().filter(e => e.cantidad > 0).length;
    const totalItems   = totalRegular + totalMulti;

    const enviar = async () => {
        setEnviando(true);
        const items = [];
        SECCIONES_INSUMOS.forEach(sec => {
            sec.items.forEach(item => {
                if (ITEMS_CON_MODELO.has(item)) {
                    getEntradas(sec.id, item).forEach(e => {
                        if (e.cantidad > 0)
                            items.push({ seccion: sec.titulo, item, cantidad: e.cantidad, modelo: e.modelo });
                    });
                } else {
                    const qty = getQty(sec.id, item);
                    if (qty > 0) items.push({ seccion: sec.titulo, item, cantidad: qty });
                }
            });
        });
        try {
            await addDoc(collection(db, "pedidosInsumos"), {
                uid: user?.uid ?? null, nombre: user?.name ?? null,
                items, vehiculo: vehiculoRef || null, observaciones,
                fecha: serverTimestamp(), estado: "pendiente",
            });
            setEnviado(true);
        } catch (e) { console.error(e); }
        setEnviando(false);
    };

    if (enviado) {
        return (
            <div className="vh-subpanel" style={{ alignItems: "center", textAlign: "center" }}>
                <div style={{ fontSize: 48, marginTop: "var(--space-6)" }}>✅</div>
                <div style={{ fontWeight: 800, fontSize: "var(--text-xl)", marginTop: "var(--space-3)" }}>¡Pedido enviado!</div>
                <div style={{ color: "var(--color-muted)", marginTop: "var(--space-2)", fontSize: "var(--text-sm)" }}>
                    Tu supervisor recibirá el pedido de insumos.
                </div>
                <button className="vh-back" style={{ marginTop: "var(--space-6)" }} onClick={onBack}>← Volver al panel</button>
            </div>
        );
    }

    return (
        <div className="vh-subpanel">
            <button className="vh-back" onClick={onBack}>← Volver al panel</button>
            <div className="vh-subpanel-title">📦 Pedido de Insumos</div>
            {SECCIONES_INSUMOS.map(sec => (
                <div key={sec.id} className="pi-seccion">
                    <div className="pi-seccion-titulo">{sec.icon} {sec.titulo}</div>
                    {sec.id === "vehiculo" && (
                        <div className="pi-vehiculo-field">
                            <label className="pi-obs-label">¿Para qué vehículo?</label>
                            {vehiculos.length > 0 ? (
                                <select
                                    className="pi-vehiculo-input"
                                    value={vehiculoRef}
                                    onChange={e => setVehiculoRef(e.target.value)}
                                >
                                    <option value="">— Seleccioná un vehículo —</option>
                                    {vehiculos.map(v => (
                                        <option key={v} value={v}>{v}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    className="pi-vehiculo-input"
                                    type="text"
                                    value={vehiculoRef}
                                    onChange={e => setVehiculoRef(e.target.value)}
                                    placeholder="Ej: Ford Transit · PPP 123 · Unidad 4"
                                />
                            )}
                        </div>
                    )}
                    {sec.items.map(item => {
                        const conModelo = ITEMS_CON_MODELO.has(item);

                        if (conModelo) {
                            const entradas = getEntradas(sec.id, item);
                            const tieneAlgo = entradas.some(e => e.cantidad > 0);
                            return (
                                <div key={item} className={`pi-item pi-item--expand${tieneAlgo ? " pi-item--activo" : ""}`}>
                                    <div className="pi-item-row">
                                        <span className="pi-item-nombre">🖨️ {item}</span>
                                    </div>
                                    {entradas.map((entrada, idx) => (
                                        <div key={idx} className="pi-entrada-row">
                                            <input
                                                className="pi-modelo-input"
                                                type="text"
                                                value={entrada.modelo}
                                                onChange={e => setEntrada(sec.id, item, idx, "modelo", e.target.value)}
                                                placeholder="Modelo (ej: HP 105A, Epson T664...)"
                                            />
                                            <div className="pi-entrada-ctrl">
                                                <button className="pi-qty-btn" onClick={() => setEntrada(sec.id, item, idx, "cantidad", entrada.cantidad - 1)} disabled={entrada.cantidad <= 0}>−</button>
                                                <span className="pi-qty-val">{entrada.cantidad}</span>
                                                <button className="pi-qty-btn" onClick={() => setEntrada(sec.id, item, idx, "cantidad", entrada.cantidad + 1)}>+</button>
                                                {entradas.length > 1 && (
                                                    <button className="pi-del-btn" onClick={() => delEntrada(sec.id, item, idx)}>✕</button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    <button className="pi-add-btn" onClick={() => addEntrada(sec.id, item)}>
                                        + Agregar otro modelo
                                    </button>
                                </div>
                            );
                        }

                        const qty = getQty(sec.id, item);
                        return (
                            <div key={item} className={`pi-item${qty > 0 ? " pi-item--activo" : ""}`}>
                                <div className="pi-item-row">
                                    <span className="pi-item-nombre">{item}</span>
                                    <div className="pi-item-ctrl">
                                        <button className="pi-qty-btn" onClick={() => setQty(sec.id, item, qty - 1)} disabled={qty === 0}>−</button>
                                        <span className="pi-qty-val">{qty}</span>
                                        <button className="pi-qty-btn" onClick={() => setQty(sec.id, item, qty + 1)}>+</button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
            <div className="pi-obs">
                <label className="pi-obs-label">Observaciones adicionales</label>
                <textarea
                    className="pi-obs-input"
                    value={observaciones}
                    onChange={e => setObservaciones(e.target.value)}
                    rows={3}
                    placeholder="Indicá cualquier detalle o urgencia del pedido..."
                />
            </div>
            <button
                className={`pi-enviar-btn${totalItems === 0 ? " pi-enviar-btn--dis" : ""}`}
                onClick={enviar}
                disabled={totalItems === 0 || enviando}
            >
                {enviando ? "Enviando..." : `📤 Enviar pedido${totalItems > 0 ? ` · ${totalItems} ítem${totalItems !== 1 ? "s" : ""}` : ""}`}
            </button>
        </div>
    );
}

// ── Modal de check-in de turno ─────────────────────────────────────────────────
function ModalCheckin({ user, puestos, empresaId, onConfirmar }) {
    const [turno,   setTurno]   = useState("");
    const [puesto,  setPuesto]  = useState("");
    const [guardando, setGuardando] = useState(false);

    const valido = turno && puesto;

    const confirmar = async () => {
        if (!valido) return;
        setGuardando(true);
        try {
            await addDoc(collection(db, "ingresosTurno"), {
                uid:       user?.uid  || null,
                nombre:    user?.name || null,
                turno,
                puesto,
                empresaId: empresaId  || null,
                fecha:     serverTimestamp(),
            });
        } catch (e) {
            console.warn("No se pudo registrar ingreso:", e);
        }
        onConfirmar({ turno, puesto });
    };

    return (
        <div className="vh-checkin-overlay">
            <div className="vh-checkin-modal">
                <div className="vh-checkin-icon">👷</div>
                <h2 className="vh-checkin-title">Bienvenido, {user?.name?.split(" ")[0]}</h2>
                <p className="vh-checkin-sub">Completá los datos de tu turno para continuar</p>

                <div className="vh-checkin-fields">
                    <div className="vh-checkin-field">
                        <label className="vh-checkin-label">Turno de trabajo</label>
                        <select
                            className="vh-checkin-select"
                            value={turno}
                            onChange={e => setTurno(e.target.value)}
                        >
                            <option value="">— Seleccioná tu turno —</option>
                            {TURNOS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    <div className="vh-checkin-field">
                        <label className="vh-checkin-label">Puesto actual</label>
                        <select
                            className="vh-checkin-select"
                            value={puesto}
                            onChange={e => setPuesto(e.target.value)}
                        >
                            <option value="">— Seleccioná tu puesto —</option>
                            {puestos.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                </div>

                <button
                    className={`vh-checkin-btn ${!valido ? "vh-checkin-btn--dis" : ""}`}
                    disabled={!valido || guardando}
                    onClick={confirmar}
                >
                    {guardando ? "Registrando..." : "Ingresar al sistema →"}
                </button>
            </div>
        </div>
    );
}

// ── Pantalla principal ─────────────────────────────────────────────────────────
export default function VigHome({ onLogout, user: propUser }) {
    const { user: authUser, logout } = useAuth();
    const { empresaLogos, data, empresaModulos, empresaNombre, empresaId, userZona } = useAppData();
    const { objetivos } = useClientesData(empresaId);
    const [seccion,  setSeccion]  = useState(null);
    const [checkin,  setCheckin]  = useState(null); // null = pendiente, objeto = completado

    // authUser = Firebase Auth context (puede tardar en llegar)
    // propUser = user pasado desde App.jsx (disponible de inmediato tras login)
    const user = authUser || propUser;

    const handleLogout = async () => { await logout(); onLogout?.(); };

    const [legajos, setLegajos] = useState([]);
    useEffect(() => {
        if (!empresaId) return;
        getDocs(query(collection(db, "legajos"), where("empresaId", "==", empresaId)))
            .then(snap => setLegajos(snap.docs.map(d => d.data())))
            .catch(err => console.error("Error cargando legajos:", err));
    }, [empresaId]);
    const actividadesSemana = useActividadesSemana(empresaId, legajos);

    const [vehiculosFS, setVehiculosFS] = useState([]);
    const [cargandoVehiculos, setCargandoVehiculos] = useState(false);
    useEffect(() => {
        if (!empresaId || seccion !== "control_vehicular") return;
        setCargandoVehiculos(true);
        const qVeh = userZona
            ? query(collection(db, "vehiculos"), where("empresaId", "==", empresaId), where("zona", "==", userZona))
            : query(collection(db, "vehiculos"), where("empresaId", "==", empresaId));
        getDocs(qVeh)
            .then(snap => {
                const lista = snap.docs
                    .map(d => d.data())
                    .filter(v => v.patente)
                    .map(v => v.marca && v.modelo ? `${v.patente} - ${v.marca} ${v.modelo}` : v.patente);
                setVehiculosFS(lista);
            })
            .catch(() => {})
            .finally(() => setCargandoVehiculos(false));
    }, [empresaId, seccion, userZona]);

    const handleModulo = (id) => { setSeccion(id); };

    const modActivo = MODULOS[seccion];
    const subline   = seccion
        ? `${modActivo?.icon ?? ""} ${modActivo?.titulo ?? seccion}`.trim()
        : "👷 Vigilador";
    const headerJSX = <AppHeader onLogout={handleLogout} subline={subline} />;

    // ── Check-in obligatorio al iniciar sesión ──────────────────
    const puestosDisponibles = [...new Set(
        objetivos
            .filter(o => o.cCosto || o.numProyecto || o.codigo)
            .map(o => fmtObjetivo(o))
            .filter(Boolean)
    )]
        .sort();
    if (!checkin) {
        return (
            <div className="vh-root">
                {headerJSX}
                <ModalCheckin
                    user={user}
                    puestos={puestosDisponibles}
                    empresaId={empresaId}
                    onConfirmar={datos => setCheckin(datos)}
                />
            </div>
        );
    }

    if (seccion === "informes")          return <div className="vh-root">{headerJSX}<PanelInformes      onBack={() => setSeccion(null)} /></div>;
    if (seccion === "planillas")         return <div className="vh-root">{headerJSX}<PanelPlanillas     onBack={() => setSeccion(null)} /></div>;
    if (seccion === "capacitacion")      return <div className="vh-root">{headerJSX}<PanelCapacitacion  onBack={() => setSeccion(null)} /></div>;
    if (seccion === "inventarios")       return <div className="vh-root">{headerJSX}<PanelInventarios   onBack={() => setSeccion(null)} /></div>;
    if (seccion === "pedido_insumos")    return <div className="vh-root">{headerJSX}<PedidoInsumosScreen onBack={() => setSeccion(null)} /></div>;
    if (seccion === "muro_comunicacion") return <div className="vh-root">{headerJSX}<VerComunicacionesScreen onBack={() => setSeccion(null)} /></div>;
    if (seccion === "turnos_ver")        return <div className="vh-root">{headerJSX}<MisTurnosVigScreen  onBack={() => setSeccion(null)} /></div>;
    if (seccion === "realizar_ronda")    return <div className="vh-root">{headerJSX}<RondasVigScreen     onBack={() => setSeccion(null)} onNovedad={() => setSeccion("informes")} /></div>;

    const PROXIMOS = {
        libro_actas:         { icon: "📖", titulo: "Libro de Actas Digital" },
        muro_procedimientos: { icon: "📌", titulo: "Muro de Procedimientos" },
    };
    if (PROXIMOS[seccion]) {
        const p = PROXIMOS[seccion];
        return (
            <div className="vh-root">
                {headerJSX}
                <div className="vh-subpanel">
                    <button className="vh-back" onClick={() => setSeccion(null)}>← Volver al panel</button>
                    <div className="vh-subpanel-title">{p.icon} {p.titulo}</div>
                    <div className="vh-coming-soon">Próximamente</div>
                </div>
            </div>
        );
    }
    if (seccion === "control_vehicular") {
        const vehiculosConfig = data?.vehiculos ?? [];
        const vehiculos = [...new Set([...vehiculosConfig, ...vehiculosFS])];
        const sinVehiculos = vehiculos.length === 0;
        return (
            <div className="vh-root">
                {headerJSX}
                {cargandoVehiculos && sinVehiculos ? (
                    <div className="vh-subpanel">
                        <button className="vh-back" onClick={() => setSeccion(null)}>← Volver al panel</button>
                        <div className="vh-subpanel-title">🚗 Control de Vehículo</div>
                        <div className="vh-coming-soon">Cargando vehículos...</div>
                    </div>
                ) : sinVehiculos ? (
                    <div className="vh-subpanel">
                        <button className="vh-back" onClick={() => setSeccion(null)}>← Volver al panel</button>
                        <div className="vh-subpanel-title">🚗 Control de Vehículo</div>
                        <div className="vh-coming-soon">No hay vehículos configurados para este objetivo</div>
                    </div>
                ) : (
                    <SelectorVehiculo
                        vehiculos={vehiculos}
                        supervisor={user?.name ?? ""}
                        onBack={() => setSeccion(null)}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="vh-root">
            {headerJSX}
            <CalendarioSemanal actividades={actividadesSemana} legajos={legajos} />
            <div style={{ padding: "var(--space-4) var(--space-5) var(--space-8)" }}>
                {GRUPOS_MENU.map(grupo => {
                    const items = grupo.ids.map(id => ({ id, ...MODULOS[id] })).filter(m => m.titulo);
                    return (
                        <div key={grupo.label} className="sh-grupo">
                            <div className="sh-grupo-label">{grupo.label}</div>
                            {items.map(m => {
                                const habilitado = tieneAcceso(empresaModulos, user, m.permiso);
                                return (
                                    <button
                                        key={m.id}
                                        className={`sh-modulo sh-modulo--${m.color} ${!habilitado ? "sh-modulo--disabled" : ""}`}
                                        disabled={!habilitado}
                                        onClick={() => habilitado && handleModulo(m.id)}
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
