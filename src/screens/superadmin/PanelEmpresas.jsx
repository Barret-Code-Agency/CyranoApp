// src/screens/superadmin/PanelEmpresas.jsx
import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../firebase";
import ModalNuevaEmpresa, { MODULOS_DEFAULT } from "./ModalNuevaEmpresa";
import { MODULOS_DEF } from "../../config/roles";
import { setupEmpresa } from "../../utils/setupEmpresa";

export default function PanelEmpresas() {
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
            const [resEmpresas, resUsuarios] = await Promise.allSettled([
                getDocs(collection(db, "empresas")),
                getDocs(collection(db, "usuarios")),
            ]);

            const listaE = resEmpresas.status === "fulfilled"
                ? resEmpresas.value.docs.map(d => ({ id: d.id, ...d.data() }))
                : (console.warn("No se pudo leer /empresas:", resEmpresas.reason?.message), []);

            const idsEnUsers = resUsuarios.status === "fulfilled"
                ? [...new Set(resUsuarios.value.docs.map(d => d.data().empresaId).filter(Boolean))]
                : (console.warn("No se pudo leer /usuarios:", resUsuarios.reason?.message), []);

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

    const reinicializar = async () => {
        if (!seleccionada) return;
        setGuardando(true); setMsg(null);
        try {
            await setupEmpresa(seleccionada.id, seleccionada.nombre ?? seleccionada.id, modulos);
            setMsg({ texto: "✅ Estructura reinicializada. Los datos operativos (config, planes) fueron recreados.", ok: true });
        } catch (e) {
            setMsg({ texto: "❌ Error al reinicializar: " + e.message, ok: false });
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

            <div className="sa-emp-reinit-section">
                <div className="sa-emp-reinit-title">🔧 Mantenimiento de estructura</div>
                <div className="sa-emp-reinit-desc">
                    Si se perdieron datos de configuración (config_global, plan_global, planes de supervisores),
                    usá este botón para reconstruir la estructura base de la empresa. <strong>No borra datos de colecciones</strong> (legajos, clientes, etc).
                </div>
                <button
                    className="sa-ur-btn-cancel sa-emp-reinit-btn"
                    onClick={reinicializar}
                    disabled={guardando}
                >
                    🔄 Reinicializar estructura de datos
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
