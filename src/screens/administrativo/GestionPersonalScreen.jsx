// src/screens/GestionPersonalScreen.jsx
// ABM de Supervisores y Vigiladores con asignaciones a objetivos y puestos.

import { useState, useEffect } from "react";
import { useAppData }       from "../../context/AppDataContext";
import { usePersonalData }  from "../../hooks/usePersonalData";
import { useClientesData }  from "../../hooks/useClientesData";
import { fmtObjetivo }      from "../../utils/formatters";
import {
    collection, addDoc, updateDoc, deleteDoc,
    doc, serverTimestamp, getDocs, query, where, deleteField,
} from "firebase/firestore";
import { db } from "../../firebase";
import { LEGAJOS_SEED } from "../../data/legajosSeed";
import "./GestionClientesScreen.css";   // reutiliza gc- base
import "./GestionPersonalScreen.css";    // clases gp- específicas

// ── Módulos habilitables (todos los perfiles, sin iconos) ─────────────────────
const MODULOS_POR_PERFIL = [
    {
        perfil: "Administrativo",
        modulos: [
            { id: "muro_comunicacion",  label: "Muro de Comunicación y Novedades" },
            { id: "planillas",          label: "Planillas"                         },
            { id: "informes",           label: "Informes"                          },
            { id: "turnos",             label: "Turnos de trabajo"                 },
            { id: "actualizacion_datos",label: "Actualización de Datos"            },
            { id: "dashboard_personal", label: "Dashboard de Personal"             },
            { id: "facturacion",        label: "Facturación"                       },
            { id: "control_horas",      label: "Control de horas"                  },
            { id: "ausentismo",         label: "Ausentismo"                        },
        ],
    },
    {
        perfil: "Supervisor",
        modulos: [
            { id: "muro_comunicacion",             label: "Muro de Comunicación y Novedades"       },
            { id: "supervision",                   label: "Supervisión"                            },
            { id: "rondas_plantillas",             label: "Cargar plantillas de ronda"             },
            { id: "control_actividades_vigilador", label: "Control de Actividades Vigilador"       },
            { id: "redactar_informe",              label: "Redactar informe"                       },
            { id: "turnos",                        label: "Turnos de trabajo"                      },
            { id: "auditoria_puesto",              label: "Auditoría de Puesto"                    },
            { id: "felicitaciones_sanciones",      label: "Registro de Felicitaciones y Sanciones" },
            { id: "informe_gestion",               label: "Informe de Gestión"                     },
            { id: "informe_visita",                label: "Informe de Visita al Cliente"           },
            { id: "dashboard_personal",            label: "Dashboard de Personal"                  },
            { id: "muro_procedimientos",           label: "Muro de Procedimientos"                 },
            { id: "capacitacion",                  label: "Capacitación y Entrenamiento"           },
        ],
    },
    {
        perfil: "Vigilador",
        modulos: [
            { id: "muro_comunicacion",   label: "Muro de Comunicación y Novedades" },
            { id: "libro_actas",         label: "Libro de Actas Digital"           },
            { id: "realizar_ronda",      label: "Realizar Ronda"                   },
            { id: "control_vehicular",   label: "Control de Vehículo"              },
            { id: "planillas",           label: "Planillas"                        },
            { id: "informes",            label: "Informes"                         },
            { id: "turnos_ver",          label: "Mis Turnos"                       },
            { id: "pedido_insumos",      label: "Pedido de Insumos"               },
            { id: "inventarios",         label: "Inventarios"                      },
            { id: "muro_procedimientos", label: "Muro de Procedimientos"           },
            { id: "capacitacion",        label: "Capacitación y Entrenamiento"     },
        ],
    },
];

