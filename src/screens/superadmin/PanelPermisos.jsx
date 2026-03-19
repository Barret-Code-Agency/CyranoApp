// src/screens/superadmin/PanelPermisos.jsx
// Permite habilitar / deshabilitar módulos por persona.
// Jerarquía: Empresa → Rol → Personas
import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

const MODULOS_VIGILADOR = [
    { key: "libro_actas",         label: "Libro de Actas"         },
    { key: "realizar_ronda",      label: "Realizar Ronda"         },
    { key: "control_vehicular",   label: "Control de Vehículo"    },
    { key: "planillas",           label: "Planillas"              },
    { key: "informes",            label: "Informes"               },
    { key: "turnos_ver",          label: "Mis Turnos"             },
    { key: "pedido_insumos",      label: "Pedido de Insumos"      },
    { key: "inventarios",         label: "Inventarios"            },
    { key: "muro_procedimientos", label: "Muro de Procedimientos" },
    { key: "muro_comunicacion",   label: "Muro de Comunicación"   },
    { key: "capacitacion",        label: "Capacitación y Entrenamiento" },
];

// Mapeo de valores de rol → { label, color }
const ROL_META = {
    super_admin:    { label: "Super Administrador",     color: "red"    },
    admin_empresa:  { label: "Gerencia de Operaciones", color: "blue"   },
    admin_contrato: { label: "Gerencia de Operaciones", color: "blue"   },
    supervisor:     { label: "Supervisor / Encargado",  color: "green"  },
    administrativo: { label: "Administrativo",          color: "orange" },
    vigilador:      { label: "Vigilador",               color: "gray"   },
    user:           { label: "Vigilador",               color: "gray"   },
    conductor:      { label: "Conductor",               color: "teal"   },
    operador:       { label: "Operador",                color: "teal"   },
};

function rolMeta(rol) {
    return ROL_META[rol] ?? { label: rol ? rol.charAt(0).toUpperCase() + rol.slice(1) : "Sin rol", color: "gray" };
}

// Normaliza empresaId: quita espacios y pasa a minúsculas para agrupar
function empKey(u) {
    return (u.empresaId ?? "").trim().toLowerCase() || "__sin_empresa__";
}

// Nombre para mostrar: usa el primer registro como referencia
function empDisplay(empId) {
    if (empId === "__sin_empresa__") return "(Sin empresa)";
    return empId.charAt(0).toUpperCase() + empId.slice(1);
}

// Rol principal del usuario
function rolPrincipal(u) {
    if (Array.isArray(u.roles) && u.roles.length) return u.roles[0];
    return u.rol ?? "vigilador";
}

// Permisos actuales del usuario (default todo habilitado)
function getModulosUsuario(u) {
    const pm = u.permisosModulos ?? {};
    return Object.fromEntries(MODULOS_VIGILADOR.map(m => [m.key, pm[m.key] !== false]));
}

