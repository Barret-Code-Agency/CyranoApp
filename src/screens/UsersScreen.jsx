// src/screens/UsersScreen.jsx
// Panel del admin para crear, ver, desactivar y resetear contraseñas
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useAppData } from "../context/AppDataContext";
import "../styles/UsersScreen.css";

const ROL_LABEL = { admin: "Administrador", operator: "Supervisor/Analista" };
const ROL_COLOR = { admin: "red", operator: "blue" };

// ── Formulario nuevo usuario ──────────────────────────────────────────────────
function NuevoUsuarioForm({ onCreated, onCancel }) {
    const { crearUsuario } = useAuth();
    const [form, setForm]   = useState({ nombre: "", email: "", password: "", rol: "operator" });
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState("");
    const [showPass, setShowPass] = useState(false);

    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = async () => {
        if (!form.nombre.trim()) return setError("Ingresá el nombre completo.");
        if (!form.email.includes("@")) return setError("Email inválido.");
        if (form.password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
        setError(""); setLoading(true);
        try {
            await crearUsuario(form);
            onCreated(form.nombre);
        } catch (e) {
            setError(e.message.includes("email-already-in-use")
                ? "Ese email ya está registrado."
                : e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="usr-form">
            <div className="usr-form-title">Nuevo usuario</div>

            <div className="field">
                <label className="label">Nombre completo</label>
                <input
                    type="text"
                    placeholder="Fernando Hector Delgado"
                    value={form.nombre}
                    onChange={e => set("nombre", e.target.value)}
                />
            </div>

            <div className="field">
                <label className="label">Email (será su usuario de acceso)</label>
                <input
                    type="email"
                    placeholder="fdelgado@empresa.com"
                    value={form.email}
                    onChange={e => set("email", e.target.value)}
                />
            </div>

            <div className="field">
                <label className="label">Contraseña inicial</label>
                <div className="input-wrap">
                    <input
                        type={showPass ? "text" : "password"}
                        placeholder="Mínimo 6 caracteres"
                        value={form.password}
                        onChange={e => set("password", e.target.value)}
                        style={{ paddingRight: 44 }}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPass(s => !s)}
                        style={{
                            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                            background: "none", border: "none", cursor: "pointer", fontSize: 16,
                            color: "var(--color-muted)"
                        }}
                    >
                        {showPass ? "🙈" : "👁️"}
                    </button>
                </div>
                <p style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 4 }}>
                    El supervisor puede cambiarla luego desde su perfil o recibir un mail de reseteo.
                </p>
            </div>

            <div className="field">
                <label className="label">Rol</label>
                <div className="usr-rol-opts">
                    {["operator", "admin"].map(r => (
                        <button
                            key={r}
                            className={`usr-rol-btn ${form.rol === r ? "active " + ROL_COLOR[r] : ""}`}
                            onClick={() => set("rol", r)}
                        >
                            {r === "operator" ? "👤 Supervisor" : "🔐 Administrador"}
                        </button>
                    ))}
                </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" disabled={loading} onClick={handleSubmit}>
                    {loading ? <><span className="spinner" /> Creando...</> : "Crear usuario"}
                </button>
                <button className="btn btn-secondary" disabled={loading} onClick={onCancel}>
                    Cancelar
                </button>
            </div>
        </div>
    );
}


// ── Zonas disponibles ─────────────────────────────────────────────────────────
const ZONAS = ["Buenos Aires", "Santa Cruz"];