// ── Blancos por tipo ──────────────────────────────────────────────────────────
const BLANK_SUPERVISOR = { nombre: "", legajo: "", modulosAcceso: [] };
const BLANK_CONDUCTOR  = { nombre: "", legajo: "", modulosAcceso: [
    "muro_comunicacion", "libro_actas", "realizar_ronda", "control_vehicular",
    "planillas", "informes", "turnos_ver", "pedido_insumos",
    "inventarios", "muro_procedimientos", "capacitacion",
] }; // todos los módulos de vigilador
const BLANK_ENCARGADO  = { nombre: "", legajo: "", modulosAcceso: [] };
const BLANK_ADMIN      = { nombre: "", legajo: "", modulosAcceso: [] };

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

    const { supervisores, conductores, encargados, admins, cargando, recargar } = usePersonalData(empresaNombre);
    const { clientes, objetivos } = useClientesData(empresaNombre);

    const [tab,       setTab]      = useState("supervisores"); // "supervisores" | "encargados" | "admin" | "conductores" | "legajos"
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
                            : tipo === "conductor"  ? "conductores"
                            : tipo === "legajo"     ? "legajos"
                            : tipo === "admin"      ? "admins"
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
            } else {
                data = {
                    nombre:        campos.nombre.trim(),
                    legajo:        campos.legajo || "",
                    modulosAcceso: campos.modulosAcceso || [],
                    empresa:       empresaNombre,
                    activo:        true,
                    ...(campos._uid ? { uid: campos._uid } : {}),
                };
            }

            if (id) await updateDoc(doc(db, coleccion, id), data);
            else    await addDoc(collection(db, coleccion), { ...data, creadoEn: serverTimestamp() });

            // Sincronizar permisosModulos en el doc de usuarios (para control de acceso real)
            if (tipo !== "legajo") {
                const targetUid = campos._uid || null;
                if (targetUid) {
                    await updateDoc(doc(db, "usuarios", targetUid), {
                        permisosModulos: campos.modulosAcceso || [],
                    });
                } else {
                    // Fallback: buscar por nombre (menos confiable)
                    const uSnap = await getDocs(
                        query(collection(db, "usuarios"), where("nombre", "==", campos.nombre.trim()))
                    );
                    if (uSnap.docs.length === 1) {
                        await updateDoc(doc(db, "usuarios", uSnap.docs[0].id), {
                            permisosModulos: campos.modulosAcceso || [],
                        });
                    } else if (uSnap.docs.length === 0) {
                        console.warn("No se encontró usuario en 'usuarios' para:", campos.nombre);
                    }
                }
            }

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
            nombre:        s.nombre,
            legajo:        s.legajo        || "",
            modulosAcceso: s.modulosAcceso || [],
            _uid:          s.uid           || null,
        } : { ...BLANK_SUPERVISOR },
    });

    const abrirConductor = (v = null) => setEditando({
        tipo: "conductor",
        id:   v?.id || null,
        campos: v ? {
            nombre:        v.nombre,
            legajo:        v.legajo        || "",
            modulosAcceso: v.modulosAcceso || [],
            _uid:          v.uid           || null,
        } : { ...BLANK_CONDUCTOR },
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

    const abrirAdmin = (a = null) => setEditando({
        tipo: "admin",
        id:   a?.id || null,
        campos: a ? {
            nombre:        a.nombre,
            legajo:        a.legajo        || "",
            modulosAcceso: a.modulosAcceso || [],
            _uid:          a.uid           || null,
        } : { ...BLANK_ADMIN },
    });

    const abrirEncargado = (e = null) => setEditando({
        tipo: "encargado",
        id:   e?.id || null,
        campos: e ? {
            nombre:        e.nombre,
            legajo:        e.legajo        || "",
            modulosAcceso: e.modulosAcceso || [],
            _uid:          e.uid           || null,
        } : { ...BLANK_ENCARGADO },
    });

    // ── Modal ─────────────────────────────────────────────────
    const Modal = () => {
        if (!editando) return null;
        const { tipo, id, campos } = editando;
        const setC = (k, v) => setEditando(e => ({ ...e, campos: { ...e.campos, [k]: v } }));
        const titulo = `${id ? "Editar" : "Nuevo/a"} ${tipo}`;

        const [busquedaSup, setBusquedaSup] = useState("");

        const seleccionarDeLegajo = async (l) => {
            // Buscar el uid en la colección usuarios por nombre exacto
            let foundUid = null;
            try {
                const uSnap = await getDocs(
                    query(collection(db, "usuarios"), where("nombre", "==", l.nombre || ""))
                );
                if (uSnap.docs.length === 1) foundUid = uSnap.docs[0].id;
            } catch (e) { console.warn("No se pudo buscar uid:", e); }

            setEditando(e => ({
                ...e,
                campos: {
                    ...e.campos,
                    nombre:    l.nombre || "",
                    legajo:    l.legajo || "",
                    _legajoId: l.id,
                    _uid:      foundUid,
                },
            }));
            setBusquedaSup("");
        };

        const legajosFiltradosSup = busquedaSup.trim().length >= 1
            ? legajos.filter(l => {
                const q = busquedaSup.toLowerCase();
                return (l.nombre  || "").toLowerCase().includes(q)
                    || (l.legajo  || "").toLowerCase().includes(q)
                    || (l.tarea   || "").toLowerCase().includes(q);
              }).slice(0, 8)
            : [];

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

                    {/* ── Buscar en legajos (nuevo) ── */}
                    {tipo !== "legajo" && !id && (
                        campos.nombre ? (
                            <div className="gp-sup-seleccionado">
                                <div className="gp-sup-sel-info">
                                    <span className="gp-sup-sel-nombre">{campos.nombre}</span>
                                    {campos.legajo && <span className="gc-item-badge">Leg. {campos.legajo}</span>}
                                </div>
                                <button
                                    className="gp-sup-cambiar"
                                    onClick={() => setEditando(e => ({ ...e, campos: tipo === "encargado" ? { ...BLANK_ENCARGADO } : tipo === "admin" ? { ...BLANK_ADMIN } : tipo === "conductor" ? { ...BLANK_CONDUCTOR } : { ...BLANK_SUPERVISOR } }))}
                                >
                                    ✕ Cambiar
                                </button>
                            </div>
                        ) : (
                            <div className="gp-sup-buscar">
                                <input
                                    className="gc-input"
                                    autoFocus
                                    placeholder="Buscar por nombre, legajo o función…"
                                    value={busquedaSup}
                                    onChange={e => setBusquedaSup(e.target.value)}
                                />
                                {legajosFiltradosSup.length > 0 && (
                                    <div className="gp-sup-resultados">
                                        {legajosFiltradosSup.map(l => (
                                            <button
                                                key={l.id}
                                                className="gp-sup-resultado-item"
                                                onClick={() => seleccionarDeLegajo(l)}
                                            >
                                                <span className="gp-sup-res-nombre">{l.nombre}</span>
                                                <span className="gp-sup-res-meta">
                                                    {l.legajo && `Leg. ${l.legajo}`}
                                                    {l.legajo && l.tarea && " · "}
                                                    {l.tarea}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {busquedaSup.trim().length >= 1 && legajosFiltradosSup.length === 0 && (
                                    <div className="gp-sup-sin-resultados">Sin coincidencias en legajos.</div>
                                )}
                            </div>
                        )
                    )}

                    {/* ── Edición: mostrar nombre y legajo (solo lectura) ── */}
                    {tipo !== "legajo" && id && (
                        <div className="gp-sup-seleccionado">
                            <div className="gp-sup-sel-info">
                                <span className="gp-sup-sel-nombre">{campos.nombre}</span>
                                {campos.legajo && <span className="gc-item-badge">Leg. {campos.legajo}</span>}
                            </div>
                        </div>
                    )}

                    {/* ── Módulos habilitados (para todos excepto legajo, cuando hay persona) ── */}
                    {tipo !== "legajo" && campos.nombre && (
                        <div className="gp-modulos-wrap">
                            {MODULOS_POR_PERFIL.map(grupo => (
                                <div key={grupo.perfil} className="gp-modulos-grupo">
                                    <div className="gp-modulos-grupo-titulo">{grupo.perfil}</div>
                                    <div className="gp-modulos-lista">
                                        {grupo.modulos.map(m => {
                                            const activo = (campos.modulosAcceso || []).includes(m.id);
                                            return (
                                                <label key={m.id} className={`gp-modulo-check ${activo ? "gp-modulo-check--on" : ""}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={activo}
                                                        onChange={() => {
                                                            const prev = campos.modulosAcceso || [];
                                                            setC("modulosAcceso", activo
                                                                ? prev.filter(x => x !== m.id)
                                                                : [...prev, m.id]
                                                            );
                                                        }}
                                                    />
                                                    <span>{m.label}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
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

    // ── Aplicar módulos nuevos a supervisores ─────────────────
    const [aplicandoSup, setAplicandoSup] = useState(false);
    const MODULOS_NUEVOS_SUPERVISOR = ["control_actividades_vigilador"];
    const aplicarModulosNuevosSupervisores = async () => {
        const necesitan = supervisores.filter(s =>
            MODULOS_NUEVOS_SUPERVISOR.some(m => !(s.modulosAcceso || []).includes(m))
        );
        if (necesitan.length === 0) { alert("Todos los supervisores ya tienen los nuevos módulos."); return; }
        if (!window.confirm(`¿Agregar los nuevos módulos a ${necesitan.length} supervisor${necesitan.length > 1 ? "es" : ""}?`)) return;
        setAplicandoSup(true);
        try {
            for (const s of necesitan) {
                const merged = [...new Set([...(s.modulosAcceso || []), ...MODULOS_NUEVOS_SUPERVISOR])];
                await updateDoc(doc(db, "supervisores", s.id), { modulosAcceso: merged });
                const targetUid = s.uid || null;
                if (targetUid) {
                    await updateDoc(doc(db, "usuarios", targetUid), { permisosModulos: merged });
                } else {
                    const uSnap = await getDocs(query(collection(db, "usuarios"), where("nombre", "==", s.nombre)));
                    if (uSnap.docs.length === 1)
                        await updateDoc(doc(db, "usuarios", uSnap.docs[0].id), { permisosModulos: merged });
                }
            }
            await recargar();
        } catch (e) {
            alert("Error: " + e.message);
        } finally {
            setAplicandoSup(false);
        }
    };

    // ── Aplicar módulos por defecto a conductores sin módulos ─
    const [aplicando, setAplicando] = useState(false);
    const MODULOS_CONDUCTOR = [
        "muro_comunicacion", "libro_actas", "realizar_ronda", "control_vehicular",
        "planillas", "informes", "turnos_ver", "pedido_insumos",
        "inventarios", "muro_procedimientos", "capacitacion",
    ];
    const aplicarModulosConductores = async () => {
        const sinModulos = conductores.filter(v => !(v.modulosAcceso || []).length);
        if (sinModulos.length === 0) { alert("Todos los conductores ya tienen módulos asignados."); return; }
        if (!window.confirm(`¿Aplicar módulos por defecto a ${sinModulos.length} conductor${sinModulos.length > 1 ? "es" : ""} sin módulos?`)) return;
        setAplicando(true);
        try {
            for (const v of sinModulos) {
                await updateDoc(doc(db, "conductores", v.id), { modulosAcceso: MODULOS_CONDUCTOR });
                const uSnap = await getDocs(query(collection(db, "usuarios"), where("nombre", "==", v.nombre)));
                for (const uDoc of uSnap.docs) {
                    await updateDoc(doc(db, "usuarios", uDoc.id), { permisosModulos: MODULOS_CONDUCTOR });
                }
            }
            await recargar();
        } catch (e) {
            alert("Error: " + e.message);
        } finally {
            setAplicando(false);
        }
    };

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
                <div className="gc-section-bar-actions">
                    {legajos.length === 0 && (
                        <button className="gc-add-btn gp-btn--seed"
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
                <div className="gc-section-bar-actions">
                    {supervisores.some(s => MODULOS_NUEVOS_SUPERVISOR.some(m => !(s.modulosAcceso || []).includes(m))) && (
                        <button className="gc-add-btn gp-btn--seed" onClick={aplicarModulosNuevosSupervisores} disabled={aplicandoSup}>
                            {aplicandoSup ? "Aplicando..." : "⚡ Aplicar módulos nuevos"}
                        </button>
                    )}
                    <button className="gc-add-btn" onClick={() => abrirSupervisor()}>
                        + Nuevo supervisor
                    </button>
                </div>
            </div>

            {cargando
                ? <div className="gc-empty">Cargando...</div>
                : supervisores.length === 0
                    ? <div className="gc-empty">No hay supervisores cargados. Agregá el primero.</div>
                    : [...supervisores]
                        .sort((a, b) => a.nombre.localeCompare(b.nombre))
                        .map(s => (
                            <div key={s.id} className="gc-item">
                                <div className="gc-item-main">
                                    <div className="gc-item-nombre-row">
                                        <strong>{s.nombre}</strong>
                                        {s.legajo && <span className="gc-item-badge">Leg. {s.legajo}</span>}
                                    </div>
                                    <span className="gc-item-sub">
                                        🗂️ {(s.modulosAcceso || []).length > 0
                                            ? `${(s.modulosAcceso || []).length} módulo${(s.modulosAcceso || []).length > 1 ? "s" : ""} habilitado${(s.modulosAcceso || []).length > 1 ? "s" : ""}`
                                            : "Sin módulos habilitados"}
                                    </span>
                                </div>
                                <div className="gc-item-actions">
                                    <button className="gc-icon-btn" onClick={() => abrirSupervisor(s)}>✏️</button>
                                    <button className="gc-icon-btn gc-icon-btn--del"
                                        onClick={() => handleEliminar("supervisores", s.id, s.nombre)}>🗑</button>
                                </div>
                            </div>
                        ))
            }
        </div>
    );

    // ── Panel conductores ─────────────────────────────────────
    const renderConductores = () => (
        <div className="gc-body">
            <div className="gc-section-bar">
                <span>Conductores ({conductores.length})</span>
                <div className="gc-section-bar-actions">
                    {conductores.some(v => !(v.modulosAcceso || []).length) && (
                        <button className="gc-add-btn gp-btn--seed" onClick={aplicarModulosConductores} disabled={aplicando}>
                            {aplicando ? "Aplicando..." : "⚡ Aplicar módulos por defecto"}
                        </button>
                    )}
                    <button className="gc-add-btn" onClick={() => abrirConductor()}>
                        + Nuevo conductor
                    </button>
                </div>
            </div>

            {cargando
                ? <div className="gc-empty">Cargando...</div>
                : conductores.length === 0
                    ? <div className="gc-empty">No hay conductores cargados. Agregá el primero.</div>
                    : [...conductores]
                        .sort((a, b) => a.nombre.localeCompare(b.nombre))
                        .map(v => (
                            <div key={v.id} className="gc-item">
                                <div className="gc-item-main">
                                    <div className="gc-item-nombre-row">
                                        <strong>{v.nombre}</strong>
                                        {v.legajo && <span className="gc-item-badge">Leg. {v.legajo}</span>}
                                    </div>
                                    <span className="gc-item-sub">
                                        🗂️ {(v.modulosAcceso || []).length > 0
                                            ? `${(v.modulosAcceso || []).length} módulo${(v.modulosAcceso || []).length > 1 ? "s" : ""} habilitado${(v.modulosAcceso || []).length > 1 ? "s" : ""}`
                                            : "Sin módulos habilitados"}
                                    </span>
                                </div>
                                <div className="gc-item-actions">
                                    <button className="gc-icon-btn" onClick={() => abrirConductor(v)}>✏️</button>
                                    <button className="gc-icon-btn gc-icon-btn--del"
                                        onClick={() => handleEliminar("conductores", v.id, v.nombre)}>🗑</button>
                                </div>
                            </div>
                        ))
            }
        </div>
    );

    // ── Panel admin ───────────────────────────────────────────
    const renderAdmin = () => (
        <div className="gc-body">
            <div className="gc-section-bar">
                <span>Administrativos ({admins.length})</span>
                <button className="gc-add-btn" onClick={() => abrirAdmin()}>
                    + Nuevo admin
                </button>
            </div>

            {cargando
                ? <div className="gc-empty">Cargando...</div>
                : admins.length === 0
                    ? <div className="gc-empty">No hay personal administrativo asignado. Agregá el primero.</div>
                    : [...admins]
                        .sort((a, b) => a.nombre.localeCompare(b.nombre))
                        .map(a => (
                            <div key={a.id} className="gc-item">
                                <div className="gc-item-main">
                                    <div className="gc-item-nombre-row">
                                        <strong>{a.nombre}</strong>
                                        {a.legajo && <span className="gc-item-badge">Leg. {a.legajo}</span>}
                                    </div>
                                    <span className="gc-item-sub">
                                        🗂️ {(a.modulosAcceso || []).length > 0
                                            ? `${(a.modulosAcceso || []).length} módulo${(a.modulosAcceso || []).length > 1 ? "s" : ""} habilitado${(a.modulosAcceso || []).length > 1 ? "s" : ""}`
                                            : "Sin módulos habilitados"}
                                    </span>
                                </div>
                                <div className="gc-item-actions">
                                    <button className="gc-icon-btn" onClick={() => abrirAdmin(a)}>✏️</button>
                                    <button className="gc-icon-btn gc-icon-btn--del"
                                        onClick={() => handleEliminar("admins", a.id, a.nombre)}>🗑</button>
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
                                    </div>
                                    <span className="gc-item-sub">
                                        🗂️ {(e.modulosAcceso || []).length > 0
                                            ? `${(e.modulosAcceso || []).length} módulo${(e.modulosAcceso || []).length > 1 ? "s" : ""} habilitado${(e.modulosAcceso || []).length > 1 ? "s" : ""}`
                                            : "Sin módulos habilitados"}
                                    </span>
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
                <span className="gc-header-title">👥 Asignación de Personal</span>
            </header>

            <div className="gp-tabs">
                <button
                    className={`gp-tab ${tab === "supervisores" ? "gp-tab--active" : ""}`}
                    onClick={() => setTab("supervisores")}>
                    🔍 Supervisores
                    {supervisores.length > 0 && <span className="gp-tab-count">{supervisores.length}</span>}
                </button>
                <button
                    className={`gp-tab ${tab === "encargados" ? "gp-tab--active" : ""}`}
                    onClick={() => setTab("encargados")}>
                    🏅 Encargados
                    {encargados.length > 0 && <span className="gp-tab-count">{encargados.length}</span>}
                </button>
                <button
                    className={`gp-tab ${tab === "admin" ? "gp-tab--active" : ""}`}
                    onClick={() => setTab("admin")}>
                    🗂️ Admin
                    {admins.length > 0 && <span className="gp-tab-count">{admins.length}</span>}
                </button>
                <button
                    className={`gp-tab ${tab === "conductores" ? "gp-tab--active" : ""}`}
                    onClick={() => setTab("conductores")}>
                    🚗 Conductores
                    {conductores.length > 0 && <span className="gp-tab-count">{conductores.length}</span>}
                </button>
                <button
                    className={`gp-tab ${tab === "legajos" ? "gp-tab--active" : ""}`}
                    onClick={() => setTab("legajos")}>
                    📋 Legajos
                    {legajos.length > 0 && <span className="gp-tab-count">{legajos.length}</span>}
                </button>
            </div>

            {tab === "supervisores" ? renderSupervisores()
           : tab === "encargados"  ? renderEncargados()
           : tab === "admin"       ? renderAdmin()
           : tab === "legajos"     ? renderLegajos()
           :                         renderConductores()}

            <Modal />
        </div>
    );
}
