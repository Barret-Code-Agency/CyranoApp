// src/screens/AnalisisHorasPASScreen.jsx
import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useAppData } from "../../context/AppDataContext";
import "./AnalisisHorasPASScreen.css";

// ── Colecciones Firestore ─────────────────────────────────────────────────────
const COL_PROG = "programacionServicios";

const MESES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

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

export default function AnalisisHorasPASScreen({ año, mes }) {
    const { empresaNombre } = useAppData();
    const [docs,     setDocs]     = useState([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        if (!empresaNombre) return;
        setCargando(true);
        const esSantaCruz = d =>
            /santa\s*cruz/i.test(d.clienteNombre || "") ||
            /santa\s*cruz/i.test(d.proyectoNombre || "") ||
            /cerro\s*moro/i.test(d.clienteNombre  || "") ||
            /cerro\s*moro/i.test(d.proyectoNombre || "");

        getDocs(query(
            collection(db, COL_PROG),
            where("empresa", "==", empresaNombre),
            where("año",     "==", año),
            where("mes",     "==", mes)
        )).then(snap => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setDocs(data.filter(esSantaCruz));
        }).catch(console.error)
          .finally(() => setCargando(false));
    }, [empresaNombre, año, mes]);

    const avance   = avanceMes(año, mes);
    const avancePct = (avance * 100).toFixed(1);

    // ── Calcular filas ────────────────────────────────────────────────────────
    const filas = useMemo(() => docs.map(doc => {
        const personal = doc.personal || [];
        const hc       = doc.horasConfig || {};
        const totalDias = DIAS_MES(año, mes);

        // Horas pedidas: horas diarias del objetivo × días del mes (placeholder — fórmulas a definir)
        const horasPedidas    = null; // TODO: fórmula a definir
        const horasTraslados  = null;
        const horasCapac      = null;
        const horasAdicionales= null;
        const horasNoPrestadas= null;
        const horasPrestadas  = null;
        const totalHoras      = null;
        const pctCobertura    = null;
        const totalCubierto   = null;

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
    }), [docs, año, mes]);

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
                <div className="ahp-header-left">
                    <span className="ahp-title">📊 Análisis de horas PAS</span>
                    <span className="ahp-periodo">{MESES_ES[mes - 1]} {año}</span>
                </div>
            </div>

            {cargando && <div className="ahp-loading">Cargando datos…</div>}

            {!cargando && (
                <div className="ahp-card">
                    {/* Título del reporte */}
                    <div className="ahp-reporte-header">
                        <div className="ahp-reporte-titulo">Análisis de cobertura de puestos — {MESES_ES[mes - 1]}</div>
                    </div>

                    <div className="ahp-table-wrap">
                        <table className="ahp-table">
                            <thead>
                                <tr className="ahp-thead-row">
                                    <th className="ahp-th ahp-th-nombre"></th>
                                    <th className="ahp-th ahp-th-num">Horas<br/>pedidas</th>
                                    <th className="ahp-th ahp-th-num">Horas de<br/>traslados</th>
                                    <th className="ahp-th ahp-th-num">Horas de<br/>capacitación</th>
                                    <th className="ahp-th ahp-th-num">Horas<br/>adicionales</th>
                                    <th className="ahp-th ahp-th-num ahp-th-neg">Horas No<br/>prestadas</th>
                                    <th className="ahp-th ahp-th-num">Horas<br/>prestadas</th>
                                    <th className="ahp-th ahp-th-num">Total de<br/>horas</th>
                                    <th className="ahp-th ahp-th-num ahp-th-pct">%<br/>Cobertura</th>
                                    <th className="ahp-th ahp-th-num ahp-th-pct">Total<br/>cubierto</th>
                                    <th className="ahp-th ahp-th-barra">Gráfico de cobertura en %</th>
                                </tr>
                                {/* Avance del mes */}
                                <tr className="ahp-avance-row">
                                    <td colSpan={8} className="ahp-avance-label">Avance del tiempo en el mes</td>
                                    <td colSpan={2} className="ahp-avance-pct">{avancePct}%</td>
                                    <td className="ahp-avance-barra-cel">
                                        <div className="ahp-avance-barra-wrap">
                                            <div className="ahp-avance-barra-fill" style={{ width: `${avancePct}%` }} />
                                        </div>
                                    </td>
                                </tr>
                            </thead>
                            <tbody>
                                {filas.length === 0 && (
                                    <tr><td colSpan={11} className="ahp-empty">Sin planillas para este período</td></tr>
                                )}
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
                                        <td className="ahp-td ahp-td-num ahp-td-pct-ok">{fmtPct(f.totalCubierto)}</td>
                                        <td className="ahp-td ahp-td-barra">
                                            <BarraCobertura pct={f.pctCobertura} />
                                        </td>
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
                                    <td className="ahp-td-total ahp-td-num">{fmtNum(totales.totalCubierto)}</td>
                                    <td className="ahp-td-total" />
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
