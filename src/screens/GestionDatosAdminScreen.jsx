// src/screens/GestionDatosAdminScreen.jsx
// Actualización de datos — lista completa + edición por fila
import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, where, doc, updateDoc, deleteDoc, setDoc, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAppData } from "../context/AppDataContext";
import "../styles/GestionDatosAdminScreen.css";
import { fmtObjetivo } from "../utils/formatters";
import { SEED_VEHICULOS } from "../data/seedVehiculos";

// ── Configuración de colecciones ─────────────────────────────────────────────
const COLECCIONES = [
    {
        id: "legajos",
        label: "Personal",
        icon: "👷",
        filterEmpresa: true,
        keyFn: d => d.legajo || d._docId,
        cols: [
            { key: "nombre",       label: "Nombre"         },
            { key: "legajo",       label: "Legajo"         },
            { key: "dni",          label: "DNI"            },
            { key: "cuil",         label: "CUIL"           },
            { key: "cargo",        label: "Cargo"          },
            { key: "tarea",        label: "Función"        },
            { key: "sexo",         label: "Sexo"           },
            { key: "nacimiento",   label: "Nacimiento"     },
            { key: "fechaIngreso", label: "Ingreso"        },
            { key: "telefono",     label: "Teléfono"       },
            { key: "domicilio",    label: "Domicilio"      },
            { key: "hijos",        label: "Hijos"          },
            { key: "centroCosto",  label: "Centro costo"   },
            { key: "proyecto",     label: "Proyecto"       },
            { key: "servicio",     label: "Objetivo"       },
            { key: "sucursal",     label: "Sucursal"       },
            { key: "zona",         label: "Zona"           },
        ],
        searchFields: ["nombre", "legajo", "dni", "tarea", "cargo"],
        campos: [
            { key: "nombre",       label: "Nombre completo",     type: "text"   },
            { key: "legajo",       label: "Legajo",              type: "text"   },
            { key: "dni",          label: "DNI",                 type: "text"   },
            { key: "cuil",         label: "CUIL",                type: "text"   },
            { key: "cargo",        label: "Cargo",               type: "text"   },
            { key: "tarea",        label: "Función / Tarea",     type: "text"   },
            { key: "sexo",         label: "Sexo",                type: "select", opts: [{ v: "M", l: "Masculino" }, { v: "F", l: "Femenino" }] },
            { key: "nacimiento",   label: "Fecha nacimiento",    type: "text"   },
            { key: "fechaIngreso", label: "Fecha ingreso",       type: "text"   },
            { key: "telefono",     label: "Teléfono",            type: "text"   },
            { key: "domicilio",    label: "Domicilio",           type: "text"   },
            { key: "hijos",        label: "Cant. hijos",         type: "text"   },
            { key: "centroCosto",  label: "Centro de costo",     type: "text"   },
            { key: "proyecto",     label: "Proyecto / Contrato", type: "text"   },
            { key: "servicio",     label: "Servicio / Objetivo", type: "text"   },
            { key: "sucursal",     label: "Sucursal",            type: "text"   },
            { key: "zona",         label: "Zona",                type: "text"   },
            { key: "regimen",      label: "Régimen",             type: "select", opts: [{ v: "", l: "— Sin asignar —" }, { v: "4 x 2 x 12", l: "4 x 2 x 12" }, { v: "5 x 2 x 12", l: "5 x 2 x 12" }, { v: "6 x 1 x 8", l: "6 x 1 x 8" }, { v: "12 x 36", l: "12 x 36" }, { v: "14 x 14 x 12", l: "14 x 14 x 12" }, { v: "14 x 14 x 8", l: "14 x 14 x 8" }, { v: "200", l: "200" }] },
            { key: "grupoTurno14", label: "Grupo Turno 14×14",   type: "select", opts: [{ v: "", l: "— Sin grupo —" }, { v: "3", l: "Grupo 3" }, { v: "4", l: "Grupo 4" }] },
        ],
    },
    {
        id: "clientes",
        label: "Clientes",
        icon: "🏢",
        filterEmpresa: false,
        keyFn: d => d.cuit || d._docId,
        cols: [
            { key: "nombre",    label: "Razón social" },
            { key: "cuit",      label: "CUIT"         },
            { key: "telefono",  label: "Teléfono"     },
            { key: "email",     label: "Email"        },
            { key: "direccion", label: "Dirección"    },
            { key: "localidad", label: "Localidad"    },
            { key: "provincia", label: "Provincia"    },
            { key: "contacto",  label: "Contacto"     },
        ],
        searchFields: ["nombre", "cuit", "localidad"],
        campos: [
            { key: "nombre",    label: "Razón social", type: "text" },
            { key: "cuit",      label: "CUIT",         type: "text" },
            { key: "telefono",  label: "Teléfono",     type: "text" },
            { key: "email",     label: "Email",        type: "text" },
            { key: "direccion", label: "Dirección",    type: "text" },
            { key: "localidad", label: "Localidad",    type: "text" },
            { key: "provincia", label: "Provincia",    type: "text" },
            { key: "contacto",  label: "Contacto",     type: "text" },
        ],
    },
    {
        id: "objetivos",
        label: "Objetivos",
        icon: "📍",
        filterEmpresa: false,
        keyFn: d => d.codigo || d.nombre || d._docId,
        cols: [
            { key: "codigo",         label: "Código"    },
            { key: "nombre",         label: "Objetivo",  renderFn: d => fmtObjetivo(d) },
            { key: "proyecto",       label: "Proyecto"  },
            { key: "clienteNombre",  label: "Cliente"   },
            { key: "domicilio",      label: "Domicilio" },
            { key: "localidad",      label: "Localidad" },
            { key: "zona",           label: "Zona"      },
            { key: "horasLunes",     label: "Lun"       },
            { key: "horasMartes",    label: "Mar"       },
            { key: "horasMiercoles", label: "Mié"       },
            { key: "horasJueves",    label: "Jue"       },
            { key: "horasViernes",   label: "Vie"       },
            { key: "horasSabado",    label: "Sáb"       },
            { key: "horasDomingo",   label: "Dom"       },
            { key: "horasFeriados",  label: "Fer"       },
        ],
        searchFields: ["nombre", "proyecto", "codigo", "domicilio", "clienteId"],
        campos: [
            { key: "codigo",          label: "Código",              type: "text"   },
            { key: "nombre",          label: "Nombre del objetivo",  type: "text"   },
            { key: "proyecto",        label: "Proyecto",             type: "text"   },
            { key: "clienteId",       label: "Cliente (ID)",         type: "text"   },
            { key: "domicilio",       label: "Domicilio",            type: "text"   },
            { key: "localidad",       label: "Localidad",            type: "text"   },
            { key: "zona",            label: "Zona",                 type: "text"   },
            // Horas de servicio por día
            { key: "horasLunes",      label: "Hs. Lunes",            type: "number" },
            { key: "horasMartes",     label: "Hs. Martes",           type: "number" },
            { key: "horasMiercoles",  label: "Hs. Miércoles",        type: "number" },
            { key: "horasJueves",     label: "Hs. Jueves",           type: "number" },
            { key: "horasViernes",    label: "Hs. Viernes",          type: "number" },
            { key: "horasSabado",     label: "Hs. Sábado",           type: "number" },
            { key: "horasDomingo",    label: "Hs. Domingo",          type: "number" },
            { key: "horasFeriados",   label: "Hs. Feriados",         type: "number" },
        ],
    },
    {
        id: "vehiculos",
        label: "Vehículos",
        icon: "🚗",
        filterEmpresa: true,
        keyFn: d => d.patente || d._docId,
        cols: [
            { key: "patente",  label: "Patente"   },
            { key: "marca",    label: "Marca"     },
            { key: "modelo",   label: "Modelo"    },
            { key: "tipo",     label: "Tipo"      },
            { key: "año",      label: "Año"       },
            { key: "estado",   label: "Estado"    },
            { key: "interno",  label: "N° Interno"},
            { key: "conductor",label: "Conductor" },
            { key: "vtv",      label: "VTV vto."  },
            { key: "seguro",   label: "Seguro vto."},
            { key: "km",       label: "Km"        },
        ],
        searchFields: ["patente", "marca", "modelo", "interno", "conductor"],
        campos: [
            { key: "patente",   label: "Patente",     type: "text" },
            { key: "marca",     label: "Marca",       type: "text" },
            { key: "modelo",    label: "Modelo",      type: "text" },
            { key: "tipo",      label: "Tipo",        type: "select", opts: [
                { v: "Auto",      l: "Auto"      },
                { v: "Camioneta", l: "Camioneta" },
                { v: "Moto",      l: "Moto"      },
                { v: "Furgón",    l: "Furgón"    },
                { v: "Otro",      l: "Otro"      },
            ]},
            { key: "año",       label: "Año",         type: "text" },
            { key: "estado",    label: "Estado",      type: "select", opts: [
                { v: "Operativo",    l: "Operativo"    },
                { v: "En servicio",  l: "En servicio"  },
                { v: "En taller",    l: "En taller"    },
                { v: "Fuera de uso", l: "Fuera de uso" },
            ]},
            { key: "interno",   label: "N° Interno",  type: "text" },
            { key: "conductor", label: "Conductor",   type: "text" },
            { key: "vtv",       label: "VTV vto.",    type: "text" },
            { key: "seguro",    label: "Seguro vto.", type: "text" },
            { key: "km",        label: "Km actuales", type: "text" },
        ],
    },
];

