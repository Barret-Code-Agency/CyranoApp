// src/screens/VigHome.jsx
// Pantalla de inicio del Vigilador — muestra sus módulos disponibles.
// Los módulos se irán implementando en etapas posteriores.

import { useState } from "react";
import { useAuth }    from "../context/AuthContext";
import { useAppData } from "../context/AppDataContext";
import { PERMISOS_BASE } from "../config/roles";
import RondasVigScreen from "./RondasVigScreen";
import InformeSencilloScreen from "../forms/InformeSencilloScreen";
import InformeNovedadScreen from "../forms/InformeNovedadScreen";
import VerInformesScreen from "../forms/VerInformesScreen";
import ControlVehicularScreen from "./ControlVehicularScreen";
import "../styles/VigHome.css";

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
            <div className="vh-opciones" style={{ flexDirection: "column", gap: "12px", padding: "16px 0" }}>
                <label style={{ fontWeight: 600, marginBottom: 4 }}>Seleccioná el vehículo a controlar:</label>
                <select
                    className="vig-select"
                    value={vehiculoSeleccionado || ""}
                    onChange={e => setVehiculoSeleccionado(e.target.value)}
                    style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc", fontSize: 15 }}
                >
                    <option value="">-- Seleccionar vehículo --</option>
                    {vehiculos.map(v => (
                        <option key={v} value={v}>{v}</option>
                    ))}
                </select>
                <button
                    className="vh-opcion vh-opcion--blue"
                    disabled={!vehiculoSeleccionado}
                    onClick={() => setIniciado(true)}
                    style={{ marginTop: 8, opacity: vehiculoSeleccionado ? 1 : 0.5 }}
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

const MODULOS = [
    { id: "libro_actas",      icon: "📖", titulo: "Libro de Actas Digital", descripcion: "Registrá novedades y actas de tu turno",        permiso: "libro_actas"      },
    { id: "realizar_ronda",   icon: "🗺️", titulo: "Realizar Ronda",         descripcion: "Iniciá y registrá tu ronda de vigilancia",      permiso: "realizar_ronda"   },
    { id: "control_vehicular",icon: "🚗", titulo: "Control de Vehículo",    descripcion: "Realizá el checklist de tu vehículo asignado",  permiso: "control_vehicular"},
    { id: "planillas",        icon: "📊", titulo: "Planillas",               descripcion: "Consultá tus planillas operativas",             permiso: "planillas"        },
    { id: "informes",         icon: "📄", titulo: "Informes",                descripcion: "Creá o consultá informes de tu puesto",         permiso: "informes"         },
    { id: "turnos_ver",       icon: "🕐", titulo: "Mis Turnos",              descripcion: "Consultá tu calendario de turnos",              permiso: "turnos_ver"       },
    { id: "pedido_insumos",   icon: "📦", titulo: "Pedido de Insumos",       descripcion: "Solicitá materiales o insumos para tu puesto",  permiso: "pedido_insumos"   },
];

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
];

