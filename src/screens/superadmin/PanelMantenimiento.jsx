// src/screens/superadmin/PanelMantenimiento.jsx
import { useState } from "react";
import { collection, getDocs, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "../../firebase";
import { correrMigracion } from "../../utils/migracionEmpresaId";

// ── Colecciones a limpiar ─────────────────────────────────────────────────
const COLECCIONES = [
    {
        id:    "legajos",
        label: "Personal (legajos)",
        icon:  "👷",
        keyFn: d => d.legajo || d.nombre || d.dni || null,
        desc:  "Registros de personal cargados desde el Excel",
    },
    {
        id:    "clientes",
        label: "Clientes",
        icon:  "🏢",
        keyFn: d => d.nombre || d.cuit || null,
        desc:  "Empresas y clientes del contrato",
    },
    {
        id:    "objetivos",
        label: "Objetivos / Servicios",
        icon:  "📍",
        keyFn: d => d.nombre || d.direccion || null,
        desc:  "Objetivos de servicio",
    },
    {
        id:    "supervisores",
        label: "Supervisores",
        icon:  "🔍",
        keyFn: d => d.legajo || d.email || d.nombre || null,
        desc:  "Tabla de supervisores del sistema",
    },
    {
        id:    "vigiladores",
        label: "Vigiladores",
        icon:  "👮",
        keyFn: d => d.legajo || d.dni || d.nombre || null,
        desc:  "Tabla de vigiladores del sistema",
    },
    {
        id:    "encargados",
        label: "Encargados",
        icon:  "📋",
        keyFn: d => d.legajo || d.email || d.nombre || null,
        desc:  "Tabla de encargados del sistema",
    },
    {
        id:    "vehiculos",
        label: "Vehículos",
        icon:  "🚗",
        keyFn: d => d.patente || d.dominio || d.interno || null,
        desc:  "Flota de vehículos registrados",
    },
];

// ── Tarjeta limpiadora por colección ──────────────────────────────────────
function CardLimpiador({ col }) {
    const [log,      setLog]      = useState([]);
    const [running,  setRunning]  = useState(false);
    const [analisis, setAnalisis] = useState(null);
    const [abierto,  setAbierto]  = useState(false);

    const addLog = (msg, tipo = "ok") =>
        setLog(prev => [...prev, { msg, tipo, ts: new Date().toLocaleTimeString() }]);

    const analizar = async () => {
        setRunning(true); setLog([]); setAnalisis(null);
        try {
            addLog(`🔍 Leyendo ${col.id}…`, "info");
            const snap = await getDocs(collection(db, col.id));
            const docs = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
            addLog(`📦 ${docs.length} documentos encontrados.`, "info");

            const grupos = {};
            docs.forEach(d => {
                const key = col.keyFn(d);
                if (!key) return;
                if (!grupos[key]) grupos[key] = [];
                grupos[key].push(d._docId);
            });

            const duplicados     = Object.entries(grupos).filter(([, ids]) => ids.length > 1);
            const totalSobrantes = duplicados.reduce((s, [, ids]) => s + ids.length - 1, 0);

            if (duplicados.length === 0) {
                addLog("✅ Sin duplicados. La colección está limpia.", "ok");
            } else {
                addLog(`⚠️ ${duplicados.length} registros duplicados — ${totalSobrantes} documentos sobrantes.`, "warn");
                duplicados.slice(0, 8).forEach(([key, ids]) =>
                    addLog(`  • "${key}": ${ids.length} copias`, "warn")
                );
                if (duplicados.length > 8) addLog(`  … y ${duplicados.length - 8} más.`, "warn");
            }

            setAnalisis({ duplicados, totalSobrantes, total: docs.length });
        } catch (e) {
            addLog("❌ Error: " + e.message, "err");
        } finally {
            setRunning(false);
        }
    };

    const limpiar = async () => {
        if (!analisis?.duplicados.length) return;
        setRunning(true);
        addLog("🗑️ Iniciando limpieza…", "info");
        let eliminados = 0;
        try {
            for (const [key, ids] of analisis.duplicados) {
                for (const docId of ids.slice(1)) {
                    await deleteDoc(doc(db, col.id, docId));
                    eliminados++;
                }
                addLog(`  ✓ "${key}": eliminadas ${ids.length - 1} copias.`, "ok");
            }
            addLog(`✅ ${eliminados} documentos eliminados.`, "ok");
            setAnalisis(null);
        } catch (e) {
            addLog("❌ Error: " + e.message, "err");
        } finally {
            setRunning(false);
        }
    };

    return (
        <div className={`sa-mant-card sa-mant-card--col ${abierto ? "sa-mant-card--open" : ""}`}>
            {/* Header colapsable */}
            <button className="sa-mant-col-header" onClick={() => setAbierto(o => !o)}>
                <span className="sa-mant-col-icon">{col.icon}</span>
                <div className="sa-mant-col-info">
                    <div className="sa-mant-card-title">{col.label}</div>
                    <div className="sa-mant-card-desc">{col.desc}</div>
                </div>
                {analisis && (
                    <span className={`sa-mant-col-badge ${analisis.totalSobrantes ? "sa-mant-col-badge--warn" : "sa-mant-col-badge--ok"}`}>
                        {analisis.totalSobrantes ? `${analisis.totalSobrantes} sobrantes` : "✓ Limpia"}
                    </span>
                )}
                <span className="sa-mant-col-arrow">{abierto ? "▲" : "▼"}</span>
            </button>

            {abierto && (
                <div className="sa-mant-col-body">
                    <div className="sa-mant-actions">
                        <button className="sa-ur-btn-save" onClick={analizar} disabled={running}>
                            {running ? "Analizando…" : "🔍 Analizar"}
                        </button>
                        {analisis?.duplicados.length > 0 && (
                            <button className="sa-mant-btn-danger" onClick={limpiar} disabled={running}>
                                {running ? "Eliminando…" : `🗑️ Eliminar ${analisis.totalSobrantes} sobrantes`}
                            </button>
                        )}
                    </div>

                    {analisis && (
                        <div className="sa-mant-resumen">
                            <div className="sa-mant-res-item">
                                <span className="sa-mant-res-val">{analisis.total}</span>
                                <span className="sa-mant-res-lbl">Total</span>
                            </div>
                            <div className="sa-mant-res-item">
                                <span className={`sa-mant-res-val ${analisis.duplicados.length ? "pm-status--warn" : "pm-status--ok"}`}>
                                    {analisis.duplicados.length}
                                </span>
                                <span className="sa-mant-res-lbl">Duplicados</span>
                            </div>
                            <div className="sa-mant-res-item">
                                <span className={`sa-mant-res-val ${analisis.totalSobrantes ? "pm-status--err" : "pm-status--ok"}`}>
                                    {analisis.totalSobrantes}
                                </span>
                                <span className="sa-mant-res-lbl">Sobrantes</span>
                            </div>
                            <div className="sa-mant-res-item">
                                <span className="sa-mant-res-val pm-status--ok">
                                    {analisis.total - analisis.totalSobrantes}
                                </span>
                                <span className="sa-mant-res-lbl">Quedarán</span>
                            </div>
                        </div>
                    )}

                    {log.length > 0 && (
                        <div className="sa-mant-log">
                            {log.map((l, i) => (
                                <div key={i} className={`sa-mant-log-line pm-log--${l.tipo}`}>
                                    <span className="sa-mant-log-ts">{l.ts}</span>{l.msg}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Migración forzada: pone empresaId a TODOS los docs sin él ──────────────
const COLECCIONES_MIGRAR = [
    "legajos","clientes","objetivos","vehiculos","supervisores","conductores",
    "encargados","admins","informes","comunicaciones","procedimientos",
    "capacitaciones","rondas","plantillasRonda","programacionServicios",
    "diagramas14x14","ingresosTurno","planCapacitacion",
];

function PanelMigracionForzada() {
    const [log,     setLog]     = useState([]);
    const [running, setRunning] = useState(false);
    const [done,    setDone]    = useState(false);

    const addLog = (msg) => setLog(prev => [...prev, msg]);

    const correr = async () => {
        if (!window.confirm(
            "¿Migración forzada?\n\n" +
            "Asignará empresaId al PRIMER empresa activa a TODOS los documentos " +
            "sin empresaId en 18 colecciones.\n" +
            "Usá esto solo cuando hay UNA sola empresa en el sistema."
        )) return;

        setRunning(true); setLog([]); setDone(false);
        try {
            const empresasSnap = await getDocs(collection(db, "empresas"));
            const empresa = empresasSnap.docs.find(d => d.data().activo !== false) || empresasSnap.docs[0];
            if (!empresa) { addLog("❌ No hay empresas."); return; }
            const empresaId = empresa.id;
            addLog(`Empresa: ${empresaId} (${empresa.data().nombre || ""})`);

            let totalActualizados = 0;
            for (const colNombre of COLECCIONES_MIGRAR) {
                const snap = await getDocs(collection(db, colNombre));
                const sinId = snap.docs.filter(d => !d.data().empresaId);
                if (sinId.length === 0) { addLog(`${colNombre}: ✅ ya migrada`); continue; }

                let batch = writeBatch(db);
                let en = 0;
                for (const d of sinId) {
                    batch.update(doc(db, colNombre, d.id), { empresaId });
                    en++; totalActualizados++;
                    if (en === 499) { await batch.commit(); batch = writeBatch(db); en = 0; }
                }
                if (en > 0) await batch.commit();
                addLog(`${colNombre}: ${sinId.length} docs actualizados`);
            }
            addLog(`─────────────────────────────────`);
            addLog(`✅ Total: ${totalActualizados} documentos con empresaId: "${empresaId}"`);
            setDone(true);
        } catch (e) {
            addLog("❌ Error: " + e.message);
        } finally {
            setRunning(false);
        }
    };

    return (
        <div className="sa-mant-card" style={{ marginBottom: "1.5rem", border: "2px solid #dc2626" }}>
            <div style={{ padding: "1rem 1.25rem" }}>
                <div className="sa-mant-card-title">⚡ Migración forzada: asignar empresaId a todo</div>
                <div className="sa-mant-card-desc" style={{ marginBottom: "1rem" }}>
                    Asigna <code>empresaId</code> a <strong>todos</strong> los documentos que no lo tienen, sin importar el campo <code>empresa</code>.
                    Usar solo cuando hay <strong>una sola empresa</strong> en el sistema.
                </div>
                <button
                    className={done ? "sa-ur-btn-cancel" : "sa-ur-btn-save"}
                    style={{ background: done ? undefined : "#dc2626", marginBottom: log.length ? "1rem" : 0 }}
                    onClick={correr}
                    disabled={running}
                >
                    {running ? "Migrando…" : done ? "✅ Completado" : "⚡ Forzar migración"}
                </button>
                {log.length > 0 && (
                    <div className="sa-mant-log">
                        {log.map((l, i) => (
                            <div key={i} className="sa-mant-log-line">
                                <span className="sa-mant-log-ts">{new Date().toLocaleTimeString()}</span>{l}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Panel de migración empresaId ───────────────────────────────────────────
function PanelMigracion() {
    const [log,      setLog]      = useState([]);
    const [running,  setRunning]  = useState(false);
    const [done,     setDone]     = useState(false);

    const addLog = (msg) => setLog(prev => [...prev, msg]);

    const correr = async () => {
        if (!window.confirm(
            "¿Confirmar migración?\n\n" +
            "Se agregará el campo empresaId a todos los documentos que no lo tengan.\n" +
            "La operación es segura e idempotente (puede correrse más de una vez)."
        )) return;

        setRunning(true); setLog([]); setDone(false);
        addLog("Iniciando migración de empresaId…");
        try {
            const resultados = await correrMigracion(addLog);
            const totalMigrados = resultados.reduce((s, r) => s + (r.migrados ?? 0), 0);
            const totalSinMapeo = resultados.reduce((s, r) => s + (r.sinMapeo ?? 0), 0);
            addLog("─────────────────────────────────");
            addLog(`Migración completa: ${totalMigrados} documentos actualizados, ${totalSinMapeo} sin mapeo.`);
            setDone(true);
        } catch (e) {
            addLog("Error crítico: " + e.message);
        } finally {
            setRunning(false);
        }
    };

    return (
        <div className="sa-mant-card" style={{ marginBottom: "2rem", border: "2px solid var(--color-warning, #f59e0b)" }}>
            <div style={{ padding: "1rem 1.25rem" }}>
                <div className="sa-mant-card-title">🔧 Migración: agregar empresaId a colecciones</div>
                <div className="sa-mant-card-desc" style={{ marginBottom: "1rem" }}>
                    Agrega el campo <code>empresaId</code> a todos los documentos que usan el campo legacy <code>empresa</code>.
                    Necesario antes de activar las Firestore Security Rules. Idempotente — puede correrse múltiples veces.
                </div>

                <button
                    className={done ? "sa-ur-btn-cancel" : "sa-ur-btn-save"}
                    onClick={correr}
                    disabled={running}
                    style={{ marginBottom: log.length ? "1rem" : 0 }}
                >
                    {running ? "Migrando…" : done ? "✅ Migración completada — correr de nuevo" : "🚀 Correr migración"}
                </button>

                {log.length > 0 && (
                    <div className="sa-mant-log">
                        {log.map((l, i) => (
                            <div key={i} className="sa-mant-log-line">
                                <span className="sa-mant-log-ts">{new Date().toLocaleTimeString()}</span>{l}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Panel de migración de usuarios ─────────────────────────────────────────
function PanelMigracionUsuarios() {
    const [log,     setLog]     = useState([]);
    const [running, setRunning] = useState(false);
    const [done,    setDone]    = useState(false);

    const addLog = (msg) => setLog(prev => [...prev, msg]);

    const correr = async () => {
        if (!window.confirm(
            "¿Migrar usuarios?\n\n" +
            "Se asignará empresaId a todos los usuarios que no lo tengan.\n" +
            "Requiere que haya una sola empresa activa en el sistema."
        )) return;

        setRunning(true); setLog([]); setDone(false);
        try {
            // 1. Obtener empresas disponibles
            const empresasSnap = await getDocs(collection(db, "empresas"));
            const empresas = empresasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            addLog(`Empresas en sistema: ${empresas.map(e => e.id).join(", ")}`);

            if (empresas.length === 0) {
                addLog("❌ No hay empresas en Firestore. Creá una empresa primero.");
                return;
            }
            if (empresas.length > 1) {
                addLog("⚠️ Hay más de una empresa. Esta migración asigna la primera activa.");
            }
            const empresa = empresas.find(e => e.activo !== false) || empresas[0];
            addLog(`Empresa destino: ${empresa.id} (${empresa.nombre || "sin nombre"})`);

            // 2. Obtener usuarios sin empresaId
            const usuariosSnap = await getDocs(collection(db, "usuarios"));
            const sinEmpresa = usuariosSnap.docs.filter(d => !d.data().empresaId);
            addLog(`Usuarios sin empresaId: ${sinEmpresa.length}`);

            if (sinEmpresa.length === 0) {
                addLog("✅ Todos los usuarios ya tienen empresaId.");
                setDone(true);
                return;
            }

            // 3. Actualizar en batches de 499
            let batch = writeBatch(db);
            let count = 0;
            for (const d of sinEmpresa) {
                batch.update(doc(db, "usuarios", d.id), { empresaId: empresa.id });
                count++;
                if (count % 499 === 0) { await batch.commit(); batch = writeBatch(db); }
            }
            if (count % 499 !== 0) await batch.commit();

            addLog(`✅ ${count} usuarios actualizados con empresaId: "${empresa.id}".`);
            setDone(true);
        } catch (e) {
            addLog("❌ Error: " + e.message);
        } finally {
            setRunning(false);
        }
    };

    return (
        <div className="sa-mant-card" style={{ marginBottom: "1.5rem", border: "2px solid var(--color-primary, #6366f1)" }}>
            <div style={{ padding: "1rem 1.25rem" }}>
                <div className="sa-mant-card-title">👤 Migración: asignar empresaId a usuarios</div>
                <div className="sa-mant-card-desc" style={{ marginBottom: "1rem" }}>
                    Asigna <code>empresaId</code> a todos los usuarios que no lo tienen (creados antes de la migración multi-empresa).
                    Necesario para que los usuarios existentes puedan ver los datos de su empresa.
                </div>
                <button
                    className={done ? "sa-ur-btn-cancel" : "sa-ur-btn-save"}
                    onClick={correr}
                    disabled={running}
                    style={{ marginBottom: log.length ? "1rem" : 0 }}
                >
                    {running ? "Migrando…" : done ? "✅ Completado — correr de nuevo" : "🚀 Migrar usuarios"}
                </button>
                {log.length > 0 && (
                    <div className="sa-mant-log">
                        {log.map((l, i) => (
                            <div key={i} className="sa-mant-log-line">
                                <span className="sa-mant-log-ts">{new Date().toLocaleTimeString()}</span>{l}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Componente principal ───────────────────────────────────────────────────
export default function PanelMantenimiento() {
    return (
        <div className="sa-mant">
            <div className="sa-usuarios-header">
                <div className="sa-section-title">🛠️ Mantenimiento de base de datos</div>
                <span className="sa-usuarios-count">Migración y limpieza de duplicados</span>
            </div>

            <PanelMigracionForzada />
            <PanelMigracion />
            <PanelMigracionUsuarios />

            <div className="sa-mant-instruccion">
                Expandí cada colección, hacé clic en <strong>Analizar</strong> para detectar duplicados
                y luego en <strong>Eliminar sobrantes</strong> para limpiarla. Se conserva siempre un registro por entrada.
            </div>
            {COLECCIONES.map(col => (
                <CardLimpiador key={col.id} col={col} />
            ))}
        </div>
    );
}
