// src/screens/superadmin/PanelUsuarios.jsx
import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { ROLE_LABELS, ROLE_COLORS } from "../../config/roles";

const SISTEMA_KEY = "⚙️ Sistema (Super Admins)";

// Roles que se pueden asignar desde este panel (se excluye super_admin)
const ROLES_ASIGNABLES = Object.entries(ROLE_LABELS).filter(([k]) => k !== "super_admin");

const ROLES_VALIDOS = new Set(Object.keys(ROLE_LABELS));

function rolesIniciales(u) {
    const todos = Array.isArray(u.roles) && u.roles.length ? u.roles : (u.rol ? [u.rol] : ["vigilador"]);
    const filtrados = todos.filter(r => ROLES_VALIDOS.has(r));
    return filtrados.length ? filtrados : ["vigilador"];
}

export default function PanelUsuarios() {
    const [usuarios,     setUsuarios]     = useState([]);
    const [empresas,     setEmpresas]     = useState({});   // { id → nombre }
    const [loading,      setLoading]      = useState(true);
    const [editando,     setEditando]     = useState(null);
    const [form,         setForm]         = useState({});
    const [guardando,    setGuardando]    = useState(false);
    const [msg,          setMsg]          = useState(null);
    const [empresasOpen, setEmpresasOpen] = useState({});

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
