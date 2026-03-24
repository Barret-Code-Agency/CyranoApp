// src/screens/superadmin/PanelUsuarios.jsx
import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, doc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { ROLE_LABELS, ROLE_COLORS } from "../../config/roles";
import { useAuth } from "../../context/AuthContext";

const SISTEMA_KEY = "⚙️ Sistema (Super Admins)";

// Roles que se pueden asignar desde este panel (se excluye super_admin)
const ROLES_ASIGNABLES = Object.entries(ROLE_LABELS).filter(([k]) => k !== "super_admin");

const ROLES_VALIDOS = new Set(Object.keys(ROLE_LABELS));

function rolesIniciales(u) {
    const todos = Array.isArray(u.roles) && u.roles.length ? u.roles : (u.rol ? [u.rol] : ["vigilador"]);
    const filtrados = todos.filter(r => ROLES_VALIDOS.has(r));
    return filtrados.length ? filtrados : ["vigilador"];
}

const ZONAS = [
    "Todas las zonas",
    "CABA Norte", "CABA Sur", "CABA Centro",
    "GBA Norte", "GBA Sur", "Buenos Aires Interior",
    "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes",
    "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza",
    "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis",
    "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán",
];

const FORM_NUEVO_VACIO = {
    nombre: "", email: "", password: "", rol: "vigilador", empresaId: "", zona: "",
};

const FORM_VINCULAR_VACIO = {
    uid: "", nombre: "", email: "", rol: "vigilador", empresaId: "", zona: "",
};

