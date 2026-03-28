// src/screens/ControlClienteScreen.jsx
// Vista Control Cliente — mes calendario completo (1-31)
// Días  1-23 → planilla del período actual   (año/mes)
// Días 24-31 → planilla del período siguiente (año/mes+1)

import { useState, useEffect } from "react";
import html2canvas from "html2canvas";
import { jsPDF }   from "jspdf";
import { useAppData }      from "../../context/AppDataContext";
import { useClientesData } from "../../hooks/useClientesData";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import "./ProgramacionServiciosScreen.css";
import "./ControlClienteScreen.css";
import { getDiasCalendario, fmtKey, DIAS_ES, MESES_ES, OPCIONES, REAL_AUS_CODES, horasDiaDeDoc, horasDeValor, normalizarTurno, r1 } from "../../utils/periodoUtils";
import { FERIADOS_ARG } from "../../utils/feriados";

// ── Constantes ───────────────────────────────────────────────────────────────────
const COL_PROG        = "programacionServicios";
const COL_OVERRID     = "horasObjetivoMes";
const JPEG_QUALITY    = 0.95;
const DOWNLOAD_DELAY  = 300;

// Merge personal de dos docs del mismo objetivo.
// Los turnos son por YYYY-MM-DD y no se solapan entre períodos.
function mergePersonal(personalA, personalB) {
    const byLeg = {};
    const addP = (personal) => {
        (personal || []).forEach(p => {
            const leg = String(p.legajo ?? "");
            if (!byLeg[leg]) {
                byLeg[leg] = {
                    ...p,
                    real:         { ...(p.real         || {}) },
                    programado:   { ...(p.programado   || {}) },
                    capacitacion: { ...(p.capacitacion || {}) },
                };
            } else {
                Object.assign(byLeg[leg].real,         p.real         || {});
                Object.assign(byLeg[leg].programado,   p.programado   || {});
                Object.assign(byLeg[leg].capacitacion, p.capacitacion || {});
            }
        });
    };
    addP(personalA);
    addP(personalB);
    return Object.values(byLeg);
}

function CeldaContenido({ val, op }) {
    if (!val) return <span className="ps-celda-vacio">—</span>;
    const hs = horasDeValor(normalizarTurno(val));
    if (hs > 0) return <span>{hs.toFixed(2).replace(".", ",")}</span>;
    return <>{op?.label ?? val}</>;
}