// ── Config Vista Analista (dentro de tarjeta de usuario) ──────────────────────
function AnalistaConfig({ u, onSave }) {
    const [open,       setOpen]       = useState(false);
    const [zona,       setZona]       = useState(u.zona || "");
    const [habilitado, setHabilitado] = useState(u.esAnalista === true);
    const [objSel,     setObjSel]     = useState(Array.isArray(u.objetivosVisibles) ? u.objetivosVisibles : []);
    const [vehSel,     setVehSel]     = useState(Array.isArray(u.vehiculosVisibles) ? u.vehiculosVisibles : []);
    const [supSel,     setSupSel]     = useState(Array.isArray(u.supervisoresVisibles) ? u.supervisoresVisibles : []);
    const [saving,     setSaving]     = useState(false);
    const [ok,         setOk]         = useState(false);

    const { data: appData } = useAppData();
    const objetivos    = Array.isArray(appData?.objetivos)    ? appData.objetivos    : [];
    const vehiculos    = Array.isArray(appData?.vehiculos)    ? appData.vehiculos    : [];
    const supervisores = Array.isArray(appData?.supervisores) ? appData.supervisores : [];

    const toggleArr = (arr, setArr, val) =>
        setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

    const handleSave = async () => {
        setSaving(true);
        const payload = { zona, esAnalista: habilitado, objetivosVisibles: objSel, vehiculosVisibles: vehSel, supervisoresVisibles: supSel };
        console.log("[AnalistaConfig] Guardando para uid:", u.uid, payload);
        await onSave(u.uid, payload);
        setSaving(false);
        setOk(true);
        setTimeout(() => setOk(false), 2000);
    };

    return (
        <div style={{ borderTop: "1.5px solid #f0e68c", marginTop: 10, paddingTop: 10, background: "#fffef7", borderRadius: "0 0 10px 10px", padding: "10px 12px 12px" }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12,
                    fontWeight: 700, color: "#7a5c00", display: "flex", alignItems: "center", gap: 6, width: "100%" }}
            >
                <span style={{ fontSize: 14 }}>📊</span>
                <span>Vista Analista — Configuración de zona</span>
                <span style={{ marginLeft: "auto" }}>{open ? "▲" : "▼"}</span>
                {habilitado && <span style={{ background: "#c9a227", color: "#fff", padding: "1px 8px", borderRadius: 99, fontSize: 10, fontWeight: 800 }}>ACTIVO</span>}
            </button>

            {!open && habilitado && (
                <div style={{ fontSize: 11, color: "#7a5c00", marginTop: 4 }}>
                    Zona: <strong>{zona || "—"}</strong> · {objSel.length} objetivos · {vehSel.length} vehículos asignados
                </div>
            )}

            {open && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* Habilitar */}
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600,
                        background: "#fff", border: "1.5px solid var(--color-border)", borderRadius: 8, padding: "10px 12px", cursor: "pointer" }}>
                        <input type="checkbox" checked={habilitado} onChange={e => setHabilitado(e.target.checked)}
                            style={{ width: 16, height: 16, cursor: "pointer" }} />
                        <div>
                            <div>Habilitar Vista Analista para este usuario</div>
                            <div style={{ fontSize: 11, color: "var(--color-muted)", fontWeight: 400, marginTop: 2 }}>
                                Le aparecerá el botón "📊 Vista Analista" en su dashboard personal
                            </div>
                        </div>
                    </label>

                    {habilitado && (<>
                        {/* Zona */}
                        <div style={{ background: "#fff", border: "1px solid var(--color-border)", borderRadius: 8, padding: "10px 12px" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 2 }}>ZONA GEOGRÁFICA</div>
                            <div style={{ fontSize: 11, color: "#8894ac", marginBottom: 8 }}>Define el nombre de zona que verá el usuario en su panel</div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {ZONAS.map(z => (
                                    <button key={z} onClick={() => setZona(z)}
                                        style={{ padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer",
                                            border: zona === z ? "2px solid #c9a227" : "1.5px solid var(--color-border)",
                                            background: zona === z ? "#fff8d6" : "transparent",
                                            color: zona === z ? "#7a5c00" : "var(--color-muted)" }}>
                                        {z}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Objetivos visibles */}
                        <div style={{ background: "#fff", border: "1px solid var(--color-border)", borderRadius: 8, padding: "10px 12px" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 2 }}>
                                PUESTOS / OBJETIVOS QUE PUEDE VER ({objSel.length} seleccionados)
                            </div>
                            <div style={{ fontSize: 11, color: "#8894ac", marginBottom: 8 }}>Solo verá controles realizados en estos puestos</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxHeight: 160, overflowY: "auto",
                                border: "1px solid var(--color-border)", borderRadius: 8, padding: 8 }}>
                                {objetivos.map(obj => (
                                    <button key={obj} onClick={() => toggleArr(objSel, setObjSel, obj)}
                                        style={{ padding: "3px 8px", borderRadius: 99, fontSize: 11, cursor: "pointer",
                                            border: objSel.includes(obj) ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                                            background: objSel.includes(obj) ? "var(--color-primary-xlight)" : "transparent",
                                            color: objSel.includes(obj) ? "var(--color-primary)" : "var(--color-muted)",
                                            fontWeight: objSel.includes(obj) ? 700 : 400 }}>
                                        {obj}
                                    </button>
                                ))}
                            </div>
                            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                                <button onClick={() => setObjSel(objetivos)}
                                    style={{ fontSize: 10, color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer" }}>
                                    ✓ Todos
                                </button>
                                <button onClick={() => setObjSel([])}
                                    style={{ fontSize: 10, color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer" }}>
                                    ✗ Ninguno
                                </button>
                            </div>
                        </div>

                        {/* Vehículos visibles */}
                        <div style={{ background: "#fff", border: "1px solid var(--color-border)", borderRadius: 8, padding: "10px 12px" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 2 }}>
                                VEHÍCULOS DE LA ZONA ({vehSel.length} seleccionados)
                            </div>
                            <div style={{ fontSize: 11, color: "#8894ac", marginBottom: 8 }}>Solo verá jornadas de estos vehículos en la vista analista</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxHeight: 120, overflowY: "auto",
                                border: "1px solid var(--color-border)", borderRadius: 8, padding: 8 }}>
                                {vehiculos.map(veh => (
                                    <button key={veh} onClick={() => toggleArr(vehSel, setVehSel, veh)}
                                        style={{ padding: "3px 8px", borderRadius: 99, fontSize: 11, cursor: "pointer",
                                            border: vehSel.includes(veh) ? "2px solid #10b981" : "1px solid var(--color-border)",
                                            background: vehSel.includes(veh) ? "#f0fdf4" : "transparent",
                                            color: vehSel.includes(veh) ? "#065f46" : "var(--color-muted)",
                                            fontWeight: vehSel.includes(veh) ? 700 : 400 }}>
                                        {veh}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>)}

                        {/* Supervisores de la zona */}
                        <div style={{ background: "#fff", border: "1px solid var(--color-border)", borderRadius: 8, padding: "10px 12px" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted)", marginBottom: 2 }}>
                                SUPERVISORES DE LA ZONA ({supSel.length} seleccionados)
                            </div>
                            <div style={{ fontSize: 11, color: "#8894ac", marginBottom: 8 }}>
                                El analista solo verá jornadas de estos supervisores
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxHeight: 120, overflowY: "auto",
                                border: "1px solid var(--color-border)", borderRadius: 8, padding: 8 }}>
                                {supervisores.length === 0 ? (
                                    <span style={{ fontSize: 11, color: "#aaa" }}>No hay supervisores en Config → agregalos primero</span>
                                ) : supervisores.map(sup => (
                                    <button key={sup} onClick={() => toggleArr(supSel, setSupSel, sup)}
                                        style={{ padding: "3px 8px", borderRadius: 99, fontSize: 11, cursor: "pointer",
                                            border: supSel.includes(sup) ? "2px solid #7c3aed" : "1px solid var(--color-border)",
                                            background: supSel.includes(sup) ? "#f5f3ff" : "transparent",
                                            color: supSel.includes(sup) ? "#7c3aed" : "var(--color-muted)",
                                            fontWeight: supSel.includes(sup) ? 700 : 400 }}>
                                        👤 {sup}
                                    </button>
                                ))}
                            </div>
                            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                                <button onClick={() => setSupSel(supervisores)}
                                    style={{ fontSize: 10, color: "#7c3aed", background: "none", border: "none", cursor: "pointer" }}>
                                    ✓ Todos
                                </button>
                                <button onClick={() => setSupSel([])}
                                    style={{ fontSize: 10, color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer" }}>
                                    ✗ Ninguno
                                </button>
                            </div>
                        </div>

                    <button onClick={handleSave} disabled={saving}
                        style={{ background: "#c9a227", color: "#fff", border: "none", borderRadius: 8,
                            padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        {saving ? "Guardando..." : ok ? "✓ Guardado" : "💾 Guardar config analista"}
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Tarjeta de usuario ────────────────────────────────────────────────────────
function UsuarioCard({ u, currentUid, onToggle, onReset, onSaveAnalista }) {
    const [expanded,   setExpanded]   = useState(false);
    const [resetting,  setResetting]  = useState(false);
    const [toggling,   setToggling]   = useState(false);
    const [resetOk,    setResetOk]    = useState(false);
    const [confirmDes, setConfirmDes] = useState(false);

    const esMismo = u.uid === currentUid;

    const handleReset = async () => {
        setResetting(true);
        await onReset(u.email);
        setResetOk(true);
        setResetting(false);
        setTimeout(() => setResetOk(false), 3000);
    };

    const handleToggle = async () => {
        setToggling(true);
        await onToggle(u.uid, !u.activo);
        setToggling(false);
        setConfirmDes(false);
    };

    const fmtFecha = (ts) => {
        if (!ts) return "Nunca";
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString("es-AR") + " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    };

    return (
        <div className={`usr-card ${!u.activo ? "inactivo" : ""}`}>
            <div className="usr-card-header" onClick={() => setExpanded(e => !e)}>
                <div className="usr-avatar-lg">
                    {u.nombre?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="usr-card-info">
                    <div className="usr-card-nombre">
                        {u.nombre}
                        {esMismo && <span className="usr-yo-badge">Vos</span>}
                        {!u.activo && <span className="usr-inactivo-badge">Inactivo</span>}
                    </div>
                    <div className="usr-card-email">{u.email}</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                        <span className={`usr-rol-tag ${ROL_COLOR[u.rol]}`}>
                            {ROL_LABEL[u.rol] || u.rol}
                        </span>
                        {u.esAnalista && (
                            <span style={{ background: "#fff8d6", color: "#7a5c00", border: "1px solid #d4a820",
                                borderRadius: 99, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>
                                📊 Analista{u.zona ? " · " + u.zona : ""}
                            </span>
                        )}
                    </div>
                </div>
                <span className="usr-chevron">{expanded ? "▲" : "▼"}</span>
            </div>

            {expanded && (
                <div className="usr-card-detail">
                    <div className="info-row">
                        <span className="info-k">Último acceso</span>
                        <span className="info-v">{fmtFecha(u.ultimoAcceso)}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-k">Creado</span>
                        <span className="info-v">{fmtFecha(u.creadoEn)}</span>
                    </div>

                    {/* ── Vista Analista ── */}
                    {u.rol === "operator" && (
                        <AnalistaConfig u={u} onSave={onSaveAnalista} />
                    )}

                    <div className="usr-card-actions">
                        {/* Reset contraseña */}
                        <button
                            className="usr-btn usr-btn-reset"
                            disabled={resetting || !u.activo}
                            onClick={handleReset}
                        >
                            {resetting ? "Enviando..." : resetOk ? "✓ Mail enviado" : "📧 Resetear contraseña"}
                        </button>

                        {/* Activar/Desactivar */}
                        {!esMismo && (
                            u.activo ? (
                                !confirmDes ? (
                                    <button className="usr-btn usr-btn-danger" onClick={() => setConfirmDes(true)}>
                                        🚫 Desactivar acceso
                                    </button>
                                ) : (
                                    <div className="usr-confirm">
                                        <span>¿Desactivar a {u.nombre.split(" ")[0]}?</span>
                                        <button className="usr-btn usr-btn-danger" disabled={toggling} onClick={handleToggle}>
                                            {toggling ? "..." : "Confirmar"}
                                        </button>
                                        <button className="usr-btn usr-btn-cancel" onClick={() => setConfirmDes(false)}>
                                            Cancelar
                                        </button>
                                    </div>
                                )
                            ) : (
                                <button className="usr-btn usr-btn-success" disabled={toggling} onClick={handleToggle}>
                                    {toggling ? "..." : "✅ Reactivar acceso"}
                                </button>
                            )
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function UsersScreen() {
    const { user, listarUsuarios, actualizarUsuario, resetPassword } = useAuth();

    const [usuarios,  setUsuarios]  = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [showForm,  setShowForm]  = useState(false);
    const [toast,     setToast]     = useState("");
    const [filtro,    setFiltro]    = useState("todos");

    const cargar = async () => {
        setLoading(true);
        try {
            const list = await listarUsuarios();
            setUsuarios(list.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
        } catch (e) {
            showToast("Error cargando usuarios: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { cargar(); }, []);

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

    const handleCreated = (nombre) => {
        setShowForm(false);
        showToast(`✓ Usuario ${nombre} creado correctamente`);
        cargar();
    };

    const handleToggle = async (uid, activo) => {
        await actualizarUsuario(uid, { activo });
        showToast(activo ? "✓ Usuario reactivado" : "Usuario desactivado");
        cargar();
    };

    const handleReset = async (email) => {
        await resetPassword(email);
    };

    const handleSaveAnalista = async (uid, datos) => {
        await actualizarUsuario(uid, datos);
        showToast("✓ Configuración analista guardada");
        cargar();
    };

    const filtrados = usuarios.filter(u => {
        if (filtro === "admin")    return u.rol === "admin";
        if (filtro === "operator") return u.rol === "operator";
        if (filtro === "inactivo") return u.activo === false;
        return true;
    });

    const activos   = usuarios.filter(u => u.activo !== false).length;
    const admins    = usuarios.filter(u => u.rol === "admin").length;
    const operators = usuarios.filter(u => u.rol === "operator").length;
    const analistas = usuarios.filter(u => u.esAnalista === true).length;

    return (
        <div className="usr-screen">
            <div className="screen-title">Usuarios</div>
            <div className="screen-sub">Gestión de accesos al sistema</div>

            {/* Stats */}
            <div className="usr-stats">
                <div className="usr-stat">
                    <div className="usr-stat-val">{activos}</div>
                    <div className="usr-stat-label">Activos</div>
                </div>
                <div className="usr-stat">
                    <div className="usr-stat-val blue">{operators}</div>
                    <div className="usr-stat-label">Supervisores</div>
                </div>
                <div className="usr-stat">
                    <div className="usr-stat-val red">{admins}</div>
                    <div className="usr-stat-label">Admins</div>
                </div>
                <div className="usr-stat">
                    <div className="usr-stat-val" style={{ color: "#c9a227" }}>{analistas}</div>
                    <div className="usr-stat-label">Analistas</div>
                </div>
                <div className="usr-stat">
                    <div className="usr-stat-val muted">{usuarios.length - activos}</div>
                    <div className="usr-stat-label">Inactivos</div>
                </div>
            </div>

            {/* Filtros */}
            <div className="usr-filtros">
                {["todos", "operator", "admin", "inactivo"].map(f => (
                    <button
                        key={f}
                        className={`usr-filtro-btn ${filtro === f ? "active" : ""}`}
                        onClick={() => setFiltro(f)}
                    >
                        {f === "todos" ? "Todos" : f === "operator" ? "Supervisores" : f === "admin" ? "Admins" : "Inactivos"}
                    </button>
                ))}
            </div>

            {/* Formulario nuevo usuario */}
            {showForm && (
                <NuevoUsuarioForm
                    onCreated={handleCreated}
                    onCancel={() => setShowForm(false)}
                />
            )}

            {/* Lista */}
            {loading ? (
                <div className="usr-loading">
                    <span className="spinner" style={{ borderTopColor: "var(--color-primary)", width: 24, height: 24, borderWidth: 3 }} />
                    Cargando usuarios...
                </div>
            ) : filtrados.length === 0 ? (
                <div className="usr-empty">
                    {usuarios.length === 0
                        ? "No hay usuarios aún. Creá el primero."
                        : "Sin resultados para este filtro."}
                </div>
            ) : (
                filtrados.map(u => (
                    <UsuarioCard
                        key={u.uid}
                        u={u}
                        currentUid={user?.uid}
                        onToggle={handleToggle}
                        onReset={handleReset}
                        onSaveAnalista={handleSaveAnalista}
                    />
                ))
            )}

            {!showForm && (
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowForm(true)}>
                    + Crear usuario
                </button>
            )}

            {toast && <div className="admin-toast">{toast}</div>}
        </div>
    );
}