export default function PanelUsuarios() {
    const { crearUsuario } = useAuth();
    const [usuarios,     setUsuarios]     = useState([]);
    const [empresas,     setEmpresas]     = useState({});   // { id → nombre }
    const [loading,      setLoading]      = useState(true);
    const [editando,     setEditando]     = useState(null);
    const [form,         setForm]         = useState({});
    const [guardando,    setGuardando]    = useState(false);
    const [msg,          setMsg]          = useState(null);
    const [empresasOpen, setEmpresasOpen] = useState({});
    const [modalNuevo,    setModalNuevo]    = useState(false);
    const [formNuevo,     setFormNuevo]     = useState(FORM_NUEVO_VACIO);
    const [creando,       setCreando]       = useState(false);
    const [msgNuevo,      setMsgNuevo]      = useState(null);
    const [modalVincular, setModalVincular] = useState(false);
    const [formVincular,  setFormVincular]  = useState(FORM_VINCULAR_VACIO);
    const [vinculando,    setVinculando]    = useState(false);
    const [msgVincular,   setMsgVincular]   = useState(null);

    const cargarUsuarios = useCallback(async () => {
        setLoading(true);
        try {
            const [snapU, snapE] = await Promise.all([
                getDocs(collection(db, "usuarios")),
                getDocs(collection(db, "empresas")),
            ]);
            const lista = snapU.docs.map(d => ({ uid: d.id, ...d.data() }))
                .sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? ""));
            const mapa = Object.fromEntries(
                snapE.docs.map(d => [d.id, d.data().nombre ?? d.id])
            );
            setUsuarios(lista);
            setEmpresas(mapa);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargarUsuarios(); }, [cargarUsuarios]);

    // Agrupar por empresaId — los super_admin van a su propio grupo
    const grupos = {};
    for (const u of usuarios) {
        const esSuperAdmin = rolesIniciales(u).includes("super_admin");
        const empId = esSuperAdmin ? SISTEMA_KEY : (u.empresaId ?? "(Sin empresa)");
        if (!grupos[empId]) grupos[empId] = [];
        grupos[empId].push(u);
    }

    const labelGrupo = (empId) => {
        if (empId === SISTEMA_KEY || empId === "(Sin empresa)") return empId;
        const nombre = empresas[empId];
        return nombre && nombre !== empId
            ? `${nombre}  ·  ${empId}`
            : empId;
    };

    const toggleEmpresa = (emp) =>
        setEmpresasOpen(prev => ({ ...prev, [emp]: !prev[emp] }));

    const abrirEdicion = (u) => {
        setEditando(u.uid);
        setForm({
            roles:     rolesIniciales(u),
            empresaId: u.empresaId ?? "",
            zona:      u.zona ?? "",
            activo:    u.activo !== false,
        });
        setMsg(null);
    };

    const cancelar = () => { setEditando(null); setMsg(null); };

    const toggleRol = (rol) => {
        setForm(f => {
            const tiene = f.roles.includes(rol);
            if (tiene && f.roles.length === 1) return f;
            return { ...f, roles: tiene ? f.roles.filter(r => r !== rol) : [...f.roles, rol] };
        });
    };

    const guardar = async (uid) => {
        setGuardando(true);
        setMsg(null);
        try {
            const esSA = form.roles.includes("super_admin");
            await updateDoc(doc(db, "usuarios", uid), {
                roles:     form.roles,
                rol:       form.roles[0],
                empresaId: esSA ? null : (form.empresaId.trim() || null),
                zona:      form.zona?.trim() || null,
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

    const abrirModalVincular = () => {
        setFormVincular(FORM_VINCULAR_VACIO);
        setMsgVincular(null);
        setModalVincular(true);
    };

    const vincularUsuarioExistente = async () => {
        const { uid, nombre, email, rol, empresaId } = formVincular;
        if (!uid.trim() || !nombre.trim() || !email.trim()) {
            setMsgVincular({ texto: "UID, nombre y email son obligatorios.", ok: false });
            return;
        }
        setVinculando(true);
        setMsgVincular(null);
        try {
            await setDoc(doc(db, "usuarios", uid.trim()), {
                nombre:       nombre.trim(),
                email:        email.trim(),
                rol,
                roles:        [rol],
                empresaId:    rol === "super_admin" ? null : (empresaId.trim() || null),
                zona:         formVincular.zona.trim() || null,
                activo:       true,
                creadoEn:     serverTimestamp(),
                ultimoAcceso: null,
            });
            setMsgVincular({ texto: "✅ Usuario vinculado correctamente", ok: true });
            await cargarUsuarios();
            setTimeout(() => setModalVincular(false), 1200);
        } catch (e) {
            setMsgVincular({ texto: "❌ " + e.message, ok: false });
        } finally {
            setVinculando(false);
        }
    };

    const abrirModalNuevo = () => {
        setFormNuevo(FORM_NUEVO_VACIO);
        setMsgNuevo(null);
        setModalNuevo(true);
    };

    const crearNuevoUsuario = async () => {
        const { nombre, email, password, rol, empresaId } = formNuevo;
        if (!nombre.trim() || !email.trim() || !password.trim()) {
            setMsgNuevo({ texto: "Nombre, email y contraseña son obligatorios.", ok: false });
            return;
        }
        setCreando(true);
        setMsgNuevo(null);
        try {
            await crearUsuario({
                nombre:    nombre.trim(),
                email:     email.trim(),
                password,
                rol,
                empresaId: rol === "super_admin" ? null : (formNuevo.empresaId.trim() || null),
                zona:      formNuevo.zona.trim() || null,
            });
            setMsgNuevo({ texto: "✅ Usuario creado correctamente", ok: true });
            await cargarUsuarios();
            setTimeout(() => setModalNuevo(false), 1200);
        } catch (e) {
            setMsgNuevo({ texto: "❌ " + e.message, ok: false });
        } finally {
            setCreando(false);
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
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <span className="sa-usuarios-count">{usuarios.length} usuarios</span>
                    <button className="sa-ur-btn-cancel" onClick={abrirModalVincular} style={{ padding: "6px 16px", fontSize: "0.85rem" }}>
                        🔗 Vincular Auth existente
                    </button>
                    <button className="sa-ur-btn-save" onClick={abrirModalNuevo} style={{ padding: "6px 16px", fontSize: "0.85rem" }}>
                        + Nuevo usuario
                    </button>
                </div>
            </div>

            {msg && (
                <div className={`sa-msg ${msg.ok ? "sa-msg--ok" : "sa-msg--err"}`}>
                    {msg.texto}
                </div>
            )}

            {modalNuevo && (
                <div className="sa-modal-overlay" onClick={() => setModalNuevo(false)}>
                    <div className="sa-modal" onClick={e => e.stopPropagation()}>
                        <div className="sa-modal-header">
                            <h3 className="sa-modal-title">Nuevo usuario</h3>
                            <button className="sa-modal-close" onClick={() => setModalNuevo(false)}>✕</button>
                        </div>

                        <div className="sa-modal-body">
                            {msgNuevo && (
                                <div className={`sa-msg ${msgNuevo.ok ? "sa-msg--ok" : "sa-msg--err"}`}>
                                    {msgNuevo.texto}
                                </div>
                            )}

                            <div className="sa-ur-form-row">
                                <label className="sa-ur-label">Nombre completo *</label>
                                <input className="sa-ur-input" type="text" value={formNuevo.nombre}
                                    onChange={e => setFormNuevo(f => ({ ...f, nombre: e.target.value }))} />
                            </div>
                            <div className="sa-ur-form-row">
                                <label className="sa-ur-label">Email *</label>
                                <input className="sa-ur-input" type="email" value={formNuevo.email}
                                    onChange={e => setFormNuevo(f => ({ ...f, email: e.target.value }))} />
                            </div>
                            <div className="sa-ur-form-row">
                                <label className="sa-ur-label">Contraseña *</label>
                                <input className="sa-ur-input" type="password" value={formNuevo.password}
                                    onChange={e => setFormNuevo(f => ({ ...f, password: e.target.value }))} />
                            </div>
                            <div className="sa-ur-form-row">
                                <label className="sa-ur-label">Rol</label>
                                <select className="sa-ur-input" value={formNuevo.rol}
                                    onChange={e => setFormNuevo(f => ({ ...f, rol: e.target.value }))}>
                                    {Object.entries(ROLE_LABELS).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>
                            {formNuevo.rol !== "super_admin" && (
                                <div className="sa-ur-form-row">
                                    <label className="sa-ur-label">Empresa</label>
                                    <select className="sa-ur-input" value={formNuevo.empresaId}
                                        onChange={e => setFormNuevo(f => ({ ...f, empresaId: e.target.value }))}>
                                        <option value="">— Sin empresa —</option>
                                        {Object.entries(empresas).map(([id, nombre]) => (
                                            <option key={id} value={id}>{nombre} ({id})</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="sa-ur-form-row">
                                <label className="sa-ur-label">Zona</label>
                                <select className="sa-ur-input" value={formNuevo.zona}
                                    onChange={e => setFormNuevo(f => ({ ...f, zona: e.target.value }))}>
                                    <option value="">— Sin zona —</option>
                                    {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="sa-modal-footer">
                            <button className="sa-ur-btn-save" onClick={crearNuevoUsuario} disabled={creando}>
                                {creando ? "Creando…" : "✅ Crear usuario"}
                            </button>
                            <button className="sa-ur-btn-cancel" onClick={() => setModalNuevo(false)}>
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modalVincular && (
                <div className="sa-modal-overlay" onClick={() => setModalVincular(false)}>
                    <div className="sa-modal" onClick={e => e.stopPropagation()}>
                        <div className="sa-modal-header">
                            <h3 className="sa-modal-title">Vincular usuario Auth existente</h3>
                            <button className="sa-modal-close" onClick={() => setModalVincular(false)}>✕</button>
                        </div>

                        <div className="sa-modal-body">
                            <p style={{ fontSize: "0.82rem", color: "var(--color-muted)", margin: 0 }}>
                                Pegá el UID que ves en Firebase Console → Authentication. Esto crea el doc en Firestore sin modificar la contraseña.
                            </p>

                            {msgVincular && (
                                <div className={`sa-msg ${msgVincular.ok ? "sa-msg--ok" : "sa-msg--err"}`}>
                                    {msgVincular.texto}
                                </div>
                            )}

                            <div className="sa-ur-form-row">
                                <label className="sa-ur-label">UID del usuario *</label>
                                <input className="sa-ur-input" type="text" placeholder="ej: HgYTJv1YzsTHIFcZDVpzzB9ra…"
                                    value={formVincular.uid}
                                    onChange={e => setFormVincular(f => ({ ...f, uid: e.target.value }))} />
                            </div>
                            <div className="sa-ur-form-row">
                                <label className="sa-ur-label">Nombre completo *</label>
                                <input className="sa-ur-input" type="text"
                                    value={formVincular.nombre}
                                    onChange={e => setFormVincular(f => ({ ...f, nombre: e.target.value }))} />
                            </div>
                            <div className="sa-ur-form-row">
                                <label className="sa-ur-label">Email *</label>
                                <input className="sa-ur-input" type="email"
                                    value={formVincular.email}
                                    onChange={e => setFormVincular(f => ({ ...f, email: e.target.value }))} />
                            </div>
                            <div className="sa-ur-form-row">
                                <label className="sa-ur-label">Rol</label>
                                <select className="sa-ur-input" value={formVincular.rol}
                                    onChange={e => setFormVincular(f => ({ ...f, rol: e.target.value }))}>
                                    {Object.entries(ROLE_LABELS).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>
                            {formVincular.rol !== "super_admin" && (
                                <div className="sa-ur-form-row">
                                    <label className="sa-ur-label">Empresa</label>
                                    <select className="sa-ur-input" value={formVincular.empresaId}
                                        onChange={e => setFormVincular(f => ({ ...f, empresaId: e.target.value }))}>
                                        <option value="">— Sin empresa —</option>
                                        {Object.entries(empresas).map(([id, nombre]) => (
                                            <option key={id} value={id}>{nombre} ({id})</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="sa-ur-form-row">
                                <label className="sa-ur-label">Zona</label>
                                <select className="sa-ur-input" value={formVincular.zona}
                                    onChange={e => setFormVincular(f => ({ ...f, zona: e.target.value }))}>
                                    <option value="">— Sin zona —</option>
                                    {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="sa-modal-footer">
                            <button className="sa-ur-btn-save" onClick={vincularUsuarioExistente} disabled={vinculando}>
                                {vinculando ? "Vinculando…" : "🔗 Vincular"}
                            </button>
                            <button className="sa-ur-btn-cancel" onClick={() => setModalVincular(false)}>
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="sa-ug-list">
                {Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b)).map(([empresa, personal]) => (
                    <div key={empresa} className="sa-ug-empresa">
                        <button className="sa-ug-empresa-header" onClick={() => toggleEmpresa(empresa)}>
                            <span className="sa-ug-empresa-icon">{empresa === SISTEMA_KEY ? "⚙️" : "🏢"}</span>
                            <span className="sa-ug-empresa-nombre">{labelGrupo(empresa)}</span>
                            <span className="sa-ug-empresa-count">{personal.length} usuario{personal.length !== 1 ? "s" : ""}</span>
                            <span className="sa-ug-empresa-arrow">{empresasOpen[empresa] ? "▲" : "▼"}</span>
                        </button>

                        {empresasOpen[empresa] && (
                            <div className="sa-usuarios-list">
                                {personal.map(u => {
                                    const roles = rolesIniciales(u);
                                    return (
                                        <div key={u.uid} className={`sa-user-row ${editando === u.uid ? "sa-user-row--editing" : ""}`}>

                                            <div className="sa-ur-avatar">
                                                {(u.nombre ?? u.email ?? "?").charAt(0).toUpperCase()}
                                            </div>

                                            <div className="sa-ur-info">
                                                <div className="sa-ur-name">{u.nombre ?? "—"}</div>
                                                <div className="sa-ur-email">{u.email}</div>
                                            </div>

                                            <div className="sa-ur-meta">
                                                {roles.map(r => (
                                                    <span key={r} className={`sa-rol-badge sa-rol-badge--${ROLE_COLORS[r] ?? "gray"}`}>
                                                        {ROLE_LABELS[r] ?? r}
                                                    </span>
                                                ))}
                                                {u.activo === false && <span className="sa-inactivo-tag">Inactivo</span>}
                                            </div>

                                            {editando !== u.uid && (
                                                <button className="sa-ur-edit-btn" onClick={() => abrirEdicion(u)}>
                                                    ✏️ Editar
                                                </button>
                                            )}

                                            {editando === u.uid && (
                                                <div className="sa-ur-form">
                                                    <div className="sa-ur-form-row">
                                                        <label className="sa-ur-label">Roles</label>
                                                        <div className="sa-ur-roles-grid">
                                                            {ROLES_ASIGNABLES.map(([value, label]) => (
                                                                <label key={value} className={`sa-ur-role-check ${form.roles.includes(value) ? "sa-ur-role-check--active" : ""}`}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={form.roles.includes(value)}
                                                                        onChange={() => toggleRol(value)}
                                                                    />
                                                                    <span>{label}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                        <small className="sa-ur-hint">El primer rol marcado es el rol primario.</small>
                                                    </div>

                                                    <div className="sa-ur-form-bottom">
                                                        {!form.roles.includes("super_admin") && (
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
                                                        )}

                                                        <div className="sa-ur-form-row">
                                                            <label className="sa-ur-label">Zona</label>
                                                            <select className="sa-ur-input" value={form.zona ?? ""}
                                                                onChange={e => setForm(f => ({ ...f, zona: e.target.value }))}>
                                                                <option value="">— Sin zona —</option>
                                                                {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
                                                            </select>
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
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
