// src/screens/superadmin/PanelPermisos.jsx
// SuperAdmin: gestiona qué módulos tiene habilitados cada empresa (lo que contrató/paga).
import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { MODULOS_DEF } from "../../config/roles";

const COLOR_MAP = {
    blue:   { bg: "#1e3a5f", badge: "#3b82f6" },
    green:  { bg: "#14532d", badge: "#22c55e" },
    orange: { bg: "#7c2d12", badge: "#f97316" },
    gray:   { bg: "#1f2937", badge: "#9ca3af" },
};

export default function PanelPermisos() {
    const [empresas,  setEmpresas]  = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [cambios,   setCambios]   = useState({});   // empresaId → { key: bool }
    const [guardando, setGuardando] = useState({});
    const [msgs,      setMsgs]      = useState({});
    const [abiertos,  setAbiertos]  = useState({});   // empresaId → bool

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, "empresas"));
            setEmpresas(snap.docs.map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? "")));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    // Módulos actuales de una empresa (default: true si no está explícitamente false)
    const modulosEmpresa = (emp) => {
        const m = emp.modulos ?? {};
        const todos = MODULOS_DEF.flatMap(g => g.modulos);
        return Object.fromEntries(todos.map(mod => [mod.key, m[mod.key] !== false]));
    };

    const estadoActual = (emp) => ({
        ...modulosEmpresa(emp),
        ...(cambios[emp.id] ?? {}),
    });

    const toggleModulo = (empId, key, emp) => {
        setCambios(prev => {
            const actual = estadoActual(emp);
            return { ...prev, [empId]: { ...actual, [key]: !actual[key] } };
        });
    };

    const toggleGrupo = (empId, keys, emp, valor) => {
        setCambios(prev => {
            const actual = estadoActual(emp);
            const patch  = Object.fromEntries(keys.map(k => [k, valor]));
            return { ...prev, [empId]: { ...actual, ...patch } };
        });
    };

    const guardar = async (emp) => {
        const modulos = estadoActual(emp);
        setGuardando(prev => ({ ...prev, [emp.id]: true }));
        setMsgs(prev => ({ ...prev, [emp.id]: null }));
        try {
            await updateDoc(doc(db, "empresas", emp.id), { modulos });
            setEmpresas(prev => prev.map(e => e.id === emp.id ? { ...e, modulos } : e));
            setCambios(prev => { const n = { ...prev }; delete n[emp.id]; return n; });
            setMsgs(prev => ({ ...prev, [emp.id]: { ok: true, txt: "✅ Guardado" } }));
            setTimeout(() => setMsgs(prev => ({ ...prev, [emp.id]: null })), 2500);
        } catch (e) {
            setMsgs(prev => ({ ...prev, [emp.id]: { ok: false, txt: "❌ " + e.message } }));
        } finally {
            setGuardando(prev => ({ ...prev, [emp.id]: false }));
        }
    };

    if (loading) return <div className="sa-usuarios-loading"><div className="sa-spinner" /> Cargando empresas…</div>;
    if (!empresas.length) return <div className="sa-empty-state"><div className="sa-empty-icon">🏢</div><div className="sa-empty-title">No hay empresas registradas</div></div>;

    return (
        <div className="sa-permisos">
            <div className="sa-usuarios-header">
                <div className="sa-section-title">Módulos por empresa</div>
                <span className="sa-usuarios-count">{empresas.length} empresa{empresas.length !== 1 ? "s" : ""}</span>
            </div>
            <p className="sa-emp-instruccion">
                Habilitá o deshabilitá módulos por empresa según los servicios contratados.
                Los módulos desactivados no estarán disponibles para <strong>ningún usuario</strong> de esa empresa.
            </p>

            <div className="sa-perm-grupos">
                {empresas.map(emp => {
                    const actual        = estadoActual(emp);
                    const tieneCambios  = !!cambios[emp.id];
                    const totalModulos  = MODULOS_DEF.flatMap(g => g.modulos).length;
                    const habilitados   = Object.values(actual).filter(Boolean).length;
                    const abierto       = !!abiertos[emp.id];

                    return (
                        <div key={emp.id} className="sa-perm-empresa">
                            {/* Header empresa */}
                            <button
                                className="sa-perm-empresa-header"
                                onClick={() => setAbiertos(p => ({ ...p, [emp.id]: !p[emp.id] }))}
                            >
                                <span className="sa-perm-empresa-icon">🏢</span>
                                <span className="sa-perm-empresa-nombre">{emp.nombre ?? emp.id}</span>
                                <span className={`sa-perm-empresa-estado ${emp.activo ? "" : "sa-perm-empresa-estado--inactiva"}`}>
                                    {emp.activo ? "Activa" : "Inactiva"}
                                </span>
                                <span className="sa-perm-empresa-count">{habilitados}/{totalModulos} módulos</span>
                                <span className="sa-perm-empresa-arrow">{abierto ? "▲" : "▼"}</span>
                            </button>

                            {abierto && (
                                <div className="sa-perm-empresa-body">
                                    {MODULOS_DEF.map(grupo => {
                                        const c      = COLOR_MAP[grupo.color] ?? COLOR_MAP.gray;
                                        const keys   = grupo.modulos.map(m => m.key);
                                        const todos  = keys.every(k => actual[k]);
                                        const ninguno= keys.every(k => !actual[k]);

                                        return (
                                            <div key={grupo.grupo} className="sa-perm-grupo-bloque">
                                                <div className="sa-perm-grupo-header" style={{ background: c.bg }}>
                                                    <span>{grupo.icon} {grupo.grupo}</span>
                                                    <div className="sa-perm-grupo-acciones">
                                                        <button
                                                            className="sa-perm-grupo-btn"
                                                            onClick={() => toggleGrupo(emp.id, keys, emp, true)}
                                                            disabled={todos}
                                                        >Todos ✓</button>
                                                        <button
                                                            className="sa-perm-grupo-btn"
                                                            onClick={() => toggleGrupo(emp.id, keys, emp, false)}
                                                            disabled={ninguno}
                                                        >Ninguno</button>
                                                    </div>
                                                </div>
                                                <div className="sa-perm-modulos-grid">
                                                    {grupo.modulos.map(m => (
                                                        <label
                                                            key={m.key}
                                                            className={`sa-perm-modulo-check ${actual[m.key] ? "sa-perm-modulo-check--on" : ""}`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={!!actual[m.key]}
                                                                onChange={() => toggleModulo(emp.id, m.key, emp)}
                                                            />
                                                            <span className="sa-perm-modulo-icon">{m.icon}</span>
                                                            <span>{m.label}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <div className="sa-perm-user-actions">
                                        {msgs[emp.id] && (
                                            <span className={`sa-perm-inline-msg ${msgs[emp.id].ok ? "sa-perm-inline-msg--ok" : "sa-perm-inline-msg--err"}`}>
                                                {msgs[emp.id].txt}
                                            </span>
                                        )}
                                        <button
                                            className="sa-ur-btn-save"
                                            disabled={!tieneCambios || guardando[emp.id]}
                                            onClick={() => guardar(emp)}
                                        >
                                            {guardando[emp.id] ? "Guardando…" : "💾 Guardar cambios"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
