// src/screens/FacturacionScreen.jsx
// Planilla de facturación mensual — Horas vendidas / no cubiertas / adicionales / total a facturar

import { useState, useEffect, useMemo, useRef } from "react";
import { useAppData }      from "../../context/AppDataContext";
import { useClientesData } from "../../hooks/useClientesData";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import "./FacturacionScreen.css";
import { getDias, fmtKey, MESES_ES, HORAS_KEYS, horasDeValor, r1 } from "../../utils/periodoUtils";
import { FERIADOS_ARG } from "../../utils/feriados";

// ── Configuración de distribución ────────────────────────────────────────────
// match: función que recibe una fila y devuelve true si pertenece a esa línea
// Se usa el campo `servicio` (objetivoNombre) y opcionalmente `clienteNombre`
const DIST_CONFIG = {
    fisica: [
        {
            label: "Brinks Go",
            match: f => /\bgo\b/i.test(f.servicio),
        },
        {
            label: "CIT",
            match: f => /recep|seguridad\s*planta|movil|m[oó]vil|pergamino|ber[oó]n|recuento/i.test(f.servicio),
        },
        {
            label: "Clientes",
            // Reginald Lee (todos) + Ovnisa + ATM Neutrales Seguridad Física
            match: f =>
                /reginald/i.test(f.clienteNombre) ||
                /ovnisa/i.test(f.clienteNombre) ||
                (/santander|atm/i.test(f.clienteNombre) && /seguridad\s*f[ií]sica/i.test(f.servicio)),
        },
        // → más líneas aquí cuando el usuario las indique
    ],
    electronica: [
        {
            label: "Monitoreo",
            match: f => /monitoreo/i.test(f.servicio) && (/brinks/i.test(f.clienteNombre) || /santander|atm/i.test(f.clienteNombre)),
        },
        {
            label: "Técnicos Instaladores",
            match: f => /t[eé]cnico|instalador/i.test(f.servicio) || /sofse/i.test(f.clienteNombre),
        },
    ],
};

// ── Colecciones Firestore ─────────────────────────────────────────────────────
const COL_PROG = "programacionServicios";

// MESES_ES, HORAS_KEYS, horasDeValor, r1, getDias, fmtKey, FERIADOS_ARG importados desde utils

function horasDiaObj(dia, obj, diasEsp) {
    if (!obj) return null;
    const key = fmtKey(dia);
    if (FERIADOS_ARG[key]) return obj.horasFeriados != null ? Number(obj.horasFeriados) : null;
    if (diasEsp?.[key] === false) return 0;
    const hs = obj[HORAS_KEYS[dia.getDay()]];
    return hs != null ? Number(hs) : null;
}

function fmt(n) {
    if (n == null || n === 0) return "0,0";
    return n.toFixed(1).replace(".", ",");
}

function fmtColor(n) {
    if (n > 0) return "fc-pos";
    if (n < 0) return "fc-neg";
    return "";
}

