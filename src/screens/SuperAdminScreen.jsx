// src/screens/SuperAdminScreen.jsx
import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, doc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS, ROLE_ICONS } from "../config/roles";
import "../styles/SuperAdminScreen.css";

const NAV = [
    { id: "dashboard", icon: "📊", label: "Dashboard"  },
    { id: "empresas",  icon: "🏛️", label: "Empresas"   },
    { id: "usuarios",  icon: "👥", label: "Usuarios"   },
    { id: "contratos", icon: "📋", label: "Contratos"  },
    { id: "permisos",  icon: "🔐", label: "Permisos"   },
];

const SECCIONES = [
    { id: "empresas",  icon: "🏛️", titulo: "Empresas",  descripcion: "Crear y gestionar empresas de seguridad" },
    { id: "usuarios",  icon: "👥", titulo: "Usuarios",   descripcion: "Gestión global de usuarios y roles"      },
    { id: "contratos", icon: "📋", titulo: "Contratos",  descripcion: "Ver contratos y clientes por empresa"    },
    { id: "permisos",  icon: "🔐", titulo: "Permisos",   descripcion: "Configurar roles y permisos del sistema" },
];

const ROLES_OPCIONES = [
    { value: "super_admin",    label: "Super Administrador"      },
    { value: "admin_empresa",  label: "Administrador de Empresa" },
    { value: "admin_contrato", label: "Administrador de Contrato"},
    { value: "supervisor",     label: "Supervisor"               },
    { value: "vigilador",      label: "Vigilador"                },
];

const ROL_COLOR = {
    super_admin:    "red",
    admin_empresa:  "gold",
    admin_contrato: "blue",
    supervisor:     "green",
    vigilador:      "gray",
};

// ── Definición de módulos agrupados por rol ────────────────────────────────────
const MODULOS_DEF = [
    {
        grupo: "Admin de Empresa",
        icon:  "🏛️",
        color: "gold",
        modulos: [
            { key: "usuarios",   label: "Gestión de usuarios",   desc: "Crear y administrar usuarios"        },
            { key: "informes",   label: "Informes globales",      desc: "Reportes de toda la empresa"         },
            { key: "clientes",   label: "Clientes",               desc: "Gestión de clientes y cuentas"       },
            { key: "dashboards", label: "Dashboards",             desc: "Métricas y KPIs de la empresa"       },
        ],
    },
    {
        grupo: "Admin de Contrato",
        icon:  "🏢",
        color: "blue",
        modulos: [
            { key: "plan_seguridad",      label: "Plan de seguridad",      desc: "Cargar y editar planes"           },
            { key: "plan_capacitacion",   label: "Plan de capacitación",   desc: "Gestión de capacitaciones"        },
            { key: "analisis_riesgos",    label: "Análisis de riesgos",    desc: "Relevamiento de riesgos"          },
            { key: "control_rondas",      label: "Control de rondas",      desc: "Ver cumplimiento de supervisores" },
            { key: "turnos_cargar",       label: "Cargar turnos",          desc: "Armar planillas de turno"         },
            { key: "turnos_ver",          label: "Ver turnos",             desc: "Consultar turnos asignados"       },
            { key: "gestion_personal",    label: "Gestión de personal",    desc: "ABM del personal del contrato"    },
        ],
    },
    {
        grupo: "Supervisor",
        icon:  "🔍",
        color: "green",
        modulos: [
            { key: "supervision",    label: "Supervisión",       desc: "Realizar supervisiones de campo"  },
            { key: "rondas_ctrl",    label: "Rondas de control", desc: "Registrar y ver rondas propias"   },
            { key: "planillas",      label: "Planillas",         desc: "Completar planillas operativas"   },
            { key: "informes_sup",   label: "Informes",          desc: "Generar informes de supervisión"  },
            { key: "turnos_ver",     label: "Ver turnos",        desc: "Consultar turnos asignados"       },
        ],
    },
    {
        grupo: "Vigilador",
        icon:  "👷",
        color: "gray",
        modulos: [
            { key: "libro_actas",    label: "Libro de actas",    desc: "Registro digital de novedades"    },
            { key: "realizar_ronda", label: "Realizar ronda",    desc: "Ejecutar rondas de vigilancia"    },
            { key: "planillas_vig",  label: "Planillas",         desc: "Completar planillas de servicio"  },
            { key: "informes_vig",   label: "Informes",          desc: "Ver informes propios"             },
            { key: "mis_turnos",     label: "Mis turnos",        desc: "Ver turnos asignados"             },
        ],
    },
];

