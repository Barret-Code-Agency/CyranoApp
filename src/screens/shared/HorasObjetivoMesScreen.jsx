// src/screens/shared/HorasObjetivoMesScreen.jsx
// Gestión de horas por objetivo / mes
//   Tab 1 – Vista tabla: todos los objetivos del período, horas día a día
//   Tab 2 – Config: editar horas contractuales por objetivo (override mensual)

import { useState, useEffect, useMemo } from "react";
import { collection, query, where, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAppData }      from "../../context/AppDataContext";
import { useClientesData } from "../../hooks/useClientesData";
import { fmtObjetivo }     from "../../utils/formatters";
import { getDias, fmtKey, MESES_ES, HORAS_KEYS, DIAS_ES } from "../../utils/periodoUtils";
import { FERIADOS_ARG } from "../../utils/feriados";
import "./HorasObjetivoMesScreen.css";

const COL_PROG = "programacionServicios";

const DIAS_SEMANA = [
    { key: "horasDomingo",   label: "Dom" },
    { key: "horasLunes",     label: "Lun" },
    { key: "horasMartes",    label: "Mar" },
    { key: "horasMiercoles", label: "Mié" },
    { key: "horasJueves",    label: "Jue" },
    { key: "horasViernes",   label: "Vie" },
    { key: "horasSabado",    label: "Sáb" },
];
const HORAS_COMUNES = [0, 8, 9, 10, 12, 13];

// Horas contratadas para un día (igual que FacturacionScreen / DashboardsGestionScreen)
function hsContrato(dia, obj, diasEsp = {}) {
    if (!obj) return null;
    const key = fmtKey(dia);
    if (FERIADOS_ARG[key]) return obj.horasFeriados != null ? Number(obj.horasFeriados) : null;
    if (diasEsp?.[key] === false) return 0;
    const hs = obj[HORAS_KEYS[dia.getDay()]];
    return hs != null ? Number(hs) : null;
}

function fmtHs(n) {
    if (n == null || n === 0) return "—";
    return Number.isInteger(n) ? `${n}` : n.toFixed(1).replace(".", ",");
}