// Extrae centro costo y nro proyecto del código (ej: "217-103-1" → cc=217, proy=103)
function parseCodigo(codigo) {
    if (!codigo) return { cc: "", proy: "" };
    const parts = String(codigo).split("-");
    return { cc: parts[0] || "", proy: parts[1] || "" };
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function FacturacionScreen({ año, mes, onBack, zonaFija = null }) {
    const { empresaId } = useAppData();
    const { objetivos } = useClientesData(empresaId);
    const [docs,      setDocs]      = useState([]);
    const [cargando,  setCargando]  = useState(false);
    const [exportando,setExportando]= useState(false);
    const tablaRef = useRef(null);

    const dias = useMemo(() => getDias(año, mes), [año, mes]);
    const mesAnterior = mes === 1 ? 12 : mes - 1;
    const añoAnterior = mes === 1 ? año - 1 : año;

    useEffect(() => {
        if (!empresaId) return;
        setCargando(true);
        getDocs(query(
            collection(db, COL_PROG),
            where("empresaId", "==", empresaId)
        ))
            .then(snap => {
                let data = snap.docs
                    .map(d => ({ docId: d.id, ...d.data() }))
                    .filter(d => d.año === año && d.mes === mes);
                if (zonaFija) data = data.filter(d => d.zona === zonaFija);
                data.sort((a, b) =>
                    (a.clienteNombre || "").localeCompare(b.clienteNombre || "") ||
                    (a.proyectoNombre || "").localeCompare(b.proyectoNombre || "") ||
                    (a.objetivoNombre || "").localeCompare(b.objetivoNombre || "")
                );
                setDocs(data);
            })
            .catch(console.error)
            .finally(() => setCargando(false));
    }, [empresaId, año, mes]);

    // ── Calcular totales por doc ───────────────────────────────────────────────
    const filas = useMemo(() => {
        return docs.map(d => {
            const obj      = objetivos.find(o => o.id === d.objetivoId) || null;
            const diasEsp  = d.diasEspeciales || {};
            const personal = d.personal || [];
            const { cc, proy } = parseCodigo(obj?.codigo || d.objetivoId);

            const vendidas = r1(dias.reduce((s, dia) => s + (horasDiaObj(dia, obj, diasEsp) ?? 0), 0));
            const reales   = r1(dias.reduce((s, dia) => {
                const key = fmtKey(dia);
                return s + personal.reduce((ps, p) => ps + horasDeValor((p.real || p.programado || {})[key] || ""), 0);
            }, 0));
            const noCubiertas  = r1(Math.max(0, vendidas - reales));
            const adicionales  = r1(Math.max(0, reales - vendidas));
            const totalFacturar = r1(vendidas - noCubiertas + adicionales);

            return {
                docId:        d.docId,
                clienteNombre: d.clienteNombre || "Sin cliente",
                clienteId:    d.clienteId || "",
                proyectoNombre: d.proyectoNombre || obj?.proyecto || "",
                servicio:     d.objetivoNombre || obj?.nombre || "",
                cc, proy,
                vendidas, noCubiertas, adicionales, totalFacturar,
            };
        });
    }, [docs, objetivos, dias]);

    // ── Agrupar por cliente ────────────────────────────────────────────────────
    const grupos = useMemo(() => {
        const map = {};
        filas.forEach(f => {
            if (!map[f.clienteNombre]) map[f.clienteNombre] = [];
            map[f.clienteNombre].push(f);
        });
        return Object.entries(map).map(([cliente, items]) => ({
            cliente,
            items,
            totVendidas:    r1(items.reduce((s, i) => s + i.vendidas, 0)),
            totNoCubiertas: r1(items.reduce((s, i) => s + i.noCubiertas, 0)),
            totAdicionales: r1(items.reduce((s, i) => s + i.adicionales, 0)),
            totFacturar:    r1(items.reduce((s, i) => s + i.totalFacturar, 0)),
        }));
    }, [filas]);

    // ── Totales generales ──────────────────────────────────────────────────────
    const totales = useMemo(() => ({
        vendidas:    r1(filas.reduce((s, f) => s + f.vendidas, 0)),
        noCubiertas: r1(filas.reduce((s, f) => s + f.noCubiertas, 0)),
        adicionales: r1(filas.reduce((s, f) => s + f.adicionales, 0)),
        facturar:    r1(filas.reduce((s, f) => s + f.totalFacturar, 0)),
    }), [filas]);

    // ── Distribución ──────────────────────────────────────────────────────────
    const dist = useMemo(() => {
        const calcSeccion = (items) => items.map(item => {
            const matches = filas.filter(item.match);
            const total = r1(matches.reduce((s, f) => s + f.totalFacturar, 0));
            return { label: item.label, total };
        });
        const fisica     = calcSeccion(DIST_CONFIG.fisica);
        const electronica = calcSeccion(DIST_CONFIG.electronica);
        return {
            fisica,
            electronica,
            totalFisica:     r1(fisica.reduce((s, i) => s + i.total, 0)),
            totalElectronica: r1(electronica.reduce((s, i) => s + i.total, 0)),
        };
    }, [filas]);

    // ── Exportar PDF ───────────────────────────────────────────────────────────
    const exportarPDF = async () => {
        if (!tablaRef.current) return;
        setExportando(true);
        try {
            const canvas = await html2canvas(tablaRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
            const w = canvas.width, h = canvas.height;
            const pdf = new jsPDF({ orientation: w > h ? "l" : "p", unit: "px", format: [w, h] });
            pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, w, h);
            pdf.save(`Facturacion ${MESES_ES[mes-1]} ${año}.pdf`);
        } finally { setExportando(false); }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="fc-root">
            {/* Header */}
            <div className="fc-header">
                <div className="fc-header-left">
                    <span className="fc-title">💰 Facturación</span>
                    <span className="fc-periodo">
                        24/{String(mesAnterior).padStart(2,"0")}/{añoAnterior}
                        {" – "}
                        23/{String(mes).padStart(2,"0")}/{año}
                    </span>
                </div>
                <div className="fc-header-actions">
                    <button className="fc-btn fc-btn--pdf" disabled={exportando || cargando} onClick={exportarPDF}>
                        {exportando ? "Generando…" : "⬇ Exportar PDF"}
                    </button>
                </div>
            </div>

            {cargando && <div className="fc-loading">Cargando datos…</div>}

            {!cargando && docs.length === 0 && (
                <div className="fc-empty">No hay planillas para este período.</div>
            )}

            {!cargando && docs.length > 0 && (
                <div className="fc-tabla-wrap" ref={tablaRef}>
                    {/* Encabezado del reporte */}
                    <div className="fc-reporte-header">
                        <div className="fc-reporte-titulo">Horas a Facturar</div>
                        <div className="fc-reporte-subtitulo">
                            {MESES_ES[mes-1]} {año} &nbsp;·&nbsp;
                            24/{String(mesAnterior).padStart(2,"0")}/{añoAnterior} al 23/{String(mes).padStart(2,"0")}/{año}
                        </div>
                    </div>

                    <table className="fc-table">
                        <thead>
                            <tr className="fc-thead-row">
                                <th className="fc-th fc-th-cc">CC</th>
                                <th className="fc-th fc-th-proy">Proy.</th>
                                <th className="fc-th fc-th-nombre">Proyecto / Cliente</th>
                                <th className="fc-th fc-th-servicio">Servicio / Objetivo</th>
                                <th className="fc-th fc-th-num">Hs Vendidas</th>
                                <th className="fc-th fc-th-num">Hs No Cubiertas</th>
                                <th className="fc-th fc-th-num">Hs Adicionales</th>
                                <th className="fc-th fc-th-num fc-th-fact">Total a Facturar</th>
                            </tr>
                        </thead>
                        <tbody>
                            {grupos.map(g => (
                                <>
                                    {g.items.map((f, i) => (
                                        <tr key={f.docId} className="fc-row">
                                            <td className="fc-td fc-td-cc">{f.cc}</td>
                                            <td className="fc-td fc-td-proy">{f.proy}</td>
                                            <td className="fc-td fc-td-nombre">{f.proyectoNombre || f.clienteNombre}</td>
                                            <td className="fc-td fc-td-servicio">{f.servicio}</td>
                                            <td className="fc-td fc-td-num">{fmt(f.vendidas)}</td>
                                            <td className="fc-td fc-td-num fc-td-nocub">{fmt(f.noCubiertas)}</td>
                                            <td className="fc-td fc-td-num fc-td-adic">{fmt(f.adicionales)}</td>
                                            <td className={`fc-td fc-td-num fc-td-fact ${fmtColor(f.totalFacturar)}`}>{fmt(f.totalFacturar)}</td>
                                        </tr>
                                    ))}
                                    {/* Subtotal cliente */}
                                    <tr className="fc-subtotal">
                                        <td className="fc-td-sub" colSpan={4}>TOTAL {g.cliente}</td>
                                        <td className="fc-td-sub fc-td-num">{fmt(g.totVendidas)}</td>
                                        <td className="fc-td-sub fc-td-num">{fmt(g.totNoCubiertas)}</td>
                                        <td className="fc-td-sub fc-td-num">{fmt(g.totAdicionales)}</td>
                                        <td className={`fc-td-sub fc-td-num ${fmtColor(g.totFacturar)}`}>{fmt(g.totFacturar)}</td>
                                    </tr>
                                </>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="fc-total-row">
                                <td className="fc-td-total" colSpan={4}>TOTAL GENERAL</td>
                                <td className="fc-td-total fc-td-num">{fmt(totales.vendidas)}</td>
                                <td className="fc-td-total fc-td-num">{fmt(totales.noCubiertas)}</td>
                                <td className="fc-td-total fc-td-num">{fmt(totales.adicionales)}</td>
                                <td className={`fc-td-total fc-td-num fc-total-fact ${fmtColor(totales.facturar)}`}>{fmt(totales.facturar)}</td>
                            </tr>
                        </tfoot>
                    </table>

                    {/* Resumen por cliente */}
                    <div className="fc-resumen">
                        <div className="fc-resumen-titulo">Resumen por cliente</div>
                        <table className="fc-resumen-tabla">
                            <thead>
                                <tr>
                                    <th className="fc-rth">Cliente</th>
                                    <th className="fc-rth fc-rth-num">Hs Vendidas</th>
                                    <th className="fc-rth fc-rth-num">Hs No Cubiertas</th>
                                    <th className="fc-rth fc-rth-num">Hs Adicionales</th>
                                    <th className="fc-rth fc-rth-num">Total a Facturar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {grupos.map(g => (
                                    <tr key={g.cliente} className="fc-resumen-row">
                                        <td className="fc-rtd">{g.cliente}</td>
                                        <td className="fc-rtd fc-rtd-num">{fmt(g.totVendidas)}</td>
                                        <td className="fc-rtd fc-rtd-num fc-td-nocub">{fmt(g.totNoCubiertas)}</td>
                                        <td className="fc-rtd fc-rtd-num fc-td-adic">{fmt(g.totAdicionales)}</td>
                                        <td className={`fc-rtd fc-rtd-num fc-td-fact ${fmtColor(g.totFacturar)}`}><strong>{fmt(g.totFacturar)}</strong></td>
                                    </tr>
                                ))}
                                <tr className="fc-resumen-total">
                                    <td className="fc-rtd"><strong>TOTAL</strong></td>
                                    <td className="fc-rtd fc-rtd-num"><strong>{fmt(totales.vendidas)}</strong></td>
                                    <td className="fc-rtd fc-rtd-num"><strong>{fmt(totales.noCubiertas)}</strong></td>
                                    <td className="fc-rtd fc-rtd-num"><strong>{fmt(totales.adicionales)}</strong></td>
                                    <td className={`fc-rtd fc-rtd-num fc-total-fact ${fmtColor(totales.facturar)}`}><strong>{fmt(totales.facturar)}</strong></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* ── Distribución de la facturación ── */}
                    <div className="fc-dist">
                        <div className="fc-dist-titulo">Distribución de horas facturadas</div>
                        <div className="fc-dist-bloques">

                            {/* Bloque Seguridad Física */}
                            <div className="fc-dist-bloque">
                                <div className="fc-dist-bloque-header fc-dist-bloque-header--fisica">
                                    <span className="fc-dist-bloque-icon">🛡️</span>
                                    <span>Seguridad Física</span>
                                </div>
                                <div className="fc-dist-bloque-body">
                                    {dist.fisica.length === 0 && (
                                        <div className="fc-dist-item fc-dist-item--placeholder">
                                            <span className="fc-dist-item-label">— Sin configuración —</span>
                                            <span className="fc-dist-item-val">—</span>
                                        </div>
                                    )}
                                    {dist.fisica.map(item => (
                                        <div key={item.label} className="fc-dist-item">
                                            <span className="fc-dist-item-label">{item.label}</span>
                                            <span className="fc-dist-item-val">{fmt(item.total)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="fc-dist-bloque-footer">
                                    <span>Total Seguridad Física</span>
                                    <span className="fc-dist-bloque-total">{fmt(dist.totalFisica)}</span>
                                </div>
                            </div>

                            {/* Bloque Electrónica */}
                            <div className="fc-dist-bloque">
                                <div className="fc-dist-bloque-header fc-dist-bloque-header--electronica">
                                    <span className="fc-dist-bloque-icon">⚡</span>
                                    <span>Electrónica</span>
                                </div>
                                <div className="fc-dist-bloque-body">
                                    {dist.electronica.length === 0 && (
                                        <div className="fc-dist-item fc-dist-item--placeholder">
                                            <span className="fc-dist-item-label">— Sin configuración —</span>
                                            <span className="fc-dist-item-val">—</span>
                                        </div>
                                    )}
                                    {dist.electronica.map(item => (
                                        <div key={item.label} className="fc-dist-item">
                                            <span className="fc-dist-item-label">{item.label}</span>
                                            <span className="fc-dist-item-val">{fmt(item.total)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="fc-dist-bloque-footer">
                                    <span>Total Electrónica</span>
                                    <span className="fc-dist-bloque-total">{fmt(dist.totalElectronica)}</span>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
