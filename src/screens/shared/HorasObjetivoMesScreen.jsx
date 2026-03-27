// src/screens/shared/HorasObjetivoMesScreen.jsx
// Gestión de horas por objetivo / mes
//   Tab 1 – Tabla: todos los objetivos del período, horas contratadas día a día
//   Tab 2 – Config: editar horas contractuales por objetivo (override mensual)
//
// Recibe año y mes desde AdminContratoHome (vía PeriodoCard — mismo estilo que el resto de pantallas)

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

// Horas contratadas para un día (igual que FacturacionScreen)
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

// ── Tab 1: Tabla de horas por objetivo × día ──────────────────────────────────
function TablaHorasObjMes({ año, mes }) {
    const { empresaId } = useAppData();
    const { objetivos }  = useClientesData(empresaId);
    const [docs,     setDocs]     = useState([]);
    const [cargando, setCargando] = useState(false);

    const dias   = useMemo(() => getDias(año, mes), [año, mes]);
    const mesAnt = mes === 1 ? 12 : mes - 1;
    const añoAnt = mes === 1 ? año - 1 : año;

    useEffect(() => {
        if (!empresaId) return;
        setCargando(true);
        getDocs(query(collection(db, COL_PROG), where("empresaId", "==", empresaId)))
            .then(snap => {
                const data = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(d => d.año === año && d.mes === mes);
                data.sort((a, b) =>
                    (a.clienteNombre || "").localeCompare(b.clienteNombre || "") ||
                    (a.objetivoNombre || "").localeCompare(b.objetivoNombre || "")
                );
                setDocs(data);
            })
            .catch(console.error)
            .finally(() => setCargando(false));
    }, [empresaId, año, mes]);

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
            cliente:  doc.clienteNombre || "—",
            objetivo: doc.objetivoNombre || doc.objetivoId || "—",
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
                Del 24/{String(mesAnt).padStart(2, "0")}/{añoAnt} al 23/{String(mes).padStart(2, "0")}/{año}
                &nbsp;·&nbsp;<strong>{filas.length}</strong> objetivo{filas.length !== 1 ? "s" : ""}
                &nbsp;·&nbsp;total período: <strong>{Math.round(totalGeneral).toLocaleString()} hs</strong>
            </div>

            <div className="hom-tabla-scroll">
                <table className="hom-tabla">
                    <thead>
                        <tr>
                            <th className="hom-th hom-th-cliente">Cliente</th>
                            <th className="hom-th hom-th-obj">Objetivo</th>
                            {dias.map((dia, i) => {
                                const key   = fmtKey(dia);
                                const esFer = !!FERIADOS_ARG[key];
                                const dow   = dia.getDay();
                                const esFin = dow === 0 || dow === 6;
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
                                    const dia   = dias[ci];
                                    const dow   = dia.getDay();
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
function EditorHorasObjetivo({ año: añoProp, mes: mesProp }) {
    const { empresaId } = useAppData();
    const { clientes, objetivos, cargando: cargandoListas } = useClientesData(empresaId);

    const hoy = new Date();
    const [año,        setAño]       = useState(añoProp ?? hoy.getFullYear());
    const [mes,        setMes]       = useState(mesProp ?? hoy.getMonth() + 1);
    const [clienteId,  setClienteId] = useState("");
    const [objetivoId, setObjetivoId]= useState("");
    const [horas,      setHoras]     = useState({});
    const [cargando,   setCargando]  = useState(false);
    const [guardando,  setGuardando] = useState(false);
    const [guardado,   setGuardado]  = useState(false);
    const [error,      setError]     = useState("");

    const periodoKey  = `${año}-${String(mes).padStart(2, "0")}`;
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

// ── Pantalla principal — recibe año y mes desde AdminContratoHome ─────────────
export default function HorasObjetivoMesScreen({ año, mes, onBack }) {
    const [tab, setTab] = useState("tabla");

    return (
        <div className="hom-root">
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

            <div className="hom-body">
                {tab === "tabla" && <TablaHorasObjMes año={año} mes={mes} />}
                {tab === "config" && <EditorHorasObjetivo año={año} mes={mes} />}
            </div>
        </div>
    );
}
