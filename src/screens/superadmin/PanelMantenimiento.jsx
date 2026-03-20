// src/screens/superadmin/PanelMantenimiento.jsx
import { useState } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../firebase";

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

// ── Componente principal ───────────────────────────────────────────────────
export default function PanelMantenimiento() {
    return (
        <div className="sa-mant">
            <div className="sa-usuarios-header">
                <div className="sa-section-title">🛠️ Mantenimiento de base de datos</div>
                <span className="sa-usuarios-count">Limpieza de duplicados por colección</span>
            </div>
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
