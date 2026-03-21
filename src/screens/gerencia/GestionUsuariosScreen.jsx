// src/screens/gerencia/GestionUsuariosScreen.jsx
// Gerencia: gestiona los usuarios de su empresa y sus permisos de módulos.
import { useState, useEffect, useCallback } from "react";
import { useAuth }    from "../../context/AuthContext";
import { useAppData } from "../../context/AppDataContext";
import {
    MODULOS_DEF, PERFILES, ROLE_LABELS, ROLE_COLORS, ROLE_ICONS,
    ROLES_CREABLES_POR,
} from "../../config/roles";
import "./GestionUsuariosScreen.css";

// ── Helpers ──────────────────────────────────────────────────────────────────

// Módulos que el usuario puede ver/editar = empresa habilitó && pertenecen al rol
function modulosDisponibles(empresaModulos, rol) {
    const grupo = MODULOS_DEF.find(g => g.rol === rol);
    if (!grupo) return [];
    return grupo.modulos.filter(m => empresaModulos?.[m.key] !== false);
}

// Estado actual de permisos de un usuario (default: true si no bloqueado explícitamente)
function permisosActuales(u, empresaModulos) {
    const pm = u.permisosModulos ?? {};
    const grupo = MODULOS_DEF.find(g => g.rol === (u.rol ?? "vigilador"));
    const mods = grupo?.modulos ?? [];
    return Object.fromEntries(
        mods
            .filter(m => empresaModulos?.[m.key] !== false)
            .map(m => [m.key, pm[m.key] !== false])
    );
}

