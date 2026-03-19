// src/screens/GestionPersonalScreen.jsx
// ABM de Supervisores y Vigiladores con asignaciones a objetivos y puestos.

import { useState, useEffect } from "react";
import { useAppData }       from "../context/AppDataContext";
import { usePersonalData }  from "../hooks/usePersonalData";
import { useClientesData }  from "../hooks/useClientesData";
import {
    collection, addDoc, updateDoc, deleteDoc,
    doc, serverTimestamp, getDocs, query, where, deleteField,
} from "firebase/firestore";
import { db } from "../firebase";
import { LEGAJOS_SEED } from "../data/legajosSeed";
import "../styles/GestionClientesScreen.css";   // reutiliza gc- base
import "../styles/GestionPersonalScreen.css";    // clases gp- específicas

// ── Blancos por tipo ──────────────────────────────────────────────────────────
const BLANK_SUPERVISOR = { nombre: "", legajo: "", email: "", telefono: "", objetivosAsignados: [] };
const BLANK_VIGILADOR  = { nombre: "", legajo: "", dni: "", email: "", telefono: "", objetivoId: "", supervisorId: "" };
const BLANK_ENCARGADO  = { nombre: "", legajo: "", dni: "", email: "", telefono: "", objetivoId: "", supervisorId: "" };

const BLANK_LEGAJO     = {
    legajo: "", nombre: "", cargo: "", tarea: "", sexo: "",
    fechaIngreso: "", dni: "", cuil: "", domicilio: "", nacimiento: "",
    cliente: "", hijos: "", centroCosto: "", proyecto: "", sucursal: "", zona: "",
    foto: "",
};

