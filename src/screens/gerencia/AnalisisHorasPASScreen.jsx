// src/screens/AnalisisHorasPASScreen.jsx
import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useAppData } from "../../context/AppDataContext";
import { useClientesData } from "../../hooks/useClientesData";
import { getDias, fmtKey, MESES_ES, HORAS_KEYS, horasDeValor, r1 } from "../../utils/periodoUtils";
import { FERIADOS_ARG } from "../../utils/feriados";
import "./AnalisisHorasPASScreen.css";

// ── Colecciones Firestore ─────────────────────────────────────────────────────
const COL_PROG = "programacionServicios";

const DIAS_MES = (año, mes) => new Date(año, mes, 0).getDate();

function fmtNum(n) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(n) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toFixed(2) + "%";
}

// Avance del mes: días transcurridos (del 1 al día de hoy si es el mes actual)
function avanceMes(año, mes) {
    const hoy = new Date();
    const totalDias = DIAS_MES(año, mes);
    if (hoy.getFullYear() === año && hoy.getMonth() + 1 === mes) {
        return Math.min(hoy.getDate(), totalDias) / totalDias;
    }
    if (new Date(año, mes - 1, 1) > hoy) return 0;
    return 1;
}

function BarraCobertura({ pct, meta = 100 }) {
    const v = Math.min(pct ?? 0, 150);
    const color = v >= meta ? "#16a34a" : v >= meta * 0.8 ? "#ca8a04" : "#dc2626";
    return (
        <div className="ahp-barra-wrap">
            <div className="ahp-barra-bg">
                <div className="ahp-barra-fill" style={{ width: `${Math.min(v, 100)}%`, background: color }} />
            </div>
            <span className="ahp-barra-label" style={{ color }}>{fmtPct(v)}</span>
        </div>
    );
}

function horasDiaObj(dia, obj, diasEsp) {
    if (!obj) return null;
    const key = fmtKey(dia);
    if (FERIADOS_ARG[key]) return obj.horasFeriados != null ? Number(obj.horasFeriados) : null;
    if (diasEsp?.[key] === false) return 0;
    const hs = obj[HORAS_KEYS[dia.getDay()]];
    return hs != null ? Number(hs) : null;
}