// Módulos activos por defecto al crear una empresa nueva
const MODULOS_DEFAULT = Object.fromEntries(
    MODULOS_DEF.flatMap(g => g.modulos.map(m => [m.key, true]))
);

// ── Modal nueva empresa ────────────────────────────────────────────────────────
function ModalNuevaEmpresa({ onCrear, onCerrar }) {
    const [form, setForm]       = useState({ id: "", nombre: "" });
    const [error, setError]     = useState("");
    const [loading, setLoading] = useState(false);

    const cambiar = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const crear = async () => {
        const id     = form.id.trim().toLowerCase().replace(/\s+/g, "_");
        const nombre = form.nombre.trim();
        if (!id)     return setError("El ID es requerido.");
        if (!nombre) return setError("El nombre es requerido.");
        setError(""); setLoading(true);
        try {
            const ref = doc(db, "empresas", id);
            await setDoc(ref, {
                nombre,
                activo:   true,
                modulos:  MODULOS_DEFAULT,
                creadoEn: serverTimestamp(),
            });
            onCrear({ id, nombre, activo: true, modulos: MODULOS_DEFAULT });
        } catch (e) {
            setError("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="sa-modal-overlay" onClick={onCerrar}>
            <div className="sa-modal-box" onClick={e => e.stopPropagation()}>
                <div className="sa-modal-title">Nueva empresa</div>

                <div className="sa-ur-field">
                    <label className="sa-ur-label">ID de la empresa</label>
                    <input
                        className="sa-ur-input"
                        name="id"
                        value={form.id}
                        onChange={cambiar}
                        placeholder="ej: brinks"
                        autoFocus
                    />
                    <span className="sa-ur-hint">Sin espacios, en minúsculas. Ej: brinks, prosegur</span>
                </div>

                <div className="sa-ur-field">
                    <label className="sa-ur-label">Nombre visible</label>
                    <input
                        className="sa-ur-input"
                        name="nombre"
                        value={form.nombre}
                        onChange={cambiar}
                        placeholder="ej: Brinks Argentina"
                        onKeyDown={e => e.key === "Enter" && crear()}
                    />
                </div>

                {error && <div className="sa-msg sa-msg--err">{error}</div>}

                <div className="sa-modal-actions">
                    <button className="sa-ur-btn-save" onClick={crear} disabled={loading}>
                        {loading ? "Creando…" : "✅ Crear empresa"}
                    </button>
                    <button className="sa-ur-btn-cancel" onClick={onCerrar}>Cancelar</button>
                </div>
            </div>
        </div>
    );
}

// ── Sub-panel: Empresas ────────────────────────────────────────────────────────
function PanelEmpresas() {
    const [empresas,     setEmpresas]     = useState([]);
    const [loading,      setLoading]      = useState(true);
    const [error,        setError]        = useState(null);
    const [seleccionada, setSeleccionada] = useState(null);
    const [modulos,      setModulos]      = useState({});
    const [guardando,    setGuardando]    = useState(false);
    const [msg,          setMsg]          = useState(null);
    const [modalNueva,   setModalNueva]   = useState(false);
    const [logos,        setLogos]        = useState({ splash: null, panel: null });
    const [subiendoLogo, setSubiendoLogo] = useState({ splash: false, panel: false });

    const cargar = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            // 1. Intentar leer colección empresas (puede fallar si las reglas no la cubren)
            let listaE = [];
            try {
                const snapE = await getDocs(collection(db, "empresas"));
                listaE = snapE.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (eEmp) {
                console.warn("No se pudo leer /empresas:", eEmp.message);
            }

            // 2. Detectar empresas sin doc en /empresas (vía empresaId en usuarios)
            let idsEnUsers = [];
            try {
                const snapU = await getDocs(collection(db, "usuarios"));
                idsEnUsers = [...new Set(snapU.docs.map(d => d.data().empresaId).filter(Boolean))];
            } catch (eUsr) {
                console.warn("No se pudo leer /usuarios:", eUsr.message);
            }

            const idsExistentes = new Set(listaE.map(e => e.id.toLowerCase()));
            const sinDoc = idsEnUsers
                .filter(id => !idsExistentes.has(id.toLowerCase()))
                .map(id => ({ id, nombre: id.charAt(0).toUpperCase() + id.slice(1), activo: true, modulos: MODULOS_DEFAULT, _sinDoc: true }));

            // Dedup final por id (por si hay duplicados residuales)
            const todas = [...listaE, ...sinDoc];
            const vistas = new Set();
            const unicas = todas.filter(e => {
                const key = e.id.toLowerCase();
                if (vistas.has(key)) return false;
                vistas.add(key);
                return true;
            });

            setEmpresas(unicas);
        } catch (e) {
            console.error("PanelEmpresas:", e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const abrirEmpresa = (emp) => {
        setSeleccionada(emp);
        setModulos({ ...MODULOS_DEFAULT, ...(emp.modulos ?? {}) });
        setLogos({ splash: emp.logoSplash ?? null, panel: emp.logoPanel ?? null });
        setMsg(null);
    };

    const subirLogo = async (tipo, file) => {
        if (!file || !seleccionada) return;
        setSubiendoLogo(prev => ({ ...prev, [tipo]: true }));
        setMsg(null);
        try {
            const ext  = file.name.split(".").pop();
            const path = `logos/${seleccionada.id}/logo_${tipo}.${ext}`;
            const snap = await uploadBytes(storageRef(storage, path), file);
            const url  = await getDownloadURL(snap.ref);
            await setDoc(doc(db, "empresas", seleccionada.id),
                { [`logo${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`]: url },
                { merge: true }
            );
            setLogos(prev => ({ ...prev, [tipo]: url }));
            setMsg({ texto: `✅ Logo ${tipo} guardado`, ok: true });
        } catch (e) {
            setMsg({ texto: "❌ Error subiendo logo: " + e.message, ok: false });
        } finally {
            setSubiendoLogo(prev => ({ ...prev, [tipo]: false }));
        }
    };

    const toggleModulo = (key) =>
        setModulos(prev => ({ ...prev, [key]: !prev[key] }));

    const guardar = async () => {
        if (!seleccionada) return;
        setGuardando(true); setMsg(null);
        try {
            await setDoc(doc(db, "empresas", seleccionada.id), {
                nombre:        seleccionada.nombre ?? seleccionada.id,
                activo:        seleccionada.activo ?? true,
                modulos,
                actualizadoEn: serverTimestamp(),
            }, { merge: true });
            setMsg({ texto: "✅ Módulos guardados correctamente", ok: true });
            await cargar();
        } catch (e) {
            setMsg({ texto: "❌ Error: " + e.message, ok: false });
        } finally {
            setGuardando(false);
        }
    };

    const onEmpresaCreada = (emp) => {
        setModalNueva(false);
        setEmpresas(prev => [...prev, emp]);
        abrirEmpresa(emp);          // abre directo a configurar módulos
    };

    // ── Loading ──────────────────────────────────────────────────────────────
    if (loading) return (
        <div className="sa-usuarios-loading">
            <div className="sa-spinner" /> Cargando empresas…
        </div>
    );

    // ── Error ────────────────────────────────────────────────────────────────
    if (error) return (
        <div className="sa-empty-state">
            <div className="sa-empty-icon">⚠️</div>
            <div className="sa-empty-title">Error al cargar empresas</div>
            <div className="sa-empty-desc">{error}</div>
            <button className="sa-ur-btn-save" style={{marginTop: "1rem"}} onClick={cargar}>Reintentar</button>
        </div>
    );

    // ── Detalle empresa ──────────────────────────────────────────────────────
    if (seleccionada) return (
        <div className="sa-empresas-detail">
            <div className="sa-empresas-detail-header">
                <button className="sa-back-btn" onClick={() => { setSeleccionada(null); setMsg(null); }}>
                    ← Volver a empresas
                </button>
                <div className="sa-empresas-detail-title">
                    <span className="sa-emp-avatar">
                        {(seleccionada.nombre ?? seleccionada.id).charAt(0).toUpperCase()}
                    </span>
                    <div>
                        <div className="sa-emp-nombre">{seleccionada.nombre ?? seleccionada.id}</div>
                        <div className="sa-emp-id">ID: {seleccionada.id}</div>
                    </div>
                </div>
            </div>

            {msg && <div className={`sa-msg ${msg.ok ? "sa-msg--ok" : "sa-msg--err"}`}>{msg.texto}</div>}

            {/* ── Identidad Visual ─────────────────────────────────── */}
            <div className="sa-logos-section">
                <div className="sa-logos-section-title">🎨 Identidad Visual</div>
                <div className="sa-logos-grid">
                    {[
                        { tipo: "splash", label: "Logo Splash", desc: "Logo animado en la pantalla de carga" },
                        { tipo: "panel",  label: "Logo Panel",  desc: "Logo en el encabezado del panel de usuarios" },
                    ].map(({ tipo, label, desc }) => (
                        <div key={tipo} className="sa-logo-uploader">
                            <div className="sa-logo-uploader-preview">
                                {logos[tipo]
                                    ? <img src={logos[tipo]} alt={label} className="sa-logo-preview-img" />
                                    : <span className="sa-logo-placeholder">Sin imagen</span>
                                }
                            </div>
                            <div className="sa-logo-uploader-info">
                                <div className="sa-logo-uploader-label">{label}</div>
                                <div className="sa-logo-uploader-desc">{desc}</div>
                                <label className={`sa-logo-upload-btn ${subiendoLogo[tipo] ? "sa-logo-upload-btn--loading" : ""}`}>
                                    {subiendoLogo[tipo] ? "Subiendo…" : "📁 Elegir imagen"}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        style={{ display: "none" }}
                                        disabled={subiendoLogo[tipo]}
                                        onChange={e => subirLogo(tipo, e.target.files[0])}
                                    />
                                </label>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <p className="sa-emp-instruccion">
                Activá o desactivá los módulos disponibles para esta empresa.
                Los módulos desactivados no estarán visibles para ningún usuario de esta empresa.
            </p>

            {MODULOS_DEF.map(grupo => (
                <div key={grupo.grupo} className="sa-modulo-grupo">
                    <div className={`sa-modulo-grupo-header sa-modulo-grupo-header--${grupo.color}`}>
                        <span>{grupo.icon}</span>
                        <span>{grupo.grupo}</span>
                    </div>
                    <div className="sa-modulo-lista">
                        {grupo.modulos.map(m => (
                            <div
                                key={m.key}
                                className={`sa-modulo-item ${modulos[m.key] ? "sa-modulo-item--on" : ""}`}
                                onClick={() => toggleModulo(m.key)}
                            >
                                <div className="sa-modulo-item-info">
                                    <div className="sa-modulo-item-label">{m.label}</div>
                                    <div className="sa-modulo-item-desc">{m.desc}</div>
                                </div>
                                <div className={`sa-toggle-switch ${modulos[m.key] ? "sa-toggle-switch--on" : ""}`}>
                                    <div className="sa-toggle-thumb" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            <div className="sa-emp-actions">
                <button className="sa-ur-btn-save" onClick={guardar} disabled={guardando}>
                    {guardando ? "Guardando…" : "💾 Guardar módulos"}
                </button>
                <button className="sa-ur-btn-cancel" onClick={() => { setSeleccionada(null); setMsg(null); }}>
                    Cancelar
                </button>
            </div>
        </div>
    );

    // ── Lista de empresas ────────────────────────────────────────────────────
    return (
        <>
        {modalNueva && (
            <ModalNuevaEmpresa
                onCrear={onEmpresaCreada}
                onCerrar={() => setModalNueva(false)}
            />
        )}

        <div className="sa-empresas">
            <div className="sa-usuarios-header">
                <div className="sa-section-title">Empresas registradas</div>
                <div style={{ display:"flex", gap:"var(--space-3)", alignItems:"center" }}>
                    <span className="sa-usuarios-count">
                        {empresas.length} empresa{empresas.length !== 1 ? "s" : ""}
                    </span>
                    <button className="sa-ur-btn-save" style={{ padding:"0.4rem 1rem", fontSize:"var(--text-sm)" }}
                        onClick={() => setModalNueva(true)}>
                        + Nueva empresa
                    </button>
                </div>
            </div>

            {empresas.length === 0 ? (
                <div className="sa-empty-state">
                    <div className="sa-empty-icon">🏛️</div>
                    <div className="sa-empty-title">No hay empresas registradas</div>
                    <div className="sa-empty-desc">
                        Creá la primera empresa para empezar a asignar módulos y usuarios.
                    </div>
                    <button className="sa-ur-btn-save" style={{marginTop:"1rem"}}
                        onClick={() => setModalNueva(true)}>
                        + Crear empresa
                    </button>
                </div>
            ) : (
                <div className="sa-empresas-list">
                    {empresas.map(emp => {
                        const totalMod   = Object.keys(MODULOS_DEFAULT).length;
                        const activosMod = Object.values({ ...MODULOS_DEFAULT, ...(emp.modulos ?? {}) }).filter(Boolean).length;
                        return (
                            <div key={emp.id} className="sa-empresa-card">
                                <div className="sa-emp-card-avatar">
                                    {(emp.nombre ?? emp.id).charAt(0).toUpperCase()}
                                </div>
                                <div className="sa-emp-card-info">
                                    <div className="sa-emp-card-nombre">{emp.nombre ?? emp.id}</div>
                                    <div className="sa-emp-card-meta">
                                        <span className="sa-empresa-tag">{emp.id}</span>
                                        <span className={`sa-empresa-tag ${emp.activo !== false ? "" : "sa-inactivo-tag"}`}>
                                            {emp.activo !== false ? "✅ Activa" : "🚫 Inactiva"}
                                        </span>
                                        <span className="sa-empresa-tag">{activosMod}/{totalMod} módulos</span>
                                        {emp._sinDoc && <span className="sa-empresa-tag sa-inactivo-tag">⚠️ Sin configurar</span>}
                                    </div>
                                </div>
                                <button className="sa-ur-edit-btn" onClick={() => abrirEmpresa(emp)}>
                                    ⚙️ Configurar módulos
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
        </>
    );
}

// ── Sub-panel: Usuarios ────────────────────────────────────────────────────────
function PanelUsuarios() {
    const [usuarios,  setUsuarios]  = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [editando,  setEditando]  = useState(null);   // uid en edición
    const [form,      setForm]      = useState({});
    const [guardando, setGuardando] = useState(false);
    const [msg,       setMsg]       = useState(null);   // { texto, ok }

    const cargarUsuarios = useCallback(async () => {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, "usuarios"));
            const lista = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
                .sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? ""));
            setUsuarios(lista);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargarUsuarios(); }, [cargarUsuarios]);

    const abrirEdicion = (u) => {
        setEditando(u.uid);
        setForm({ rol: u.rol ?? "vigilador", empresaId: u.empresaId ?? "", activo: u.activo !== false });
        setMsg(null);
    };

    const cancelar = () => { setEditando(null); setMsg(null); };

    const guardar = async (uid) => {
        setGuardando(true);
        setMsg(null);
        try {
            await updateDoc(doc(db, "usuarios", uid), {
                rol:       form.rol,
                empresaId: form.empresaId.trim() || null,
                activo:    form.activo,
            });
            setMsg({ texto: "✅ Guardado correctamente", ok: true });
            setEditando(null);
            await cargarUsuarios();
        } catch (e) {
            setMsg({ texto: "❌ Error: " + e.message, ok: false });
        } finally {
            setGuardando(false);
        }
    };

    if (loading) return (
        <div className="sa-usuarios-loading">
            <div className="sa-spinner" /> Cargando usuarios…
        </div>
    );

    return (
        <div className="sa-usuarios">
            <div className="sa-usuarios-header">
                <div className="sa-section-title">Usuarios del sistema</div>
                <span className="sa-usuarios-count">{usuarios.length} usuarios</span>
            </div>

            {msg && (
                <div className={`sa-msg ${msg.ok ? "sa-msg--ok" : "sa-msg--err"}`}>
                    {msg.texto}
                </div>
            )}

            <div className="sa-usuarios-list">
                {usuarios.map(u => (
                    <div key={u.uid} className={`sa-user-row ${editando === u.uid ? "sa-user-row--editing" : ""}`}>

                        {/* Avatar + info */}
                        <div className="sa-ur-avatar">
                            {(u.nombre ?? u.email ?? "?").charAt(0).toUpperCase()}
                        </div>

                        <div className="sa-ur-info">
                            <div className="sa-ur-name">{u.nombre ?? "—"}</div>
                            <div className="sa-ur-email">{u.email}</div>
                        </div>

                        <div className="sa-ur-meta">
                            <span className={`sa-rol-badge sa-rol-badge--${ROL_COLOR[u.rol] ?? "gray"}`}>
                                {ROLE_ICONS[u.rol] ?? "👤"} {ROLE_LABELS[u.rol] ?? u.rol ?? "Sin rol"}
                            </span>
                            {u.empresaId && (
                                <span className="sa-empresa-tag">{u.empresaId}</span>
                            )}
                            {u.activo === false && (
                                <span className="sa-inactivo-tag">Inactivo</span>
                            )}
                        </div>

                        {editando !== u.uid && (
                            <button className="sa-ur-edit-btn" onClick={() => abrirEdicion(u)}>
                                ✏️ Editar
                            </button>
                        )}

                        {/* Formulario inline de edición */}
                        {editando === u.uid && (
                            <div className="sa-ur-form">
                                <div className="sa-ur-form-row">
                                    <label className="sa-ur-label">Rol</label>
                                    <select
                                        className="sa-ur-select"
                                        value={form.rol}
                                        onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}
                                    >
                                        {ROLES_OPCIONES.map(r => (
                                            <option key={r.value} value={r.value}>{r.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="sa-ur-form-row">
                                    <label className="sa-ur-label">Empresa ID</label>
                                    <input
                                        className="sa-ur-input"
                                        type="text"
                                        placeholder="ej: brinks"
                                        value={form.empresaId}
                                        onChange={e => setForm(f => ({ ...f, empresaId: e.target.value }))}
                                    />
                                </div>

                                <div className="sa-ur-form-row">
                                    <label className="sa-ur-label">Estado</label>
                                    <label className="sa-ur-toggle">
                                        <input
                                            type="checkbox"
                                            checked={form.activo}
                                            onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))}
                                        />
                                        <span className="sa-ur-toggle-label">
                                            {form.activo ? "✅ Activo" : "🚫 Inactivo"}
                                        </span>
                                    </label>
                                </div>

                                <div className="sa-ur-form-actions">
                                    <button
                                        className="sa-ur-btn-save"
                                        onClick={() => guardar(u.uid)}
                                        disabled={guardando}
                                    >
                                        {guardando ? "Guardando…" : "💾 Guardar"}
                                    </button>
                                    <button className="sa-ur-btn-cancel" onClick={cancelar}>
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Pantalla principal ─────────────────────────────────────────────────────────
export default function SuperAdminScreen({ onExit }) {
    const { user, logout } = useAuth();
    const [seccion,     setSeccion]     = useState("dashboard");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [stats,       setStats]       = useState({
        empresas: "…", usuarios: "…", contratos: "…", alertas: 0,
    });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Usuarios
                const snapU     = await getDocs(collection(db, "usuarios"));
                const usuarios  = snapU.size;

                // Empresas: primero desde /empresas, fallback desde empresaId en usuarios
                let empresasCnt = 0;
                try {
                    const snapE   = await getDocs(collection(db, "empresas"));
                    const idsFirestore = new Set(snapE.docs.map(d => d.id.toLowerCase()));
                    const idsUsers     = new Set(snapU.docs.map(d => (d.data().empresaId ?? "").toLowerCase()).filter(Boolean));
                    // Unión sin duplicados
                    const idsTotales = new Set([...idsFirestore, ...idsUsers]);
                    empresasCnt = idsTotales.size;
                } catch {
                    const ids = new Set(snapU.docs.map(d => (d.data().empresaId ?? "").toLowerCase()).filter(Boolean));
                    empresasCnt = ids.size;
                }

                setStats({ empresas: empresasCnt, usuarios, contratos: "—", alertas: 0 });
            } catch {
                setStats({ empresas: "—", usuarios: "—", contratos: "—", alertas: 0 });
            }
        };
        fetchStats();
    }, []);

    const handleLogout = async () => { await logout(); onExit?.(); };

    return (
        <div className="sa-root">

            {/* ── Sidebar ── */}
            <aside className={`sa-sidebar ${sidebarOpen ? "sa-sidebar--open" : ""}`}>
                <div className="sa-sidebar-logo">
                    <div className="sa-logo-mark">⚙️</div>
                    <div>
                        <div className="sa-logo-text">CYRANO<span>APP</span></div>
                        <div className="sa-logo-badge">SUPER ADMIN</div>
                    </div>
                </div>

                <nav className="sa-nav">
                    <div className="sa-nav-label">MENÚ</div>
                    {NAV.map(n => (
                        <button
                            key={n.id}
                            className={`sa-nav-item ${seccion === n.id ? "sa-nav-item--active" : ""}`}
                            onClick={() => { setSeccion(n.id); setSidebarOpen(false); }}
                        >
                            <span className="sa-nav-icon">{n.icon}</span>
                            <span className="sa-nav-text">{n.label}</span>
                            {seccion === n.id && <span className="sa-nav-dot" />}
                        </button>
                    ))}
                </nav>

                <div className="sa-sidebar-footer">
                    <div className="sa-user-chip">
                        <div className="sa-user-avatar">
                            {(user?.name ?? "S").charAt(0).toUpperCase()}
                        </div>
                        <div className="sa-user-info">
                            <div className="sa-user-name">{user?.name ?? "Super Admin"}</div>
                            <div className="sa-user-email">{user?.email}</div>
                        </div>
                    </div>
                    <button className="sa-logout-btn" onClick={handleLogout}>
                        <span>🚪</span> Cerrar sesión
                    </button>
                </div>
            </aside>

            {sidebarOpen && <div className="sa-overlay" onClick={() => setSidebarOpen(false)} />}

            {/* ── Main ── */}
            <div className="sa-main">
                <header className="sa-topbar">
                    <div className="sa-topbar-left">
                        <button className="sa-hamburger" onClick={() => setSidebarOpen(s => !s)}>☰</button>
                        <div>
                            <h1 className="sa-page-title">
                                {NAV.find(n => n.id === seccion)?.icon}{" "}
                                {NAV.find(n => n.id === seccion)?.label}
                            </h1>
                            <p className="sa-page-sub">Panel de control global del sistema</p>
                        </div>
                    </div>
                    <div className="sa-topbar-right">
                        <div className="sa-topbar-user">
                            <div className="sa-topbar-avatar">
                                {(user?.name ?? "S").charAt(0).toUpperCase()}
                            </div>
                            <span className="sa-topbar-name">{user?.name ?? "Super Admin"}</span>
                        </div>
                    </div>
                </header>

                <div className="sa-content">

                    {/* Dashboard */}
                    {seccion === "dashboard" && (
                        <>
                            <div className="sa-stats-grid">
                                {[
                                    { icon: "🏛️", label: "Empresas activas",  value: stats.empresas,  color: "blue"  },
                                    { icon: "👥", label: "Usuarios totales",   value: stats.usuarios,  color: "green" },
                                    { icon: "📋", label: "Contratos activos",  value: stats.contratos, color: "gold"  },
                                    { icon: "🔔", label: "Alertas",            value: stats.alertas,   color: "red"   },
                                ].map(s => (
                                    <div key={s.label} className={`sa-stat-card sa-stat-card--${s.color}`}>
                                        <div className="sa-stat-icon">{s.icon}</div>
                                        <div className="sa-stat-value">{s.value}</div>
                                        <div className="sa-stat-label">{s.label}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="sa-section-title">Módulos del sistema</div>
                            <div className="sa-cards-grid">
                                {SECCIONES.map(s => (
                                    <button key={s.id} className="sa-module-card" onClick={() => setSeccion(s.id)}>
                                        <div className="sa-module-icon">{s.icon}</div>
                                        <div className="sa-module-body">
                                            <div className="sa-module-title">{s.titulo}</div>
                                            <div className="sa-module-desc">{s.descripcion}</div>
                                        </div>
                                        <span className="sa-module-arrow">›</span>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Empresas — funcional */}
                    {seccion === "empresas" && <PanelEmpresas />}

                    {/* Usuarios — funcional */}
                    {seccion === "usuarios" && <PanelUsuarios />}

                    {/* Resto — placeholder */}
                    {seccion !== "dashboard" && seccion !== "empresas" && seccion !== "usuarios" && (
                        <div className="sa-placeholder">
                            <div className="sa-placeholder-icon">{SECCIONES.find(s => s.id === seccion)?.icon}</div>
                            <div className="sa-placeholder-title">{SECCIONES.find(s => s.id === seccion)?.titulo}</div>
                            <div className="sa-placeholder-desc">{SECCIONES.find(s => s.id === seccion)?.descripcion}</div>
                            <span className="sa-placeholder-badge">Próximamente</span>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