// ── Helpers de cálculo ────────────────────────────────────────────────────────
function calcAntiguedad(fecha) {
    if (!fecha) return "—";
    const parts = fecha.split("/");
    if (parts.length < 3) return "—";
    const [d, m, y] = parts.map(Number);
    const diff = (Date.now() - new Date(y, m - 1, d)) / (1000 * 60 * 60 * 24 * 365.25);
    return isNaN(diff) ? "—" : diff.toFixed(2);
}
function calcEdad(fecha) {
    if (!fecha) return "—";
    const parts = fecha.split("/");
    if (parts.length < 3) return "—";
    const [d, m, y] = parts.map(Number);
    const diff = (Date.now() - new Date(y, m - 1, d)) / (1000 * 60 * 60 * 24 * 365.25);
    return isNaN(diff) ? "—" : Math.floor(diff);
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function GestionPersonalScreen({ onBack }) {
    const { empresaNombre } = useAppData();

    const { supervisores, vigiladores, encargados, cargando, recargar } = usePersonalData(empresaNombre);
    const { clientes, objetivos, puestos } = useClientesData(empresaNombre);

    const [tab,       setTab]      = useState("supervisores"); // "supervisores" | "vigiladores" | "encargados" | "legajos"
    const [editando,  setEditando] = useState(null);           // { tipo, id, campos }
    const [guardando, setGuardando] = useState(false);
    const [error,     setError]    = useState(null);

    const [legajos,          setLegajos]          = useState([]);
    const [cargandoLegajos,  setCargandoLegajos]  = useState(false);

    const cargarLegajos = async () => {
        if (!empresaNombre) return;
        setCargandoLegajos(true);
        try {
            const snap = await getDocs(
                query(collection(db, "legajos"), where("empresa", "==", empresaNombre))
            );
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            docs.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
            setLegajos(docs);
        } catch (e) { console.error(e); }
        finally { setCargandoLegajos(false); }
    };

    useEffect(() => { cargarLegajos(); }, [empresaNombre]); // eslint-disable-line

    // ── Guardar (add / update) ────────────────────────────────
    const handleGuardar = async () => {
        setGuardando(true); setError(null);
        try {
            const { tipo, id, campos } = editando;
            const coleccion = tipo === "supervisor" ? "supervisores"
                            : tipo === "vigilador"  ? "vigiladores"
                            : tipo === "legajo"     ? "legajos"
                            :                         "encargados";
            let data;

            if (tipo === "legajo") {
                data = {
                    legajo:       campos.legajo       || "",
                    nombre:       campos.nombre.trim(),
                    cargo:        campos.cargo        || "",
                    tarea:        campos.tarea        || "",
                    sexo:         campos.sexo         || "",
                    fechaIngreso: campos.fechaIngreso || "",
                    dni:          campos.dni          || "",
                    cuil:         campos.cuil         || "",
                    domicilio:    campos.domicilio     || "",
                    nacimiento:   campos.nacimiento    || "",
                    cliente:      campos.cliente       || "",
                    hijos:        campos.hijos         || "",
                    centroCosto:  campos.centroCosto   || "",
                    proyecto:     campos.proyecto      || "",
                    sucursal:     campos.sucursal      || "",
                    zona:         campos.zona          || "",
                    foto:         campos.foto          || "",
                    empresa:      empresaNombre,
                };
            } else if (tipo === "encargado") {
                const obj = objetivos.find(o => o.id === campos.objetivoId) || null;
                const sup = supervisores.find(s => s.id === campos.supervisorId) || null;
                data = {
                    nombre:           campos.nombre.trim(),
                    legajo:           campos.legajo   || "",
                    dni:              campos.dni      || "",
                    email:            campos.email    || "",
                    telefono:         campos.telefono || "",
                    empresa:          empresaNombre,
                    objetivoId:       campos.objetivoId   || "",
                    objetivoNombre:   obj?.nombre          || "",
                    clienteId:        obj?.clienteId       || "",
                    clienteNombre:    obj?.clienteNombre   || "",
                    supervisorId:     campos.supervisorId  || "",
                    supervisorNombre: sup?.nombre          || "",
                    activo:           true,
                };
            } else if (tipo === "supervisor") {
                data = {
                    nombre:             campos.nombre.trim(),
                    legajo:             campos.legajo    || "",
                    email:              campos.email     || "",
                    telefono:           campos.telefono  || "",
                    empresa:            empresaNombre,
                    objetivosAsignados: campos.objetivosAsignados || [],
                    activo:             true,
                };
            } else {
                // Vigilador — asignación directa a objetivo (sin puesto)
                const obj = objetivos.find(o => o.id === campos.objetivoId) || null;
                const sup = supervisores.find(s => s.id === campos.supervisorId) || null;
                data = {
                    nombre:           campos.nombre.trim(),
                    legajo:           campos.legajo   || "",
                    dni:              campos.dni      || "",
                    email:            campos.email    || "",
                    telefono:         campos.telefono || "",
                    empresa:          empresaNombre,
                    objetivoId:       campos.objetivoId  || "",
                    objetivoNombre:   obj?.nombre         || "",
                    clienteId:        obj?.clienteId      || "",
                    clienteNombre:    obj?.clienteNombre  || "",
                    supervisorId:     campos.supervisorId  || "",
                    supervisorNombre: sup?.nombre          || "",
                    activo:           true,
                };
            }

            if (id) await updateDoc(doc(db, coleccion, id), data);
            else    await addDoc(collection(db, coleccion), { ...data, creadoEn: serverTimestamp() });

            if (tipo === "legajo") await cargarLegajos();
            else                   await recargar();
            setEditando(null);
        } catch (e) {
            setError("Error: " + e.message);
        } finally {
            setGuardando(false);
        }
    };

    // ── Eliminar ──────────────────────────────────────────────
    const handleEliminar = async (coleccion, id, nombre) => {
        if (!window.confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
        try {
            await deleteDoc(doc(db, coleccion, id));
            await recargar();
        } catch (e) {
            alert("Error al eliminar: " + e.message);
        }
    };

    // ── Abrir modal ───────────────────────────────────────────
    const abrirSupervisor = (s = null) => setEditando({
        tipo: "supervisor",
        id:   s?.id || null,
        campos: s ? {
            nombre:             s.nombre,
            legajo:             s.legajo    || "",
            email:              s.email     || "",
            telefono:           s.telefono  || "",
            objetivosAsignados: s.objetivosAsignados || s.puestosAsignados || [],
        } : { ...BLANK_SUPERVISOR },
    });

    const abrirVigilador = (v = null) => setEditando({
        tipo: "vigilador",
        id:   v?.id || null,
        campos: v ? {
            nombre:       v.nombre,
            legajo:       v.legajo       || "",
            dni:          v.dni          || "",
            email:        v.email        || "",
            telefono:     v.telefono     || "",
            objetivoId:   v.objetivoId   || "",
            supervisorId: v.supervisorId || "",
        } : { ...BLANK_VIGILADOR },
    });

    const abrirLegajo = (l = null) => setEditando({
        tipo: "legajo",
        id:   l?.id || null,
        campos: l ? {
            legajo: l.legajo || "", nombre: l.nombre || "", cargo: l.cargo || "",
            tarea: l.tarea || "", sexo: l.sexo || "", fechaIngreso: l.fechaIngreso || "",
            dni: l.dni || "", cuil: l.cuil || "", domicilio: l.domicilio || "",
            nacimiento: l.nacimiento || "", cliente: l.cliente || "",
            hijos: l.hijos || "", centroCosto: l.centroCosto || "",
            proyecto: l.proyecto || "", sucursal: l.sucursal || "",
            zona: l.zona || "", foto: l.foto || "",
        } : { ...BLANK_LEGAJO },
    });

    const abrirEncargado = (e = null) => setEditando({
        tipo: "encargado",
        id:   e?.id || null,
        campos: e ? {
            nombre:      e.nombre,
            legajo:      e.legajo      || "",
            dni:         e.dni         || "",
            email:       e.email       || "",
            telefono:    e.telefono    || "",
            objetivoId:  e.objetivoId  || "",
            supervisorId:e.supervisorId|| "",
        } : { ...BLANK_ENCARGADO },
    });

    // ── Modal ─────────────────────────────────────────────────
    const Modal = () => {
        if (!editando) return null;
        const { tipo, id, campos } = editando;
        const setC = (k, v) => setEditando(e => ({ ...e, campos: { ...e.campos, [k]: v } }));
        const titulo = `${id ? "Editar" : "Nuevo/a"} ${tipo}`;

        const toggleObjetivo = (o) => {
            const actual = campos.objetivosAsignados || [];
            const existe = actual.some(x => x.id === o.id);
            setC("objetivosAsignados",
                existe
                    ? actual.filter(x => x.id !== o.id)
                    : [...actual, { id: o.id, nombre: o.nombre, proyecto: o.proyecto || "", codigo: o.codigo || "" }]
            );
        };

        return (
            <div className="gc-modal-overlay" onClick={() => setEditando(null)}>
                <div className="gc-modal gp-modal" onClick={e => e.stopPropagation()}>
                    <div className="gc-modal-title">
                        {tipo === "supervisor" ? "🔍" : tipo === "encargado" ? "🏅" : tipo === "legajo" ? "📋" : "👷"} {titulo.charAt(0).toUpperCase() + titulo.slice(1)}
                    </div>

                    {/* ── Formulario de Legajo (HR completo) ── */}
                    {tipo === "legajo" && (
                        <div className="gp-form-grid">
                            <div>
                                <label className="gc-label">Legajo *</label>
                                <input className="gc-input" autoFocus value={campos.legajo || ""} onChange={e => setC("legajo", e.target.value)} placeholder="Ej: 20250" />
                            </div>
                            <div>
                                <label className="gc-label">Nombre y Apellido *</label>
                                <input className="gc-input" value={campos.nombre || ""} onChange={e => setC("nombre", e.target.value)} placeholder="APELLIDO Nombre..." />
                            </div>
                            <div>
                                <label className="gc-label">Cargo</label>
                                <select className="gc-input gp-select" value={campos.cargo || ""} onChange={e => setC("cargo", e.target.value)}>
                                    <option value="">— Seleccionar cargo —</option>
                                    <option>Vigilador General</option>
                                    <option>Vigilador Administrativo</option>
                                    <option>Vigilador Bombero</option>
                                    <option>Vigilador Principal</option>
                                    <option>Verificador de eventos</option>
                                    <option>Operador de Monitoreo</option>
                                    <option>Instalador de elementos</option>
                                </select>
                            </div>
                            <div>
                                <label className="gc-label">Tarea</label>
                                <select className="gc-input gp-select" value={campos.tarea || ""} onChange={e => setC("tarea", e.target.value)}>
                                    <option value="">— Seleccionar tarea —</option>
                                    <option>Vigilador</option>
                                    <option>Administrativo</option>
                                    <option>Encargado</option>
                                    <option>Conductor</option>
                                    <option>Operador Monitoreo</option>
                                    <option>Operador en cliente</option>
                                    <option>Supervisor (FC)</option>
                                    <option>Jefe</option>
                                    <option>Recepcionista</option>
                                </select>
                            </div>
                            <div>
                                <label className="gc-label">Sexo</label>
                                <select className="gc-input gp-select" value={campos.sexo || ""} onChange={e => setC("sexo", e.target.value)}>
                                    <option value="">—</option>
                                    <option value="M">M</option>
                                    <option value="F">F</option>
                                </select>
                            </div>
                            <div>
                                <label className="gc-label">Fecha de Ingreso</label>
                                <input className="gc-input" value={campos.fechaIngreso || ""} onChange={e => setC("fechaIngreso", e.target.value)} placeholder="dd/MM/aaaa" />
                            </div>
                            <div>
                                <label className="gc-label">DNI</label>
                                <input className="gc-input" value={campos.dni || ""} onChange={e => setC("dni", e.target.value)} placeholder="Ej: 30123456" />
                            </div>
                            <div>
                                <label className="gc-label">CUIL</label>
                                <input className="gc-input" value={campos.cuil || ""} onChange={e => setC("cuil", e.target.value)} placeholder="Ej: 20301234565" />
                            </div>
                            <div className="gp-form-full">
                                <label className="gc-label">Domicilio</label>
                                <input className="gc-input" value={campos.domicilio || ""} onChange={e => setC("domicilio", e.target.value)} placeholder="Calle, número, ciudad..." />
                            </div>
                            <div>
                                <label className="gc-label">Nacimiento</label>
                                <input className="gc-input" value={campos.nacimiento || ""} onChange={e => setC("nacimiento", e.target.value)} placeholder="dd/MM/aaaa" />
                            </div>
                            <div>
                                <label className="gc-label">Cliente</label>
                                <input className="gc-input" value={campos.cliente || ""} onChange={e => setC("cliente", e.target.value)} placeholder="Ej: Panamerican Silver" />
                            </div>
                            <div>
                                <label className="gc-label">Hijos</label>
                                <input className="gc-input" type="number" min="0" value={campos.hijos || ""} onChange={e => setC("hijos", e.target.value)} placeholder="0" />
                            </div>
                            <div>
                                <label className="gc-label">Centro de Costo</label>
                                <input className="gc-input" value={campos.centroCosto || ""} onChange={e => setC("centroCosto", e.target.value)} placeholder="Ej: 217" />
                            </div>
                            <div>
                                <label className="gc-label">Proyecto</label>
                                <input className="gc-input" value={campos.proyecto || ""} onChange={e => setC("proyecto", e.target.value)} placeholder="Ej: Seguridad Fisica Cerro Moro" />
                            </div>
                            <div>
                                <label className="gc-label">Sucursal</label>
                                <input className="gc-input" value={campos.sucursal || ""} onChange={e => setC("sucursal", e.target.value)} placeholder="Ej: Santa Cruz" />
                            </div>
                            <div>
                                <label className="gc-label">Zona</label>
                                <input className="gc-input" value={campos.zona || ""} onChange={e => setC("zona", e.target.value)} placeholder="Ej: Santa Cruz" />
                            </div>
                            <div className="gp-form-full">
                                <label className="gc-label">Foto (URL o nombre de archivo)</label>
                                <input className="gc-input" value={campos.foto || ""} onChange={e => setC("foto", e.target.value)} placeholder="Ej: 20250.jpg" />
                            </div>
                        </div>
                    )}

                    {/* ── Campos comunes (no legajo) ── */}
                    {tipo !== "legajo" && (<>
                    <label className="gc-label">Nombre completo *</label>
                    <input className="gc-input" autoFocus
                        value={campos.nombre || ""}
                        onChange={e => setC("nombre", e.target.value)}
                        placeholder="Apellido, Nombre..." />

                    <label className="gc-label">Legajo / N° empleado</label>
                    <input className="gc-input"
                        value={campos.legajo || ""}
                        onChange={e => setC("legajo", e.target.value)}
                        placeholder="Ej: 12345" />

                    {(tipo === "vigilador" || tipo === "encargado") && (
                        <>
                            <label className="gc-label">DNI</label>
                            <input className="gc-input"
                                value={campos.dni || ""}
                                onChange={e => setC("dni", e.target.value)}
                                placeholder="Ej: 30123456" />
                        </>
                    )}

                    <label className="gc-label">Email</label>
                    <input className="gc-input" type="email"
                        value={campos.email || ""}
                        onChange={e => setC("email", e.target.value)}
                        placeholder="email@empresa.com" />

                    <label className="gc-label">Teléfono</label>
                    <input className="gc-input"
                        value={campos.telefono || ""}
                        onChange={e => setC("telefono", e.target.value)}
                        placeholder="Ej: 11 1234-5678" />
                    </>)}

                    {/* Supervisor: asignar objetivos (checkboxes) */}
                    {tipo === "supervisor" && objetivos.length > 0 && (
                        <>
                            <label className="gc-label">Objetivos asignados</label>
                            <div className="gp-obj-list">
                                {[...objetivos]
                                    .sort((a, b) => (a.codigo || "").localeCompare(b.codigo || ""))
                                    .map(o => {
                                        const sel = (campos.objetivosAsignados || []).some(x => x.id === o.id);
                                        const cli = clientes.find(c => c.id === o.clienteId);
                                        const partes = [];
                                        if (cli?.nombre) partes.push(cli.nombre);
                                        if (o.nombre !== cli?.nombre) partes.push(o.nombre);
                                        const etiqueta = partes.join(" — ");
                                        return (
                                            <label key={o.id} className={`gp-obj-check ${sel ? "gp-obj-check--sel" : ""}`}>
                                                <input type="checkbox" checked={sel}
                                                    onChange={() => toggleObjetivo(o)} />
                                                <div className="gp-obj-texto">
                                                    {o.codigo && <span className="gp-obj-id">{o.codigo}</span>}
                                                    <strong>{etiqueta}</strong>
                                                </div>
                                            </label>
                                        );
                                    })
                                }
                            </div>
                        </>
                    )}

                    {/* Encargado: asignar objetivo y supervisor */}
                    {tipo === "encargado" && (
                        <>
                            <label className="gc-label">Objetivo a cargo</label>
                            <select className="gc-input gp-select"
                                value={campos.objetivoId || ""}
                                onChange={e => setC("objetivoId", e.target.value)}>
                                <option value="">-- Sin objetivo asignado --</option>
                                {[...objetivos]
                                    .sort((a, b) => a.nombre.localeCompare(b.nombre))
                                    .map(o => (
                                        <option key={o.id} value={o.id}>
                                            {o.nombre}{o.clienteNombre ? ` · ${o.clienteNombre}` : ""}
                                        </option>
                                    ))
                                }
                            </select>

                            <label className="gc-label">Supervisor a cargo</label>
                            <select className="gc-input gp-select"
                                value={campos.supervisorId || ""}
                                onChange={e => setC("supervisorId", e.target.value)}>
                                <option value="">-- Sin supervisor asignado --</option>
                                {[...supervisores]
                                    .sort((a, b) => a.nombre.localeCompare(b.nombre))
                                    .map(s => (
                                        <option key={s.id} value={s.id}>{s.nombre}</option>
                                    ))
                                }
                            </select>
                        </>
                    )}

                    {/* Vigilador: asignar objetivo y supervisor */}
                    {tipo === "vigilador" && (
                        <>
                            <label className="gc-label">Objetivo (cliente) asignado</label>
                            <select className="gc-input gp-select"
                                value={campos.objetivoId || ""}
                                onChange={e => setC("objetivoId", e.target.value)}>
                                <option value="">-- Sin objetivo asignado --</option>
                                {[...objetivos]
                                    .sort((a, b) => a.nombre.localeCompare(b.nombre))
                                    .map(o => (
                                        <option key={o.id} value={o.id}>
                                            {o.nombre}{o.clienteNombre ? ` · ${o.clienteNombre}` : ""}
                                        </option>
                                    ))
                                }
                            </select>

                            <label className="gc-label">Supervisor a cargo</label>
                            <select className="gc-input gp-select"
                                value={campos.supervisorId || ""}
                                onChange={e => setC("supervisorId", e.target.value)}>
                                <option value="">-- Sin supervisor asignado --</option>
                                {[...supervisores]
                                    .sort((a, b) => a.nombre.localeCompare(b.nombre))
                                    .map(s => (
                                        <option key={s.id} value={s.id}>{s.nombre}</option>
                                    ))
                                }
                            </select>
                        </>
                    )}

                    {error && <div className="gc-error">{error}</div>}

                    <div className="gc-modal-btns">
                        <button className="gc-btn gc-btn--ghost" onClick={() => setEditando(null)}>
                            Cancelar
                        </button>
                        <button className="gc-btn gc-btn--primary"
                            onClick={handleGuardar}
                            disabled={tipo === "legajo" ? !campos.legajo?.trim() : !campos.nombre?.trim() || guardando}>
                            {guardando ? "Guardando..." : "Guardar"}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ── Migración: Vigilador General → Vigilador ──────────────
    useEffect(() => {
        const migrar = async () => {
            if (!empresaNombre || legajos.length === 0) return;
            const RENAMES = { "Vigilador General": "Vigilador", "Vigilador Administrativo": "Administrativo", "Operador de Monitoreo": "Operador Monitoreo" };
            const CLIENTE_MAP = {
                // proyecto (del legajo) → Razón Social correcta
                "Brinks Argentina":              "Brinks Argentina S.A.",
                "Seguridad Fisica Reginald Lee": "Reginald Lee S.A.",
                "Seguridad Fisica Ovnisa":       "Ovnisa S.A.",
                "Seguridad Fisica Cerro Moro":   "Panamerican Silver",
                "ATM Neutrales Santander":       "Banco Santander S.A.",
            };
            const conSab     = legajos.filter(l => l.sab1 !== undefined || l.sab2 !== undefined || l.sab3 !== undefined || l.sab4 !== undefined || l.servicio !== undefined);
            const aCorregir  = legajos.filter(l => RENAMES[l.tarea]);
            const aCliente   = legajos.filter(l => l.proyecto && CLIENTE_MAP[l.proyecto] && l.cliente !== CLIENTE_MAP[l.proyecto]);
            const ids = new Set([...conSab.map(l => l.id), ...aCorregir.map(l => l.id), ...aCliente.map(l => l.id)]);
            if (ids.size === 0) return;
            for (const id of ids) {
                const l = legajos.find(x => x.id === id);
                const patch = {};
                if (RENAMES[l.tarea])                                              patch.tarea   = RENAMES[l.tarea];
                if (l.sab1 !== undefined)                                          patch.sab1    = deleteField();
                if (l.sab2 !== undefined)                                          patch.sab2    = deleteField();
                if (l.sab3 !== undefined)                                          patch.sab3    = deleteField();
                if (l.sab4 !== undefined)                                          patch.sab4    = deleteField();
                if (l.servicio !== undefined)                                     { patch.cliente = l.servicio; patch.servicio = deleteField(); }
                if (l.proyecto && CLIENTE_MAP[l.proyecto] && l.cliente !== CLIENTE_MAP[l.proyecto])
                                                                                   patch.cliente = CLIENTE_MAP[l.proyecto];
                await updateDoc(doc(db, "legajos", id), patch);
            }
            await cargarLegajos();
        };
        migrar().catch(console.error);
    }, [legajos.length]); // eslint-disable-line

    // ── Importar seed ─────────────────────────────────────────
    const [importando, setImportando] = useState(false);
    const handleImportarSeed = async () => {
        if (!window.confirm(`¿Importar ${LEGAJOS_SEED.length} legajos de muestra? Esto agrega los registros a la base de datos.`)) return;
        setImportando(true);
        try {
            for (const l of LEGAJOS_SEED) {
                await addDoc(collection(db, "legajos"), { ...l, empresa: empresaNombre, creadoEn: serverTimestamp() });
            }
            await cargarLegajos();
            alert("✅ Importación completa.");
        } catch (e) {
            alert("Error: " + e.message);
        } finally {
            setImportando(false);
        }
    };

    // ── Panel legajos ─────────────────────────────────────────
    const renderLegajos = () => (
        <div className="gc-body">
            <div className="gc-section-bar">
                <span>Legajos ({legajos.length})</span>
                <div style={{ display: "flex", gap: 8 }}>
                    {legajos.length === 0 && (
                        <button className="gc-add-btn" style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" }}
                            onClick={handleImportarSeed} disabled={importando}>
                            {importando ? "Importando..." : "⬇ Importar datos"}
                        </button>
                    )}
                    <button className="gc-add-btn" onClick={() => abrirLegajo()}>
                        + Nuevo legajo
                    </button>
                </div>
            </div>

            {cargandoLegajos
                ? <div className="gc-empty">Cargando...</div>
                : legajos.length === 0
                    ? <div className="gc-empty">No hay legajos cargados. Agregá el primero.</div>
                    : (
                        <div className="gp-table-wrap">
                            <table className="gp-table">
                                <thead>
                                    <tr>
                                        <th>Legajo</th>
                                        <th>Nombre y Apellido</th>
                                        <th>Tarea</th>
                                        <th>Cargo</th>
                                        <th>DNI</th>
                                        <th>Zona</th>
                                        <th>Cliente</th>
                                        <th>Ingreso</th>
                                        <th>Antigüedad</th>
                                        <th>Nacimiento</th>
                                        <th>Edad</th>
                                        <th>Sucursal</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {legajos.map(l => (
                                        <tr key={l.id}>
                                            <td className="gp-td-leg">{l.legajo || "—"}</td>
                                            <td className="gp-td-nombre">{l.nombre}</td>
                                            <td><span className={`gp-tarea-badge gp-tarea--${(l.tarea || "").toLowerCase().replace(/\s+/g, "-").replace(/[()]/g, "")}`}>{l.tarea || "—"}</span></td>
                                            <td>{l.cargo || "—"}</td>
                                            <td>{l.dni || "—"}</td>
                                            <td>{l.zona || "—"}</td>
                                            <td>{l.cliente || "—"}</td>
                                            <td>{l.fechaIngreso || "—"}</td>
                                            <td>{calcAntiguedad(l.fechaIngreso)}</td>
                                            <td>{l.nacimiento || "—"}</td>
                                            <td>{calcEdad(l.nacimiento)}</td>
                                            <td>{l.sucursal || "—"}</td>
                                            <td className="gp-td-actions">
                                                <button className="gc-icon-btn" onClick={() => abrirLegajo(l)}>✏️</button>
                                                <button className="gc-icon-btn gc-icon-btn--del"
                                                    onClick={() => handleEliminar("legajos", l.id, l.nombre)}>🗑</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
            }
        </div>
    );

    // ── Panel supervisores ────────────────────────────────────
    const renderSupervisores = () => (
        <div className="gc-body">
            <div className="gc-section-bar">
                <span>Supervisores ({supervisores.length})</span>
                <button className="gc-add-btn" onClick={() => abrirSupervisor()}>
                    + Nuevo supervisor
                </button>
            </div>

            {cargando
                ? <div className="gc-empty">Cargando...</div>
                : supervisores.length === 0
                    ? <div className="gc-empty">No hay supervisores cargados. Agregá el primero.</div>
                    : [...supervisores]
                        .sort((a, b) => a.nombre.localeCompare(b.nombre))
                        .map(s => {
                            const nPuestos = (s.puestosAsignados || s.objetivosAsignados || []).length;
                            const listaPuestos = (s.puestosAsignados || s.objetivosAsignados || []).map(p => p.nombre).join(", ");
                            return (
                                <div key={s.id} className="gc-item">
                                    <div className="gc-item-main">
                                        <div className="gc-item-nombre-row">
                                            <strong>{s.nombre}</strong>
                                            {s.legajo && <span className="gc-item-badge">Leg. {s.legajo}</span>}
                                        </div>
                                        <span className="gc-item-sub">
                                            🎯{" "}
                                            {nPuestos > 0
                                                ? `${nPuestos} puesto${nPuestos > 1 ? "s" : ""}: ${listaPuestos}`
                                                : "Sin puestos asignados"}
                                        </span>
                                        {(s.telefono || s.email) && (
                                            <span className="gc-item-sub">
                                                {s.telefono && `📞 ${s.telefono}`}
                                                {s.telefono && s.email && " · "}
                                                {s.email && `✉️ ${s.email}`}
                                            </span>
                                        )}
                                    </div>
                                    <div className="gc-item-actions">
                                        <button className="gc-icon-btn" onClick={() => abrirSupervisor(s)}>✏️</button>
                                        <button className="gc-icon-btn gc-icon-btn--del"
                                            onClick={() => handleEliminar("supervisores", s.id, s.nombre)}>🗑</button>
                                    </div>
                                </div>
                            );
                        })
            }
        </div>
    );

    // ── Panel vigiladores ─────────────────────────────────────
    const renderVigiladores = () => (
        <div className="gc-body">
            <div className="gc-section-bar">
                <span>Vigiladores ({vigiladores.length})</span>
                <button className="gc-add-btn" onClick={() => abrirVigilador()}>
                    + Nuevo vigilador
                </button>
            </div>

            {cargando
                ? <div className="gc-empty">Cargando...</div>
                : vigiladores.length === 0
                    ? <div className="gc-empty">No hay vigiladores cargados. Agregá el primero.</div>
                    : [...vigiladores]
                        .sort((a, b) => a.nombre.localeCompare(b.nombre))
                        .map(v => (
                            <div key={v.id} className="gc-item">
                                <div className="gc-item-main">
                                    <div className="gc-item-nombre-row">
                                        <strong>{v.nombre}</strong>
                                        {v.legajo && <span className="gc-item-badge">Leg. {v.legajo}</span>}
                                        {v.dni    && <span className="gc-item-badge gp-badge--dni">DNI {v.dni}</span>}
                                    </div>
                                    {(v.objetivoNombre || v.clienteNombre) && (
                                        <span className="gc-item-sub">
                                            📍 {[v.objetivoNombre, v.clienteNombre].filter(Boolean).join(" · ")}
                                        </span>
                                    )}
                                    {v.supervisorNombre && (
                                        <span className="gc-item-sub">🔍 Sup: {v.supervisorNombre}</span>
                                    )}
                                    {(v.telefono || v.email) && (
                                        <span className="gc-item-sub">
                                            {v.telefono && `📞 ${v.telefono}`}
                                            {v.telefono && v.email && " · "}
                                            {v.email && `✉️ ${v.email}`}
                                        </span>
                                    )}
                                </div>
                                <div className="gc-item-actions">
                                    <button className="gc-icon-btn" onClick={() => abrirVigilador(v)}>✏️</button>
                                    <button className="gc-icon-btn gc-icon-btn--del"
                                        onClick={() => handleEliminar("vigiladores", v.id, v.nombre)}>🗑</button>
                                </div>
                            </div>
                        ))
            }
        </div>
    );

    // ── Panel encargados ──────────────────────────────────────
    const renderEncargados = () => (
        <div className="gc-body">
            <div className="gc-section-bar">
                <span>Encargados ({encargados.length})</span>
                <button className="gc-add-btn" onClick={() => abrirEncargado()}>
                    + Nuevo encargado
                </button>
            </div>

            {cargando
                ? <div className="gc-empty">Cargando...</div>
                : encargados.length === 0
                    ? <div className="gc-empty">No hay encargados cargados. Agregá el primero.</div>
                    : [...encargados]
                        .sort((a, b) => a.nombre.localeCompare(b.nombre))
                        .map(e => (
                            <div key={e.id} className="gc-item">
                                <div className="gc-item-main">
                                    <div className="gc-item-nombre-row">
                                        <strong>{e.nombre}</strong>
                                        {e.legajo && <span className="gc-item-badge">Leg. {e.legajo}</span>}
                                        {e.dni    && <span className="gc-item-badge gp-badge--dni">DNI {e.dni}</span>}
                                    </div>
                                    {(e.objetivoNombre || e.clienteNombre) && (
                                        <span className="gc-item-sub">
                                            📍 {[e.objetivoNombre, e.clienteNombre].filter(Boolean).join(" · ")}
                                        </span>
                                    )}
                                    {e.supervisorNombre && (
                                        <span className="gc-item-sub">🔍 Sup: {e.supervisorNombre}</span>
                                    )}
                                    {(e.telefono || e.email) && (
                                        <span className="gc-item-sub">
                                            {e.telefono && `📞 ${e.telefono}`}
                                            {e.telefono && e.email && " · "}
                                            {e.email && `✉️ ${e.email}`}
                                        </span>
                                    )}
                                </div>
                                <div className="gc-item-actions">
                                    <button className="gc-icon-btn" onClick={() => abrirEncargado(e)}>✏️</button>
                                    <button className="gc-icon-btn gc-icon-btn--del"
                                        onClick={() => handleEliminar("encargados", e.id, e.nombre)}>🗑</button>
                                </div>
                            </div>
                        ))
            }
        </div>
    );

    // ── Render ────────────────────────────────────────────────
    return (
        <div className="gc-root">
            <header className="gc-header">
                <button className="gc-back" onClick={onBack}>← Panel</button>
                <span className="gc-header-title">👥 Gestión de Personal</span>
            </header>

            <div className="gp-tabs">
                <button
                    className={`gp-tab ${tab === "supervisores" ? "gp-tab--active" : ""}`}
                    onClick={() => setTab("supervisores")}>
                    🔍 Supervisores
                </button>
                <button
                    className={`gp-tab ${tab === "encargados" ? "gp-tab--active" : ""}`}
                    onClick={() => setTab("encargados")}>
                    🏅 Encargados
                </button>
                <button
                    className={`gp-tab ${tab === "vigiladores" ? "gp-tab--active" : ""}`}
                    onClick={() => setTab("vigiladores")}>
                    👷 Vigiladores
                </button>
                <button
                    className={`gp-tab ${tab === "legajos" ? "gp-tab--active" : ""}`}
                    onClick={() => setTab("legajos")}>
                    📋 Legajos
                </button>
            </div>

            {tab === "supervisores" ? renderSupervisores()
           : tab === "encargados"  ? renderEncargados()
           : tab === "legajos"     ? renderLegajos()
           :                         renderVigiladores()}

            <Modal />
        </div>
    );
}