// ── Selector de período (estilo Consolidado) ──────────────────────────────────
function SelectorPeriodo({ onSelect }) {
    const hoy = new Date();
    const [año, setAño] = useState(hoy.getFullYear());
    const [mes, setMes] = useState(hoy.getMonth() + 1);

    const mesAnt = mes === 1 ? 12 : mes - 1;
    const añoAnt = mes === 1 ? año - 1 : año;

    return (
        <div className="hom-sel-wrap">
            <div className="hom-sel-card">
                <span className="hom-sel-icon">⏱</span>
                <div className="hom-sel-info">
                    <strong>Horas por objetivo / mes</strong>
                    <small>
                        Del 24/{String(mesAnt).padStart(2, "0")}/{añoAnt}
                        &nbsp;al&nbsp;
                        23/{String(mes).padStart(2, "0")}/{año}
                    </small>
                </div>
                <div className="hom-sel-campos">
                    <select className="hom-select" value={mes}
                        onChange={e => setMes(Number(e.target.value))}>
                        {MESES_ES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                    <select className="hom-select hom-select--año" value={año}
                        onChange={e => setAño(Number(e.target.value))}>
                        {Array.from({ length: 6 }, (_, i) => hoy.getFullYear() - 1 + i)
                            .map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button className="hom-btn-ver" onClick={() => onSelect({ año, mes })}>
                        Ver →
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Tab 1: Tabla de horas por objetivo × día ──────────────────────────────────
function TablaHorasObjMes({ config }) {
    const { empresaId } = useAppData();
    const { objetivos }  = useClientesData(empresaId);
    const [docs,     setDocs]     = useState([]);
    const [cargando, setCargando] = useState(false);

    const dias    = useMemo(() => getDias(config.año, config.mes), [config]);
    const mesAnt  = config.mes === 1 ? 12 : config.mes - 1;
    const añoAnt  = config.mes === 1 ? config.año - 1 : config.año;

    useEffect(() => {
        if (!empresaId) return;
        setCargando(true);
        getDocs(query(collection(db, COL_PROG), where("empresaId", "==", empresaId)))
            .then(snap => {
                const data = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(d => d.año === config.año && d.mes === config.mes);
                data.sort((a, b) =>
                    (a.clienteNombre || "").localeCompare(b.clienteNombre || "") ||
                    (a.objetivoNombre || "").localeCompare(b.objetivoNombre || "")
                );
                setDocs(data);
            })
            .catch(console.error)
            .finally(() => setCargando(false));
    }, [empresaId, config]);

    const objMap = useMemo(() => {
        const m = {};
        objetivos.forEach(o => { if (o.id) m[o.id] = o; });
        return m;
    }, [objetivos]);

    const filas = useMemo(() => docs.map(doc => {
        const obj     = objMap[doc.objetivoId] || null;
        const diasEsp = doc.diasEspeciales || {};
        const hsPorDia = dias.map(dia => hsContrato(dia, obj, diasEsp));
        const total    = hsPorDia.reduce((s, h) => s + (h ?? 0), 0);
        return {
            cliente:   doc.clienteNombre || "—",
            objetivo:  doc.objetivoNombre || doc.objetivoId || "—",
            hsPorDia,
            total,
        };
    }), [docs, objMap, dias]);

    const totalesDia   = useMemo(() =>
        dias.map((_, i) => filas.reduce((s, f) => s + (f.hsPorDia[i] ?? 0), 0)),
        [filas, dias]
    );
    const totalGeneral = totalesDia.reduce((s, h) => s + h, 0);

    if (cargando) return <div className="hom-cargando">Cargando…</div>;
    if (!filas.length) return <div className="hom-vacio">Sin datos para el período seleccionado.</div>;

    return (
        <div className="hom-tabla-wrap">
            <div className="hom-tabla-info">
                Del 24/{String(mesAnt).padStart(2, "0")}/{añoAnt} al 23/{String(config.mes).padStart(2, "0")}/{config.año}
                &nbsp;·&nbsp;
                <strong>{filas.length}</strong> objetivo{filas.length !== 1 ? "s" : ""}
                &nbsp;·&nbsp;total período: <strong>{Math.round(totalGeneral)} hs</strong>
            </div>

            <div className="hom-tabla-scroll">
                <table className="hom-tabla">
                    <thead>
                        <tr>
                            <th className="hom-th hom-th-cliente">Cliente</th>
                            <th className="hom-th hom-th-obj">Objetivo</th>
                            {dias.map((dia, i) => {
                                const key    = fmtKey(dia);
                                const esFer  = !!FERIADOS_ARG[key];
                                const dow    = dia.getDay();
                                const esFin  = dow === 0 || dow === 6;
                                return (
                                    <th key={i} title={key}
                                        className={`hom-th hom-th-dia${esFin ? " hom-finde" : ""}${esFer ? " hom-feriado" : ""}`}>
                                        <div className="hom-dia-dow">{DIAS_ES[dow]}</div>
                                        <div className="hom-dia-num">{dia.getDate()}</div>
                                    </th>
                                );
                            })}
                            <th className="hom-th hom-th-total">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filas.map((fila, ri) => (
                            <tr key={ri} className="hom-tr">
                                <td className="hom-td hom-td-cliente">{fila.cliente}</td>
                                <td className="hom-td hom-td-obj">{fila.objetivo}</td>
                                {fila.hsPorDia.map((h, ci) => {
                                    const dia  = dias[ci];
                                    const dow  = dia.getDay();
                                    const esFin = dow === 0 || dow === 6;
                                    const esFer = !!FERIADOS_ARG[fmtKey(dia)];
                                    return (
                                        <td key={ci}
                                            className={`hom-td hom-td-num${esFin ? " hom-finde" : ""}${esFer ? " hom-feriado" : ""}${!h ? " hom-cero" : ""}`}>
                                            {fmtHs(h)}
                                        </td>
                                    );
                                })}
                                <td className="hom-td hom-td-total">{fmtHs(fila.total)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="hom-tr-total">
                            <td className="hom-td hom-td-cliente" colSpan={2}><strong>Total</strong></td>
                            {totalesDia.map((h, i) => (
                                <td key={i} className={`hom-td hom-td-num${!h ? " hom-cero" : ""}`}>
                                    <strong>{fmtHs(h)}</strong>
                                </td>
                            ))}
                            <td className="hom-td hom-td-total"><strong>{fmtHs(totalGeneral)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}

// ── Tab 2: Editor de override por objetivo ────────────────────────────────────
function EditorHorasObjetivo() {
    const { empresaId } = useAppData();
    const { clientes, objetivos, cargando: cargandoListas } = useClientesData(empresaId);

    const hoy = new Date();
    const [año,        setAño]       = useState(hoy.getFullYear());
    const [mes,        setMes]       = useState(hoy.getMonth() + 1);
    const [clienteId,  setClienteId] = useState("");
    const [objetivoId, setObjetivoId]= useState("");
    const [horas,      setHoras]     = useState({});
    const [cargando,   setCargando]  = useState(false);
    const [guardando,  setGuardando] = useState(false);
    const [guardado,   setGuardado]  = useState(false);
    const [error,      setError]     = useState("");

    const periodoKey = `${año}-${String(mes).padStart(2, "0")}`;
    const clienteSel  = clientes.find(c => c.id === clienteId);
    const objFiltrados = !clienteId ? [] : objetivos.filter(o => {
        if (!clienteSel) return false;
        const cn  = clienteSel.nombre.toLowerCase().trim();
        const oid = String(o.clienteId ?? "").toLowerCase().trim();
        const onm = String(o.clienteNombre ?? o.nombreProyecto ?? "").toLowerCase().trim();
        return o.clienteId === clienteId || oid === cn || onm === cn;
    });
    const objSel = objetivos.find(o => o.id === objetivoId);

    useEffect(() => {
        if (!empresaId || !objetivoId) return;
        (async () => {
            setCargando(true);
            setError("");
            setGuardado(false);
            try {
                const docId = `${empresaId}_${objetivoId}_${periodoKey}`;
                const snap  = await getDoc(doc(db, "horasObjetivoMes", docId));
                const h = {};
                if (snap.exists()) {
                    const d = snap.data();
                    DIAS_SEMANA.forEach(({ key }) => { h[key] = d[key] ?? ""; });
                } else {
                    DIAS_SEMANA.forEach(({ key }) => { h[key] = objSel?.[key] ?? ""; });
                }
                setHoras(h);
            } catch (e) {
                setError("Error al cargar: " + e.message);
            } finally {
                setCargando(false);
            }
        })();
    }, [empresaId, objetivoId, periodoKey]);

    const handleHora = (key, valor) => {
        setHoras(prev => ({ ...prev, [key]: valor === "" ? "" : Number(valor) }));
        setGuardado(false);
    };

    const guardar = async () => {
        if (!objetivoId) return;
        setGuardando(true);
        setError("");
        try {
            const docId = `${empresaId}_${objetivoId}_${periodoKey}`;
            await setDoc(doc(db, "horasObjetivoMes", docId), {
                empresaId, objetivoId, año, mes,
                ...Object.fromEntries(
                    DIAS_SEMANA.map(({ key }) => [key, horas[key] === "" ? null : Number(horas[key])])
                ),
            });
            setGuardado(true);
        } catch (e) {
            setError("Error al guardar: " + e.message);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="hom-editor-wrap">
            <div className="hom-filtros">
                <div className="hom-field">
                    <label>Mes</label>
                    <select value={mes} onChange={e => { setMes(Number(e.target.value)); setGuardado(false); }}>
                        {MESES_ES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                </div>
                <div className="hom-field">
                    <label>Año</label>
                    <select value={año} onChange={e => { setAño(Number(e.target.value)); setGuardado(false); }}>
                        {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div className="hom-field">
                    <label>Cliente</label>
                    <select value={clienteId} onChange={e => { setClienteId(e.target.value); setObjetivoId(""); }} disabled={cargandoListas}>
                        <option value="">— Seleccioná —</option>
                        {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                </div>
                <div className="hom-field">
                    <label>Objetivo</label>
                    <select value={objetivoId} onChange={e => setObjetivoId(e.target.value)} disabled={!clienteId || objFiltrados.length === 0}>
                        <option value="">— Seleccioná —</option>
                        {objFiltrados.map(o => <option key={o.id} value={o.id}>{fmtObjetivo(o)}</option>)}
                    </select>
                </div>
            </div>

            {objetivoId ? (
                <div className="hom-editor">
                    <div className="hom-editor-titulo">
                        {objSel ? fmtObjetivo(objSel) : objetivoId} — <strong>{MESES_ES[mes - 1]} {año}</strong>
                    </div>
                    {cargando ? (
                        <div className="hom-loading">Cargando...</div>
                    ) : (
                        <>
                            <div className="hom-grid">
                                {DIAS_SEMANA.map(({ key, label }) => (
                                    <div key={key} className="hom-dia-col">
                                        <div className="hom-dia-label">{label}</div>
                                        <input type="number" className="hom-dia-input"
                                            min={0} max={24} step={0.5}
                                            value={horas[key] ?? ""} placeholder="—"
                                            onChange={e => handleHora(key, e.target.value)} />
                                        <div className="hom-dia-atajos">
                                            {HORAS_COMUNES.map(h => (
                                                <button key={h} className="hom-atajo" onClick={() => handleHora(key, h)}>
                                                    {h === 0 ? "0" : h}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {error && <div className="hom-error">⚠ {error}</div>}
                            <div className="hom-actions">
                                <button className="hom-btn-guardar" onClick={guardar} disabled={guardando}>
                                    {guardando ? "Guardando..." : "💾 Guardar para este mes"}
                                </button>
                                {guardado && <span className="hom-ok">✓ Guardado — el consolidado usará estas horas para {MESES_ES[mes - 1]} {año}</span>}
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <div className="hom-placeholder">
                    Seleccioná un cliente y objetivo para configurar las horas contractuales del mes.<br />
                    Si no configurás un mes específico, el consolidado usa las horas del documento de programación.
                </div>
            )}
        </div>
    );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function HorasObjetivoMesScreen({ onBack }) {
    const [tab,    setTab]    = useState("tabla");
    const [config, setConfig] = useState(null);

    return (
        <div className="hom-root">
            <div className="vh-subpanel">
                <button className="vh-back" onClick={onBack}>← Volver al panel</button>
                <div className="vh-subpanel-title">⏱ Horas por objetivo / mes</div>
            </div>

            {/* Tabs */}
            <div className="hom-tabs">
                <button
                    className={`hom-tab${tab === "tabla" ? " hom-tab--active" : ""}`}
                    onClick={() => setTab("tabla")}>
                    📊 Vista por período
                </button>
                <button
                    className={`hom-tab${tab === "config" ? " hom-tab--active" : ""}`}
                    onClick={() => setTab("config")}>
                    ✏️ Configurar horas
                </button>
            </div>

            {tab === "tabla" && (
                <div className="hom-body">
                    <SelectorPeriodo onSelect={setConfig} />
                    {config && (
                        <TablaHorasObjMes
                            key={`${config.año}-${config.mes}`}
                            config={config}
                        />
                    )}
                </div>
            )}

            {tab === "config" && (
                <div className="hom-body">
                    <EditorHorasObjetivo />
                </div>
            )}
        </div>
    );
}