// ── Sub-componente: formulario de edición de usuario ─────────────────────────
function FormEdicionUsuario({ u, empresaModulos, rolesCreables, onGuardar, onCancelar }) {
    const rolActual  = u.rol ?? "vigilador";
    const [rol,      setRol]      = useState(rolActual);
    const [activo,   setActivo]   = useState(u.activo !== false);
    const [permisos, setPermisos] = useState(() => permisosActuales(u, empresaModulos));
    const [guardando, setGuardando] = useState(false);
    const [msg,       setMsg]       = useState(null);

    // Cuando cambia el rol, recalcular permisos
    const cambiarRol = (nuevoRol) => {
        setRol(nuevoRol);
        const grupo = MODULOS_DEF.find(g => g.rol === nuevoRol);
        const mods  = grupo?.modulos ?? [];
        const pm    = u.permisosModulos ?? {};
        setPermisos(Object.fromEntries(
            mods
                .filter(m => empresaModulos?.[m.key] !== false)
                .map(m => [m.key, pm[m.key] !== false])
        ));
    };

    const mods = modulosDisponibles(empresaModulos, rol);

    const toggleMod = (key) =>
        setPermisos(p => ({ ...p, [key]: !p[key] }));

    const aplicarPerfil = (perfil) => {
        const pm = perfil.modulos;
        setPermisos(prev => {
            const next = { ...prev };
            for (const k of Object.keys(next)) {
                if (pm[k] !== undefined && empresaModulos?.[k] !== false) {
                    next[k] = pm[k];
                }
            }
            return next;
        });
    };

    const perfilesRol = PERFILES[rol] ?? [];

    const guardar = async () => {
        setGuardando(true);
        setMsg(null);
        try {
            await onGuardar(u.uid, { rol, activo, permisosModulos: permisos });
        } catch (e) {
            setMsg("❌ " + e.message);
            setGuardando(false);
        }
    };

    return (
        <div className="gu-form">
            {/* Rol */}
            <div className="gu-form-row">
                <label className="gu-label">Rol</label>
                <div className="gu-roles-grid">
                    {rolesCreables.map(r => (
                        <label key={r} className={`gu-role-chip ${rol === r ? "gu-role-chip--on" : ""}`}>
                            <input type="radio" name={`rol_${u.uid}`} value={r}
                                checked={rol === r} onChange={() => cambiarRol(r)} />
                            <span>{ROLE_ICONS[r]} {ROLE_LABELS[r]}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Perfiles predefinidos */}
            {perfilesRol.length > 0 && (
                <div className="gu-form-row">
                    <label className="gu-label">Perfil rápido</label>
                    <div className="gu-perfiles">
                        {perfilesRol.map(p => (
                            <button key={p.id} className="gu-perfil-btn" onClick={() => aplicarPerfil(p)} title={p.desc}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Módulos */}
            {mods.length > 0 && (
                <div className="gu-form-row">
                    <label className="gu-label">Módulos</label>
                    <div className="gu-mods-grid">
                        {mods.map(m => (
                            <label key={m.key} className={`gu-mod-check ${permisos[m.key] ? "gu-mod-check--on" : ""}`}>
                                <input type="checkbox" checked={!!permisos[m.key]}
                                    onChange={() => toggleMod(m.key)} />
                                <span className="gu-mod-icon">{m.icon}</span>
                                <span>{m.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Estado */}
            <div className="gu-form-row gu-form-row--inline">
                <label className="gu-label">Estado</label>
                <label className="gu-toggle">
                    <input type="checkbox" checked={activo}
                        onChange={e => setActivo(e.target.checked)} />
                    <span className={`gu-toggle-label ${activo ? "gu-toggle-label--on" : ""}`}>
                        {activo ? "✅ Activo" : "🚫 Inactivo"}
                    </span>
                </label>
            </div>

            {msg && <div className="gu-msg gu-msg--err">{msg}</div>}

            <div className="gu-form-actions">
                <button className="gu-btn-save" onClick={guardar} disabled={guardando}>
                    {guardando ? "Guardando…" : "💾 Guardar"}
                </button>
                <button className="gu-btn-cancel" onClick={onCancelar}>Cancelar</button>
            </div>
        </div>
    );
}

// ── Sub-componente: modal de nuevo usuario ────────────────────────────────────
function ModalNuevoUsuario({ empresaId, empresaModulos, rolesCreables, onCrear, onCerrar }) {
    const [form, setForm] = useState({
        nombre: "", email: "", password: "", rol: rolesCreables[0] ?? "vigilador",
    });
    const [creando, setCreando] = useState(false);
    const [msg,     setMsg]     = useState(null);

    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const crear = async () => {
        if (!form.nombre.trim()) return setMsg("El nombre es obligatorio.");
        if (!form.email.trim())  return setMsg("El email es obligatorio.");
        if (form.password.length < 6) return setMsg("La contraseña debe tener al menos 6 caracteres.");
        setCreando(true);
        setMsg(null);
        try {
            await onCrear({
                nombre:   form.nombre.trim(),
                email:    form.email.trim(),
                password: form.password,
                rol:      form.rol,
                empresaId,
            });
            onCerrar();
        } catch (e) {
            setMsg("❌ " + e.message);
            setCreando(false);
        }
    };

    return (
        <div className="gu-modal-overlay" onClick={e => e.target === e.currentTarget && onCerrar()}>
            <div className="gu-modal">
                <div className="gu-modal-header">
                    <span className="gu-modal-titulo">➕ Nuevo usuario</span>
                    <button className="gu-modal-cerrar" onClick={onCerrar}>✕</button>
                </div>

                <div className="gu-modal-body">
                    <div className="gu-form-row">
                        <label className="gu-label">Nombre completo</label>
                        <input className="gu-input" placeholder="Nombre y apellido"
                            value={form.nombre} onChange={e => upd("nombre", e.target.value)} />
                    </div>
                    <div className="gu-form-row">
                        <label className="gu-label">Email</label>
                        <input className="gu-input" type="email" placeholder="usuario@empresa.com"
                            value={form.email} onChange={e => upd("email", e.target.value)} />
                    </div>
                    <div className="gu-form-row">
                        <label className="gu-label">Contraseña inicial</label>
                        <input className="gu-input" type="password" placeholder="Mínimo 6 caracteres"
                            value={form.password} onChange={e => upd("password", e.target.value)} />
                    </div>
                    <div className="gu-form-row">
                        <label className="gu-label">Rol</label>
                        <div className="gu-roles-grid">
                            {rolesCreables.map(r => (
                                <label key={r} className={`gu-role-chip ${form.rol === r ? "gu-role-chip--on" : ""}`}>
                                    <input type="radio" name="nuevo_rol" value={r}
                                        checked={form.rol === r} onChange={() => upd("rol", r)} />
                                    <span>{ROLE_ICONS[r]} {ROLE_LABELS[r]}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {msg && <div className="gu-msg gu-msg--err">{msg}</div>}
                </div>

                <div className="gu-modal-footer">
                    <button className="gu-btn-save" onClick={crear} disabled={creando}>
                        {creando ? "Creando…" : "✅ Crear usuario"}
                    </button>
                    <button className="gu-btn-cancel" onClick={onCerrar}>Cancelar</button>
                </div>
            </div>
        </div>
    );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function GestionUsuariosScreen({ onBack }) {
    const { user, listarUsuarios, actualizarUsuario, crearUsuario, rolesCreables } = useAuth();
    const { empresaModulos } = useAppData();

    const [usuarios,     setUsuarios]     = useState([]);
    const [loading,      setLoading]      = useState(true);
    const [editando,     setEditando]     = useState(null);   // uid en edición
    const [msgGlobal,    setMsgGlobal]    = useState(null);
    const [modalNuevo,   setModalNuevo]   = useState(false);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const lista = await listarUsuarios(user.empresaId);
            setUsuarios(lista.sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? "")));
        } finally {
            setLoading(false);
        }
    }, [listarUsuarios, user.empresaId]);

    useEffect(() => { cargar(); }, [cargar]);

    const guardarUsuario = async (uid, datos) => {
        await actualizarUsuario(uid, datos);
        setUsuarios(prev => prev.map(u => u.uid === uid ? { ...u, ...datos } : u));
        setEditando(null);
        setMsgGlobal({ ok: true, txt: "✅ Usuario actualizado" });
        setTimeout(() => setMsgGlobal(null), 2500);
    };

    const crearNuevo = async (datos) => {
        await crearUsuario(datos);
        await cargar();
        setMsgGlobal({ ok: true, txt: "✅ Usuario creado correctamente" });
        setTimeout(() => setMsgGlobal(null), 2500);
    };

    const activos   = usuarios.filter(u => u.activo !== false);
    const inactivos = usuarios.filter(u => u.activo === false);

    if (loading) return (
        <div className="gu-loading">
            <div className="gu-spinner" /> Cargando usuarios…
        </div>
    );

    return (
        <div className="gu-root">
            <div className="gu-header">
                <div>
                    <div className="gu-titulo">👤 Usuarios de la empresa</div>
                    <div className="gu-subtitulo">{usuarios.length} usuario{usuarios.length !== 1 ? "s" : ""} · {activos.length} activo{activos.length !== 1 ? "s" : ""}</div>
                </div>
                <div className="gu-header-actions">
                    {rolesCreables.length > 0 && (
                        <button className="gu-btn-nuevo" onClick={() => setModalNuevo(true)}>
                            ➕ Nuevo usuario
                        </button>
                    )}
                    {onBack && (
                        <button className="gu-btn-back" onClick={onBack}>← Volver</button>
                    )}
                </div>
            </div>

            <p className="gu-instruccion">
                Gestioná los usuarios de tu empresa. Podés asignar roles, habilitar o deshabilitar módulos
                individuales, y aplicar perfiles predefinidos. Los módulos disponibles dependen del plan contratado.
            </p>

            {msgGlobal && (
                <div className={`gu-msg-global ${msgGlobal.ok ? "gu-msg-global--ok" : "gu-msg-global--err"}`}>
                    {msgGlobal.txt}
                </div>
            )}

            {usuarios.length === 0 ? (
                <div className="gu-empty">
                    <div className="gu-empty-icon">👤</div>
                    <div className="gu-empty-txt">No hay usuarios en esta empresa.</div>
                </div>
            ) : (
                <div className="gu-lista">
                    {[...activos, ...inactivos].map(u => {
                        const estaEditando = editando === u.uid;
                        const rol = u.rol ?? "vigilador";
                        const pm  = u.permisosModulos ?? {};
                        const mods = modulosDisponibles(empresaModulos, rol);
                        const habilitados = mods.filter(m => pm[m.key] !== false).length;

                        return (
                            <div key={u.uid} className={`gu-user-card ${estaEditando ? "gu-user-card--editing" : ""} ${u.activo === false ? "gu-user-card--inactivo" : ""}`}>
                                <div className="gu-user-info">
                                    <div className="gu-avatar">
                                        {(u.nombre ?? u.email ?? "?").charAt(0).toUpperCase()}
                                    </div>
                                    <div className="gu-user-datos">
                                        <div className="gu-user-nombre">{u.nombre ?? "—"}</div>
                                        <div className="gu-user-email">{u.email}</div>
                                        <div className="gu-user-meta">
                                            <span className={`gu-rol-badge gu-rol-badge--${ROLE_COLORS[rol] ?? "gray"}`}>
                                                {ROLE_ICONS[rol]} {ROLE_LABELS[rol] ?? rol}
                                            </span>
                                            {mods.length > 0 && (
                                                <span className="gu-mods-count">
                                                    {habilitados}/{mods.length} módulos
                                                </span>
                                            )}
                                            {u.activo === false && (
                                                <span className="gu-inactivo-tag">Inactivo</span>
                                            )}
                                        </div>
                                    </div>
                                    {!estaEditando && (
                                        <button className="gu-btn-editar"
                                            onClick={() => setEditando(u.uid)}>
                                            ✏️ Editar
                                        </button>
                                    )}
                                </div>

                                {estaEditando && (
                                    <FormEdicionUsuario
                                        u={u}
                                        empresaModulos={empresaModulos}
                                        rolesCreables={rolesCreables}
                                        onGuardar={guardarUsuario}
                                        onCancelar={() => setEditando(null)}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {modalNuevo && (
                <ModalNuevoUsuario
                    empresaId={user.empresaId}
                    empresaModulos={empresaModulos}
                    rolesCreables={rolesCreables}
                    onCrear={crearNuevo}
                    onCerrar={() => setModalNuevo(false)}
                />
            )}
        </div>
    );
}
