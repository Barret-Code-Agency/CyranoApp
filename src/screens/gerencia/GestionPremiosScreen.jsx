// src/screens/gerencia/GestionPremiosScreen.jsx
// Gestión de premios y aprobación de canjes — uso de gerencia / admin_contrato.

import { useState, useEffect } from "react";
import { useAuth }    from "../../context/AuthContext";
import { useAppData } from "../../context/AppDataContext";
import { db } from "../../firebase";
import {
    collection, query, where, getDocs, addDoc,
    updateDoc, doc, deleteDoc, serverTimestamp,
} from "firebase/firestore";
import { consumirTokens } from "../../utils/tokenService";
import "./GestionPremiosScreen.css";

// ── Tab: Tokens del personal ────────────────────────────────────────────────
function TabTokensPersonal({ eId, premios }) {
    const [filas,    setFilas]    = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [busqueda, setBusqueda] = useState("");

    useEffect(() => {
        if (!eId) return;
        const cargar = async () => {
            setLoading(true);
            try {
                const [tokSnap, legSnap, canjesSnap] = await Promise.all([
                    getDocs(query(collection(db, "tokens"),           where("empresaId", "==", eId))),
                    getDocs(query(collection(db, "legajos"),          where("empresaId", "==", eId))),
                    getDocs(query(collection(db, "canjes"),           where("empresaId", "==", eId))),
                ]);
                const legMap = {};
                legSnap.docs.forEach(d => { const data = d.data(); if (data.uid) legMap[data.uid] = data; });
                const canjesPorUid = {};
                canjesSnap.docs.forEach(d => {
                    const c = d.data();
                    if (!canjesPorUid[c.uid]) canjesPorUid[c.uid] = { aprobados: 0, pendientes: 0 };
                    if (c.estado === "aprobado")  canjesPorUid[c.uid].aprobados++;
                    if (c.estado === "pendiente") canjesPorUid[c.uid].pendientes++;
                });
                const lista = tokSnap.docs.map(d => {
                    const t = d.data();
                    const leg = legMap[t.uid] || {};
                    return {
                        uid:        t.uid,
                        nombre:     leg.nombre || t.uid,
                        legajo:     leg.legajo || "—",
                        funcion:    leg.rol || leg.tarea || "—",
                        saldo:      t.saldo || 0,
                        aprobados:  canjesPorUid[t.uid]?.aprobados  || 0,
                        pendientes: canjesPorUid[t.uid]?.pendientes || 0,
                    };
                }).sort((a, b) => b.saldo - a.saldo);
                setFilas(lista);
            } catch (e) { console.error(e); }
            setLoading(false);
        };
        cargar();
    }, [eId]);

    const meta = premios.length ? Math.min(...premios.filter(p => p.activo).map(p => p.costo)) : 300;
    const filtradas = busqueda
        ? filas.filter(f => f.nombre.toLowerCase().includes(busqueda.toLowerCase()) || f.legajo.includes(busqueda))
        : filas;

    if (loading) return <div className="gp-loading">Cargando tokens del personal...</div>;

    return (
        <div className="gp-body">
            <div className="gp-body-top">
                <input
                    className="gp-search"
                    placeholder="Buscar por nombre o legajo..."
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                />
                <span className="gp-tokens-meta">Premio más accesible: <strong>{meta} tokens</strong></span>
            </div>
            {filtradas.length === 0 ? (
                <div className="gp-empty">No hay tokens registrados aún.</div>
            ) : (
                filtradas.map(f => {
                    const pct = Math.min(100, Math.round((f.saldo / meta) * 100));
                    return (
                        <div key={f.uid} className="gp-token-fila">
                            <div className="gp-token-info">
                                <div className="gp-token-nombre">{f.nombre}</div>
                                <div className="gp-token-sub">Leg. {f.legajo} · {f.funcion}</div>
                            </div>
                            <div className="gp-token-progress">
                                <div className="gp-token-track">
                                    <div className="gp-token-bar" style={{ width: `${pct}%` }} />
                                </div>
                                <div className="gp-token-nums">
                                    <span className="gp-token-saldo">{f.saldo} tokens</span>
                                    <span className="gp-token-pct">{pct}%</span>
                                </div>
                            </div>
                            <div className="gp-token-canjes">
                                {f.pendientes > 0 && <span className="gp-badge gp-badge--pend">⏳ {f.pendientes}</span>}
                                {f.aprobados  > 0 && <span className="gp-badge gp-badge--ok">✅ {f.aprobados}</span>}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}

const PREMIO_VACIO = { nombre: "", icon: "🎁", desc: "", costo: 0, activo: true };

export default function GestionPremiosScreen({ onBack }) {
    const { user }       = useAuth();
    const { empresaId }  = useAppData();
    const eId            = empresaId || user?.empresaId;

    const [tab,      setTab]      = useState("premios");   // "premios" | "canjes" | "tokens"
    const [premios,  setPremios]  = useState([]);
    const [canjes,   setCanjes]   = useState([]);
    const [loading,  setLoading]  = useState(true);

    // Modal nuevo/editar premio
    const [modalPremio,  setModalPremio]  = useState(false);
    const [formPremio,   setFormPremio]   = useState(PREMIO_VACIO);
    const [editId,       setEditId]       = useState(null);
    const [guardando,    setGuardando]    = useState(false);

    // Aprobar/rechazar canje
    const [procesando,   setProcesando]   = useState(null);

    const PREMIOS_DEFAULT = [
        { nombre: "Vale Facturas",  icon: "🧾", desc: "Vale descuento en facturas personales",  costo: 300, activo: true },
        { nombre: "Vale Almuerzo",  icon: "🍽️", desc: "Almuerzo en cantina o equivalente",       costo: 600, activo: true },
    ];

    const cargar = async () => {
        if (!eId) return;
        setLoading(true);
        try {
            const [premiosSnap, canjesSnap] = await Promise.all([
                getDocs(query(collection(db, "premios"), where("empresaId", "==", eId))),
                getDocs(query(collection(db, "canjes"),  where("empresaId", "==", eId), where("estado", "==", "pendiente"))),
            ]);
            let lista = premiosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Seed premios por defecto si no existen
            if (lista.length === 0) {
                await Promise.all(
                    PREMIOS_DEFAULT.map(p => addDoc(collection(db, "premios"), { ...p, empresaId: eId, creadoEn: serverTimestamp() }))
                );
                const seeded = await getDocs(query(collection(db, "premios"), where("empresaId", "==", eId)));
                lista = seeded.docs.map(d => ({ id: d.id, ...d.data() }));
            }
            setPremios(lista);
            setCanjes(canjesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { cargar(); }, [eId]);

    const abrirNuevo = () => {
        setEditId(null);
        setFormPremio(PREMIO_VACIO);
        setModalPremio(true);
    };

    const abrirEditar = (p) => {
        setEditId(p.id);
        setFormPremio({ nombre: p.nombre, icon: p.icon ?? "🎁", desc: p.desc ?? "", costo: p.costo, activo: p.activo ?? true });
        setModalPremio(true);
    };

    const guardarPremio = async () => {
        if (!formPremio.nombre.trim() || !formPremio.costo) return;
        setGuardando(true);
        try {
            const data = { ...formPremio, costo: Number(formPremio.costo), empresaId: eId };
            if (editId) {
                await updateDoc(doc(db, "premios", editId), data);
            } else {
                await addDoc(collection(db, "premios"), { ...data, creadoEn: serverTimestamp() });
            }
            setModalPremio(false);
            await cargar();
        } catch (e) { console.error(e); alert("Error al guardar."); }
        setGuardando(false);
    };

    const eliminarPremio = async (id) => {
        if (!confirm("¿Eliminar este premio?")) return;
        await deleteDoc(doc(db, "premios", id)).catch(console.error);
        await cargar();
    };

    const aprobarCanje = async (canje) => {
        if (!confirm(`¿Aprobar canje de "${canje.premioNombre}" para ${canje.nombre}?`)) return;
        setProcesando(canje.id);
        try {
            await consumirTokens(canje.uid, canje.empresaId, canje.costo, `Canje aprobado: ${canje.premioNombre}`);
            await updateDoc(doc(db, "canjes", canje.id), {
                estado: "aprobado",
                aprobadoEn: serverTimestamp(),
                aprobadoPor: user?.uid ?? null,
            });
            setCanjes(cs => cs.filter(c => c.id !== canje.id));
        } catch (e) { console.error(e); alert("Error al aprobar."); }
        setProcesando(null);
    };

    const rechazarCanje = async (canje) => {
        if (!confirm(`¿Rechazar canje de "${canje.premioNombre}"?`)) return;
        setProcesando(canje.id);
        try {
            await updateDoc(doc(db, "canjes", canje.id), {
                estado: "rechazado",
                rechazadoEn: serverTimestamp(),
            });
            setCanjes(cs => cs.filter(c => c.id !== canje.id));
        } catch (e) { console.error(e); alert("Error al rechazar."); }
        setProcesando(null);
    };

    return (
        <div className="gp-root">
            <div className="gp-header">
                <button className="gp-back" onClick={onBack}>← Volver al panel</button>
                <div className="gp-header-title">🎁 Premios y Tokens</div>
            </div>

            <div className="gp-tabs">
                <button className={`gp-tab ${tab === "premios" ? "gp-tab--on" : ""}`} onClick={() => setTab("premios")}>
                    🎁 Catálogo de premios
                </button>
                <button className={`gp-tab ${tab === "canjes" ? "gp-tab--on" : ""}`} onClick={() => setTab("canjes")}>
                    🔄 Canjes pendientes {canjes.length > 0 && <span className="gp-badge">{canjes.length}</span>}
                </button>
                <button className={`gp-tab ${tab === "tokens" ? "gp-tab--on" : ""}`} onClick={() => setTab("tokens")}>
                    👥 Tokens del personal
                </button>
            </div>

            {tab === "tokens" ? (
                <TabTokensPersonal eId={eId} premios={premios} />
            ) : loading ? (
                <div className="gp-loading">Cargando...</div>
            ) : tab === "premios" ? (
                <div className="gp-body">
                    <div className="gp-body-top">
                        <button className="gp-btn-nuevo" onClick={abrirNuevo}>+ Nuevo premio</button>
                    </div>
                    {premios.length === 0 ? (
                        <div className="gp-empty">No hay premios cargados. Creá el primero.</div>
                    ) : (
                        premios.map(p => (
                            <div key={p.id} className={`gp-premio ${!p.activo ? "gp-premio--inactivo" : ""}`}>
                                <div className="gp-premio-icon">{p.icon ?? "🎁"}</div>
                                <div className="gp-premio-info">
                                    <div className="gp-premio-nombre">{p.nombre} {!p.activo && <span className="gp-inactivo-tag">Inactivo</span>}</div>
                                    {p.desc && <div className="gp-premio-desc">{p.desc}</div>}
                                    <div className="gp-premio-costo">{p.costo} tokens</div>
                                </div>
                                <div className="gp-premio-acciones">
                                    <button className="gp-btn-edit" onClick={() => abrirEditar(p)}>Editar</button>
                                    <button className="gp-btn-del"  onClick={() => eliminarPremio(p.id)}>Eliminar</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <div className="gp-body">
                    {canjes.length === 0 ? (
                        <div className="gp-empty">No hay canjes pendientes.</div>
                    ) : (
                        canjes.map(c => {
                            const fecha = c.creadoEn?.toDate?.()?.toLocaleDateString("es-AR") ?? "";
                            return (
                                <div key={c.id} className="gp-canje">
                                    <div className="gp-canje-info">
                                        <div className="gp-canje-nombre">{c.nombre || c.uid}</div>
                                        <div className="gp-canje-premio">🎁 {c.premioNombre}</div>
                                        <div className="gp-canje-meta">{c.costo} tokens · {fecha}</div>
                                    </div>
                                    <div className="gp-canje-acciones">
                                        <button
                                            className="gp-btn-aprobar"
                                            disabled={procesando === c.id}
                                            onClick={() => aprobarCanje(c)}
                                        >
                                            {procesando === c.id ? "..." : "✅ Aprobar"}
                                        </button>
                                        <button
                                            className="gp-btn-rechazar"
                                            disabled={procesando === c.id}
                                            onClick={() => rechazarCanje(c)}
                                        >
                                            ✗ Rechazar
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Modal nuevo/editar premio */}
            {modalPremio && (
                <div className="gp-modal-overlay" onClick={() => setModalPremio(false)}>
                    <div className="gp-modal" onClick={e => e.stopPropagation()}>
                        <div className="gp-modal-header">
                            <strong>{editId ? "Editar premio" : "Nuevo premio"}</strong>
                            <button className="gp-modal-close" onClick={() => setModalPremio(false)}>✕</button>
                        </div>
                        <div className="gp-modal-body">
                            <div className="gp-field">
                                <label className="gp-label">Nombre</label>
                                <input className="gp-input" value={formPremio.nombre}
                                    onChange={e => setFormPremio(p => ({ ...p, nombre: e.target.value }))}
                                    placeholder="ej: Vale almuerzo" />
                            </div>
                            <div className="gp-row2">
                                <div className="gp-field">
                                    <label className="gp-label">Ícono (emoji)</label>
                                    <input className="gp-input" value={formPremio.icon}
                                        onChange={e => setFormPremio(p => ({ ...p, icon: e.target.value }))} />
                                </div>
                                <div className="gp-field">
                                    <label className="gp-label">Costo (tokens)</label>
                                    <input className="gp-input" type="number" min="1" value={formPremio.costo}
                                        onChange={e => setFormPremio(p => ({ ...p, costo: e.target.value }))} />
                                </div>
                            </div>
                            <div className="gp-field">
                                <label className="gp-label">Descripción (opcional)</label>
                                <input className="gp-input" value={formPremio.desc}
                                    onChange={e => setFormPremio(p => ({ ...p, desc: e.target.value }))}
                                    placeholder="ej: Almuerzo en cantina por hasta $5000" />
                            </div>
                            <label className="gp-check-row">
                                <input type="checkbox" checked={formPremio.activo}
                                    onChange={e => setFormPremio(p => ({ ...p, activo: e.target.checked }))} />
                                Premio activo (visible para vigiladores)
                            </label>
                        </div>
                        <div className="gp-modal-footer">
                            <button className="gp-btn-cancel" onClick={() => setModalPremio(false)}>Cancelar</button>
                            <button className="gp-btn-guardar"
                                disabled={!formPremio.nombre.trim() || !formPremio.costo || guardando}
                                onClick={guardarPremio}
                            >
                                {guardando ? "Guardando..." : editId ? "Guardar cambios" : "Crear premio"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
