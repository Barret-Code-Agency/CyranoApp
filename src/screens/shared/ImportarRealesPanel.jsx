// src/screens/shared/ImportarRealesPanel.jsx
// Panel de importación masiva de horarios reales desde Excel.
// Formato esperado:
//   Fila 1-3  : cabecera (empresa, cliente, etc.) — se ignora
//   Fila 4    : encabezados de columnas (LEGAJO en col B)
//   Fila 5    : seriales de fecha Excel (p.ej. 46000)
//   Fila 6+   : 2 filas por agente → fila A = hora entrada, fila B = hora salida
//               Col B = legajo en fila A

import { useState, useRef } from "react";
import { read, utils }      from "xlsx";
import {
    doc, getDoc, setDoc, serverTimestamp,
} from "firebase/firestore";
import { db }               from "../../firebase";
import { useAppData }       from "../../context/AppDataContext";
import { useClientesData }  from "../../hooks/useClientesData";
import { fmtObjetivo }      from "../../utils/formatters";
import { getDias, fmtKey, MESES_ES } from "../../utils/periodoUtils";
import "./ImportarRealesPanel.css";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convierte decimal de tiempo Excel (0.375 → "09:00").
 *  val = 0 → null (celda vacía con valor numérico cero, no representa un turno).
 *  Usa solo la parte fraccionaria para tolerar celdas con fecha+hora completa.
 */
