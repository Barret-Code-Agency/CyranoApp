// src/screens/AdministrativoHome.jsx
import { useState } from "react";
import { useAuth }                from "../context/AuthContext";
import { useAppData }             from "../context/AppDataContext";
import GestionDatosAdminScreen   from "./GestionDatosAdminScreen";
import DashboardPersonalScreen   from "./DashboardPersonalScreen";
import "../styles/VigHome.css";
import "../styles/GestionDatosAdminScreen.css";

// ── Calendario semanal (idéntico al de VigHome) ────────────────────────────
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
                                {acts.length === 0
                                    ? <span className="vh-cal-dia-empty">—</span>
                                    : acts.map((a, i) => (
                                        <span key={i} className={`vh-cal-dia-chip vh-cal-dia-chip--${a.tipo ?? "default"}`}>
                                            {a.label}
                                        </span>
                                    ))
                                }
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
                {selActs.length === 0 ? (
                    <div className="vh-cal-empty">Sin actividades programadas</div>
                ) : (
                    <div className="vh-cal-acts">
                        {selActs.map((a, i) => (
                            <div key={i} className={`vh-cal-act vh-cal-act--${a.tipo ?? "default"}`}>
                                {a.hora && <span className="vh-cal-act-hora">{a.hora}</span>}
                                <span className="vh-cal-act-label">{a.label}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Módulos del Administrativo ─────────────────────────────────────────────
const MODULOS = [
    { id: "muro_comunicacion", icon: "📢", titulo: "Muro de Comunicación y Novedades", desc: "Novedades y comunicados de tu empresa"                     },
    { id: "planillas",         icon: "📊", titulo: "Planillas",                         desc: "Consultá las planillas operativas"                         },
    { id: "informes",          icon: "📄", titulo: "Informes",                          desc: "Creá o consultá informes"                                  },
    { id: "turnos",            icon: "🕐", titulo: "Turnos de trabajo",                 desc: "Gestioná los turnos del personal"                          },
    { id: "actualizacion_datos", icon: "🗂️", titulo: "Actualización de Datos",         desc: "Editá legajos, clientes, objetivos, vehículos y más"       },
    { id: "dashboard_personal",  icon: "👥", titulo: "Dashboard de personal",          desc: "Estado y novedades del personal"                            },
    { id: "facturacion",       icon: "💰", titulo: "Facturación",                       desc: "Gestión de facturación"                                    },
    { id: "control_horas",     icon: "⏱️", titulo: "Control de horas",                  desc: "Control de horas trabajadas"                               },
    { id: "ausentismo",        icon: "📉", titulo: "Ausentismo",                        desc: "Registro y seguimiento de ausentismo"                      },
];

export default function AdministrativoHome({ user: propUser, onLogout }) {
    const { user: authUser, logout } = useAuth();
    const { empresaLogos, data }     = useAppData();
    const [seccion, setSeccion]      = useState(null);

    const user = authUser || propUser;
    const handleLogout = async () => { await logout(); onLogout?.(); };

    const header = (
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

    if (seccion === "actualizacion_datos") {
        return (
            <div className="gd-page">
                {header}
                <GestionDatosAdminScreen onBack={() => setSeccion(null)} />
            </div>
        );
    }

    if (seccion === "dashboard_personal") {
        return (
            <div className="vh-root">
                {header}
                <DashboardPersonalScreen onBack={() => setSeccion(null)} />
            </div>
        );
    }

    // Secciones con pantalla "próximamente"
    if (seccion) {
        const mod = MODULOS.find(m => m.id === seccion);
        return (
            <div className="vh-root">
                {header}
                <div className="vh-subpanel">
                    <button className="vh-back" onClick={() => setSeccion(null)}>← Volver al panel</button>
                    <div className="vh-subpanel-title">{mod.icon} {mod.titulo}</div>
                    <div className="vh-coming-soon">Próximamente</div>
                </div>
            </div>
        );
    }

    return (
        <div className="vh-root">
            {header}

            <div className="vh-role-badge"><span>🗂️</span> Administrativo</div>

            <CalendarioSemanal actividades={data?.actividadesSemana ?? {}} />

            <div className="vh-grid">
                {(user?.permisosModulos != null
                    ? MODULOS.filter(m => user.permisosModulos.includes(m.id))
                    : MODULOS
                ).map(m => (
                    <button
                        key={m.id}
                        className="vh-modulo"
                        onClick={() => setSeccion(m.id)}
                    >
                        <span className="vh-modulo-icon">{m.icon}</span>
                        <div className="vh-modulo-info">
                            <strong>{m.titulo}</strong>
                            <small>{m.desc}</small>
                        </div>
                        <span className="vh-modulo-arrow">›</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