export default function PanelPermisos() {
    const [usuarios,     setUsuarios]     = useState([]);
    const [loading,      setLoading]      = useState(true);
    const [empAbiertos,  setEmpAbiertos]  = useState({});   // empKey → bool
    const [rolAbiertos,  setRolAbiertos]  = useState({});   // "empKey|rol" → bool
    const [cambios,      setCambios]      = useState({});   // uid → { key: bool }
    const [guardando,    setGuardando]    = useState({});
    const [msgs,         setMsgs]         = useState({});

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, "usuarios"));
            const lista = snap.docs
                .map(d => ({ uid: d.id, ...d.data() }))
                .filter(u => rolPrincipal(u) !== "super_admin")
                .sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? ""));
            setUsuarios(lista);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    // ── Agrupación: empresa → rol → personas ─────────────────────────────────
    // grupos = { empKey: { display, roles: { rolKey: [user, ...] } } }
    const grupos = {};
    for (const u of usuarios) {
        const ek  = empKey(u);
        const rol = rolPrincipal(u);
        if (!grupos[ek]) grupos[ek] = { display: empDisplay(ek), roles: {} };
        if (!grupos[ek].roles[rol]) grupos[ek].roles[rol] = [];
        grupos[ek].roles[rol].push(u);
    }

    const toggleEmp = (ek) =>
        setEmpAbiertos(prev => ({ ...prev, [ek]: !prev[ek] }));

    const toggleRol = (ek, rol) => {
        const key = `${ek}|${rol}`;
        setRolAbiertos(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const estadoActual = (u) => ({ ...getModulosUsuario(u), ...(cambios[u.uid] ?? {}) });

    const toggleModulo = (uid, key, u) => {
        setCambios(prev => {
            const actual = estadoActual(u);
            return { ...prev, [uid]: { ...actual, [key]: !actual[key] } };
        });
    };

    const guardar = async (u) => {
        const permisos = estadoActual(u);
        setGuardando(prev => ({ ...prev, [u.uid]: true }));
        setMsgs(prev => ({ ...prev, [u.uid]: null }));
        try {
            await updateDoc(doc(db, "usuarios", u.uid), { permisosModulos: permisos });
            setUsuarios(prev => prev.map(x => x.uid === u.uid ? { ...x, permisosModulos: permisos } : x));
            setCambios(prev => { const n = { ...prev }; delete n[u.uid]; return n; });
            setMsgs(prev => ({ ...prev, [u.uid]: { ok: true, texto: "✅ Guardado" } }));
        } catch (e) {
            setMsgs(prev => ({ ...prev, [u.uid]: { ok: false, texto: "❌ " + e.message } }));
        } finally {
            setGuardando(prev => ({ ...prev, [u.uid]: false }));
        }
    };

    if (loading) return (
        <div className="sa-usuarios-loading">
            <div className="sa-spinner" /> Cargando personal…
        </div>
    );

    if (usuarios.length === 0) return (
        <div className="sa-empty-state">
            <div className="sa-empty-icon">👤</div>
            <div className="sa-empty-title">No hay usuarios registrados</div>
            <div className="sa-empty-desc">Los usuarios se crean desde el panel de Usuarios.</div>
        </div>
    );

    return (
        <div className="sa-permisos">
            <div className="sa-usuarios-header">
                <div className="sa-section-title">Permisos por persona</div>
                <span className="sa-usuarios-count">{usuarios.length} personas</span>
            </div>

            <p className="sa-emp-instruccion">
                Habilitá o deshabilitá módulos para cada persona de forma individual.
                Los módulos desactivados no se mostrarán a ese usuario.
            </p>

            <div className="sa-perm-grupos">
                {Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b)).map(([ek, grupo]) => {
                    const totalPersonas = Object.values(grupo.roles).reduce((s, arr) => s + arr.length, 0);
                    return (
                        <div key={ek} className="sa-perm-empresa">

                            {/* ── Header empresa ── */}
                            <button className="sa-perm-empresa-header" onClick={() => toggleEmp(ek)}>
                                <span className="sa-perm-empresa-icon">🏢</span>
                                <span className="sa-perm-empresa-nombre">{grupo.display}</span>
                                <span className="sa-perm-empresa-count">
                                    {totalPersonas} persona{totalPersonas !== 1 ? "s" : ""}
                                </span>
                                <span className="sa-perm-empresa-arrow">{empAbiertos[ek] ? "▲" : "▼"}</span>
                            </button>

                            {/* ── Sub-grupos por rol ── */}
                            {empAbiertos[ek] && (
                                <div className="sa-perm-roles-list">
                                    {Object.entries(grupo.roles).sort(([a], [b]) => a.localeCompare(b)).map(([rol, personal]) => {
                                        const rolKey = `${ek}|${rol}`;
                                        const meta   = rolMeta(rol);
                                        return (
                                            <div key={rol} className="sa-perm-rol-grupo">

                                                <button className={`sa-perm-rol-header sa-perm-rol-header--${meta.color}`} onClick={() => toggleRol(ek, rol)}>
                                                    <span className={`sa-perm-rol-dot sa-perm-rol-dot--${meta.color}`} />
                                                    <span className="sa-perm-rol-nombre">{meta.label}</span>
                                                    <span className="sa-perm-rol-count">
                                                        {personal.length} persona{personal.length !== 1 ? "s" : ""}
                                                    </span>
                                                    <span className="sa-perm-empresa-arrow">{rolAbiertos[rolKey] ? "▲" : "▼"}</span>
                                                </button>

                                                {rolAbiertos[rolKey] && (
                                                    <div className="sa-perm-personal-list">
                                                        {personal.map(u => {
                                                            const actual       = estadoActual(u);
                                                            const tieneCambios = !!cambios[u.uid];
                                                            const habilitados  = MODULOS_VIGILADOR.filter(m => actual[m.key]).length;

                                                            return (
                                                                <div key={u.uid} className="sa-perm-user-row">
                                                                    <div className="sa-perm-user-header">
                                                                        <div className="sa-ur-avatar sa-ur-avatar--sm">
                                                                            {(u.nombre ?? u.email ?? "?").charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <div className="sa-perm-user-info">
                                                                            <div className="sa-ur-name">{u.nombre ?? "—"}</div>
                                                                            <div className="sa-ur-email">{u.email}</div>
                                                                        </div>
                                                                        <span className="sa-perm-user-count">
                                                                            {habilitados}/{MODULOS_VIGILADOR.length} módulos
                                                                        </span>
                                                                    </div>

                                                                    <div className="sa-perm-modulos-grid">
                                                                        {MODULOS_VIGILADOR.map(m => (
                                                                            <label
                                                                                key={m.key}
                                                                                className={`sa-perm-modulo-check ${actual[m.key] ? "sa-perm-modulo-check--on" : ""}`}
                                                                            >
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={actual[m.key]}
                                                                                    onChange={() => toggleModulo(u.uid, m.key, u)}
                                                                                />
                                                                                <span>{m.label}</span>
                                                                            </label>
                                                                        ))}
                                                                    </div>

                                                                    <div className="sa-perm-user-actions">
                                                                        {msgs[u.uid] && (
                                                                            <span className={`sa-perm-inline-msg ${msgs[u.uid].ok ? "sa-perm-inline-msg--ok" : "sa-perm-inline-msg--err"}`}>
                                                                                {msgs[u.uid].texto}
                                                                            </span>
                                                                        )}
                                                                        <button
                                                                            className="sa-ur-btn-save"
                                                                            style={{ minWidth: 120 }}
                                                                            disabled={!tieneCambios || guardando[u.uid]}
                                                                            onClick={() => guardar(u)}
                                                                        >
                                                                            {guardando[u.uid] ? "Guardando…" : "💾 Guardar"}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