export default function AnalisisHorasPASScreen({ año, mes }) {
    const { empresaNombre, empresaId } = useAppData();
    const { objetivos } = useClientesData(empresaId);
    const [docs,     setDocs]     = useState([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        if (!empresaId) return;
        setCargando(true);
        const esSantaCruz = d =>
            /santa\s*cruz/i.test(d.clienteNombre || "") ||
            /santa\s*cruz/i.test(d.proyectoNombre || "") ||
            /cerro\s*moro/i.test(d.clienteNombre  || "") ||
            /cerro\s*moro/i.test(d.proyectoNombre || "") ||
            /panamerican/i.test(d.clienteNombre   || "") ||
            /panamerican/i.test(d.proyectoNombre  || "") ||
            /\bpas\b/i.test(d.clienteNombre       || "") ||
            /\bpas\b/i.test(d.proyectoNombre      || "");

        getDocs(query(
            collection(db, COL_PROG),
            where("empresaId", "==", empresaId)
        )).then(snap => {
            const data = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(d => d.año === año && d.mes === mes);
            setDocs(data.filter(esSantaCruz));
        }).catch(console.error)
          .finally(() => setCargando(false));
    }, [empresaId, año, mes]);

    const avance   = avanceMes(año, mes);
    const avancePct = (avance * 100).toFixed(1);

    const dias = useMemo(() => getDias(año, mes), [año, mes]);

    // ── Calcular filas ────────────────────────────────────────────────────────
    const filas = useMemo(() => docs.map(doc => {
        const personal = doc.personal || [];
        const obj      = objetivos.find(o => o.id === doc.objetivoId) || null;
        const diasEsp  = doc.diasEspeciales || {};

        // Horas pedidas: suma de horas contratadas por día según el objetivo
        const horasPedidas = r1(dias.reduce((s, dia) => s + (horasDiaObj(dia, obj, diasEsp) ?? 0), 0));

        // Horas prestadas: horas reales trabajadas (real → programado como fallback)
        const horasPrestadas = r1(dias.reduce((s, dia) => {
            const key = fmtKey(dia);
            return s + personal.reduce((ps, p) => ps + horasDeValor((p.real || p.programado || {})[key] || ""), 0);
        }, 0));

        // Horas capacitación
        const horasCapac = r1(dias.reduce((s, dia) => {
            const key = fmtKey(dia);
            return s + personal.reduce((ps, p) => ps + (Number(p.capacitacion?.[key]) || 0), 0);
        }, 0));

        const horasTraslados   = 0; // sin dato en el modelo actual
        const horasNoPrestadas = r1(Math.max(0, horasPedidas - horasPrestadas));
        const horasAdicionales = r1(Math.max(0, horasPrestadas - horasPedidas));
        const totalHoras       = r1(horasPrestadas + horasCapac + horasAdicionales);
        const pctCobertura     = horasPedidas > 0 ? r1((horasPrestadas / horasPedidas) * 100) : null;
        const totalCubierto    = pctCobertura;

        return {
            nombre:          [doc.clienteNombre, doc.proyectoNombre, doc.objetivoNombre].filter(Boolean).join(" · "),
            horasPedidas,
            horasTraslados,
            horasCapac,
            horasAdicionales,
            horasNoPrestadas,
            horasPrestadas,
            totalHoras,
            pctCobertura,
            totalCubierto,
        };
    }), [docs, objetivos, dias]);

    // Totales
    const sum = key => filas.reduce((s, f) => s + (f[key] ?? 0), 0);
    const totales = {
        horasPedidas:     sum("horasPedidas"),
        horasTraslados:   sum("horasTraslados"),
        horasCapac:       sum("horasCapac"),
        horasAdicionales: sum("horasAdicionales"),
        horasNoPrestadas: sum("horasNoPrestadas"),
        horasPrestadas:   sum("horasPrestadas"),
        totalHoras:       sum("totalHoras"),
        totalCubierto:    sum("totalCubierto"),
    };
    totales.pctCobertura = totales.horasPedidas
        ? (totales.horasPrestadas / totales.horasPedidas) * 100
        : null;

    // Barras inferiores
    const totalPed = totales.horasPedidas || 1;
    const barras = [
        { label: "Horas Standard",      val: totales.horasPedidas,     pct: 100,                                         color: "#ca8a04" },
        { label: "Horas Capacitación",  val: totales.horasCapac,       pct: (totales.horasCapac      / totalPed) * 100,  color: "#ca8a04" },
        { label: "Horas de traslados",  val: totales.horasTraslados,   pct: (totales.horasTraslados  / totalPed) * 100,  color: "#ca8a04" },
        { label: "Horas adicionales",   val: totales.horasAdicionales, pct: (totales.horasAdicionales/ totalPed) * 100,  color: "#ca8a04" },
    ];

    return (
        <div className="ahp-root">
            {/* ── Header ── */}
            <div className="ahp-header">
                <span className="ahp-periodo" style={{ width: "100%", textAlign: "center", fontSize: "15px", fontWeight: 700, color: "#1e3a5f" }}>
                    {MESES_ES[mes - 1]} {año}
                </span>
            </div>

            {cargando && <div className="ahp-loading">Cargando datos…</div>}

            {!cargando && (
                <div className="ahp-card" style={{ margin: "0 16px 16px" }}>
                    {/* Avance del mes */}
                    <div className="ahp-avance-strip">
                        <span className="ahp-avance-strip-label">Avance del mes</span>
                        <div className="ahp-avance-barra-wrap" style={{ flex: 1 }}>
                            <div className="ahp-avance-barra-fill" style={{ width: `${avancePct}%` }} />
                        </div>
                        <span className="ahp-avance-strip-pct">{avancePct}%</span>
                    </div>

                    {/* Lista de puestos con barra de cobertura */}
                    <div className="ahp-puestos-lista">
                        {filas.length === 0 && (
                            <div className="ahp-empty">Sin planillas para este período</div>
                        )}
                        {filas.map((f, i) => {
                            const pct      = f.pctCobertura ?? 0;
                            const verde    = Math.min(pct, 100);
                            const rojo     = Math.max(0, 100 - verde);
                            const exceso   = Math.max(0, pct - 100);
                            const colorBarra = pct >= 100 ? "#16a34a" : pct >= 95 ? "#ca8a04" : "#dc2626";
                            return (
                                <div key={i} className="ahp-puesto-row">
                                    <div className="ahp-puesto-encabezado">
                                        <span className="ahp-puesto-nombre">{f.nombre}</span>
                                        <span className="ahp-puesto-hs">
                                            {fmtNum(f.horasPrestadas)} / {fmtNum(f.horasPedidas)} hs
                                        </span>
                                        <span className="ahp-puesto-pct" style={{ color: colorBarra }}>
                                            {fmtPct(pct)}
                                        </span>
                                    </div>
                                    <div className="ahp-puesto-barra-wrap">
                                        {/* Verde: cubierto */}
                                        <div className="ahp-puesto-barra-verde" style={{ width: `${verde}%`, background: colorBarra }} />
                                        {/* Rojo: no cubierto */}
                                        {rojo > 0 && (
                                            <div className="ahp-puesto-barra-rojo" style={{ width: `${rojo}%` }}>
                                                <span className="ahp-puesto-barra-rojo-pct">{rojo.toFixed(1)}% no cubierto</span>
                                            </div>
                                        )}
                                        {/* Verde extra si supera 100% */}
                                        {exceso > 0 && (
                                            <div className="ahp-puesto-barra-exceso" style={{ width: `${Math.min(exceso, 20)}%` }}>
                                                <span className="ahp-puesto-barra-rojo-pct">+{exceso.toFixed(1)}% adicional</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="ahp-table-wrap">
                        <table className="ahp-table">
                            <thead>
                                <tr className="ahp-thead-row">
                                    <th className="ahp-th ahp-th-nombre">Puesto</th>
                                    <th className="ahp-th ahp-th-num">Hs<br/>pedidas</th>
                                    <th className="ahp-th ahp-th-num">Hs<br/>traslados</th>
                                    <th className="ahp-th ahp-th-num">Hs<br/>capacit.</th>
                                    <th className="ahp-th ahp-th-num">Hs<br/>adicionales</th>
                                    <th className="ahp-th ahp-th-num ahp-th-neg">Hs No<br/>prestadas</th>
                                    <th className="ahp-th ahp-th-num">Hs<br/>prestadas</th>
                                    <th className="ahp-th ahp-th-num">Total<br/>horas</th>
                                    <th className="ahp-th ahp-th-num ahp-th-pct">%<br/>Cobertura</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filas.map((f, i) => (
                                    <tr key={i} className="ahp-row">
                                        <td className="ahp-td ahp-td-nombre">{f.nombre}</td>
                                        <td className="ahp-td ahp-td-num">{fmtNum(f.horasPedidas)}</td>
                                        <td className="ahp-td ahp-td-num">{fmtNum(f.horasTraslados)}</td>
                                        <td className="ahp-td ahp-td-num">{fmtNum(f.horasCapac)}</td>
                                        <td className="ahp-td ahp-td-num">{fmtNum(f.horasAdicionales)}</td>
                                        <td className="ahp-td ahp-td-num ahp-td-neg">{fmtNum(f.horasNoPrestadas)}</td>
                                        <td className="ahp-td ahp-td-num">{fmtNum(f.horasPrestadas)}</td>
                                        <td className="ahp-td ahp-td-num">{fmtNum(f.totalHoras)}</td>
                                        <td className="ahp-td ahp-td-num ahp-td-pct">{fmtPct(f.pctCobertura)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="ahp-total-row">
                                    <td className="ahp-td-total ahp-td-total-label">Totales</td>
                                    <td className="ahp-td-total ahp-td-num">{fmtNum(totales.horasPedidas)}</td>
                                    <td className="ahp-td-total ahp-td-num">{fmtNum(totales.horasTraslados)}</td>
                                    <td className="ahp-td-total ahp-td-num">{fmtNum(totales.horasCapac)}</td>
                                    <td className="ahp-td-total ahp-td-num">{fmtNum(totales.horasAdicionales)}</td>
                                    <td className="ahp-td-total ahp-td-num ahp-td-neg">{fmtNum(totales.horasNoPrestadas)}</td>
                                    <td className="ahp-td-total ahp-td-num">{fmtNum(totales.horasPrestadas)}</td>
                                    <td className="ahp-td-total ahp-td-num">{fmtNum(totales.totalHoras)}</td>
                                    <td className="ahp-td-total ahp-td-num ahp-td-pct">{fmtPct(totales.pctCobertura)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* ── Barras inferiores ── */}
                    <div className="ahp-barras-section">
                        {barras.map((b, i) => (
                            <div key={i} className="ahp-barra-row">
                                <div className="ahp-barra-row-label">{b.label}</div>
                                <div className="ahp-barra-row-track">
                                    <div
                                        className="ahp-barra-row-fill"
                                        style={{ width: `${Math.min(b.pct ?? 0, 100)}%`, background: b.color }}
                                    />
                                    <span className="ahp-barra-row-txt">
                                        {b.label} {fmtPct(b.pct)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