// ── Componente principal ─────────────────────────────────────────────────────────
export default function ControlClienteScreen({ año, mes, zonaFija = null }) {
    const { empresaId } = useAppData();
    const { objetivos } = useClientesData(empresaId);
    const [docs,        setDocs]        = useState([]); // docs mergeados por objetivoId
    const [overridesA,  setOverridesA]  = useState({}); // objetivoId → override período A
    const [overridesB,  setOverridesB]  = useState({}); // objetivoId → override período B
    const [cargando,    setCargando]    = useState(false);
    const [descargando, setDescargando] = useState(false);

    useEffect(() => {
        if (!empresaId) return;
        setCargando(true);

        // Período B = siguiente mes de liquidación (cubre días 24-31 del mes calendario)
        const añoB = mes === 12 ? año + 1 : año;
        const mesB = mes === 12 ? 1 : mes + 1;

        Promise.all([
            // Planillas período A (días 1-23 del mes calendario)
            getDocs(query(collection(db, COL_PROG),
                where("empresaId", "==", empresaId),
                where("año", "==", año),
                where("mes", "==", mes))),
            // Planillas período B (días 24-31 del mes calendario)
            getDocs(query(collection(db, COL_PROG),
                where("empresaId", "==", empresaId),
                where("año", "==", añoB),
                where("mes", "==", mesB))),
            // Overrides de horas período A
            getDocs(query(collection(db, COL_OVERRID),
                where("empresaId", "==", empresaId),
                where("año", "==", año),
                where("mes", "==", mes))),
            // Overrides de horas período B
            getDocs(query(collection(db, COL_OVERRID),
                where("empresaId", "==", empresaId),
                where("año", "==", añoB),
                where("mes", "==", mesB))),
        ])
            .then(([snapA, snapB, overSnapA, overSnapB]) => {
                // Indexar por objetivoId
                const docsA = {};
                snapA.docs.forEach(d => {
                    const dat = { docId: d.id, ...d.data() };
                    if (dat.objetivoId) docsA[dat.objetivoId] = dat;
                });
                const docsB = {};
                snapB.docs.forEach(d => {
                    const dat = { docId: d.id, ...d.data() };
                    if (dat.objetivoId) docsB[dat.objetivoId] = dat;
                });

                // Unión de todos los objetivos presentes en alguno de los dos períodos
                const allOids = new Set([...Object.keys(docsA), ...Object.keys(docsB)]);

                let merged = [...allOids].map(oid => {
                    const dA   = docsA[oid];
                    const dB   = docsB[oid];
                    const base = dA || dB;
                    return {
                        objetivoId:    oid,
                        clienteNombre: base.clienteNombre  || "",
                        proyectoNombre:base.proyectoNombre || "",
                        objetivoNombre:base.objetivoNombre || "",
                        zona:          base.zona           || "",
                        diasEspA:      dA?.diasEspeciales  || {},
                        diasEspB:      dB?.diasEspeciales  || {},
                        personal:      mergePersonal(dA?.personal, dB?.personal),
                    };
                });

                if (zonaFija) merged = merged.filter(d => d.zona === zonaFija);
                merged.sort((a, b) =>
                    a.clienteNombre.localeCompare(b.clienteNombre) ||
                    a.proyectoNombre.localeCompare(b.proyectoNombre) ||
                    a.objetivoNombre.localeCompare(b.objetivoNombre)
                );
                setDocs(merged);

                // Overrides por período
                const oA = {}, oB = {};
                overSnapA.docs.forEach(d => { const od = d.data(); if (od.objetivoId) oA[od.objetivoId] = od; });
                overSnapB.docs.forEach(d => { const od = d.data(); if (od.objetivoId) oB[od.objetivoId] = od; });
                setOverridesA(oA);
                setOverridesB(oB);
            })
            .catch(console.error)
            .finally(() => setCargando(false));
    }, [empresaId, año, mes]); // eslint-disable-line react-hooks/exhaustive-deps

    const dias = getDiasCalendario(año, mes);

    // ── Helpers por día ───────────────────────────────────────────────────────
    // Días 1-23 → período A;  días 24+ → período B
    const esB = (dia) => dia.getDate() >= 24;

    const horasDiaDoc = (dia, hcA, hcB, diasEspA, diasEspB) => {
        const hc      = esB(dia) ? hcB      : hcA;
        const diasEsp = esB(dia) ? diasEspB : diasEspA;
        return horasDiaDeDoc(dia, hc, diasEsp, FERIADOS_ARG);
    };

    const hsRealesDia = (personal, dia) => {
        const key = fmtKey(dia);
        return r1(personal.reduce((s, p) =>
            s + horasDeValor(normalizarTurno((p.real || p.programado || {})[key] || "")), 0));
    };

    const ausentismoDia = (personal, dia) => {
        const key = fmtKey(dia);
        return personal.filter(p => REAL_AUS_CODES.includes((p.real || p.programado || {})[key] || "")).length;
    };

    const hsCapacitacionDia = (personal, dia) => {
        const key = fmtKey(dia);
        return r1(personal.reduce((s, p) => s + (Number(p.capacitacion?.[key]) || 0), 0));
    };

    // ── Descarga ──────────────────────────────────────────────────────────────
    const capturar = async (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        return html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    };

    const conMargenes = (canvas) => {
        const margen = Math.round(3 * (96 / 2.54) * 2);
        const c2 = document.createElement("canvas");
        c2.width  = canvas.width  + margen * 2;
        c2.height = canvas.height + margen * 2;
        const ctx = c2.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, c2.width, c2.height);
        ctx.drawImage(canvas, margen, margen);
        return c2;
    };

    const nombreArchivo = (d) =>
        [d.clienteNombre, d.proyectoNombre, d.objetivoNombre]
            .filter(Boolean).join(" - ")
            .replace(/[/\\?%*:|"<>]/g, "-");

    const descargarUno = async (oid, nombre, fmt) => {
        setDescargando(true);
        try {
            const raw = await capturar(`cc-obj-${oid}`);
            if (!raw) return;
            const canvas = conMargenes(raw);
            if (fmt === "jpg") {
                const a = document.createElement("a");
                a.download = `${nombre}.jpg`;
                a.href = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
                a.click();
            } else {
                const w = canvas.width, h = canvas.height;
                const pdf = new jsPDF({ orientation: w > h ? "l" : "p", unit: "px", format: [w, h] });
                pdf.addImage(canvas.toDataURL("image/jpeg", JPEG_QUALITY), "JPEG", 0, 0, w, h);
                pdf.save(`${nombre}.pdf`);
            }
        } finally { setDescargando(false); }
    };

    const descargarTodos = async (fmt) => {
        if (docs.length === 0) return;
        setDescargando(true);
        try {
            if (fmt === "jpg") {
                for (const d of docs) {
                    const raw = await capturar(`cc-obj-${d.objetivoId}`);
                    if (!raw) continue;
                    const canvas = conMargenes(raw);
                    const a = document.createElement("a");
                    a.download = `${nombreArchivo(d)}.jpg`;
                    a.href = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
                    a.click();
                    await new Promise(r => setTimeout(r, DOWNLOAD_DELAY));
                }
            } else {
                let pdf = null;
                for (const d of docs) {
                    const raw = await capturar(`cc-obj-${d.objetivoId}`);
                    if (!raw) continue;
                    const canvas = conMargenes(raw);
                    const w = canvas.width, h = canvas.height;
                    const ori = w > h ? "l" : "p";
                    if (!pdf) {
                        pdf = new jsPDF({ orientation: ori, unit: "px", format: [w, h] });
                    } else {
                        pdf.addPage([w, h], ori);
                    }
                    pdf.addImage(canvas.toDataURL("image/jpeg", JPEG_QUALITY), "JPEG", 0, 0, w, h);
                }
                if (pdf) pdf.save(`ControlCliente ${MESES_ES[mes - 1]} ${año}.pdf`);
            }
        } finally { setDescargando(false); }
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="ps-vt-root">
            {/* Header */}
            <div className="ps-vt-header">
                <span className="ps-vt-hint" style={{ margin: "0 auto", fontWeight: 600 }}>
                    {MESES_ES[mes - 1]} {año}
                </span>
                {docs.length > 0 && (
                    <div className="ps-vt-dl-group">
                        <span className="ps-vt-dl-label">Todos:</span>
                        <button className="ps-vt-dl-btn ps-vt-dl-btn--jpg" disabled={descargando} onClick={() => descargarTodos("jpg")}>⬇ JPG</button>
                        <button className="ps-vt-dl-btn ps-vt-dl-btn--pdf" disabled={descargando} onClick={() => descargarTodos("pdf")}>⬇ PDF</button>
                    </div>
                )}
                {descargando && <span className="ps-vt-dl-status">Generando...</span>}
            </div>

            {/* Cuerpo */}
            <div className="ps-vt-body">
                {cargando && <div className="ps-loading">Cargando...</div>}
                {!cargando && docs.length === 0 && (
                    <div className="ps-vt-empty">No hay planillas programadas para este período.</div>
                )}
                {!cargando && docs.map(d => {
                    const obj  = objetivos.find(o => o.id === d.objetivoId) || null;
                    // Override período A (días 1-23): si no existe usa el objetivo base
                    const hcA  = overridesA[d.objetivoId] ?? obj;
                    // Override período B (días 24-31): si no existe usa el objetivo base
                    const hcB  = overridesB[d.objetivoId] ?? obj;

                    const { diasEspA, diasEspB, personal } = d;

                    const hsDia = (dia) => horasDiaDoc(dia, hcA, hcB, diasEspA, diasEspB);

                    const totalReales   = r1(dias.reduce((s, dia) => s + hsRealesDia(personal, dia), 0));
                    const totalACubrir  = r1(dias.reduce((s, dia) => s + (hsDia(dia) ?? 0), 0));
                    const totalNoCubier = r1(dias.reduce((s, dia) => s + Math.max(0, (hsDia(dia) ?? 0) - hsRealesDia(personal, dia)), 0));
                    const totalAdicional= r1(dias.reduce((s, dia) => s + Math.max(0, hsRealesDia(personal, dia) - (hsDia(dia) ?? 0)), 0));
                    const totalFacturar     = r1(totalACubrir - totalNoCubier + totalAdicional);
                    const totalCapacitacion = r1(dias.reduce((s, dia) => s + hsCapacitacionDia(personal, dia), 0));
                    const totalAusentismo   = dias.reduce((s, dia) => s + ausentismoDia(personal, dia), 0);

                    return (
                        <div key={d.objetivoId} className="ps-vt-objetivo" id={`cc-obj-${d.objetivoId}`}>
                            {/* Cabecera del objetivo */}
                            <div className="ps-vt-obj-header">
                                <div className="ps-vt-obj-info">
                                    <span className="ps-vt-obj-cliente">{d.clienteNombre}</span>
                                    {d.proyectoNombre  && <span className="ps-vt-obj-sep"> · {d.proyectoNombre}</span>}
                                    {d.objetivoNombre  && <span className="ps-vt-obj-sep"> · {d.objetivoNombre}</span>}
                                </div>
                                <span className="ps-vt-obj-count">{personal.length} personas</span>
                                <div className="ps-vt-obj-dl">
                                    <button className="ps-vt-dl-btn ps-vt-dl-btn--jpg" disabled={descargando}
                                        onClick={() => descargarUno(d.objetivoId, nombreArchivo(d), "jpg")}>⬇ JPG</button>
                                    <button className="ps-vt-dl-btn ps-vt-dl-btn--pdf" disabled={descargando}
                                        onClick={() => descargarUno(d.objetivoId, nombreArchivo(d), "pdf")}>⬇ PDF</button>
                                </div>
                            </div>

                            {personal.length === 0
                                ? <div className="ps-vt-obj-empty">Sin personal asignado</div>
                                : (
                                    <div className="ps-vt-tabla-wrap">
                                        <table className="ps-table ps-vt-table">
                                            <thead>
                                                <tr>
                                                    <th className="ps-th-sticky ps-th-legajo">Leg.</th>
                                                    <th className="ps-th-sticky ps-th-nombre">Nombre y Apellido</th>
                                                    {dias.map(dia => {
                                                        const key       = fmtKey(dia);
                                                        const diasEsp   = esB(dia) ? diasEspB : diasEspA;
                                                        const fin       = dia.getDay() === 0 || dia.getDay() === 6;
                                                        const ferNombre = FERIADOS_ARG[key];
                                                        const trabaja   = diasEsp[key];
                                                        return (
                                                            <th key={key}
                                                                className={[
                                                                    "ps-th-dia",
                                                                    fin && !ferNombre && trabaja !== false ? "ps-th-dia--fin" : "",
                                                                    ferNombre ? "ps-th-dia--fer" : "",
                                                                ].join(" ")}
                                                                title={ferNombre}
                                                            >
                                                                <div className="ps-th-mes-label">{MESES_ES[dia.getMonth()].slice(0,3)}</div>
                                                                <div className="ps-th-num">{dia.getDate()}</div>
                                                                <div className="ps-th-dow">{DIAS_ES[dia.getDay()].slice(0,2)}</div>
                                                                {ferNombre && <div className="ps-th-badge ps-th-badge--fer">FER</div>}
                                                            </th>
                                                        );
                                                    })}
                                                    <th className="ps-th-hs">Hs Trab</th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {personal.map((p, i) => {
                                                    const data   = p.real || p.programado || {};
                                                    const hsTrab = r1(
                                                        dias.reduce((s, dia) => s + horasDeValor(normalizarTurno(data[fmtKey(dia)] || "")), 0) +
                                                        dias.reduce((s, dia) => s + (Number(p.capacitacion?.[fmtKey(dia)]) || 0), 0)
                                                    );
                                                    return (
                                                        <tr key={p.legajo + i} className="ps-row">
                                                            <td className="ps-td-sticky ps-td-legajo">{p.legajo}</td>
                                                            <td className="ps-td-sticky ps-td-nombre">{p.nombre}</td>
                                                            {dias.map(dia => {
                                                                const key     = fmtKey(dia);
                                                                const diasEsp = esB(dia) ? diasEspB : diasEspA;
                                                                const val     = data[key] || "";
                                                                const op      = OPCIONES.find(o => o.val === val);
                                                                const fin     = dia.getDay() === 0 || dia.getDay() === 6;
                                                                const trabaja = diasEsp[key];
                                                                return (
                                                                    <td key={key}
                                                                        className={[
                                                                            "ps-celda",
                                                                            op?.cls ? `ps-celda--${op.cls}` : "",
                                                                            fin && !op?.cls && trabaja !== false ? "ps-celda--fin" : "",
                                                                        ].join(" ")}
                                                                    >
                                                                        <CeldaContenido val={val} op={op} />
                                                                    </td>
                                                                );
                                                            })}
                                                            <td className="ps-td-hs">{hsTrab || "—"}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>

                                            <tfoot>
                                                {/* Hs. a cubrir */}
                                                <tr className="ps-tfoot cc-tfoot-first">
                                                    <td colSpan={2} className="ps-tfoot-label">Hs. a cubrir</td>
                                                    {dias.map(dia => {
                                                        const hs = hsDia(dia);
                                                        return (
                                                            <td key={fmtKey(dia)} className={`ps-tfoot-cel ${hs == null ? "ps-tfoot-cel--sin" : ""}`}>
                                                                {hs != null ? hs : "—"}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="ps-tfoot-total">{totalACubrir} hs</td>
                                                </tr>

                                                {/* Horas reales */}
                                                <tr className="cc-tfoot-row">
                                                    <td colSpan={2} className="ps-tfoot-label">Hs. reales cubiertas</td>
                                                    {dias.map(dia => {
                                                        const v = hsRealesDia(personal, dia);
                                                        return <td key={fmtKey(dia)} className="ps-tfoot-cel">{v || "—"}</td>;
                                                    })}
                                                    <td className="ps-tfoot-total">{totalReales} hs</td>
                                                </tr>

                                                {/* Horas NO cubiertas */}
                                                <tr className="cc-tfoot-row cc-tfoot-row--nocub">
                                                    <td colSpan={2} className="ps-tfoot-label">Hs. NO cubiertas</td>
                                                    {dias.map(dia => {
                                                        const v = r1(Math.max(0, (hsDia(dia) ?? 0) - hsRealesDia(personal, dia)));
                                                        return <td key={fmtKey(dia)} className="ps-tfoot-cel">{v || "—"}</td>;
                                                    })}
                                                    <td className="ps-tfoot-total">{totalNoCubier} hs</td>
                                                </tr>

                                                {/* Horas adicionales */}
                                                <tr className="cc-tfoot-row cc-tfoot-row--adic">
                                                    <td colSpan={2} className="ps-tfoot-label">Hs. adicionales</td>
                                                    {dias.map(dia => {
                                                        const v = r1(Math.max(0, hsRealesDia(personal, dia) - (hsDia(dia) ?? 0)));
                                                        return <td key={fmtKey(dia)} className="ps-tfoot-cel">{v || "—"}</td>;
                                                    })}
                                                    <td className="ps-tfoot-total">{totalAdicional} hs</td>
                                                </tr>

                                                {/* Horas a Facturar */}
                                                <tr className="cc-tfoot-row cc-tfoot-row--fact">
                                                    <td colSpan={2} className="ps-tfoot-label">Hs. a Facturar</td>
                                                    {dias.map(dia => {
                                                        const cubrir = hsDia(dia) ?? 0;
                                                        const real   = hsRealesDia(personal, dia);
                                                        const v      = r1(cubrir - r1(Math.max(0, cubrir - real)) + r1(Math.max(0, real - cubrir)));
                                                        return <td key={fmtKey(dia)} className="ps-tfoot-cel">{v || "—"}</td>;
                                                    })}
                                                    <td className="ps-tfoot-total">{totalFacturar} hs</td>
                                                </tr>

                                                {/* Capacitación */}
                                                <tr className="cc-tfoot-row cc-tfoot-row--cap">
                                                    <td colSpan={2} className="ps-tfoot-label">Hs. capacitación</td>
                                                    {dias.map(dia => {
                                                        const v = hsCapacitacionDia(personal, dia);
                                                        return <td key={fmtKey(dia)} className="ps-tfoot-cel">{v || "—"}</td>;
                                                    })}
                                                    <td className="ps-tfoot-total">{totalCapacitacion || "—"}</td>
                                                </tr>

                                                {/* Ausentismo */}
                                                <tr className="cc-tfoot-row cc-tfoot-row--aus">
                                                    <td colSpan={2} className="ps-tfoot-label">Ausentismo</td>
                                                    {dias.map(dia => {
                                                        const v = ausentismoDia(personal, dia);
                                                        return <td key={fmtKey(dia)} className="ps-tfoot-cel">{v || "—"}</td>;
                                                    })}
                                                    <td className="ps-tfoot-total">{totalAusentismo}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )
                            }
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
