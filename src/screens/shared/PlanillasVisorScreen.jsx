// src/screens/shared/PlanillasVisorScreen.jsx
// Vista de planillas operativas para supervisor / administrativo / gerente.
// Muestra registros agrupados por fecha + objetivo con estado de firma y código de trazabilidad.

import { useState, useEffect, useMemo } from "react";
import { useAppData }      from "../../context/AppDataContext";
import { useClientesData } from "../../hooks/useClientesData";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { MESES_ES } from "../../utils/periodoUtils";
import "./PlanillasVisorScreen.css";

const TIPOS = [
    { id: "llaves",    label: "🔑 Llaves",    col: "controlLlaves",    firmaTipo: "planilla_llaves"    },
    { id: "visitas",   label: "🧑‍💼 Visitas",   col: "controlVisitas",   firmaTipo: "planilla_visitas"   },
    { id: "vehiculos", label: "🚗 Vehículos",  col: "controlVehiculos", firmaTipo: "planilla_vehiculos" },
];

const AÑOS = [2024, 2025, 2026, 2027];

function fmtFecha(iso) {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
}

// ── Sub-componente: detalle de un grupo (fecha+objetivo) ──────────────────────
function DetalleGrupo({ grupo, tipo, onBack }) {
    return (
        <div className="pvr-detalle">
            <button className="pvr-back" onClick={onBack}>← Volver</button>
            <div className="pvr-detalle-header">
                <div className="pvr-detalle-titulo">
                    {tipo === "llaves" ? "🔑 Control de Llaves"
                     : tipo === "vehiculos" ? "🚗 Vehículos livianos"
                     : "🧑‍💼 Visitas"}
                </div>
                <div className="pvr-detalle-meta">
                    {grupo.clienteNombre && <span>{grupo.clienteNombre} · </span>}
                    <span>{grupo.objetivoNombre}</span>
                    <span> · {fmtFecha(grupo.fecha)}</span>
                </div>
                {grupo.firma ? (
                    <div className="pvr-detalle-firma pvr-detalle-firma--ok">
                        ✅ Firmada — código de trazabilidad: <code className="pvr-codigo">{grupo.firmaId}</code>
                    </div>
                ) : (
                    <div className="pvr-detalle-firma pvr-detalle-firma--pend">
                        ⚠️ Sin firma electrónica
                    </div>
                )}
            </div>

            {tipo === "llaves" && (
                <div className="pvr-tabla-wrap">
                    <table className="pvr-tabla">
                        <thead>
                            <tr>
                                <th>Hora entrega</th>
                                <th>Llave</th>
                                <th>Quien retira</th>
                                <th>Vigilador</th>
                                <th>F. devolución</th>
                                <th>H. devolución</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {grupo.items.map(r => (
                                <tr key={r.id} className={r.estado === "entregada" ? "pvr-tr--pend" : ""}>
                                    <td>{r.hora}</td>
                                    <td>{r.llaveNombre}</td>
                                    <td>{r.retiraPersona}</td>
                                    <td>{r.vigiladorEntrega}</td>
                                    <td>{r.fechaDevolucion ? fmtFecha(r.fechaDevolucion) : "—"}</td>
                                    <td>{r.horaDevolucion || "—"}</td>
                                    <td>
                                        {r.estado === "entregada"
                                            ? <span className="pvr-badge pvr-badge--pend">Pendiente</span>
                                            : <span className="pvr-badge pvr-badge--ok">Devuelta</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {tipo === "visitas" && (
                <div className="pvr-tabla-wrap">
                    <table className="pvr-tabla">
                        <thead>
                            <tr>
                                <th>H. ingreso</th>
                                <th>Nombre</th>
                                <th>DNI</th>
                                <th>A quién visita</th>
                                <th>H. egreso</th>
                                <th>Observaciones</th>
                                <th>Código</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {grupo.items.map(r => (
                                <tr key={r.id} className={r.estado === "en_planta" ? "pvr-tr--pend" : ""}>
                                    <td>{r.horaIngreso}</td>
                                    <td>{r.nombre}</td>
                                    <td>{r.dni || "—"}</td>
                                    <td>{r.aQuienVisita}</td>
                                    <td>{r.horaEgreso || "—"}</td>
                                    <td>{r.observaciones || "—"}</td>
                                    <td className="pvr-td-codigo">{r.codigoTrazabilidad}</td>
                                    <td>
                                        {r.estado === "en_planta"
                                            ? <span className="pvr-badge pvr-badge--pend">En planta</span>
                                            : <span className="pvr-badge pvr-badge--ok">Retirado</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {tipo === "vehiculos" && (
                <div className="pvr-tabla-wrap">
                    <table className="pvr-tabla">
                        <thead>
                            <tr>
                                <th>Patente</th>
                                <th>Conductor</th>
                                <th>Entrada</th>
                                <th>Salida</th>
                                <th>Km entrada</th>
                                <th>Km salida</th>
                                <th>Recorrido</th>
                                <th>Inventario</th>
                                <th>Observaciones</th>
                                <th>Código</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {grupo.items.map(r => {
                                const kmRec = r.kmSalida != null && r.kmEntrada != null
                                    ? r.kmSalida - r.kmEntrada : null;
                                return (
                                    <tr key={r.id} className={r.estado === "en_puesto" ? "pvr-tr--pend" : ""}>
                                        <td><strong>{r.patente}</strong></td>
                                        <td>{r.conductor}</td>
                                        <td>{r.horaEntrada}</td>
                                        <td>{r.horaSalida || "—"}</td>
                                        <td>{r.kmEntrada ?? "—"}</td>
                                        <td>{r.kmSalida  ?? "—"}</td>
                                        <td>{kmRec !== null ? `+${kmRec} km` : "—"}</td>
                                        <td>
                                            {r.inventarioOk
                                                ? <span className="pvr-badge pvr-badge--ok">✔ OK</span>
                                                : <span className="pvr-badge pvr-badge--pend">Ver obs.</span>}
                                        </td>
                                        <td>{r.observaciones || "—"}</td>
                                        <td className="pvr-td-codigo">{r.codigoTrazabilidad}</td>
                                        <td>
                                            {r.estado === "en_puesto"
                                                ? <span className="pvr-badge pvr-badge--pend">En puesto</span>
                                                : <span className="pvr-badge pvr-badge--ok">Retirado</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function PlanillasVisorScreen({ onBack }) {
    const { empresaId }           = useAppData();
    const { clientes, objetivos } = useClientesData(empresaId);

    const hoy = new Date();
    const [año,          setAño]          = useState(hoy.getFullYear());
    const [mes,          setMes]          = useState(hoy.getMonth() + 1);
    const [tipo,         setTipo]         = useState("llaves");
    const [clienteFiltr, setClienteFiltr] = useState("");
    const [objetivoFiltr,setObjetivoFiltr]= useState("");
    const [registros,    setRegistros]    = useState([]);
    const [firmas,       setFirmas]       = useState([]);
    const [cargando,     setCargando]     = useState(false);
    const [detalleKey,   setDetalleKey]   = useState(null);

    const tipoActivo = TIPOS.find(t => t.id === tipo);

    useEffect(() => {
        if (!empresaId || !tipoActivo) return;
        setCargando(true);
        const fechaMin = `${año}-${String(mes).padStart(2,"0")}-01`;
        const fechaMax = `${año}-${String(mes).padStart(2,"0")}-31`;

        Promise.all([
            getDocs(query(collection(db, tipoActivo.col), where("empresaId", "==", empresaId))),
            getDocs(query(collection(db, "firmasElectronicas"),
                where("empresaId", "==", empresaId),
                where("tipo",      "==", tipoActivo.firmaTipo)
            )),
        ]).then(([regSnap, firmaSnap]) => {
            setRegistros(
                regSnap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(r => r.fecha >= fechaMin && r.fecha <= fechaMax)
            );
            setFirmas(firmaSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }).catch(console.error)
          .finally(() => setCargando(false));
    }, [empresaId, año, mes, tipo]);

    const clienteMap  = useMemo(() => { const m = {}; clientes.forEach(c => { if (c.id) m[c.id] = c; }); return m; }, [clientes]);
    const objetivoMap = useMemo(() => { const m = {}; objetivos.forEach(o => { if (o.id) m[o.id] = o; }); return m; }, [objetivos]);

    // Agrupar por objetivoId + fecha
    const grupos = useMemo(() => {
        const map = {};
        registros.forEach(r => {
            const key = `${r.objetivoId}|${r.fecha}`;
            if (!map[key]) {
                const obj = objetivoMap[r.objetivoId];
                const cid = obj?.clienteId || r.clienteId || "";
                map[key] = {
                    key,
                    objetivoId:     r.objetivoId,
                    objetivoNombre: r.objetivoNombre || obj?.nombre || r.objetivoId || "",
                    clienteId:      cid,
                    clienteNombre:  clienteMap[cid]?.nombre || r.clienteNombre || "",
                    fecha:          r.fecha,
                    items:          [],
                    firma:          null,
                    firmaId:        null,
                };
            }
            map[key].items.push(r);
        });
        // Adjuntar firma al grupo
        Object.values(map).forEach(g => {
            const f = firmas.find(f => f.datos?.objetivoId === g.objetivoId && f.datos?.fecha === g.fecha);
            if (f) { g.firma = f; g.firmaId = f.id; }
        });
        return Object.values(map).sort((a, b) =>
            b.fecha.localeCompare(a.fecha) || a.clienteNombre.localeCompare(b.clienteNombre)
        );
    }, [registros, firmas, objetivoMap, clienteMap]);

    const gruposFiltrados = useMemo(() =>
        grupos.filter(g => {
            if (clienteFiltr  && g.clienteId  !== clienteFiltr)  return false;
            if (objetivoFiltr && g.objetivoId !== objetivoFiltr) return false;
            return true;
        }),
    [grupos, clienteFiltr, objetivoFiltr]);

    const clientesDisp = useMemo(() => {
        const cids = [...new Set(grupos.map(g => g.clienteId).filter(Boolean))];
        return cids.map(id => ({ id, nombre: clienteMap[id]?.nombre || id }))
                   .sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [grupos, clienteMap]);

    const objetivosDisp = useMemo(() => {
        const oids = [...new Set(
            grupos.filter(g => !clienteFiltr || g.clienteId === clienteFiltr).map(g => g.objetivoId)
        )];
        return oids.map(id => ({ id, nombre: grupos.find(g => g.objetivoId === id)?.objetivoNombre || id }))
                   .sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [grupos, clienteFiltr]);

    const detalleGrupo = detalleKey ? grupos.find(g => g.key === detalleKey) : null;

    if (detalleGrupo) {
        return <DetalleGrupo grupo={detalleGrupo} tipo={tipo} onBack={() => setDetalleKey(null)} />;
    }

    return (
        <div className="pvr-root">
            {onBack && <button className="pvr-back" onClick={onBack}>← Volver</button>}
            <div className="pvr-titulo">📋 Planillas operativas</div>

            {/* Tabs de tipo */}
            <div className="pvr-tabs">
                {TIPOS.map(t => (
                    <button
                        key={t.id}
                        className={`pvr-tab${tipo === t.id ? " pvr-tab--active" : ""}`}
                        onClick={() => { setTipo(t.id); setDetalleKey(null); }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Filtros */}
            <div className="pvr-filtros">
                <select value={mes}  onChange={e => setMes(Number(e.target.value))}>
                    {MESES_ES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <select value={año}  onChange={e => setAño(Number(e.target.value))}>
                    {AÑOS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={clienteFiltr} onChange={e => { setClienteFiltr(e.target.value); setObjetivoFiltr(""); }}>
                    <option value="">— Todos los clientes —</option>
                    {clientesDisp.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <select value={objetivoFiltr} onChange={e => setObjetivoFiltr(e.target.value)}>
                    <option value="">— Todos los objetivos —</option>
                    {objetivosDisp.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
            </div>

            {cargando && <div className="pvr-loading">Cargando planillas…</div>}

            {!cargando && gruposFiltrados.length === 0 && (
                <div className="pvr-empty">Sin registros para {MESES_ES[mes - 1]} {año}</div>
            )}

            {!cargando && gruposFiltrados.length > 0 && (
                <div className="pvr-tabla-wrap">
                    <table className="pvr-tabla">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Cliente</th>
                                <th>Objetivo</th>
                                <th className="pvr-th-num">Registros</th>
                                <th>Firmada</th>
                                <th>Código trazabilidad</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {gruposFiltrados.map(g => (
                                <tr key={g.key} className="pvr-tr">
                                    <td>{fmtFecha(g.fecha)}</td>
                                    <td>{g.clienteNombre || "—"}</td>
                                    <td>{g.objetivoNombre}</td>
                                    <td className="pvr-th-num">{g.items.length}</td>
                                    <td>
                                        {g.firma
                                            ? <span className="pvr-badge pvr-badge--ok">✅ Firmada</span>
                                            : <span className="pvr-badge pvr-badge--pend">Sin firma</span>}
                                    </td>
                                    <td className="pvr-td-codigo">
                                        {g.firmaId ? g.firmaId.slice(0, 16).toUpperCase() : "—"}
                                    </td>
                                    <td>
                                        <button className="pvr-btn-ver" onClick={() => setDetalleKey(g.key)}>
                                            Ver →
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
