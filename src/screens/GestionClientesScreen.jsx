// src/screens/GestionClientesScreen.jsx
// ABM de Clientes → Objetivos → Puestos para el Admin de Contrato.

import { useState } from "react";
import { SEED_DATA } from "../data/seedClientesData";
import { useAppData } from "../context/AppDataContext";
import {
    collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";
import { useClientesData } from "../hooks/useClientesData";
import "../styles/GestionClientesScreen.css";

// ── helpers ───────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);

// ── Componente ────────────────────────────────────────────────────────────────
export default function GestionClientesScreen({ onBack }) {
    const { empresaNombre } = useAppData();
    const { clientes, objetivos, puestos, cargando, recargar } = useClientesData(empresaNombre);

    // Navegación drill-down
    const [nivelCliente,  setNivelCliente]  = useState(null); // cliente seleccionado
    const [nivelObjetivo, setNivelObjetivo] = useState(null); // objetivo seleccionado

    // Formulario add/edit
    const [editando, setEditando] = useState(null); // { tipo, id|null, campos }
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState(null);
    const [seedeando, setSeedeando] = useState(false);

    const handleSeed = async () => {
        if (!window.confirm(`¿Importar ${SEED_DATA.reduce((a, c) => a + 1 + c.objetivos.length + c.objetivos.reduce((x, o) => x + o.puestos.length, 0), 0)} registros? Se agregarán a los clientes existentes.`)) return;
        setSeedeando(true);
        try {
            for (const entry of SEED_DATA) {
                // Crear cliente
                const cRef = await addDoc(collection(db, "clientes"), {
                    ...entry.cliente,
                    empresa: empresaNombre,
                    creadoEn: serverTimestamp(),
                });
                for (const obj of entry.objetivos) {
                    // Crear objetivo
                    const oRef = await addDoc(collection(db, "objetivos"), {
                        nombre:         obj.nombre,
                        zona:           obj.zona || "",
                        provincia:      obj.provincia || "",
                        clienteId:      cRef.id,
                        clienteNombre:  entry.cliente.nombre,
                        empresa:        empresaNombre,
                        creadoEn:       serverTimestamp(),
                    });
                    for (const p of obj.puestos) {
                        // Crear puesto
                        await addDoc(collection(db, "puestos"), {
                            nombre:         p.nombre,
                            direccion:      p.direccion || "",
                            telefono:       p.telefono || "",
                            objetivoId:     oRef.id,
                            objetivoNombre: obj.nombre,
                            clienteId:      cRef.id,
                            clienteNombre:  entry.cliente.nombre,
                            empresa:        empresaNombre,
                            creadoEn:       serverTimestamp(),
                        });
                    }
                }
            }
            await recargar();
            alert("✅ Datos importados correctamente.");
        } catch (e) {
            alert("Error al importar: " + e.message);
        } finally {
            setSeedeando(false);
        }
    };

    // ── Guardar (add o update) ────────────────────────────────
    const handleGuardar = async () => {
        setGuardando(true); setError(null);
        try {
            const { tipo, id, campos } = editando;

            if (tipo === "cliente") {
                const data = { nombre: campos.nombre, codigo: campos.codigo || "", empresa: empresaNombre };
                if (id) await updateDoc(doc(db, "clientes", id), data);
                else    await addDoc(collection(db, "clientes"), { ...data, creadoEn: serverTimestamp() });
            }
            else if (tipo === "objetivo") {
                const cl = clientes.find(c => c.id === nivelCliente);
                const data = { nombre: campos.nombre, zona: campos.zona || "", provincia: campos.provincia || "", clienteId: nivelCliente, clienteNombre: cl?.nombre || "", empresa: empresaNombre };
                if (id) await updateDoc(doc(db, "objetivos", id), data);
                else    await addDoc(collection(db, "objetivos"), { ...data, creadoEn: serverTimestamp() });
            }
            else if (tipo === "puesto") {
                const cl = clientes.find(c => c.id === nivelCliente);
                const ob = objetivos.find(o => o.id === nivelObjetivo);
                const data = {
                    nombre: campos.nombre, direccion: campos.direccion || "", telefono: campos.telefono || "",
                    objetivoId: nivelObjetivo, objetivoNombre: ob?.nombre || "",
                    clienteId: nivelCliente,   clienteNombre: cl?.nombre || "",
                    empresa: empresaNombre,
                };
                if (id) await updateDoc(doc(db, "puestos", id), data);
                else    await addDoc(collection(db, "puestos"), { ...data, creadoEn: serverTimestamp() });
            }

            await recargar();
            setEditando(null);
        } catch (e) {
            setError("Error: " + e.message);
        } finally {
            setGuardando(false);
        }
    };

    // ── Eliminar ──────────────────────────────────────────────
    const handleEliminar = async (coleccion, id, nombre) => {
        if (!window.confirm(`¿Eliminár "${nombre}"? Esta acción no se puede deshacer.`)) return;
        try {
            await deleteDoc(doc(db, coleccion, id));
            await recargar();
            // reset drill-down si es necesario
            if (coleccion === "clientes")  { setNivelCliente(null); setNivelObjetivo(null); }
            if (coleccion === "objetivos") { setNivelObjetivo(null); }
        } catch (e) {
            alert("Error al eliminar: " + e.message);
        }
    };

    // ── Modal de edición ──────────────────────────────────────
    const Modal = () => {
        if (!editando) return null;
        const { tipo, id, campos } = editando;
        const setC = (k, v) => setEditando(e => ({ ...e, campos: { ...e.campos, [k]: v } }));
        const titulo = id ? `Editar ${tipo}` : `Nuevo ${tipo}`;

        return (
            <div className="gc-modal-overlay" onClick={() => setEditando(null)}>
                <div className="gc-modal" onClick={e => e.stopPropagation()}>
                    <div className="gc-modal-title">{titulo.charAt(0).toUpperCase() + titulo.slice(1)}</div>

                    <label className="gc-label">Nombre</label>
                    <input className="gc-input" value={campos.nombre || ""}
                        onChange={e => setC("nombre", e.target.value)} placeholder="Nombre..." autoFocus />

                    {tipo === "cliente" && (
                        <>
                            <label className="gc-label">Código / ID</label>
                            <input className="gc-input" value={campos.codigo || ""}
                                onChange={e => setC("codigo", e.target.value)} placeholder="Ej: YG, BSC-001..." />
                        </>
                    )}

                    {tipo === "objetivo" && (
                        <>
                            <label className="gc-label">Zona / Ciudad</label>
                            <input className="gc-input" value={campos.zona || ""}
                                onChange={e => setC("zona", e.target.value)} placeholder="Ej: CABA, Berazategui..." />
                            <label className="gc-label">Provincia</label>
                            <input className="gc-input" value={campos.provincia || ""}
                                onChange={e => setC("provincia", e.target.value)} placeholder="Ej: Buenos Aires, Santa Cruz..." />
                        </>
                    )}

                    {tipo === "puesto" && (
                        <>
                            <label className="gc-label">Dirección</label>
                            <input className="gc-input" value={campos.direccion || ""}
                                onChange={e => setC("direccion", e.target.value)} placeholder="Dirección completa..." />
                            <label className="gc-label">Teléfono</label>
                            <input className="gc-input" value={campos.telefono || ""}
                                onChange={e => setC("telefono", e.target.value)} placeholder="Teléfono de contacto..." />
                        </>
                    )}

                    {error && <div className="gc-error">{error}</div>}

                    <div className="gc-modal-btns">
                        <button className="gc-btn gc-btn--ghost" onClick={() => setEditando(null)}>Cancelar</button>
                        <button className="gc-btn gc-btn--primary"
                            onClick={handleGuardar} disabled={!campos.nombre || guardando}>
                            {guardando ? "Guardando..." : "Guardar"}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ── Breadcrumb ────────────────────────────────────────────
    const clienteActual  = clientes.find(c => c.id === nivelCliente);
    const objetivoActual = objetivos.find(o => o.id === nivelObjetivo);

    // ── Nivel puestos ─────────────────────────────────────────
    if (nivelCliente && nivelObjetivo) {
        const lista = puestos.filter(p => p.objetivoId === nivelObjetivo);
        return (
            <div className="gc-root">
                <header className="gc-header">
                    <button className="gc-back" onClick={onBack}>← Panel</button>
                    <div className="gc-breadcrumb">
                        <span className="gc-bc-link" onClick={() => { setNivelCliente(null); setNivelObjetivo(null); }}>Clientes</span>
                        <span className="gc-bc-sep">›</span>
                        <span className="gc-bc-link" onClick={() => setNivelObjetivo(null)}>{clienteActual?.nombre}</span>
                        <span className="gc-bc-sep">›</span>
                        <span className="gc-bc-current">{objetivoActual?.nombre}</span>
                    </div>
                </header>

                <div className="gc-body">
                    <div className="gc-section-bar">
                        <span>Puestos</span>
                        <button className="gc-add-btn" onClick={() =>
                            setEditando({ tipo: "puesto", id: null, campos: { nombre: "", direccion: "", telefono: "" } })}>
                            + Nuevo puesto
                        </button>
                    </div>

                    {lista.length === 0
                        ? <div className="gc-empty">No hay puestos. Agregá el primero.</div>
                        : lista.map(p => (
                            <div key={p.id} className="gc-item">
                                <div className="gc-item-main">
                                    <strong>{p.nombre}</strong>
                                    {p.direccion && <span className="gc-item-sub">📍 {p.direccion}</span>}
                                    {p.telefono  && <span className="gc-item-sub">📞 {p.telefono}</span>}
                                </div>
                                <div className="gc-item-actions">
                                    <button className="gc-icon-btn" onClick={() =>
                                        setEditando({ tipo: "puesto", id: p.id, campos: { nombre: p.nombre, direccion: p.direccion || "", telefono: p.telefono || "" } })}>
                                        ✏️
                                    </button>
                                    <button className="gc-icon-btn gc-icon-btn--del" onClick={() => handleEliminar("puestos", p.id, p.nombre)}>
                                        🗑
                                    </button>
                                </div>
                            </div>
                        ))
                    }
                </div>
                <Modal />
            </div>
        );
    }

    // ── Nivel objetivos ───────────────────────────────────────
    if (nivelCliente) {
        const lista = objetivos.filter(o => o.clienteId === nivelCliente);
        return (
            <div className="gc-root">
                <header className="gc-header">
                    <button className="gc-back" onClick={onBack}>← Panel</button>
                    <div className="gc-breadcrumb">
                        <span className="gc-bc-link" onClick={() => setNivelCliente(null)}>Clientes</span>
                        <span className="gc-bc-sep">›</span>
                        <span className="gc-bc-current">{clienteActual?.nombre}</span>
                    </div>
                </header>

                <div className="gc-body">
                    <div className="gc-section-bar">
                        <span>Objetivos de {clienteActual?.nombre}</span>
                        <button className="gc-add-btn" onClick={() =>
                            setEditando({ tipo: "objetivo", id: null, campos: { nombre: "", zona: "", provincia: "" } })}>
                            + Nuevo objetivo
                        </button>
                    </div>

                    {lista.length === 0
                        ? <div className="gc-empty">No hay objetivos. Agregá el primero.</div>
                        : lista.map(o => (
                            <div key={o.id} className="gc-item gc-item--clickable"
                                onClick={() => setNivelObjetivo(o.id)}>
                                <div className="gc-item-main">
                                    <strong>{o.nombre}</strong>
                                    {(o.zona || o.provincia) && (
                                        <span className="gc-item-sub">📍 {[o.zona, o.provincia].filter(Boolean).join(", ")}</span>
                                    )}
                                    <span className="gc-item-sub">{puestos.filter(p => p.objetivoId === o.id).length} puestos</span>
                                </div>
                                <div className="gc-item-actions" onClick={e => e.stopPropagation()}>
                                    <button className="gc-icon-btn" onClick={() =>
                                        setEditando({ tipo: "objetivo", id: o.id, campos: { nombre: o.nombre, zona: o.zona || "", provincia: o.provincia || "" } })}>
                                        ✏️
                                    </button>
                                    <button className="gc-icon-btn gc-icon-btn--del" onClick={() => handleEliminar("objetivos", o.id, o.nombre)}>
                                        🗑
                                    </button>
                                    <span className="gc-arrow">›</span>
                                </div>
                            </div>
                        ))
                    }
                </div>
                <Modal />
            </div>
        );
    }

    // ── Nivel clientes ────────────────────────────────────────
    return (
        <div className="gc-root">
            <header className="gc-header">
                <button className="gc-back" onClick={onBack}>← Panel</button>
                <span className="gc-header-title">🏢 Gestión de Clientes</span>
            </header>

            <div className="gc-body">
                <div className="gc-section-bar">
                    <span>Clientes</span>
                    <div style={{ display: "flex", gap: "8px" }}>
                        {clientes.length === 0 && (
                            <button className="gc-add-btn" style={{ background: "var(--color-success, #22c55e)" }}
                                onClick={handleSeed} disabled={seedeando}>
                                {seedeando ? "Importando..." : "📥 Importar datos"}
                            </button>
                        )}
                        <button className="gc-add-btn" onClick={() =>
                            setEditando({ tipo: "cliente", id: null, campos: { nombre: "", codigo: "" } })}>
                            + Nuevo cliente
                        </button>
                    </div>
                </div>

                {cargando
                    ? <div className="gc-empty">Cargando...</div>
                    : clientes.length === 0
                        ? <div className="gc-empty">No hay clientes. Agregá el primero.</div>
                        : clientes.map(c => (
                            <div key={c.id} className="gc-item gc-item--clickable"
                                onClick={() => setNivelCliente(c.id)}>
                                <div className="gc-item-main">
                                    <strong>{c.nombre}</strong>
                                    {c.codigo && <span className="gc-item-badge">{c.codigo}</span>}
                                    <span className="gc-item-sub">
                                        {objetivos.filter(o => o.clienteId === c.id).length} objetivos
                                    </span>
                                </div>
                                <div className="gc-item-actions" onClick={e => e.stopPropagation()}>
                                    <button className="gc-icon-btn" onClick={() =>
                                        setEditando({ tipo: "cliente", id: c.id, campos: { nombre: c.nombre, codigo: c.codigo || "" } })}>
                                        ✏️
                                    </button>
                                    <button className="gc-icon-btn gc-icon-btn--del" onClick={() => handleEliminar("clientes", c.id, c.nombre)}>
                                        🗑
                                    </button>
                                    <span className="gc-arrow">›</span>
                                </div>
                            </div>
                        ))
                }
            </div>
            <Modal />
        </div>
    );
}