function PanelInformes({ onBack, onSelect }) {
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

    if (vista) {
        const op = OPCIONES_INFORMES.find(o => o.id === vista);
        return (
            <div className="vh-subpanel">
                <button className="vh-back" onClick={() => setVista(null)}>← Volver</button>
                <div className="vh-subpanel-title">{op.icon} {op.titulo}</div>
                <div className="vh-coming-soon">Próximamente</div>
            </div>
        );
    }

    return (
        <div className="vh-subpanel">
            <button className="vh-back" onClick={onBack}>← Volver al panel</button>
            <div className="vh-subpanel-title">📄 Informes</div>
            <div className="vh-opciones">
                {OPCIONES_INFORMES.map(op => (
                    <button key={op.id} className={`vh-opcion vh-opcion--${op.color}`} onClick={() => setVista(op.id)}>
                        <span className="vh-opcion-icon">{op.icon}</span>
                        <div className="vh-opcion-info">
                            <strong>{op.titulo}</strong>
                            <small>{op.desc}</small>
                        </div>
                        <span className="vh-modulo-arrow">›</span>
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
                <button className="vh-back" onClick={() => setVista(null)}>← Volver</button>
                <div className="vh-subpanel-title">{op.icon} {op.titulo}</div>
                <div className="vh-coming-soon">Próximamente</div>
            </div>
        );
    }

    return (
        <div className="vh-subpanel">
            <button className="vh-back" onClick={onBack}>← Volver al panel</button>
            <div className="vh-subpanel-title">📊 Planillas</div>
            <div className="vh-opciones">
                {OPCIONES_PLANILLAS.map(op => (
                    <button key={op.id} className={`vh-opcion vh-opcion--${op.color}`} onClick={() => setVista(op.id)}>
                        <span className="vh-opcion-icon">{op.icon}</span>
                        <div className="vh-opcion-info">
                            <strong>{op.titulo}</strong>
                            <small>{op.desc}</small>
                        </div>
                        <span className="vh-modulo-arrow">›</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── Pantalla principal ─────────────────────────────────────────────────────────
export default function VigHome({ onLogout, user: propUser }) {
    const { user: authUser, logout } = useAuth();
    const { empresaLogos, data } = useAppData();
    const [seccion, setSeccion] = useState(null);

    // authUser = Firebase Auth context (puede tardar en llegar)
    // propUser = user pasado desde App.jsx (disponible de inmediato tras login)
    const user = authUser || propUser;

    const handleLogout = async () => { await logout(); onLogout?.(); };

    const handleModulo = (id) => {
        if (id === "informes")         setSeccion("informes");
        if (id === "planillas")        setSeccion("planillas");
        if (id === "realizar_ronda")   setSeccion("realizar_ronda");
        if (id === "control_vehicular") setSeccion("control_vehicular");
    };

    const headerJSX = (
        <header className="vh-header">
            <div className="vh-header-left">
                {empresaLogos?.panel && (
                    <img src={empresaLogos.panel} alt="Logo empresa" className="vh-empresa-logo" />
                )}
                <div className="vh-header-info">
                    <div className="vh-greeting">Bienvenido</div>
                    <div className="vh-username">{user?.name}</div>
                </div>
            </div>
            <button className="vh-logout" onClick={handleLogout}>🚪</button>
        </header>
    );

    if (seccion === "informes")         return <div className="vh-root">{headerJSX}<PanelInformes  onBack={() => setSeccion(null)} /></div>;
    if (seccion === "planillas")        return <div className="vh-root">{headerJSX}<PanelPlanillas onBack={() => setSeccion(null)} /></div>;
    if (seccion === "realizar_ronda")   return <RondasVigScreen onBack={() => setSeccion(null)} />;
    if (seccion === "control_vehicular") return (
        <div className="vh-root">
            {headerJSX}
            <SelectorVehiculo
                vehiculos={data?.vehiculos ?? []}
                supervisor={user?.name ?? ""}
                onBack={() => setSeccion(null)}
            />
        </div>
    );

    return (
        <div className="vh-root">
            {headerJSX}
            <div className="vh-role-badge"><span>👷</span> Vigilador</div>

            <div className="vh-grid">
                {MODULOS.map(m => {
                    // VigHome solo es accesible a vigiladores — usamos PERMISOS_BASE directamente
                    // para no depender del timing de resolución del objeto user.permisos
                    const habilitado = PERMISOS_BASE.vigilador[m.permiso] === true;
                    return (
                        <button
                            key={m.id}
                            className={`vh-modulo ${!habilitado ? "vh-modulo--disabled" : ""}`}
                            disabled={!habilitado}
                            onClick={() => habilitado && handleModulo(m.id)}
                        >
                            <span className="vh-modulo-icon">{m.icon}</span>
                            <div className="vh-modulo-info">
                                <strong>{m.titulo}</strong>
                                <small>{habilitado ? m.descripcion : "Sin acceso"}</small>
                            </div>
                            {habilitado && <span className="vh-modulo-arrow">›</span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