function decimalAHora(val) {
    if (val === null || val === undefined || val === 0) return null;
    if (typeof val === "string") {
        const t = val.trim();
        if (/^\d{1,2}:\d{2}$/.test(t)) return t.padStart(5, "0");
        return null;
    }
    if (typeof val !== "number") return null;
    // Usa solo la parte fraccionaria para eliminar la parte de fecha (datetime Excel)
    const frac = val - Math.floor(val);
    if (frac === 0) return null; // valor entero sin fracción → no es tiempo válido
    const min = Math.round(frac * 1440);
    const h   = Math.floor(min / 60) % 24;
    const m   = min % 60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

/** Convierte serial de fecha Excel (46000 → "2025-12-04") usando UTC */
function serialADateKey(serial) {
    if (!serial || typeof serial !== "number") return null;
    const d = new Date((serial - 25569) * 86400 * 1000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2,"0");
    const day = String(d.getUTCDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
}

/**
 * Parsea el buffer del Excel y devuelve un array de:
 *   { legajo: string, nombre: string, real: { "YYYY-MM-DD": "HH:MM – HH:MM" } }
 * Solo incluye entradas cuya fecha esté en `fechasPermitidas` (Set de dateKeys).
 */
function parsearExcel(buffer, fechasPermitidas) {
    const wb   = read(new Uint8Array(buffer), { type: "array", cellDates: false });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = utils.sheet_to_json(ws, { header: 1, defval: null });

    if (rows.length < 6) throw new Error("El archivo no tiene el formato esperado (menos de 6 filas).");

    // ── Fila de fechas (índice 4 = fila 5) ─────────────────────────────────
    const fechaRow = rows[4];
    // Columnas que son seriales de fecha válidos (entre 2020 y 2035 ≈ 43831–46386)
    const fechaCols = []; // [{ colIdx, dateKey }]
    fechaRow.forEach((val, ci) => {
        if (typeof val === "number" && val > 43000 && val < 48000) {
            const dk = serialADateKey(val);
            if (dk) fechaCols.push({ colIdx: ci, dateKey: dk });
        }
    });

    if (fechaCols.length === 0)
        throw new Error("No se encontraron fechas en la fila 5. Verificá el formato del archivo.");

    // ── Filas de datos (índice 5 en adelante, de a 2) ───────────────────────
    const dataRows = rows.slice(5);
    const personal = [];

    for (let i = 0; i + 1 < dataRows.length; i += 2) {
        const entradaRow = dataRows[i];
        const salidaRow  = dataRows[i + 1];
        if (!entradaRow) break;

        // Legajo en col B (índice 1)
        const legajoRaw = entradaRow[1];
        if (!legajoRaw && legajoRaw !== 0) continue; // fila vacía
        const legajo = String(legajoRaw).trim();
        if (!legajo) continue;

        // Nombre: buscar en col A (índice 0) o col C (índice 2)
        const nombre = (entradaRow[0] || entradaRow[2] || legajo).toString().trim();

        const real = {};
        fechaCols.forEach(({ colIdx, dateKey }) => {
            if (!fechasPermitidas.has(dateKey)) return; // fuera del período

            const entrada = decimalAHora(entradaRow[colIdx]);
            const salida  = decimalAHora(salidaRow  ? salidaRow[colIdx] : null);
            if (!entrada || !salida) return; // sin turno

            real[dateKey] = `${entrada} – ${salida}`;
        });

        if (Object.keys(real).length > 0) {
            personal.push({ legajo, nombre, real });
        }
    }

    return personal;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ImportarRealesPanel({ año, mes }) {
    const { empresaId, empresaNombre } = useAppData();
    const { clientes, objetivos, cargando: cargandoListas } = useClientesData(empresaId);

    // Selección de destino
    const [clienteId,   setClienteId]   = useState("");
    const [objetivoId,  setObjetivoId]  = useState("");

    // Tab activo
    const [tab,         setTab]         = useState("importar"); // "importar" | "borrar"

    // Estado del proceso — importar
    const [fase,        setFase]        = useState("upload"); // "upload" | "preview" | "importing" | "done"
    const [archivos,    setArchivos]    = useState([]);       // [{ nombre, personal[] }]
    const [error,       setError]       = useState("");
    const [progreso,    setProgreso]    = useState({ ok: 0, total: 0 });
    const fileRef = useRef();

    // Estado del proceso — borrar
    const [borrarClienteId,  setBorrarClienteId]  = useState("");
    const [borrarObjetivoId, setBorrarObjetivoId] = useState("");
    const [borrarConfirm,    setBorrarConfirm]    = useState(false);
    const [borrandoFase,     setBorrandoFase]     = useState("idle"); // "idle" | "borrando" | "done"
    const [borrarError,      setBorrarError]      = useState("");
    const [borrarInfo,       setBorrarInfo]       = useState({ agentes: 0, turnos: 0 });

    const dias          = getDias(año, mes);
    const fechasSet     = new Set(dias.map(d => fmtKey(d)));
    const tituloPeriodo = `${MESES_ES[mes - 1]} ${año}`;

    // ── Filtrar objetivos según cliente seleccionado ──────────────────────────
    const clienteSel   = clientes.find(c => c.id === clienteId);
    const objFiltrados = !clienteId ? [] : objetivos.filter(o => {
        if (!clienteSel) return false;
        const cn  = clienteSel.nombre.toLowerCase().trim();
        const oid = String(o.clienteId ?? "").toLowerCase().trim();
        const onm = String(o.clienteNombre ?? o.nombreProyecto ?? "").toLowerCase().trim();
        return o.clienteId === clienteId || oid === cn || onm === cn;
    });
    const objSel = objetivos.find(o => o.id === objetivoId);

    // ── Manejo de archivos ────────────────────────────────────────────────────
    const handleFiles = async (files) => {
        setError("");
        const resultados = [];
        for (const file of files) {
            try {
                const buf     = await file.arrayBuffer();
                const personal = parsearExcel(buf, fechasSet);
                if (personal.length === 0) {
                    setError(`"${file.name}": no se encontraron turnos dentro del período ${tituloPeriodo}.`);
                    return;
                }
                resultados.push({ nombre: file.name, personal });
            } catch (e) {
                setError(`Error al leer "${file.name}": ${e.message}`);
                return;
            }
        }
        setArchivos(resultados);
        setFase("preview");
    };

    const onDrop = (e) => {
        e.preventDefault();
        const files = [...e.dataTransfer.files].filter(f => /\.(xlsx|xls)$/i.test(f.name));
        if (files.length) handleFiles(files);
    };

    // ── Importar a Firestore ──────────────────────────────────────────────────
    const importar = async () => {
        if (!clienteId || !objetivoId) {
            setError("Seleccioná cliente y objetivo de destino.");
            return;
        }
        setFase("importing");
        setError("");

        try {
            const docId  = `${empresaNombre}_${clienteId}_${objetivoId}_${año}-${String(mes).padStart(2,"0")}`;
            const ref    = doc(db, "programacionServicios", docId);

            // ── Leer planilla existente ──────────────────────────────────────
            // getDoc puede fallar con "permission denied" cuando el documento
            // no existe y la regla de Firestore intenta leer resource.data
            // (que es null para docs inexistentes). En ese caso asumimos que
            // la planilla hay que crearla desde cero.
            let personalExistente = [];
            let docExistente      = false;
            let datosExistentes   = null;

            try {
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    docExistente    = true;
                    datosExistentes = snap.data();
                    personalExistente = datosExistentes.personal || [];
                }
            } catch (_readErr) {
                // Documento no existe → se creará nuevo con setDoc
                docExistente = false;
            }

            // ── Combinar todos los archivos ──────────────────────────────────
            const todoImportado = [];
            archivos.forEach(a => todoImportado.push(...a.personal));

            let ok = 0;
            todoImportado.forEach(({ legajo, nombre, real }) => {
                const idx = personalExistente.findIndex(p => String(p.legajo) === String(legajo));
                if (idx >= 0) {
                    // Merge: mantiene entradas existentes, pisa con las importadas
                    personalExistente[idx] = {
                        ...personalExistente[idx],
                        real: { ...(personalExistente[idx].real || {}), ...real },
                    };
                } else {
                    personalExistente.push({
                        legajo,
                        nombre,
                        programado:   {},
                        real,
                        reemplazos:   {},
                        capacitacion: {},
                    });
                }
                ok++;
            });

            setProgreso({ ok, total: ok });

            // ── Guardar en Firestore ──────────────────────────────────────────
            if (docExistente && datosExistentes) {
                await setDoc(ref, {
                    ...datosExistentes,
                    empresaId,
                    personal:      personalExistente,
                    actualizadoEn: serverTimestamp(),
                });
            } else {
                // Crear planilla nueva
                await setDoc(ref, {
                    empresa:        empresaNombre,
                    empresaId,
                    clienteId,
                    clienteNombre:  clienteSel?.nombre || "",
                    objetivoId,
                    objetivoCodigo: objSel?.codigo     || "",
                    objetivoNombre: objSel?.nombre     || "",
                    proyectoNombre: objSel?.proyecto   || "",
                    año, mes,
                    personal:       personalExistente,
                    diasEspeciales: {},
                    horasConfig:    {},
                    actualizadoEn:  serverTimestamp(),
                });
            }

            setFase("done");
        } catch (e) {
            setError("Error al guardar: " + e.message);
            setFase("preview");
        }
    };

    // ── Filtrar objetivos para el tab borrar ─────────────────────────────────
    const borrarClienteSel   = clientes.find(c => c.id === borrarClienteId);
    const borrarObjFiltrados = !borrarClienteId ? [] : objetivos.filter(o => {
        if (!borrarClienteSel) return false;
        const cn  = borrarClienteSel.nombre.toLowerCase().trim();
        const oid = String(o.clienteId ?? "").toLowerCase().trim();
        const onm = String(o.clienteNombre ?? o.nombreProyecto ?? "").toLowerCase().trim();
        return o.clienteId === borrarClienteId || oid === cn || onm === cn;
    });

    // ── Borrar real del período ────────────────────────────────────────────────
    const borrarReal = async () => {
        if (!borrarClienteId || !borrarObjetivoId) return;
        setBorrandoFase("borrando");
        setBorrarError("");
        try {
            const docId = `${empresaNombre}_${borrarClienteId}_${borrarObjetivoId}_${año}-${String(mes).padStart(2,"0")}`;
            const ref   = doc(db, "programacionServicios", docId);
            let snap;
            try { snap = await getDoc(ref); } catch (_e) { snap = { exists: () => false }; }
            if (!snap.exists()) {
                setBorrarError("No existe una planilla para ese cliente/objetivo en este período.");
                setBorrandoFase("idle");
                return;
            }
            const personal = snap.data().personal || [];
            let agentes = 0, turnos = 0;
            const personalLimpio = personal.map(p => {
                const realFiltrado = {};
                Object.entries(p.real || {}).forEach(([dk, val]) => {
                    if (!fechasSet.has(dk)) realFiltrado[dk] = val; // conservar fechas fuera del período
                });
                const borrados = Object.keys(p.real || {}).filter(dk => fechasSet.has(dk)).length;
                if (borrados > 0) { agentes++; turnos += borrados; }
                return { ...p, real: realFiltrado };
            });
            await setDoc(ref, {
                ...snap.data(),
                empresaId,
                personal:      personalLimpio,
                actualizadoEn: serverTimestamp(),
            });
            setBorrarInfo({ agentes, turnos });
            setBorrarConfirm(false);
            setBorrandoFase("done");
        } catch (e) {
            setBorrarError("Error: " + e.message);
            setBorrandoFase("idle");
        }
    };

    // ── Resumen de agentes únicos en preview ──────────────────────────────────
    const resumenPreview = (() => {
        if (!archivos.length) return [];
        const mapa = {};
        archivos.forEach(({ personal }) => {
            personal.forEach(({ legajo, nombre, real }) => {
                if (!mapa[legajo]) mapa[legajo] = { legajo, nombre, turnos: 0 };
                mapa[legajo].turnos += Object.keys(real).length;
            });
        });
        return Object.values(mapa).sort((a, b) => a.legajo.localeCompare(b.legajo));
    })();

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="imp-root">
            {/* Encabezado de período */}
            <div className="imp-header">
                <span className="imp-periodo">{tituloPeriodo}</span>
                <span className="imp-sub">24/{mes === 1 ? 12 : mes - 1} – 23/{mes}</span>
            </div>

            {/* Tabs */}
            <div className="imp-tabs">
                <button
                    className={`imp-tab ${tab === "importar" ? "imp-tab--active" : ""}`}
                    onClick={() => { setTab("importar"); setError(""); }}
                >📥 Importar</button>
                <button
                    className={`imp-tab ${tab === "borrar" ? "imp-tab--active imp-tab--danger" : ""}`}
                    onClick={() => { setTab("borrar"); setBorrarError(""); setBorrandoFase("idle"); setBorrarConfirm(false); }}
                >🗑 Borrar importación</button>
            </div>

            {error && <div className="imp-error">⚠ {error}</div>}

            {/* ── TAB: borrar ──────────────────────────────────────────────── */}
            {tab === "borrar" && (
                <div className="imp-borrar-box">
                    <p className="imp-borrar-desc">
                        Eliminá todos los horarios <strong>reales</strong> importados del período <strong>{tituloPeriodo}</strong> para el objetivo seleccionado.<br/>
                        Los datos programados y de otros períodos <strong>no se tocan</strong>.
                    </p>

                    {borrarError && <div className="imp-error">⚠ {borrarError}</div>}

                    {borrandoFase === "done" ? (
                        <div className="imp-done">
                            <div className="imp-done-icon">🗑</div>
                            <div className="imp-done-title" style={{ color: "#991b1b" }}>Importación borrada</div>
                            <div className="imp-done-desc">
                                Se eliminaron <strong>{borrarInfo.turnos}</strong> turnos de <strong>{borrarInfo.agentes}</strong> agentes.
                            </div>
                            <div className="imp-actions" style={{ justifyContent: "center" }}>
                                <button className="imp-btn-sec" onClick={() => { setBorrandoFase("idle"); setBorrarClienteId(""); setBorrarObjetivoId(""); }}>
                                    Borrar otro
                                </button>
                            </div>
                        </div>
                    ) : borrandoFase === "borrando" ? (
                        <div className="imp-loading">
                            <div className="imp-spinner" />
                            <div>Eliminando datos…</div>
                        </div>
                    ) : (
                        <>
                            <div className="imp-dest-row">
                                <div className="imp-field">
                                    <label>Cliente</label>
                                    <select value={borrarClienteId} onChange={e => { setBorrarClienteId(e.target.value); setBorrarObjetivoId(""); setBorrarConfirm(false); }} disabled={cargandoListas}>
                                        <option value="">— Seleccioná un cliente —</option>
                                        {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                    </select>
                                </div>
                                <div className="imp-field">
                                    <label>Objetivo</label>
                                    <select value={borrarObjetivoId} onChange={e => { setBorrarObjetivoId(e.target.value); setBorrarConfirm(false); }} disabled={!borrarClienteId || borrarObjFiltrados.length === 0}>
                                        <option value="">— Seleccioná un objetivo —</option>
                                        {borrarObjFiltrados.map(o => <option key={o.id} value={o.id}>{fmtObjetivo(o)}</option>)}
                                    </select>
                                </div>
                            </div>

                            {borrarClienteId && borrarObjetivoId && !borrarConfirm && (
                                <button className="imp-btn-danger" onClick={() => setBorrarConfirm(true)}>
                                    🗑 Borrar horarios reales de este período
                                </button>
                            )}

                            {borrarConfirm && (
                                <div className="imp-confirm-box">
                                    <strong>¿Confirmás?</strong> Esta acción borra todos los horarios reales del período <strong>{tituloPeriodo}</strong> del objetivo seleccionado. No se puede deshacer.
                                    <div className="imp-actions" style={{ marginTop: "0.75rem" }}>
                                        <button className="imp-btn-sec" onClick={() => setBorrarConfirm(false)}>Cancelar</button>
                                        <button className="imp-btn-danger" onClick={borrarReal}>Sí, borrar</button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ── FASE: upload ─────────────────────────────────────────────── */}
            {fase === "upload" && (
                <div
                    className="imp-dropzone"
                    onDrop={onDrop}
                    onDragOver={e => e.preventDefault()}
                    onClick={() => fileRef.current?.click()}
                >
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".xlsx,.xls"
                        multiple
                        style={{ display: "none" }}
                        onChange={e => handleFiles([...e.target.files])}
                    />
                    <div className="imp-dropzone-icon">📥</div>
                    <div className="imp-dropzone-txt">
                        Arrastrá el archivo Excel aquí o hacé clic para seleccionarlo
                    </div>
                    <div className="imp-dropzone-hint">
                        Formato: 2 filas por agente · Fila 5 = fechas · Col B = Legajo
                    </div>
                </div>
            )}

            {/* ── FASE: preview ────────────────────────────────────────────── */}
            {fase === "preview" && (
                <div className="imp-preview">
                    {/* Selección de destino */}
                    <div className="imp-dest-box">
                        <div className="imp-dest-title">📌 Destino de la importación</div>
                        <div className="imp-dest-row">
                            <div className="imp-field">
                                <label>Cliente</label>
                                <select
                                    value={clienteId}
                                    onChange={e => { setClienteId(e.target.value); setObjetivoId(""); }}
                                    disabled={cargandoListas}
                                >
                                    <option value="">— Seleccioná un cliente —</option>
                                    {clientes.map(c => (
                                        <option key={c.id} value={c.id}>{c.nombre}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="imp-field">
                                <label>Objetivo</label>
                                <select
                                    value={objetivoId}
                                    onChange={e => setObjetivoId(e.target.value)}
                                    disabled={!clienteId || objFiltrados.length === 0}
                                >
                                    <option value="">— Seleccioná un objetivo —</option>
                                    {objFiltrados.map(o => (
                                        <option key={o.id} value={o.id}>{fmtObjetivo(o)}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Resumen de archivos */}
                    <div className="imp-files-info">
                        {archivos.map(a => (
                            <div key={a.nombre} className="imp-file-tag">
                                📄 {a.nombre} · <strong>{a.personal.length}</strong> agentes
                            </div>
                        ))}
                    </div>

                    {/* Tabla de agentes */}
                    <div className="imp-table-wrap">
                        <table className="imp-table">
                            <thead>
                                <tr>
                                    <th>Legajo</th>
                                    <th>Nombre</th>
                                    <th>Turnos a importar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {resumenPreview.map(p => (
                                    <tr key={p.legajo}>
                                        <td className="imp-td-legajo">{p.legajo}</td>
                                        <td>{p.nombre}</td>
                                        <td className="imp-td-num">{p.turnos}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Acciones */}
                    <div className="imp-actions">
                        <button className="imp-btn-sec" onClick={() => { setFase("upload"); setArchivos([]); }}>
                            ← Cambiar archivo
                        </button>
                        <button
                            className="imp-btn-pri"
                            disabled={!clienteId || !objetivoId}
                            onClick={importar}
                        >
                            ✅ Importar {resumenPreview.length} agentes
                        </button>
                    </div>
                </div>
            )}

            {/* ── FASE: importing ──────────────────────────────────────────── */}
            {fase === "importing" && (
                <div className="imp-loading">
                    <div className="imp-spinner" />
                    <div>Importando datos a Firestore…</div>
                </div>
            )}

            {/* ── FASE: done ───────────────────────────────────────────────── */}
            {fase === "done" && (
                <div className="imp-done">
                    <div className="imp-done-icon">✅</div>
                    <div className="imp-done-title">Importación completada</div>
                    <div className="imp-done-desc">
                        Se importaron <strong>{progreso.ok}</strong> agentes al período <strong>{tituloPeriodo}</strong>.
                    </div>
                    <div className="imp-actions">
                        <button className="imp-btn-sec" onClick={() => { setFase("upload"); setArchivos([]); setClienteId(""); setObjetivoId(""); }}>
                            📥 Importar otro archivo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
