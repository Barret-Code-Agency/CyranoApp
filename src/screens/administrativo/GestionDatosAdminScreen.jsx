// src/screens/GestionDatosAdminScreen.jsx
// Actualización de datos — lista completa + edición por fila
import { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { collection, getDocs, query, where, doc, updateDoc, deleteDoc, setDoc, addDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../firebase";
import { useAppData } from "../../context/AppDataContext";
import "./GestionDatosAdminScreen.css";
import { fmtObjetivo } from "../../utils/formatters";
import { SEED_VEHICULOS } from "../../data/seedVehiculos";

// ── Helpers de fecha ─────────────────────────────────────────────────────────
function fmtFechaExcel(valor) {
    if (!valor && valor !== 0) return <span style={{ color: "#aaa" }}>—</span>;
    let d;
    if (typeof valor === "number" || (!isNaN(Number(valor)) && Number(valor) > 20000 && Number(valor) < 60000)) {
        d = new Date((Number(valor) - 25569) * 86400000);
    } else if (typeof valor === "string" && valor.includes("/")) {
        const [dd, mm, yyyy] = valor.split("/").map(Number);
        d = new Date(yyyy, mm - 1, dd);
    } else {
        d = new Date(valor);
    }
    if (!d || isNaN(d.getTime())) return valor;
    return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}

// ── Configuración de colecciones ─────────────────────────────────────────────
const COLECCIONES = [
    {
        id: "legajos",
        label: "Personal",
        icon: "👷",
        filterEmpresa: true,
        keyFn: d => d.legajo || d._docId,
        dupKey: "legajo",
        cols: [
            { key: "legajo",       label: "N° Legajo"      },
            { key: "dni",          label: "DNI"            },
            { key: "nombre",       label: "Apellido y Nombre" },
            { key: "nacimiento",   label: "Fecha Nac.",     renderFn: d => fmtFechaExcel(d.nacimiento)   },
            { key: "cargo",        label: "Cargo"          },
            { key: "rol",          label: "Rol"            },
            { key: "fechaIngreso", label: "Ingreso",        renderFn: d => fmtFechaExcel(d.fechaIngreso) },
            { key: "zona",         label: "Zona"           },
            { key: "estado",       label: "Estado"         },
            { key: "sexo",         label: "Sexo"           },
            { key: "cuil",         label: "CUIL"           },
            { key: "domicilio",    label: "Domicilio"      },
            { key: "hijos",        label: "Hijos"          },
            { key: "centroCosto",  label: "C. Costo"       },
            { key: "proyecto",     label: "Proyecto"       },
        ],
        searchFields: ["nombre", "legajo", "dni", "cargo", "rol", "cuil"],
        campos: [
            { key: "legajo",       label: "N° Legajo",          type: "text"   },
            { key: "dni",          label: "DNI",                 type: "text"   },
            { key: "nombre",       label: "Apellido y Nombre",   type: "text"   },
            { key: "nacimiento",   label: "Fecha de Nacimiento", type: "text"   },
            { key: "cargo",        label: "Cargo",               type: "text"   },
            { key: "rol",          label: "Rol",                 type: "text"   },
            { key: "fechaIngreso", label: "Fecha de Ingreso",    type: "text"   },
            { key: "zona",         label: "Zona",                type: "text"   },
            { key: "estado",       label: "Estado",              type: "select", opts: [{ v: "Activo", l: "Activo" }, { v: "Baja", l: "Baja" }, { v: "Suspendido", l: "Suspendido" }] },
            { key: "sexo",         label: "Sexo",                type: "select", opts: [{ v: "M", l: "Masculino" }, { v: "F", l: "Femenino" }] },
            { key: "cuil",         label: "CUIL",                type: "text"   },
            { key: "domicilio",    label: "Domicilio",           type: "text"   },
            { key: "hijos",        label: "Hijos",               type: "text"   },
            { key: "centroCosto",  label: "Centro de Costo",     type: "text"   },
            { key: "proyecto",     label: "Proyecto",            type: "text"   },
            { key: "regimen",      label: "Régimen",             type: "select", opts: [{ v: "", l: "— Sin asignar —" }, { v: "4 x 2 x 12", l: "4 x 2 x 12" }, { v: "5 x 2 x 12", l: "5 x 2 x 12" }, { v: "6 x 1 x 8", l: "6 x 1 x 8" }, { v: "12 x 36", l: "12 x 36" }, { v: "14 x 14 x 12", l: "14 x 14 x 12" }, { v: "14 x 14 x 8", l: "14 x 14 x 8" }, { v: "200", l: "200" }] },
            { key: "grupoTurno14", label: "Grupo Turno 14×14",   type: "select", opts: [{ v: "", l: "— Sin grupo —" }, { v: "A", l: "Grupo A" }, { v: "B", l: "Grupo B" }] },
            { key: "fotoUrl",      label: "Foto",                type: "image"  },
        ],
        excelMap: [
            { patterns: ["n legajo","nro legajo","num legajo","legajo","n° legajo"], field: "legajo"       },
            { patterns: ["dni"],                                                     field: "dni"          },
            { patterns: ["apellido y nombre","apellido nombre","nombre"],            field: "nombre"       },
            { patterns: ["fecha de nacimiento","fecha nacimiento","nacimiento"],     field: "nacimiento"   },
            { patterns: ["cargo"],                                                   field: "cargo"        },
            { patterns: ["rol"],                                                     field: "rol"          },
            { patterns: ["fecha de ingreso","fecha ingreso","ingreso"],             field: "fechaIngreso" },
            { patterns: ["zona"],                                                    field: "zona"         },
            { patterns: ["estado"],                                                  field: "estado"       },
            { patterns: ["sexo"],                                                    field: "sexo"         },
            { patterns: ["cuil"],                                                    field: "cuil"         },
            { patterns: ["domicilio","direccion"],                                   field: "domicilio"    },
            { patterns: ["hijos"],                                                   field: "hijos"        },
            { patterns: ["centro de costo","centrocosto","c costo"],                field: "centroCosto"  },
            { patterns: ["proyecto"],                                                field: "proyecto"     },
        ],
    },
    {
        id: "clientes",
        label: "Clientes",
        icon: "🏢",
        filterEmpresa: true,
        keyFn: d => d.cuit || d._docId,
        dupKey: "cuit",
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
        excelMap: [
            { patterns: ["nombre","razon social","razonsocial"], field: "nombre"    },
            { patterns: ["cuit"],                                field: "cuit"      },
            { patterns: ["telefono","tel"],                      field: "telefono"  },
            { patterns: ["email"],                               field: "email"     },
            { patterns: ["direccion","domicilio"],               field: "direccion" },
            { patterns: ["localidad"],                           field: "localidad" },
            { patterns: ["provincia"],                           field: "provincia" },
            { patterns: ["contacto"],                            field: "contacto"  },
        ],
    },
    {
        id: "objetivos",
        label: "Objetivos",
        icon: "📍",
        filterEmpresa: true,
        keyFn: d => d.codigo || d._docId,
        dupKey: "codigo",
        cols: [
            { key: "cCosto",         label: "C.Costo"    },
            { key: "numProyecto",    label: "Proyecto"   },
            { key: "numObjetivo",    label: "Objetivo"   },
            { key: "nombreProyecto", label: "Nº Proyecto" },
            { key: "nombre",         label: "Nombre objetivo", renderFn: d => fmtObjetivo(d) },
            { key: "clienteNombre",  label: "Cliente",    renderFn: d => d.clienteNombre || d.nombreProyecto || "—" },
            { key: "domicilio",      label: "Domicilio"  },
            { key: "localidad",      label: "Localidad"  },
            { key: "zona",           label: "Zona"       },
            { key: "horasLunes",     label: "Lun"        },
            { key: "horasMartes",    label: "Mar"        },
            { key: "horasMiercoles", label: "Mié"        },
            { key: "horasJueves",    label: "Jue"        },
            { key: "horasViernes",   label: "Vie"        },
            { key: "horasSabado",    label: "Sáb"        },
            { key: "horasDomingo",   label: "Dom"        },
            { key: "horasFeriados",  label: "Fer"        },
        ],
        searchFields: ["nombre", "nombreProyecto", "cCosto", "numProyecto", "numObjetivo", "domicilio"],
        campos: [
            { key: "cCosto",          label: "C. Costo",           type: "text"   },
            { key: "numProyecto",     label: "N° Proyecto",        type: "text"   },
            { key: "numObjetivo",     label: "N° Objetivo",        type: "text"   },
            { key: "nombreProyecto",  label: "Nombre Proyecto",    type: "text"   },
            { key: "nombre",          label: "Nombre Objetivo",    type: "text"   },
            { key: "clienteId",       label: "Cliente (ID)",       type: "text"   },
            { key: "domicilio",       label: "Domicilio",          type: "text"   },
            { key: "localidad",       label: "Localidad",          type: "text"   },
            { key: "zona",            label: "Zona",               type: "text"   },
            { key: "horasLunes",      label: "Hs. Lunes",          type: "number" },
            { key: "horasMartes",     label: "Hs. Martes",         type: "number" },
            { key: "horasMiercoles",  label: "Hs. Miércoles",      type: "number" },
            { key: "horasJueves",     label: "Hs. Jueves",         type: "number" },
            { key: "horasViernes",    label: "Hs. Viernes",        type: "number" },
            { key: "horasSabado",     label: "Hs. Sábado",         type: "number" },
            { key: "horasDomingo",    label: "Hs. Domingo",        type: "number" },
            { key: "horasFeriados",   label: "Hs. Feriados",       type: "number" },
        ],
        excelMap: [
            // Los más específicos primero para evitar que "nombre proyecto" matchee "proyecto"
            { patterns: ["nombre proyecto","nombreproyecto"],                    field: "nombreProyecto" },
            { patterns: ["nombre objetivo","nombreobjetivo"],                    field: "nombre"         },
            { patterns: ["c costo","ccosto","costo","cc"],                       field: "cCosto"         },
            { patterns: ["proyecto","num proyecto","nro proyecto"],              field: "numProyecto"    },
            { patterns: ["objetivo","num objetivo","nro objetivo"],              field: "numObjetivo"    },
            { patterns: ["cliente","clienteid","clientenombre"],                 field: "clienteId"      },
            { patterns: ["domicilio","direccion"],                               field: "domicilio"      },
            { patterns: ["localidad"],                                           field: "localidad"      },
            { patterns: ["zona"],                                                field: "zona"           },
            { patterns: ["lunes","lun"],                                         field: "horasLunes"     },
            { patterns: ["martes","mar"],                                        field: "horasMartes"    },
            { patterns: ["miercoles","mie","miércoles"],                         field: "horasMiercoles" },
            { patterns: ["jueves","jue"],                                        field: "horasJueves"    },
            { patterns: ["viernes","vie"],                                       field: "horasViernes"   },
            { patterns: ["sabado","sab","sábado"],                               field: "horasSabado"    },
            { patterns: ["domingo","dom"],                                        field: "horasDomingo"   },
            { patterns: ["feriado","fer"],                                        field: "horasFeriados"  },
        ],
    },
    {
        id: "vehiculos",
        label: "Vehículos",
        icon: "🚗",
        filterEmpresa: true,
        keyFn: d => d.patente || d._docId,
        dupKey: "patente",
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
        excelMap: [
            { patterns: ["patente","dominio"],         field: "patente"   },
            { patterns: ["marca"],                     field: "marca"     },
            { patterns: ["modelo"],                    field: "modelo"    },
            { patterns: ["tipo"],                      field: "tipo"      },
            { patterns: ["ano","anio","año"],          field: "año"       },
            { patterns: ["estado"],                    field: "estado"    },
            { patterns: ["interno","n interno","ninterno"], field: "interno" },
            { patterns: ["conductor"],                 field: "conductor" },
        ],
    },
    {
        id: "lugaresAdicionales",
        label: "Lugares adicionales",
        icon: "📌",
        filterEmpresa: true,
        keyFn: d => d.nombre || d._docId,
        dupKey: "nombre",
        cols: [
            { key: "nombre", label: "Nombre del lugar" },
        ],
        searchFields: ["nombre"],
        campos: [
            { key: "nombre", label: "Nombre del lugar", type: "text" },
        ],
        excelMap: [
            { patterns: ["nombre","lugar"], field: "nombre" },
        ],
    },
    {
        id: "tiposActividad",
        label: "Tipos de actividad",
        icon: "🔧",
        filterEmpresa: true,
        keyFn: d => d.nombre || d._docId,
        dupKey: "nombre",
        cols: [
            { key: "nombre", label: "Tipo de actividad" },
        ],
        searchFields: ["nombre"],
        campos: [
            { key: "nombre", label: "Tipo de actividad", type: "text" },
        ],
        excelMap: [
            { patterns: ["nombre","tipo","actividad"], field: "nombre" },
        ],
    },
];

// ── Utilidad: normalizar string para comparación ──────────────────────────────
function normalizar(str) {
    return String(str ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

// ── Mapear headers Excel → campos Firestore ───────────────────────────────────
// Devuelve { [headerExcel]: campoFirestore | null }
function mapearHeaders(headers, excelMap) {
    const resultado = {};
    for (const header of headers) {
        const norm = normalizar(header);
        let encontrado = null;
        for (const { patterns, field } of excelMap) {
            if (patterns.some(p => norm === normalizar(p) || norm.includes(normalizar(p)))) {
                encontrado = field;
                break;
            }
        }
        resultado[header] = encontrado;
    }
    return resultado;
}

// ── Componente: Modal importar Excel ─────────────────────────────────────────
function ModalImportExcel({ col, empresaId, onClose, onImportado, importActual, importTotal, setImportActual, setImportTotal }) {
    const [paso, setPaso]           = useState("leer"); // "leer" | "preview" | "importando" | "done"
    const [headers, setHeaders]     = useState([]);
    const [filas, setFilas]         = useState([]);
    const [mapeo, setMapeo]         = useState({});     // { headerExcel: campoFirestore | null }
    const [errMsg, setErrMsg]       = useState(null);
    const [resumen, setResumen]     = useState(null);   // { insertados, actualizados, errores }
    const fileInputRef              = useRef(null);

    const leerArchivo = (file) => {
        setErrMsg(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data   = new Uint8Array(e.target.result);
                const wb     = XLSX.read(data, { type: "array" });
                const sheet  = wb.Sheets[wb.SheetNames[0]];
                const rows   = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

                if (rows.length < 2) {
                    setErrMsg("El archivo no tiene datos suficientes (mínimo una fila de encabezados y una de datos).");
                    return;
                }

                const hdrs = rows[0].map(h => String(h).trim()).filter(h => h !== "");
                const data_rows = rows.slice(1).filter(r =>
                    r.some(cell => String(cell ?? "").trim() !== "")
                );

                setHeaders(hdrs);
                setFilas(data_rows);
                setMapeo(mapearHeaders(hdrs, col.excelMap));
                setPaso("preview");
            } catch (err) {
                setErrMsg("Error leyendo el archivo: " + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const cambiarMapeo = (header, nuevoField) => {
        setMapeo(prev => ({ ...prev, [header]: nuevoField || null }));
    };

    const ejecutarImport = async () => {
        setPaso("importando");
        setImportActual(0);
        setImportTotal(filas.length);

        let insertados  = 0;
        let actualizados = 0;
        let errores     = 0;

        // Cargar documentos existentes para detectar duplicados
        const snapExist = col.filterEmpresa && empresaId
            ? await getDocs(query(collection(db, col.id), where("empresaId", "==", empresaId)))
            : await getDocs(collection(db, col.id));

        // Mapa clave → docId para upsert
        const existMap = {};
        snapExist.docs.forEach(d => {
            const val = d.data()[col.dupKey];
            if (val) existMap[String(val).trim()] = d.id;
        });

        for (let i = 0; i < filas.length; i++) {
            const fila = filas[i];
            try {
                // Construir objeto con los campos mapeados
                const obj = {};
                headers.forEach((h, idx) => {
                    const campo = mapeo[h];
                    if (campo) {
                        const val = String(fila[idx] ?? "").trim();
                        if (val !== "") obj[campo] = val;
                    }
                });

                if (Object.keys(obj).length === 0) {
                    errores++;
                    setImportActual(i + 1);
                    continue;
                }

                if (col.filterEmpresa && empresaId) obj.empresaId = empresaId;

                // Para objetivos: generar codigo compuesto y rellenar clienteNombre
                if (col.id === "objetivos") {
                    if (obj.cCosto || obj.numProyecto || obj.numObjetivo) {
                        obj.codigo = [obj.cCosto, obj.numProyecto, obj.numObjetivo]
                            .filter(Boolean).join("-");
                    }
                    if (!obj.clienteNombre && obj.nombreProyecto) {
                        obj.clienteNombre = obj.nombreProyecto;
                    }
                }

                const claveVal = col.dupKey && obj[col.dupKey] ? String(obj[col.dupKey]).trim() : null;
                const docExistId = claveVal ? existMap[claveVal] : null;

                if (docExistId) {
                    await updateDoc(doc(db, col.id, docExistId), obj);
                    actualizados++;
                } else {
                    const newRef = await addDoc(collection(db, col.id), obj);
                    if (claveVal) existMap[claveVal] = newRef.id;
                    insertados++;
                }
            } catch (err) {
                console.error("Import row error:", err);
                errores++;
            }
            setImportActual(i + 1);
        }

        setResumen({ insertados, actualizados, errores });
        setPaso("done");
        onImportado();
    };

    const camposDisponibles = col.campos
        .filter(c => c.type !== "image")
        .map(c => ({ v: c.key, l: c.label }));

    const headersMapeados = headers.filter(h => mapeo[h]);

    return (
        <div className="gd-overlay" onClick={onClose}>
            <div className="gd-import-modal" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="gd-import-modal-header">
                    <span>📥 Importar Excel — {col.label}</span>
                    <button className="gd-import-modal-close" onClick={onClose} disabled={paso === "importando"}>✕</button>
                </div>

                {/* Paso: seleccionar archivo */}
                {paso === "leer" && (
                    <div className="gd-import-modal-body">
                        <div className="gd-import-dropzone" onClick={() => fileInputRef.current?.click()}>
                            <div className="gd-import-dropzone-icon">📄</div>
                            <div className="gd-import-dropzone-text">
                                <strong>Seleccioná el archivo Excel</strong>
                                <span>Formatos aceptados: .xlsx, .xls, .csv</span>
                            </div>
                            <button className="gd-import-btn-file">Elegir archivo</button>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            style={{ display: "none" }}
                            onChange={e => e.target.files[0] && leerArchivo(e.target.files[0])}
                        />
                        {errMsg && <div className="gd-import-error">{errMsg}</div>}
                        <div className="gd-import-hint">
                            La primera fila debe contener los nombres de columna. El sistema detecta automáticamente las columnas compatibles.
                        </div>
                    </div>
                )}

                {/* Paso: preview y mapeo */}
                {paso === "preview" && (
                    <div className="gd-import-modal-body">
                        <div className="gd-import-stats">
                            <span className="gd-import-stat"><strong>{filas.length}</strong> registros a importar</span>
                            <span className="gd-import-stat"><strong>{headersMapeados.length}</strong> columnas mapeadas de {headers.length}</span>
                        </div>

                        {/* Tabla de preview */}
                        <div className="gd-import-section-title">Vista previa (primeras 5 filas)</div>
                        <div className="gd-import-preview-wrap">
                            <table className="gd-import-preview-table">
                                <thead>
                                    <tr>
                                        {headers.map(h => (
                                            <th key={h} className={mapeo[h] ? "gd-imp-th-ok" : "gd-imp-th-skip"}>
                                                {h}
                                                {mapeo[h]
                                                    ? <span className="gd-imp-th-badge gd-imp-th-badge--ok">→ {mapeo[h]}</span>
                                                    : <span className="gd-imp-th-badge gd-imp-th-badge--skip">omitir</span>
                                                }
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filas.slice(0, 5).map((fila, ri) => (
                                        <tr key={ri}>
                                            {headers.map((h, ci) => (
                                                <td key={ci} className={mapeo[h] ? "" : "gd-imp-td-skip"}>
                                                    {String(fila[ci] ?? "").trim() || <span className="gd-empty-cell">—</span>}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mapeo editable */}
                        <div className="gd-import-section-title">Mapeo de columnas</div>
                        <div className="gd-import-mapeo-grid">
                            {headers.map(h => (
                                <div key={h} className="gd-import-mapeo-row">
                                    <span className="gd-import-mapeo-header">{h}</span>
                                    <span className="gd-import-mapeo-arrow">→</span>
                                    <select
                                        className="gd-input gd-import-mapeo-select"
                                        value={mapeo[h] || ""}
                                        onChange={e => cambiarMapeo(h, e.target.value)}
                                    >
                                        <option value="">— omitir —</option>
                                        {camposDisponibles.map(c => (
                                            <option key={c.v} value={c.v}>{c.l}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>

                        <div className="gd-import-modal-footer">
                            <button className="gd-btn-cancel" onClick={() => setPaso("leer")}>← Volver</button>
                            <button
                                className="gd-import-btn-go"
                                onClick={ejecutarImport}
                                disabled={headersMapeados.length === 0}
                            >
                                📥 Importar {filas.length} registros
                            </button>
                        </div>
                    </div>
                )}

                {/* Paso: importando */}
                {paso === "importando" && (
                    <div className="gd-import-modal-body gd-import-progress-body">
                        <div className="gd-import-progress-icon">⏳</div>
                        <div className="gd-import-progress-label">
                            Importando... <strong>{importActual} / {importTotal}</strong>
                        </div>
                        <div className="gd-import-progress-bar-wrap">
                            <div
                                className="gd-import-progress-bar"
                                style={{ width: importTotal > 0 ? `${Math.round((importActual / importTotal) * 100)}%` : "0%" }}
                            />
                        </div>
                        <div className="gd-import-progress-pct">
                            {importTotal > 0 ? Math.round((importActual / importTotal) * 100) : 0}%
                        </div>
                    </div>
                )}

                {/* Paso: terminado */}
                {paso === "done" && resumen && (
                    <div className="gd-import-modal-body gd-import-progress-body">
                        <div className="gd-import-progress-icon">✅</div>
                        <div className="gd-import-done-title">¡Importación completada!</div>
                        <div className="gd-import-done-stats">
                            <div className="gd-import-done-stat gd-import-done-stat--ok">
                                <strong>{resumen.insertados}</strong>
                                <span>Nuevos</span>
                            </div>
                            <div className="gd-import-done-stat gd-import-done-stat--upd">
                                <strong>{resumen.actualizados}</strong>
                                <span>Actualizados</span>
                            </div>
                            {resumen.errores > 0 && (
                                <div className="gd-import-done-stat gd-import-done-stat--err">
                                    <strong>{resumen.errores}</strong>
                                    <span>Con error</span>
                                </div>
                            )}
                        </div>
                        <button className="gd-import-btn-go" onClick={onClose} style={{ marginTop: "1.5rem" }}>
                            Cerrar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function GestionDatosAdminScreen({ onBack, coleccionInicial = 0, canCreate = false, noDelete = false }) {
    const { empresaNombre, empresaId, data } = useAppData();

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
    const [subiendoFoto,    setSubiendoFoto]    = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importActual,    setImportActual]    = useState(0);
    const [importTotal,     setImportTotal]     = useState(0);
    const fileInputRef      = useRef(null);
    const excelInputRef     = useRef(null);

    const col = COLECCIONES[colIdx];

    // ── Cargar colección ─────────────────────────────────────────────────────
    const cargarColeccion = async () => {
        setLoading(true);
        try {
            const snap = col.filterEmpresa && empresaId
                ? await getDocs(query(collection(db, col.id), where("empresaId", "==", empresaId)))
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

    useEffect(() => {
        setTodos([]);
        setFiltro("");
        setSeleccionado(null);
        setEsNuevo(false);
        setMsg(null);
        cargarColeccion();
    }, [colIdx, empresaId]);

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

    // ── Subir foto a Storage ─────────────────────────────────────────────────
    const subirFoto = async (file) => {
        if (!file || !empresaId) return;
        setSubiendoFoto(true);
        try {
            const legajo = form.legajo || seleccionado?._docId || Date.now();
            const ext    = file.name.split(".").pop();
            const path   = `empresas/${empresaId}/personal/${legajo}.${ext}`;
            const sRef   = storageRef(storage, path);
            await uploadBytes(sRef, file);
            const url = await getDownloadURL(sRef);
            setForm(f => ({ ...f, fotoUrl: url }));
            // Si el doc ya existe en Firestore, actualizarlo directamente
            if (!esNuevo && seleccionado?._docId) {
                await updateDoc(doc(db, "legajos", seleccionado._docId), { fotoUrl: url });
                setTodos(prev => prev.map(d => d._docId === seleccionado._docId ? { ...d, fotoUrl: url } : d));
            }
        } catch (e) {
            setMsg({ ok: false, texto: "❌ Error subiendo foto: " + e.message });
        } finally {
            setSubiendoFoto(false);
        }
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
                if (col.filterEmpresa && empresaId) datos.empresaId = empresaId;
                const ref = await addDoc(collection(db, col.id), datos);
                const creado = { _docId: ref.id, ...datos };
                setTodos(prev =>
                    [creado, ...prev].sort((a, b) =>
                        (a[col.searchFields[0]] || "").toString()
                            .localeCompare((b[col.searchFields[0]] || "").toString())
                    )
                );
                setSeleccionado(null);
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
                        empresaId: empresaId || "",
                    }, { merge: true })
                )
            );
            const snap = await getDocs(
                query(collection(db, "vehiculos"), where("empresaId", "==", empresaId))
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

    // ── Importar tipos de actividad desde config_global ──────────────────────
    const importarTiposActividad = async () => {
        const lista = data.tiposActividad || [];
        if (!lista.length || !empresaId) return;
        setImportando(true);
        setImportMsg(null);
        try {
            await Promise.all(
                lista.map(nombre =>
                    addDoc(collection(db, "tiposActividad"), { nombre, empresaId })
                )
            );
            await cargarColeccion();
            setImportMsg(`✅ ${lista.length} tipos importados correctamente.`);
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

    // ── Callback post-import: recargar lista ─────────────────────────────────
    const onImportadoExcel = () => {
        cargarColeccion();
    };

    // ── Header del panel (igual en lista y edición) ──────────────────────────
    const panelHeader = (
        <div className="gd-panel-header">
            <button className="gd-panel-back" onClick={seleccionado ? cerrarForm : onBack}>
                ← {seleccionado ? "Lista" : "Volver al panel"}
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
        // Separar campos por tipo
        const camposImagen   = col.campos.filter(c => c.type === "image");
        const camposNormales = col.campos.filter(c => c.type !== "number" && c.type !== "image");
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

                    {/* Foto de perfil */}
                    {camposImagen.length > 0 && (
                        <div className="gd-foto-section">
                            <div className="gd-foto-preview">
                                {form.fotoUrl
                                    ? <img src={form.fotoUrl} alt="Foto personal" className="gd-foto-img" />
                                    : <div className="gd-foto-placeholder">Sin foto</div>
                                }
                            </div>
                            <div className="gd-foto-actions">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: "none" }}
                                    onChange={e => e.target.files[0] && subirFoto(e.target.files[0])}
                                />
                                <button
                                    className="gd-btn-foto"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={subiendoFoto}
                                >
                                    {subiendoFoto ? "⏳ Subiendo…" : "📷 Cambiar foto"}
                                </button>
                                {form.fotoUrl && (
                                    <button
                                        className="gd-btn-cancel"
                                        style={{ marginTop: "0.5rem" }}
                                        onClick={() => setForm(f => ({ ...f, fotoUrl: "" }))}
                                        disabled={subiendoFoto}
                                    >
                                        Quitar foto
                                    </button>
                                )}
                            </div>
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
                {/* Botón importar Excel (visible para todas las colecciones) */}
                <button
                    className="gd-btn-import-excel"
                    onClick={() => setShowImportModal(true)}
                    title={`Importar ${col.label} desde Excel`}
                >
                    📥 Importar Excel
                </button>
                {canCreate && (
                    <button className="gd-btn-nuevo" onClick={nuevo}>
                        + Nuevo
                    </button>
                )}
            </div>

            {/* ── Progreso de import (persiste mientras el modal está cerrado) ── */}
            {importActual > 0 && importActual < importTotal && (
                <div className="gd-import-inline-progress">
                    Importando... <strong>{importActual} / {importTotal}</strong>
                    <div className="gd-import-progress-bar-wrap gd-import-progress-bar-wrap--inline">
                        <div
                            className="gd-import-progress-bar"
                            style={{ width: `${Math.round((importActual / importTotal) * 100)}%` }}
                        />
                    </div>
                </div>
            )}

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

            {/* ── Banner importar tipos de actividad ────────────────────── */}
            {col.id === "tiposActividad" && !loading && todos.length === 0 && (
                <div className="gd-import-banner">
                    <div className="gd-import-icon">🔧</div>
                    <div className="gd-import-texto">
                        <strong>Sin tipos de actividad cargados</strong>
                        <span>Importá los tipos existentes de la configuración ({(data.tiposActividad || []).length} tipos)</span>
                    </div>
                    <button
                        className="gd-import-btn"
                        onClick={importarTiposActividad}
                        disabled={importando}
                    >
                        {importando ? "⏳ Importando…" : "📥 Importar desde configuración"}
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

            {/* ── Modal importar Excel ───────────────────────────────────── */}
            {showImportModal && (
                <ModalImportExcel
                    col={col}
                    empresaId={empresaId}
                    onClose={() => setShowImportModal(false)}
                    onImportado={onImportadoExcel}
                    importActual={importActual}
                    importTotal={importTotal}
                    setImportActual={setImportActual}
                    setImportTotal={setImportTotal}
                />
            )}
        </div>
    );
}
