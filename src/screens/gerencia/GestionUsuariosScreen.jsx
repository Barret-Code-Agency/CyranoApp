// src/screens/gerencia/GestionUsuariosScreen.jsx
// Gerencia: gestiona los usuarios de su empresa y sus permisos de módulos.
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth }    from "../../context/AuthContext";
import { useAppData } from "../../context/AppDataContext";
import {
    MODULOS_DEF, PERFILES, ROLE_LABELS, ROLE_COLORS, ROLE_ICONS,
    ROLES_CREABLES_POR,
} from "../../config/roles";
import { collection, query, where, getDocs, updateDoc, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import "../administrativo/GestionDatosAdminScreen.css";

// ── Helpers ──────────────────────────────────────────────────────────────────

// Módulos que el usuario puede ver/editar = empresa habilitó && pertenecen al rol
function modulosDisponibles(empresaModulos, rol) {
    const grupo = MODULOS_DEF.find(g => g.rol === rol);
    if (!grupo) return [];
    return grupo.modulos.filter(m => empresaModulos?.[m.key] !== false);
}

// Estado actual de permisos de un usuario — incluye TODOS los módulos de todos los perfiles
function permisosActuales(u, empresaModulos) {
    const pm = u.permisosModulos ?? {};
    const todosMods = MODULOS_DEF.flatMap(g => g.modulos);
    return Object.fromEntries(
        todosMods
            .filter(m => empresaModulos?.[m.key] !== false)
            .map(m => [m.key, pm[m.key] === true])   // por defecto: desactivado salvo que esté explícitamente true
    );
}

// ── Sub-componente: formulario de edición de usuario ─────────────────────────
function FormEdicionUsuario({ u, empresaModulos, rolesCreables, onGuardar, onCancelar }) {
    const rolActual  = u.rol ?? "vigilador";
    const [rol,      setRol]      = useState(rolActual);
    const [activo,   setActivo]   = useState(u.activo !== false);
    const [zona,     setZona]     = useState(u.zona || "");
    const [permisos, setPermisos] = useState(() => permisosActuales(u, empresaModulos));
    const [guardando, setGuardando] = useState(false);
    const [msg,       setMsg]       = useState(null);

    const toggleMod = (key) =>
        setPermisos(p => ({ ...p, [key]: !p[key] }));

    const guardar = async () => {
        setGuardando(true);
        setMsg(null);
        try {
            await onGuardar(u.uid, { rol, activo, permisosModulos: permisos, zona: zona.trim() || null });
        } catch (e) {
            setMsg({ ok: false, txt: "❌ " + e.message });
            setGuardando(false);
        }
    };

    // Todos los grupos de módulos habilitados por la empresa
    const gruposVisibles = MODULOS_DEF.map(g => ({
        ...g,
        modulos: g.modulos.filter(m => empresaModulos?.[m.key] !== false),
    })).filter(g => g.modulos.length > 0);

    return (
        <tr className="gd-row--editing-inline">
            <td colSpan={6} style={{ padding: "1rem 1.2rem", background: "var(--color-primary-ghost, #f0f2ff)" }}>
                {/* Rol */}
                <div className="gd-field" style={{ marginBottom: "0.75rem" }}>
                    <label className="gd-label">Rol</label>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
                        {rolesCreables.map(r => (
                            <label key={r} style={{
                                display: "inline-flex", alignItems: "center", gap: "0.35rem",
                                padding: "0.3rem 0.75rem", borderRadius: "999px", cursor: "pointer",
                                background: rol === r ? "var(--color-primary)" : "var(--color-surface, #fff)",
                                color: rol === r ? "#fff" : "var(--color-text)",
                                border: rol === r ? "1.5px solid var(--color-primary)" : "1.5px solid var(--color-border)",
                                fontSize: "var(--text-sm)", fontWeight: 600, transition: "all 0.15s",
                            }}>
                                <input type="radio" name={`rol_${u.uid}`} value={r}
                                    checked={rol === r} onChange={() => setRol(r)}
                                    style={{ display: "none" }} />
                                {ROLE_ICONS[r]} {ROLE_LABELS[r]}
                            </label>
                        ))}
                    </div>
                </div>

                {/* Módulos */}
                <div className="gd-field" style={{ marginBottom: "0.75rem" }}>
                    <label className="gd-label">Accesos</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginTop: "0.3rem" }}>
                        {gruposVisibles.map(g => (
                            <div key={g.rol}>
                                <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-text-secondary)", marginBottom: "0.3rem", textTransform: "uppercase" }}>
                                    {g.grupo}
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                                    {g.modulos.map(m => (
                                        <label key={m.key} style={{
                                            display: "inline-flex", alignItems: "center", gap: "0.3rem",
                                            padding: "0.25rem 0.6rem", borderRadius: "7px", cursor: "pointer",
                                            background: permisos[m.key] ? "var(--color-primary)" : "#fff",
                                            color: permisos[m.key] ? "#fff" : "var(--color-text)",
                                            border: permisos[m.key] ? "1.5px solid var(--color-primary)" : "1.5px solid var(--color-border)",
                                            fontSize: "var(--text-xs)", fontWeight: 500, transition: "all 0.15s",
                                        }}>
                                            <input type="checkbox" checked={!!permisos[m.key]}
                                                onChange={() => toggleMod(m.key)}
                                                style={{ display: "none" }} />
                                            {m.icon} {m.label}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Zona */}
                <div className="gd-field" style={{ marginBottom: "0.75rem", maxWidth: 320 }}>
                    <label className="gd-label">Zona</label>
                    <input className="gd-input" placeholder="Ej: Santa Cruz, Buenos Aires… (vacío = todas)"
                        value={zona} onChange={e => setZona(e.target.value)} />
                </div>

                {/* Estado */}
                <div className="gd-field" style={{ marginBottom: "0.75rem" }}>
                    <label className="gd-label">Estado</label>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                        <input type="checkbox" checked={activo}
                            onChange={e => setActivo(e.target.checked)} />
                        <span style={{
                            fontSize: "var(--text-sm)", fontWeight: 600,
                            color: activo ? "#2e7d32" : "#c62828",
                        }}>
                            {activo ? "✅ Activo" : "🚫 Inactivo"}
                        </span>
                    </label>
                </div>

                {msg && (
                    <div className={`gd-msg ${msg.ok ? "gd-msg--ok" : "gd-msg--err"}`} style={{ marginBottom: "0.75rem" }}>
                        {msg.txt}
                    </div>
                )}

                <div className="gd-form-actions" style={{ paddingTop: "0.75rem", marginTop: 0 }}>
                    <button className="gd-btn-save" onClick={guardar} disabled={guardando} style={{ maxWidth: 160 }}>
                        {guardando ? "Guardando…" : "💾 Guardar"}
                    </button>
                    <button className="gd-btn-cancel" onClick={onCancelar}>Cancelar</button>
                </div>
            </td>
        </tr>
    );
}

// ── Lista de zonas ────────────────────────────────────────────────────────────
const ZONAS = [
    "Todas las zonas",
    "CABA Norte", "CABA Sur", "CABA Centro",
    "GBA Norte", "GBA Sur", "Buenos Aires Interior",
    "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes",
    "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza",
    "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis",
    "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán",
];

// ── Sub-componente: modal de nuevo usuario ────────────────────────────────────
function ModalNuevoUsuario({ empresaId, empresaModulos, rolesCreables, onCrear, onCerrar }) {
    const [form, setForm] = useState({
        nombre: "", email: "", password: "", rol: rolesCreables[0] ?? "vigilador", zona: "",
    });
    const [creando, setCreando] = useState(false);
    const [msg,     setMsg]     = useState(null);

    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const crear = async () => {
        if (!form.nombre.trim()) return setMsg({ ok: false, txt: "El nombre es obligatorio." });
        if (!form.email.trim())  return setMsg({ ok: false, txt: "El email es obligatorio." });
        if (form.password.length < 6) return setMsg({ ok: false, txt: "La contraseña debe tener al menos 6 caracteres." });
        setCreando(true);
        setMsg(null);
        try {
            await onCrear({
                nombre:   form.nombre.trim(),
                email:    form.email.trim(),
                password: form.password,
                rol:      form.rol,
                zona:     form.zona.trim() || null,
                empresaId,
            });
            onCerrar();
        } catch (e) {
            setMsg({ ok: false, txt: "❌ " + e.message });
            setCreando(false);
        }
    };

    return (
        <div className="gd-overlay" onClick={e => e.target === e.currentTarget && onCerrar()}>
            <div className="gd-import-modal">
                <div className="gd-import-modal-header">
                    <span>➕ Nuevo usuario</span>
                    <button className="gd-import-modal-close" onClick={onCerrar}>✕</button>
                </div>

                <div className="gd-import-modal-body">
                    <div className="gd-field">
                        <label className="gd-label">Nombre completo *</label>
                        <input className="gd-input" placeholder="Nombre y apellido"
                            value={form.nombre} onChange={e => upd("nombre", e.target.value)} />
                    </div>
                    <div className="gd-field">
                        <label className="gd-label">Email *</label>
                        <input className="gd-input" type="email" placeholder="usuario@empresa.com"
                            value={form.email} onChange={e => upd("email", e.target.value)} />
                    </div>
                    <div className="gd-field">
                        <label className="gd-label">Contraseña inicial *</label>
                        <input className="gd-input" type="password" placeholder="Mínimo 6 caracteres"
                            value={form.password} onChange={e => upd("password", e.target.value)} />
                    </div>
                    <div className="gd-field">
                        <label className="gd-label">Rol</label>
                        <select className="gd-input" value={form.rol} onChange={e => upd("rol", e.target.value)}>
                            {rolesCreables.map(r => (
                                <option key={r} value={r}>{ROLE_ICONS[r]} {ROLE_LABELS[r]}</option>
                            ))}
                        </select>
                    </div>
                    <div className="gd-field">
                        <label className="gd-label">Zona</label>
                        <select className="gd-input" value={form.zona} onChange={e => upd("zona", e.target.value)}>
                            <option value="">— Sin zona —</option>
                            {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
                        </select>
                    </div>

                    {msg && <div className={`gd-msg ${msg.ok ? "gd-msg--ok" : "gd-msg--err"}`}>{msg.txt}</div>}
                </div>

                <div className="gd-import-modal-footer" style={{
                    display: "flex", gap: "0.75rem", padding: "0.9rem 1.2rem",
                    borderTop: "1px solid var(--color-border)", flexShrink: 0,
                }}>
                    <button className="gd-btn-save" onClick={crear} disabled={creando}>
                        {creando ? "Creando…" : "✅ Crear usuario"}
                    </button>
                    <button className="gd-btn-cancel" onClick={onCerrar}>Cancelar</button>
                </div>
            </div>
        </div>
    );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function GestionUsuariosScreen({ onBack }) {
    const { user, listarUsuarios, actualizarUsuario, crearUsuario, resetPassword, rolesCreables } = useAuth();
    const { empresaModulos } = useAppData();

    const [usuarios,      setUsuarios]      = useState([]);
    const [loading,       setLoading]       = useState(true);
    const [editando,      setEditando]      = useState(null);
    const [msgGlobal,     setMsgGlobal]     = useState(null);
    const [modalNuevo,    setModalNuevo]    = useState(false);
    const [modalVincular, setModalVincular] = useState(false);
    const [reseteando,    setReseteando]    = useState(null);
    const [filtro,        setFiltro]        = useState("");
    const msgTimer = useRef(null);

    // Form vincular Auth existente
    const VINCULAR_VACIO = { uid: "", nombre: "", email: "", rol: rolesCreables[0] ?? "vigilador", zona: "" };
    const [formVincular,  setFormVincular]  = useState(VINCULAR_VACIO);
    const [vinculandoAuth, setVinculandoAuth] = useState(false);
    const [msgVincular,   setMsgVincular]   = useState(null);

    const showMsg = useCallback((msg, ms = 2500) => {
        if (msgTimer.current) clearTimeout(msgTimer.current);
        setMsgGlobal(msg);
        msgTimer.current = setTimeout(() => setMsgGlobal(null), ms);
    }, []);

    useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current); }, []);

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
        showMsg({ ok: true, txt: "✅ Usuario actualizado" });
    };

    const handleResetPassword = async (u) => {
        if (!window.confirm(`¿Enviar email de reseteo de contraseña a ${u.email}?`)) return;
        setReseteando(u.uid);
        try {
            await resetPassword(u.email);
            showMsg({ ok: true, txt: `✅ Email de reseteo enviado a ${u.email}` }, 3000);
        } catch (e) {
            showMsg({ ok: false, txt: "❌ " + e.message });
        } finally {
            setReseteando(null);
        }
    };

    const crearNuevo = async (datos) => {
        await crearUsuario(datos);

        // Punto 2 — vincular email al legajo correspondiente (búsqueda por nombre)
        try {
            const legSnap = await getDocs(query(
                collection(db, "legajos"),
                where("empresaId", "==", datos.empresaId),
                where("nombre",    "==", datos.nombre),
            ));
            if (!legSnap.empty) {
                // Puede haber más de un legajo con el mismo nombre; actualizamos el primero
                const legDoc = legSnap.docs[0];
                if (!legDoc.data().email) {
                    await updateDoc(doc(db, "legajos", legDoc.id), { email: datos.email });
                }
            }
        } catch (_) {
            // Vinculación opcional — no interrumpir el alta de usuario si falla
        }

        await cargar();
        showMsg({ ok: true, txt: "✅ Usuario creado correctamente" });
    };

    // ── Vincular Auth existente por UID ──────────────────────────────────────
    const vincularAuthExistente = async () => {
        const { uid, nombre, email, rol, zona } = formVincular;
        if (!uid.trim() || !nombre.trim() || !email.trim()) {
            setMsgVincular({ ok: false, txt: "UID, nombre y email son obligatorios." });
            return;
        }
        setVinculandoAuth(true);
        setMsgVincular(null);
        try {
            await setDoc(doc(db, "usuarios", uid.trim()), {
                nombre:       nombre.trim(),
                email:        email.trim(),
                rol,
                roles:        [rol],
                empresaId:    user.empresaId,
                zona:         zona.trim() || null,
                activo:       true,
                creadoEn:     serverTimestamp(),
                ultimoAcceso: null,
            });
            setMsgVincular({ ok: true, txt: "✅ Usuario vinculado correctamente" });
            await cargar();
            setTimeout(() => { setModalVincular(false); setFormVincular(VINCULAR_VACIO); setMsgVincular(null); }, 1400);
        } catch (e) {
            setMsgVincular({ ok: false, txt: "❌ " + e.message });
        } finally {
            setVinculandoAuth(false);
        }
    };

    // ── Vincular emails masivamente ───────────────────────────────────────────
    const [vinculando,    setVinculando]    = useState(false);
    const [resVinculacion, setResVinculacion] = useState(null);

    const vincularTodos = async () => {
        if (!window.confirm(
            "Esto buscará el legajo de cada usuario por nombre y escribirá su email donde falte.\n¿Continuar?"
        )) return;
        setVinculando(true);
        setResVinculacion(null);
        try {
            const legSnap = await getDocs(query(
                collection(db, "legajos"),
                where("empresaId", "==", user.empresaId),
            ));
            const legajos = legSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            let vinculados = 0, sinLegajo = 0, yaVinculados = 0;
            await Promise.all(usuarios.map(async u => {
                if (!u.email || !u.nombre) return;
                const leg = legajos.find(l => l.nombre === u.nombre);
                if (!leg) { sinLegajo++; return; }
                if (leg.email) { yaVinculados++; return; }
                await updateDoc(doc(db, "legajos", leg.id), { email: u.email });
                vinculados++;
            }));
            setResVinculacion({ vinculados, sinLegajo, yaVinculados });
        } catch (e) {
            showMsg({ ok: false, txt: "❌ Error: " + e.message });
        } finally {
            setVinculando(false);
        }
    };

    // ── Borrar usuario ────────────────────────────────────────────────────────
    const [confirmBorrar, setConfirmBorrar] = useState(null); // usuario a borrar
    const [borrando,      setBorrando]      = useState(false);

    const handleBorrar = async () => {
        if (!confirmBorrar) return;
        setBorrando(true);
        try {
            await deleteDoc(doc(db, "usuarios", confirmBorrar.uid));
            setUsuarios(prev => prev.filter(u => u.uid !== confirmBorrar.uid));
            setConfirmBorrar(null);
            showMsg({ ok: true, txt: `✅ Usuario ${confirmBorrar.nombre ?? confirmBorrar.email} eliminado del sistema` });
        } catch (e) {
            showMsg({ ok: false, txt: "❌ Error al borrar: " + e.message });
        } finally {
            setBorrando(false);
        }
    };

    // ── Filtrado por nombre o email ───────────────────────────────────────────
    const usuariosFiltrados = useMemo(() => {
        const activos   = usuarios.filter(u => u.activo !== false);
        const inactivos = usuarios.filter(u => u.activo === false);
        const lista = [...activos, ...inactivos];
        if (!filtro.trim()) return lista;
        const q = filtro.toLowerCase();
        return lista.filter(u =>
            (u.nombre ?? "").toLowerCase().includes(q) ||
            (u.email  ?? "").toLowerCase().includes(q)
        );
    }, [usuarios, filtro]);

    if (loading) return (
        <div className="gd-page">
            <div className="gd-root">
                <div className="gd-empty">⏳ Cargando usuarios…</div>
            </div>
        </div>
    );

    return (
        <div className="gd-page">
            <div className="gd-root">

                {/* ── Panel header (barra azul) ── */}
                <div className="gd-panel-header">
                    {onBack && (
                        <button className="gd-panel-back" onClick={onBack}>
                            ← Volver al panel
                        </button>
                    )}
                    <span className="gd-panel-titulo">👥 Usuarios del sistema</span>
                    <span className="gd-panel-sub">
                        {usuarios.length} usuario{usuarios.length !== 1 ? "s" : ""}
                    </span>
                </div>

                {/* ── Mensajes globales ── */}
                {msgGlobal && (
                    <div className={`gd-msg ${msgGlobal.ok ? "gd-msg--ok" : "gd-msg--err"}`}
                        style={{ margin: "0.5rem 1rem 0" }}>
                        {msgGlobal.txt}
                    </div>
                )}

                {resVinculacion && (
                    <div className="gd-msg gd-msg--ok" style={{ margin: "0.5rem 1rem 0" }}>
                        ✅ {resVinculacion.vinculados} vinculado{resVinculacion.vinculados !== 1 ? "s" : ""}
                        {resVinculacion.yaVinculados > 0 && ` · ${resVinculacion.yaVinculados} ya tenían email`}
                        {resVinculacion.sinLegajo    > 0 && ` · ${resVinculacion.sinLegajo} sin legajo encontrado`}
                    </div>
                )}

                {/* ── Toolbar ── */}
                <div className="gd-toolbar">
                    <input
                        className="gd-filtro"
                        placeholder="🔍 Filtrar por nombre o email…"
                        value={filtro}
                        onChange={e => setFiltro(e.target.value)}
                        autoComplete="off"
                    />
                    <span className="gd-count-badge">
                        {usuariosFiltrados.length} / {usuarios.length}
                    </span>
                    <button
                        className="gd-btn-import-excel"
                        onClick={() => { setFormVincular(VINCULAR_VACIO); setMsgVincular(null); setModalVincular(true); }}
                        title="Registrar un usuario que ya existe en Firebase Auth"
                    >
                        🔗 Vincular Auth
                    </button>
                    <button
                        className="gd-btn-import-excel"
                        onClick={vincularTodos}
                        disabled={vinculando}
                        title="Escribe el email en los legajos que aún no lo tienen"
                    >
                        {vinculando ? "Vinculando…" : "📧 Vincular emails"}
                    </button>
                    <button className="gd-btn-nuevo" onClick={() => setModalNuevo(true)}>
                        + Nuevo usuario
                    </button>
                </div>

                {/* ── Tabla de usuarios ── */}
                <div className="gd-table-wrap">
                    {usuariosFiltrados.length === 0 && usuarios.length > 0 ? (
                        <div className="gd-empty">Sin resultados para "{filtro}".</div>
                    ) : usuariosFiltrados.length === 0 ? (
                        <div className="gd-empty">
                            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>👤</div>
                            No hay usuarios en esta empresa.
                        </div>
                    ) : (
                        <table className="gd-table">
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Email</th>
                                    <th>Rol</th>
                                    <th>Zona</th>
                                    <th>Estado</th>
                                    <th className="gd-th-accion"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {usuariosFiltrados.map(u => {
                                    const estaEditando = editando === u.uid;
                                    const roles = Array.isArray(u.roles) && u.roles.length ? u.roles : [u.rol ?? "vigilador"];

                                    return (
                                        <>
                                            <tr
                                                key={u.uid}
                                                className="gd-row"
                                                style={u.activo === false ? { opacity: 0.55 } : undefined}
                                                onClick={() => setEditando(estaEditando ? null : u.uid)}
                                            >
                                                <td data-label="Nombre">
                                                    <span style={{ fontWeight: 700, color: "var(--color-primary)" }}>
                                                        {(u.nombre ?? u.email ?? "?").charAt(0).toUpperCase()}
                                                    </span>
                                                    {" "}{u.nombre ?? "—"}
                                                </td>
                                                <td data-label="Email">{u.email ?? "—"}</td>
                                                <td data-label="Rol">
                                                    {roles.map(r => (
                                                        <span key={r} style={{
                                                            display: "inline-block",
                                                            fontSize: "0.7rem",
                                                            fontWeight: 700,
                                                            padding: "0.15rem 0.5rem",
                                                            borderRadius: "999px",
                                                            marginRight: "0.25rem",
                                                            background: ROLE_COLORS[r] === "blue"   ? "#e3f0ff" :
                                                                        ROLE_COLORS[r] === "green"  ? "#e8f5e9" :
                                                                        ROLE_COLORS[r] === "orange" ? "#fff3e0" :
                                                                        ROLE_COLORS[r] === "red"    ? "#ffebee" :
                                                                        ROLE_COLORS[r] === "purple" ? "#f3e5f5" :
                                                                        "#f0f2ff",
                                                            color: ROLE_COLORS[r] === "blue"   ? "#1565c0" :
                                                                   ROLE_COLORS[r] === "green"  ? "#2e7d32" :
                                                                   ROLE_COLORS[r] === "orange" ? "#e65100" :
                                                                   ROLE_COLORS[r] === "red"    ? "#c62828" :
                                                                   ROLE_COLORS[r] === "purple" ? "#6a1b9a" :
                                                                   "var(--color-primary)",
                                                        }}>
                                                            {ROLE_LABELS[r] ?? r}
                                                        </span>
                                                    ))}
                                                </td>
                                                <td data-label="Zona">
                                                    {u.zona
                                                        ? <span>📍 {u.zona}</span>
                                                        : <span className="gd-empty-cell">—</span>
                                                    }
                                                </td>
                                                <td data-label="Estado">
                                                    {u.activo === false
                                                        ? <span style={{ color: "#c62828", fontWeight: 600, fontSize: "0.75rem" }}>Inactivo</span>
                                                        : <span style={{ color: "#2e7d32", fontWeight: 600, fontSize: "0.75rem" }}>Activo</span>
                                                    }
                                                </td>
                                                <td className="gd-td-accion" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        className="gd-row-btn gd-row-btn--edit"
                                                        title="Editar"
                                                        onClick={() => setEditando(estaEditando ? null : u.uid)}
                                                    >✏️</button>
                                                    <button
                                                        className="gd-row-btn"
                                                        title="Reset contraseña"
                                                        disabled={reseteando === u.uid}
                                                        onClick={() => handleResetPassword(u)}
                                                    >
                                                        {reseteando === u.uid ? "⏳" : "🔑"}
                                                    </button>
                                                    <button
                                                        className="gd-row-btn gd-row-btn--del"
                                                        title="Eliminar usuario"
                                                        onClick={() => setConfirmBorrar(u)}
                                                    >🗑️</button>
                                                </td>
                                            </tr>
                                            {estaEditando && (
                                                <FormEdicionUsuario
                                                    key={`edit-${u.uid}`}
                                                    u={u}
                                                    empresaModulos={empresaModulos}
                                                    rolesCreables={rolesCreables}
                                                    onGuardar={guardarUsuario}
                                                    onCancelar={() => setEditando(null)}
                                                />
                                            )}
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ── Modal: Nuevo usuario ── */}
                {modalNuevo && (
                    <ModalNuevoUsuario
                        empresaId={user.empresaId}
                        empresaModulos={empresaModulos}
                        rolesCreables={rolesCreables}
                        onCrear={crearNuevo}
                        onCerrar={() => setModalNuevo(false)}
                    />
                )}

                {/* ── Modal: Vincular Auth existente ── */}
                {modalVincular && (
                    <div className="gd-overlay" onClick={e => e.target === e.currentTarget && setModalVincular(false)}>
                        <div className="gd-import-modal">
                            <div className="gd-import-modal-header">
                                <span>🔗 Vincular usuario Auth existente</span>
                                <button className="gd-import-modal-close" onClick={() => setModalVincular(false)}>✕</button>
                            </div>

                            <div className="gd-import-modal-body">
                                <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", margin: 0 }}>
                                    Usá esto cuando el usuario ya tiene cuenta en Firebase Auth (puede iniciar sesión)
                                    pero no aparece en la lista. Pegá su UID desde Firebase Console → Authentication.
                                </p>

                                <div className="gd-field">
                                    <label className="gd-label">UID del usuario *</label>
                                    <input className="gd-input" type="text" placeholder="ej: HgYTJv1YzsTH…"
                                        value={formVincular.uid}
                                        onChange={e => setFormVincular(f => ({ ...f, uid: e.target.value }))} />
                                </div>
                                <div className="gd-field">
                                    <label className="gd-label">Nombre completo *</label>
                                    <input className="gd-input" type="text"
                                        value={formVincular.nombre}
                                        onChange={e => setFormVincular(f => ({ ...f, nombre: e.target.value }))} />
                                </div>
                                <div className="gd-field">
                                    <label className="gd-label">Email *</label>
                                    <input className="gd-input" type="email"
                                        value={formVincular.email}
                                        onChange={e => setFormVincular(f => ({ ...f, email: e.target.value }))} />
                                </div>
                                <div className="gd-field">
                                    <label className="gd-label">Rol</label>
                                    <select className="gd-input" value={formVincular.rol}
                                        onChange={e => setFormVincular(f => ({ ...f, rol: e.target.value }))}>
                                        {rolesCreables.map(r => (
                                            <option key={r} value={r}>{ROLE_ICONS[r]} {ROLE_LABELS[r]}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="gd-field">
                                    <label className="gd-label">Zona</label>
                                    <select className="gd-input" value={formVincular.zona}
                                        onChange={e => setFormVincular(f => ({ ...f, zona: e.target.value }))}>
                                        <option value="">— Sin zona —</option>
                                        {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
                                    </select>
                                </div>

                                {msgVincular && (
                                    <div className={`gd-msg ${msgVincular.ok ? "gd-msg--ok" : "gd-msg--err"}`}>
                                        {msgVincular.txt}
                                    </div>
                                )}
                            </div>

                            <div style={{
                                display: "flex", gap: "0.75rem", padding: "0.9rem 1.2rem",
                                borderTop: "1px solid var(--color-border)", flexShrink: 0,
                            }}>
                                <button className="gd-btn-save" onClick={vincularAuthExistente} disabled={vinculandoAuth}>
                                    {vinculandoAuth ? "Vinculando…" : "🔗 Vincular"}
                                </button>
                                <button className="gd-btn-cancel" onClick={() => setModalVincular(false)}>Cancelar</button>
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {/* ── Modal: Confirmar borrado ── */}
            {confirmBorrar && (
                <div className="gd-overlay" onClick={e => { if (!borrando && e.target === e.currentTarget) setConfirmBorrar(null); }}>
                    <div className="gd-import-modal" style={{ maxWidth: 420 }}>
                        <div className="gd-import-modal-header" style={{ background: "#ffebee" }}>
                            <span style={{ color: "#c62828" }}>🗑️ Eliminar usuario</span>
                            <button className="gd-import-modal-close" onClick={() => !borrando && setConfirmBorrar(null)}>✕</button>
                        </div>
                        <div className="gd-import-modal-body" style={{ gap: "0.6rem" }}>
                            <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-text)" }}>
                                ¿Estás seguro de que querés eliminar a{" "}
                                <strong>{confirmBorrar.nombre ?? confirmBorrar.email}</strong> del sistema?
                            </p>
                            <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "#c62828" }}>
                                ⚠️ Esta acción borra el registro de Firestore. La cuenta de Firebase Auth permanece
                                y puede seguir iniciando sesión hasta que sea deshabilitada desde la consola.
                            </p>
                        </div>
                        <div style={{
                            display: "flex", gap: "0.75rem", padding: "0.9rem 1.2rem",
                            borderTop: "1px solid var(--color-border)", flexShrink: 0,
                        }}>
                            <button
                                className="gd-btn-save"
                                style={{ background: "#c62828", borderColor: "#c62828" }}
                                onClick={handleBorrar}
                                disabled={borrando}
                            >
                                {borrando ? "Eliminando…" : "🗑️ Sí, eliminar"}
                            </button>
                            <button className="gd-btn-cancel" onClick={() => setConfirmBorrar(null)} disabled={borrando}>
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
