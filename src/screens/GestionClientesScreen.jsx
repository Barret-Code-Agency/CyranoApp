// src/screens/GestionClientesScreen.jsx
// ABM de Clientes → Objetivos (estructura plana: una fila Excel = un objetivo)

import { useState } from "react";
import { SEED_CLIENTES, SEED_OBJETIVOS } from "../data/seedClientesData";
import { useAppData } from "../context/AppDataContext";
import {
    collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useClientesData } from "../hooks/useClientesData";
import "../styles/GestionClientesScreen.css";

export default function GestionClientesScreen({ onBack }) {
    const { empresaNombre } = useAppData();
    const { clientes, objetivos, cargando, recargar } = useClientesData(empresaNombre);

    const [nivelCliente, setNivelCliente] = useState(null);
    const [editando,     setEditando]     = useState(null);
    const [guardando,    setGuardando]    = useState(false);
    const [error,        setError]        = useState(null);
    const [seedeando,    setSeedeando]    = useState(false);

    // ── Importar desde seed (idempotente — setDoc sobrescribe) ────────────────
    const handleSeed = async () => {
        const total = SEED_CLIENTES.length + SEED_OBJETIVOS.length;
        if (!window.confirm(`¿Importar / actualizar ${total} registros (${SEED_CLIENTES.length} clientes + ${SEED_OBJETIVOS.length} objetivos)?`)) return;
        setSeedeando(true);
        try {
            for (const c of SEED_CLIENTES) {
                await setDoc(doc(db, "clientes", c.id), {
                    nombre:    c.nombre,
                    empresa:   empresaNombre,
                    creadoEn:  serverTimestamp(),
                }, { merge: true });
            }
            for (const o of SEED_OBJETIVOS) {
                const clienteNombre = SEED_CLIENTES.find(c => c.id === o.clienteId)?.nombre || "";
                await setDoc(doc(db, "objetivos", o.codigo), {
                    codigo:        o.codigo,
                    proyecto:      o.proyecto,
                    nombre:        o.nombre,
                    clienteId:     o.clienteId,
                    clienteNombre: clienteNombre,
                    domicilio:     o.domicilio || "",
                    horasLunes:    o.horasLunes,
                    horasMartes:   o.horasMartes,
                    horasMiercoles:o.horasMiercoles,
                    horasJueves:   o.horasJueves,
                    horasViernes:  o.horasViernes,
                    horasSabado:   o.horasSabado,
                    horasDomingo:  o.horasDomingo,
                    horasFeriados: o.horasFeriados,
                    empresa:       empresaNombre,
                    creadoEn:      serverTimestamp(),
                }, { merge: true });
            }
            await recargar();
            alert(`✅ ${total} registros importados correctamente.`);
        } catch (e) {
            alert("Error al importar: " + e.message);
        } finally {
            setSeedeando(false);
        }
    };

    // ── Guardar (add / update) ────────────────────────────────────────────────
    const handleGuardar = async () => {
        setGuardando(true); setError(null);
        try {
            const { tipo, id, campos } = editando;

            if (tipo === "cliente") {
                const data = { nombre: campos.nombre, empresa: empresaNombre };
                if (id) await updateDoc(doc(db, "clientes", id), data);
                else    await addDoc(collection(db, "clientes"), { ...data, creadoEn: serverTimestamp() });
            }
            else if (tipo === "objetivo") {
                const cl = clientes.find(c => c.id === nivelCliente);
                const data = {
                    codigo:        campos.codigo   || "",
                    proyecto:      campos.proyecto || "",
                    nombre:        campos.nombre,
                    domicilio:     campos.domicilio || "",
                    clienteId:     nivelCliente,
                    clienteNombre: cl?.nombre || "",
                    empresa:       empresaNombre,
                };
                if (id) await updateDoc(doc(db, "objetivos", id), data);
                else    await addDoc(collection(db, "objetivos"), { ...data, creadoEn: serverTimestamp() });
            }

            await recargar();
            setEditando(null);
        } catch (e) {
            setError("Error: " + e.message);
        } finally {
            setGuardando(false);
        }
    };

    // ── Eliminar ──────────────────────────────────────────────────────────────
    const handleEliminar = async (coleccion, id, nombre) => {
        if (!window.confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
        try {
            await deleteDoc(doc(db, coleccion, id));
            await recargar();
            if (coleccion === "clientes") setNivelCliente(null);
        } catch (e) {
            alert("Error al eliminar: " + e.message);
        }
    };

    // ── Modal ─────────────────────────────────────────────────────────────────
    const Modal = () => {
        if (!editando) return null;
        const { tipo, id, campos } = editando;
        const setC = (k, v) => setEditando(e => ({ ...e, campos: { ...e.campos, [k]: v } }));

        return (
            <div className="gc-modal-overlay" onClick={() => setEditando(null)}>
                <div className="gc-modal" onClick={e => e.stopPropagation()}>
                    <div className="gc-modal-title">
                        {id ? "Editar" : "Nuevo"} {tipo}
                    </div>

                    {tipo === "objetivo" && (
                        <>
                            <label className="gc-label">Código (CC-Proyecto-Objetivo)</label>
                            <input className="gc-input" value={campos.codigo || ""}
                                onChange={e => setC("codigo", e.target.value)} placeholder="Ej: 217-103-2" />
                            <label className="gc-label">Proyecto</label>
                            <input className="gc-input" value={campos.proyecto || ""}
                                onChange={e => setC("proyecto", e.target.value)} placeholder="Ej: Cerro Moro" autoFocus />
                        </>
                    )}

                    <label className="gc-label">Nombre</label>
                    <input className="gc-input" value={campos.nombre || ""}
                        onChange={e => setC("nombre", e.target.value)}
                        placeholder={tipo === "objetivo" ? "Ej: PAS Supervisor" : "Nombre del cliente..."}
                        autoFocus={tipo === "cliente"} />

                    {tipo === "objetivo" && (
                        <>
                            <label className="gc-label">Domicilio</label>
                            <input className="gc-input" value={campos.domicilio || ""}
                                onChange={e => setC("domicilio", e.target.value)} placeholder="Dirección del objetivo..." />
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

    const clienteActual = clientes.find(c => c.id === nivelCliente);

    // ── Nivel objetivos ───────────────────────────────────────────────────────
    if (nivelCliente) {
        const lista = objetivos
            .filter(o => o.clienteId === nivelCliente)
            .sort((a, b) => (a.codigo || "").localeCompare(b.codigo || ""));

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
                            setEditando({ tipo: "objetivo", id: null, campos: { codigo: "", proyecto: "", nombre: "", domicilio: "" } })}>
                            + Nuevo objetivo
                        </button>
                    </div>

                    {lista.length === 0
                        ? <div className="gc-empty">No hay objetivos. Usá "Importar datos" para cargar desde el Excel.</div>
                        : lista.map(o => (
                            <div key={o.id} className="gc-item">
                                <div className="gc-item-main">
                                    <div className="gc-item-nombre-row">
                                        {o.codigo && <span className="gc-item-badge">{o.codigo}</span>}
                                        <strong>{o.proyecto} — {o.nombre}</strong>
                                    </div>
                                    {o.domicilio && <span className="gc-item-sub">📍 {o.domicilio}</span>}
                                </div>
                                <div className="gc-item-actions">
                                    <button className="gc-icon-btn" onClick={() =>
                                        setEditando({ tipo: "objetivo", id: o.id, campos: { codigo: o.codigo || "", proyecto: o.proyecto || "", nombre: o.nombre, domicilio: o.domicilio || "" } })}>
                                        ✏️
                                    </button>
                                    <button className="gc-icon-btn gc-icon-btn--del" onClick={() => handleEliminar("objetivos", o.id, o.nombre)}>
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

    // ── Nivel clientes ────────────────────────────────────────────────────────
    return (
        <div className="gc-root">
            <header className="gc-header">
                <button className="gc-back" onClick={onBack}>← Panel</button>
                <span className="gc-header-title">🏢 Gestión de Clientes</span>
            </header>

            <div className="gc-body">
                <div className="gc-section-bar">
                    <span>Clientes</span>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button className="gc-add-btn" style={{ background: "var(--color-success, #22c55e)" }}
                            onClick={handleSeed} disabled={seedeando}>
                            {seedeando ? "Importando..." : "📥 Importar / actualizar datos"}
                        </button>
                        <button className="gc-add-btn" onClick={() =>
                            setEditando({ tipo: "cliente", id: null, campos: { nombre: "" } })}>
                            + Nuevo cliente
                        </button>
                    </div>
                </div>

                {cargando
                    ? <div className="gc-empty">Cargando...</div>
                    : clientes.length === 0
                        ? <div className="gc-empty">No hay clientes. Usá "Importar / actualizar datos".</div>
                        : clientes.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(c => (
                            <div key={c.id} className="gc-item gc-item--clickable"
                                onClick={() => setNivelCliente(c.id)}>
                                <div className="gc-item-main">
                                    <div className="gc-item-nombre-row">
                                        <strong>{c.nombre}</strong>
                                    </div>
                                    <span className="gc-item-sub">
                                        {objetivos.filter(o => o.clienteId === c.id).length} objetivos
                                    </span>
                                </div>
                                <div className="gc-item-actions" onClick={e => e.stopPropagation()}>
                                    <button className="gc-icon-btn" onClick={() =>
                                        setEditando({ tipo: "cliente", id: c.id, campos: { nombre: c.nombre } })}>
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