// ── Componente principal ──────────────────────────────────────────────────────
export default function GestionDatosAdminScreen({ onBack, coleccionInicial = 0, canCreate = false, noDelete = false }) {
    const { empresaNombre } = useAppData();

    const [colIdx,          setColIdx]          = useState(coleccionInicial);
    const [todos,           setTodos]           = useState([]);
    const [loading,         setLoading]         = useState(false);
    const [filtro,          setFiltro]          = useState("");
    const [seleccionado,    setSeleccionado]    = useState(null);
    const [esNuevo,         setEsNuevo]         = useState(false);
    const [form,            setForm]            = useState({});
    const [guardando,       setGuardando]       = useState(false);
    const [msg,             setMsg]             = useState(null);
    const [pendienteBorrar, setPendienteBorrar] = useState(null);
    const [borrando,        setBorrando]        = useState(false);
    const [importando,      setImportando]      = useState(false);
    const [importMsg,       setImportMsg]       = useState(null);

    const col = COLECCIONES[colIdx];

    // ── Cargar colección ─────────────────────────────────────────────────────
    useEffect(() => {
        setTodos([]);
        setFiltro("");
        setSeleccionado(null);
        setEsNuevo(false);
        setMsg(null);
        setLoading(true);

        const cargar = async () => {
            try {
                const snap = col.filterEmpresa && empresaNombre
                    ? await getDocs(query(collection(db, col.id), where("empresa", "==", empresaNombre)))
                    : await getDocs(collection(db, col.id));

                const docs = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));

                // Deduplicar
                const vistos = new Set();
                const unicos = docs.filter(d => {
                    const k = col.keyFn(d);
                    if (vistos.has(k)) return false;
                    vistos.add(k);
                    return true;
                });

                unicos.sort((a, b) =>
                    (a[col.searchFields[0]] || "").toString()
                        .localeCompare((b[col.searchFields[0]] || "").toString())
                );
                setTodos(unicos);
            } catch (e) {
                console.error("GestionDatos:", e);
            } finally {
                setLoading(false);
            }
        };
        cargar();
    }, [colIdx, empresaNombre]);

    // ── Filtrado instantáneo ─────────────────────────────────────────────────
    const filas = useMemo(() => {
        if (!filtro.trim()) return todos;
        const q = filtro.toLowerCase();
        return todos.filter(d =>
            col.searchFields.some(f =>
                (d[f] || "").toString().toLowerCase().includes(q)
            )
        );
    }, [todos, filtro, col]);

    // ── Abrir edición ────────────────────────────────────────────────────────
    const abrir = d => {
        setSeleccionado(d);
        setEsNuevo(false);
        setForm(Object.fromEntries(col.campos.map(c => [c.key, d[c.key] ?? ""])));
        setMsg(null);
    };

    // ── Nuevo registro ───────────────────────────────────────────────────────
    const nuevo = () => {
        setSeleccionado({});
        setEsNuevo(true);
        setForm(Object.fromEntries(col.campos.map(c => [c.key, ""])));
        setMsg(null);
    };

    // ── Guardar ──────────────────────────────────────────────────────────────
    const guardar = async () => {
        setGuardando(true);
        setMsg(null);
        try {
            const datos = { ...form };
            col.campos.forEach(c => {
                if (c.type === "number" && datos[c.key] !== "") {
                    datos[c.key] = Number(datos[c.key]);
                }
            });

            if (esNuevo) {
                if (col.filterEmpresa && empresaNombre) datos.empresa = empresaNombre;
                const ref = await addDoc(collection(db, col.id), datos);
                const creado = { _docId: ref.id, ...datos };
                setTodos(prev =>
                    [creado, ...prev].sort((a, b) =>
                        (a[col.searchFields[0]] || "").toString()
                            .localeCompare((b[col.searchFields[0]] || "").toString())
                    )
                );
                setSeleccionado(creado);
                setEsNuevo(false);
            } else {
                await updateDoc(doc(db, col.id, seleccionado._docId), datos);
                setTodos(prev =>
                    prev.map(d => d._docId === seleccionado._docId ? { ...d, ...datos } : d)
                );
                setSeleccionado(prev => ({ ...prev, ...datos }));
            }
            setMsg({ ok: true, texto: "✅ Guardado correctamente." });
        } catch (e) {
            setMsg({ ok: false, texto: "❌ " + e.message });
        } finally {
            setGuardando(false);
        }
    };

    const cerrarForm = () => { setSeleccionado(null); setEsNuevo(false); setMsg(null); };

    // ── Importar flota base (solo vehículos) ─────────────────────────────────
    const importarVehiculos = async () => {
        setImportando(true);
        setImportMsg(null);
        try {
            await Promise.all(
                SEED_VEHICULOS.map(v =>
                    setDoc(doc(db, "vehiculos", v.id), {
                        patente:   v.patente,
                        marca:     v.marca,
                        modelo:    v.modelo,
                        tipo:      v.tipo,
                        año:       v.año,
                        estado:    v.estado,
                        interno:   v.interno,
                        conductor: v.conductor,
                        vtv:       "",
                        seguro:    "",
                        km:        "",
                        empresa:   empresaNombre || "",
                    }, { merge: true })
                )
            );
            const snap = await getDocs(
                query(collection(db, "vehiculos"), where("empresa", "==", empresaNombre))
            );
            const docs = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
            setTodos(docs.sort((a, b) => (a.patente || "").localeCompare(b.patente || "")));
            setImportMsg(`✅ ${SEED_VEHICULOS.length} vehículos importados correctamente.`);
        } catch (e) {
            setImportMsg("❌ Error: " + e.message);
        } finally {
            setImportando(false);
        }
    };

    // ── Borrar ───────────────────────────────────────────────────────────────
    const confirmarBorrar = async () => {
        if (!pendienteBorrar) return;
        setBorrando(true);
        try {
            await deleteDoc(doc(db, col.id, pendienteBorrar._docId));
            setTodos(prev => prev.filter(d => d._docId !== pendienteBorrar._docId));
            setPendienteBorrar(null);
        } catch (e) {
            alert("Error al borrar: " + e.message);
        } finally {
            setBorrando(false);
        }
    };

    // ── Header del panel (igual en lista y edición) ──────────────────────────
    const panelHeader = (
        <div className="gd-panel-header">
            <button className="gd-panel-back" onClick={seleccionado ? cerrarForm : onBack}>
                ← {seleccionado ? "Lista" : "Panel"}
            </button>
            <span className="gd-panel-titulo">
                {seleccionado
                    ? esNuevo
                        ? `${col.icon} Nuevo — ${col.label}`
                        : `${col.icon} ${col.id === "objetivos" ? fmtObjetivo(seleccionado) : (seleccionado[col.campos[0]?.key] || "Registro")}`
                    : "🗂️ Actualización de Datos"
                }
            </span>
            {!seleccionado && (
                <span className="gd-panel-sub">{col.label} · {loading ? "…" : `${filas.length} registros`}</span>
            )}
        </div>
    );

    // ── Render: formulario de edición ────────────────────────────────────────
    if (seleccionado) {
        // Agrupar los campos de horas juntos en una fila de 4 columnas
        const camposNormales = col.campos.filter(c => c.type !== "number");
        const camposHoras    = col.campos.filter(c => c.type === "number");

        return (
            <div className="gd-root">
                {panelHeader}

                <div className="gd-form-wrap">
                    {msg && (
                        <div className={`gd-msg ${msg.ok ? "gd-msg--ok" : "gd-msg--err"}`}>
                            {msg.texto}
                        </div>
                    )}

                    <div className="gd-form-grid">
                        {camposNormales.map(c => (
                            <div key={c.key} className="gd-field">
                                <label className="gd-label">{c.label}</label>
                                {c.type === "select" ? (
                                    <select
                                        className="gd-input"
                                        value={form[c.key] || ""}
                                        onChange={e => setForm(f => ({ ...f, [c.key]: e.target.value }))}
                                    >
                                        {c.opts.map(o => (
                                            <option key={o.v} value={o.v}>{o.l}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        className="gd-input"
                                        type="text"
                                        value={form[c.key] || ""}
                                        onChange={e => setForm(f => ({ ...f, [c.key]: e.target.value }))}
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Horas de servicio (objetivos) */}
                    {camposHoras.length > 0 && (
                        <div className="gd-horas-section">
                            <div className="gd-horas-titulo">⏱️ Horas de servicio por día</div>
                            <div className="gd-horas-grid">
                                {camposHoras.map(c => (
                                    <div key={c.key} className="gd-field gd-field--hora">
                                        <label className="gd-label">{c.label}</label>
                                        <input
                                            className="gd-input gd-input--hora"
                                            type="number"
                                            min="0"
                                            max="24"
                                            value={form[c.key] ?? ""}
                                            onChange={e => setForm(f => ({ ...f, [c.key]: e.target.value }))}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="gd-form-actions">
                        <button className="gd-btn-save" onClick={guardar} disabled={guardando}>
                            {guardando ? "⏳ Guardando…" : "💾 Guardar cambios"}
                        </button>
                        <button className="gd-btn-cancel" onClick={cerrarForm}>
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Render: lista ────────────────────────────────────────────────────────
    return (
        <div className="gd-root">
            {panelHeader}

            {/* ── Tabs ──────────────────────────────────────────────────── */}
            <div className="gd-tabs-wrap">
                <div className="gd-tabs">
                    {COLECCIONES.map((c, i) => (
                        <button
                            key={c.id}
                            className={`gd-tab ${i === colIdx ? "gd-tab--active" : ""}`}
                            onClick={() => setColIdx(i)}
                        >
                            <span className="gd-tab-icon">{c.icon}</span>
                            <span className="gd-tab-label">{c.label}</span>
                            {i === colIdx && todos.length > 0 && (
                                <span className="gd-tab-count">{todos.length}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Barra de búsqueda ─────────────────────────────────────── */}
            <div className="gd-toolbar">
                <input
                    className="gd-filtro"
                    placeholder={`🔍 Filtrar ${col.label.toLowerCase()}…`}
                    value={filtro}
                    onChange={e => setFiltro(e.target.value)}
                    autoComplete="off"
                />
                <span className="gd-count-badge">
                    {loading ? "…" : `${filas.length} / ${todos.length}`}
                </span>
                {canCreate && (
                    <button className="gd-btn-nuevo" onClick={nuevo}>
                        + Nuevo
                    </button>
                )}
            </div>

            {/* ── Banner importar vehículos ──────────────────────────────── */}
            {col.id === "vehiculos" && !loading && todos.length === 0 && (
                <div className="gd-import-banner">
                    <div className="gd-import-icon">🚗</div>
                    <div className="gd-import-texto">
                        <strong>Sin vehículos cargados</strong>
                        <span>Importá la flota base ({SEED_VEHICULOS.length} vehículos) desde el sistema anterior</span>
                    </div>
                    <button
                        className="gd-import-btn"
                        onClick={importarVehiculos}
                        disabled={importando}
                    >
                        {importando ? "⏳ Importando…" : "📥 Importar flota base"}
                    </button>
                    {importMsg && <div className="gd-import-msg">{importMsg}</div>}
                </div>
            )}

            {/* ── Tabla ─────────────────────────────────────────────────── */}
            <div className="gd-table-wrap">
                {loading ? (
                    <div className="gd-empty">⏳ Cargando {col.label.toLowerCase()}…</div>
                ) : filas.length === 0 && todos.length > 0 ? (
                    <div className="gd-empty">Sin resultados para "{filtro}".</div>
                ) : filas.length === 0 ? (
                    <div className="gd-empty">Sin registros{col.id !== "vehiculos" ? ` en ${col.label}` : ""}.</div>
                ) : (
                    <table className="gd-table">
                        <thead>
                            <tr>
                                {col.cols.map(c => (
                                    <th key={c.key}>{c.label}</th>
                                ))}
                                <th className="gd-th-accion"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filas.map(d => (
                                <tr
                                    key={d._docId}
                                    className="gd-row"
                                    onClick={() => abrir(d)}
                                >
                                    {col.cols.map(c => (
                                        <td key={c.key} data-label={c.label}>
                                            {c.renderFn
                                                ? c.renderFn(d)
                                                : (d[c.key] ?? <span className="gd-empty-cell">—</span>)
                                            }
                                        </td>
                                    ))}
                                    <td className="gd-td-accion" onClick={e => e.stopPropagation()}>
                                        <button
                                            className="gd-row-btn gd-row-btn--edit"
                                            title="Editar"
                                            onClick={() => abrir(d)}
                                        >✏️</button>
                                        {!noDelete && (
                                        <button
                                            className="gd-row-btn gd-row-btn--del"
                                            title="Borrar"
                                            onClick={() => setPendienteBorrar(d)}
                                        >🗑</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── Modal confirmación de borrado ─────────────────────────── */}
            {pendienteBorrar && (() => {
                const label = col.id === "objetivos"
                    ? fmtObjetivo(pendienteBorrar)
                    : (pendienteBorrar[col.cols[0]?.key] || "este registro");
                return (
                    <div className="gd-overlay" onClick={() => setPendienteBorrar(null)}>
                        <div className="gd-confirm" onClick={e => e.stopPropagation()}>
                            <div className="gd-confirm-icon">🗑</div>
                            <div className="gd-confirm-titulo">¿Borrar registro?</div>
                            <div className="gd-confirm-nombre">{label}</div>
                            <p className="gd-confirm-aviso">
                                Esta acción <strong>no se puede deshacer</strong> y borra el registro de Firebase.
                            </p>
                            <div className="gd-confirm-btns">
                                <button
                                    className="gd-confirm-btn--del"
                                    onClick={confirmarBorrar}
                                    disabled={borrando}
                                >
                                    {borrando ? "Borrando…" : "Sí, borrar"}
                                </button>
                                <button
                                    className="gd-confirm-btn--cancel"
                                    onClick={() => setPendienteBorrar(null)}
                                    disabled={borrando}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
