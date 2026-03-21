// src/screens/ControlClienteScreen.jsx
// Vista Control Cliente — idéntica a VistaTurnos + columna Hs Trab + filas de resumen

import { useState, useEffect } from "react";
import html2canvas from "html2canvas";
import { jsPDF }   from "jspdf";
import { useAppData }      from "../context/AppDataContext";
import { useClientesData } from "../hooks/useClientesData";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import "../styles/ProgramacionServiciosScreen.css";
import "../styles/ControlClienteScreen.css";

// ── Constantes (igual que ProgramacionServiciosScreen) ───────────────────────────
const DIAS_ES  = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const MESES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const OPCIONES = [
    { val: "",              label: "—",      cls: ""    },
    { val: "06:00 – 14:00", label: "06-14",  cls: "dia" },
    { val: "06:00 – 16:00", label: "06-16",  cls: "dia" },
    { val: "06:00 – 19:00", label: "06-19",  cls: "dia" },
    { val: "06:00 – 18:00", label: "06-18",  cls: "dia" },
    { val: "07:00 – 17:00", label: "07-17",  cls: "dia" },
    { val: "07:00 – 19:00", label: "07-19",  cls: "dia" },
    { val: "08:00 – 20:00", label: "08-20",  cls: "dia" },
    { val: "09:00 – 17:00", label: "09-17",  cls: "dia" },
    { val: "10:00 – 18:00", label: "10-18",  cls: "dia" },
    { val: "05:00 – 13:00", label: "05-13",  cls: "dia" },
    { val: "05:00 – 13:30", label: "05-13½", cls: "dia" },
    { val: "05:00 – 17:00", label: "05-17",  cls: "dia" },
    { val: "13:00 – 21:00", label: "13-21",  cls: "tard"},
    { val: "13:30 – 22:00", label: "13½-22", cls: "tard"},
    { val: "14:00 – 22:00", label: "14-22",  cls: "tard"},
    { val: "17:00 – 05:00", label: "17-05",  cls: "noch"},
    { val: "18:00 – 06:00", label: "18-06",  cls: "noch"},
    { val: "19:00 – 07:00", label: "19-07",  cls: "noch"},
    { val: "21:00 – 06:00", label: "21-06",  cls: "noch"},
    { val: "22:00 – 06:00", label: "22-06",  cls: "noch"},
    { val: "06:00 – 06:00", label: "06-06",  cls: "g24" },
    { val: "07:00 – 07:00", label: "07-07",  cls: "g24" },
    { val: "08:00 – 08:00", label: "08-08",  cls: "g24" },
    { val: "Fco",           label: "Fco",    cls: "fco" },
    { val: "Com",           label: "Com",    cls: "com" },
    { val: "FER",           label: "FER",    cls: "fer" },
    { val: "Lic",           label: "Lic",    cls: "lic" },
    { val: "Vac",           label: "Vac",    cls: "vac" },
    { val: "Enf",           label: "Enf",    cls: "enf" },
    { val: "Art",           label: "ART",    cls: "art" },
    { val: "Asa",           label: "ASA",    cls: "asa" },
    { val: "Aca",           label: "ACA",    cls: "aca" },
    { val: "Sus",           label: "Sus",    cls: "sus" },
];

const AUS_CODES = ["Enf","Art","Asa","Aca","Sus","Lic"];

const FERIADOS_ARG = {
    "2025-01-01":"Año Nuevo","2025-03-03":"Carnaval","2025-03-04":"Carnaval",
    "2025-03-24":"Día de la Memoria","2025-04-02":"Día del Veterano de Malvinas",
    "2025-04-18":"Viernes Santo","2025-05-01":"Día del Trabajador",
    "2025-05-25":"Revolución de Mayo","2025-06-16":"Paso a la Inmortalidad del Gral. Güemes",
    "2025-06-20":"Paso a la Inmortalidad del Gral. Belgrano",
    "2025-07-09":"Día de la Independencia",
    "2025-08-18":"Paso a la Inmortalidad del Gral. San Martín",
    "2025-10-13":"Día del Respeto a la Diversidad Cultural",
    "2025-11-21":"Día de la Soberanía Nacional","2025-12-08":"Inmaculada Concepción de María",
    "2025-12-25":"Navidad",
    "2026-01-01":"Año Nuevo","2026-02-16":"Carnaval","2026-02-17":"Carnaval",
    "2026-03-24":"Día de la Memoria","2026-04-02":"Día del Veterano de Malvinas",
    "2026-04-03":"Viernes Santo","2026-05-01":"Día del Trabajador",
    "2026-05-25":"Revolución de Mayo","2026-06-15":"Paso a la Inmortalidad del Gral. Güemes",
    "2026-06-20":"Paso a la Inmortalidad del Gral. Belgrano",
    "2026-07-09":"Día de la Independencia",
    "2026-08-17":"Paso a la Inmortalidad del Gral. San Martín",
    "2026-10-12":"Día del Respeto a la Diversidad Cultural",
    "2026-11-20":"Día de la Soberanía Nacional","2026-12-08":"Inmaculada Concepción de María",
    "2026-12-25":"Navidad",
    "2027-01-01":"Año Nuevo","2027-02-08":"Carnaval","2027-02-09":"Carnaval",
    "2027-03-24":"Día de la Memoria","2027-04-02":"Día del Veterano de Malvinas",
    "2027-03-26":"Viernes Santo","2027-05-01":"Día del Trabajador",
    "2027-05-25":"Revolución de Mayo","2027-06-17":"Paso a la Inmortalidad del Gral. Güemes",
    "2027-06-21":"Paso a la Inmortalidad del Gral. Belgrano",
    "2027-07-09":"Día de la Independencia",
    "2027-08-16":"Paso a la Inmortalidad del Gral. San Martín",
    "2027-10-11":"Día del Respeto a la Diversidad Cultural",
    "2027-11-22":"Día de la Soberanía Nacional","2027-12-08":"Inmaculada Concepción de María",
    "2027-12-25":"Navidad",
};

const HORAS_KEYS = [
    "horasDomingo","horasLunes","horasMartes","horasMiercoles",
    "horasJueves","horasViernes","horasSabado",
];

// ── Helpers ──────────────────────────────────────────────────────────────────────
function getDias(año, mes) {
    const dias = [];
    let cur = new Date(año, mes - 2, 24);
    const end = new Date(año, mes - 1, 23);
    while (cur <= end) {
        dias.push(new Date(cur));
        cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    }
    return dias;
}

function fmtKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function horasDeValor(val) {
    if (!val || val === "Fco" || val === "Com" || val === "FER" || val === "Lic") return 0;
    const partes = val.split(/\s*[-\u2013\u2014]\s*/);
    if (partes.length !== 2) return 0;
    const [h1, m1] = partes[0].split(":").map(Number);
    const [h2, m2] = partes[1].split(":").map(Number);
    if (isNaN(h1) || isNaN(h2)) return 0;
    const ini = h1 * 60 + (m1 || 0);
    const fin = h2 * 60 + (m2 || 0);
    return (fin > ini ? fin - ini : fin + 1440 - ini) / 60;
}

function CeldaContenido({ val, op }) {
    if (!val) return <span className="ps-celda-vacio">—</span>;
    const hs = horasDeValor(val);
    if (hs > 0) {
        return <span>{hs.toFixed(2).replace(".", ",")}</span>;
    }
    return <>{op?.label ?? val}</>;
}

function r1(n) { return Math.round(n * 10) / 10; }

// ── Componente principal ─────────────────────────────────────────────────────────
export default function ControlClienteScreen({ año, mes }) {
    const { empresaNombre } = useAppData();
    const { objetivos }     = useClientesData(empresaNombre);
    const [docs, setDocs]         = useState([]);
    const [cargando, setCargando] = useState(false);
    const [descargando, setDescargando] = useState(false);

    useEffect(() => {
        if (!empresaNombre) return;
        setCargando(true);
        getDocs(query(
            collection(db, "programacionServicios"),
            where("empresa", "==", empresaNombre),
            where("año",     "==", año),
            where("mes",     "==", mes)
        ))
            .then(snap => {
                const data = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
                data.sort((a, b) => (a.clienteNombre || "").localeCompare(b.clienteNombre || ""));
                setDocs(data);
            })
            .catch(console.error)
            .finally(() => setCargando(false));
    }, [empresaNombre, año, mes]);

    const dias = getDias(año, mes);
    const mesAnterior = mes === 1 ? 12 : mes - 1;
    const añoAnterior = mes === 1 ? año - 1 : año;

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

    const descargarUno = async (docId, nombre, fmt) => {
        setDescargando(true);
        try {
            const raw = await capturar(`cc-obj-${docId}`);
            if (!raw) return;
            const canvas = conMargenes(raw);
            if (fmt === "jpg") {
                const a = document.createElement("a");
                a.download = `${nombre}.jpg`;
                a.href = canvas.toDataURL("image/jpeg", 0.95);
                a.click();
            } else {
                const w = canvas.width, h = canvas.height;
                const pdf = new jsPDF({ orientation: w > h ? "l" : "p", unit: "px", format: [w, h] });
                pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, w, h);
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
                    const raw = await capturar(`cc-obj-${d.docId}`);
                    if (!raw) continue;
                    const canvas = conMargenes(raw);
                    const a = document.createElement("a");
                    a.download = `${nombreArchivo(d)}.jpg`;
                    a.href = canvas.toDataURL("image/jpeg", 0.95);
                    a.click();
                    await new Promise(r => setTimeout(r, 300));
                }
            } else {
                let pdf = null;
                for (const d of docs) {
                    const raw = await capturar(`cc-obj-${d.docId}`);
                    if (!raw) continue;
                    const canvas = conMargenes(raw);
                    const w = canvas.width, h = canvas.height;
                    const ori = w > h ? "l" : "p";
                    if (!pdf) {
                        pdf = new jsPDF({ orientation: ori, unit: "px", format: [w, h] });
                    } else {
                        pdf.addPage([w, h], ori);
                    }
                    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, w, h);
                }
                if (pdf) pdf.save(`ControlCliente ${MESES_ES[mes - 1]} ${año}.pdf`);
            }
        } finally { setDescargando(false); }
    };

    // ── Cálculos por fila de resumen ─────────────────────────────────────────
    const horasDiaDoc = (dia, hc, diasEsp) => {
        if (!hc) return null;
        const key = fmtKey(dia);
        if (FERIADOS_ARG[key]) return hc.horasFeriados != null ? Number(hc.horasFeriados) : null;
        if (diasEsp[key] === false) return 0;
        const hs = hc[HORAS_KEYS[dia.getDay()]];
        return hs != null ? Number(hs) : null;
    };

    const hsRealesDia = (personal, dia) => {
        const key = fmtKey(dia);
        return r1(personal.reduce((s, p) => s + horasDeValor((p.programado || {})[key] || ""), 0));
    };

    const ausentismoDia = (personal, dia) => {
        const key = fmtKey(dia);
        return personal.filter(p => AUS_CODES.includes((p.real || p.programado || {})[key] || "")).length;
    };

    const hsCapacitacionDia = (personal, dia) => {
        const key = fmtKey(dia);
        return r1(personal.reduce((s, p) => s + (Number(p.capacitacion?.[key]) || 0), 0));
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="ps-vt-root">
            {/* Header */}
            <div className="ps-vt-header">
                <span className="ps-vt-title">Control Cliente</span>
                <span className="ps-vt-hint">
                    24/{String(mesAnterior).padStart(2,"0")}/{añoAnterior} — 23/{String(mes).padStart(2,"0")}/{año}
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
                    const obj     = objetivos.find(o => o.id === d.objetivoId) || null;
                    const hc      = obj;   // mismos campos: horasLunes, horasSabado, etc.
                    const diasEsp = d.diasEspeciales || {};
                    const personal = d.personal || [];

                    const totalReales     = r1(dias.reduce((s, dia) => s + hsRealesDia(personal, dia), 0));
                    const totalACubrir    = r1(dias.reduce((s, dia) => s + (horasDiaDoc(dia, hc, diasEsp) ?? 0), 0));
                    const totalNoCubier   = r1(Math.max(0, totalACubrir - totalReales));
                    const totalAdicional  = r1(Math.max(0, totalReales - totalACubrir));
                    const totalFacturar       = r1(totalACubrir - totalNoCubier + totalAdicional);
                    const totalCapacitacion   = r1(dias.reduce((s, dia) => s + hsCapacitacionDia(personal, dia), 0));
                    const totalAusentismo     = dias.reduce((s, dia) => s + ausentismoDia(personal, dia), 0);

                    return (
                        <div key={d.docId} className="ps-vt-objetivo" id={`cc-obj-${d.docId}`}>
                            {/* Cabecera del objetivo */}
                            <div className="ps-vt-obj-header">
                                <span className="ps-vt-obj-cliente">{d.clienteNombre}</span>
                                {d.proyectoNombre  && <span className="ps-vt-obj-sep"> · {d.proyectoNombre}</span>}
                                {d.objetivoNombre  && <span className="ps-vt-obj-sep"> · {d.objetivoNombre}</span>}
                                <span className="ps-vt-obj-count">{personal.length} personas</span>
                                <div className="ps-vt-obj-dl">
                                    <button className="ps-vt-dl-btn ps-vt-dl-btn--jpg" disabled={descargando}
                                        onClick={() => descargarUno(d.docId, nombreArchivo(d), "jpg")}>⬇ JPG</button>
                                    <button className="ps-vt-dl-btn ps-vt-dl-btn--pdf" disabled={descargando}
                                        onClick={() => descargarUno(d.docId, nombreArchivo(d), "pdf")}>⬇ PDF</button>
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
                                                    const data   = p.programado || {};
                                                    const hsTrab = r1(dias.reduce((s, dia) => s + horasDeValor(data[fmtKey(dia)] || ""), 0));
                                                    return (
                                                        <tr key={p.legajo + i} className="ps-row">
                                                            <td className="ps-td-sticky ps-td-legajo">{p.legajo}</td>
                                                            <td className="ps-td-sticky ps-td-nombre">{p.nombre}</td>
                                                            {dias.map(dia => {
                                                                const key    = fmtKey(dia);
                                                                const val    = data[key] || "";
                                                                const op     = OPCIONES.find(o => o.val === val);
                                                                const fin    = dia.getDay() === 0 || dia.getDay() === 6;
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
                                                {/* Hs. a cubrir — igual que VistaTurnos */}
                                                <tr className="ps-tfoot cc-tfoot-first">
                                                    <td colSpan={2} className="ps-tfoot-label">Hs. a cubrir</td>
                                                    {dias.map(dia => {
                                                        const hs = horasDiaDoc(dia, hc, diasEsp);
                                                        return (
                                                            <td key={fmtKey(dia)} className={`ps-tfoot-cel ${hs == null ? "ps-tfoot-cel--sin" : ""}`}>
                                                                {hs != null ? hs : "—"}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="ps-tfoot-total">
                                                        {totalACubrir} hs
                                                    </td>
                                                </tr>

                                                {/* Horas reales cubiertas */}
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
                                                        const real   = hsRealesDia(personal, dia);
                                                        const cubrir = horasDiaDoc(dia, hc, diasEsp) ?? 0;
                                                        const v = r1(Math.max(0, cubrir - real));
                                                        return <td key={fmtKey(dia)} className="ps-tfoot-cel">{v || "—"}</td>;
                                                    })}
                                                    <td className="ps-tfoot-total">{totalNoCubier} hs</td>
                                                </tr>

                                                {/* Horas adicionales */}
                                                <tr className="cc-tfoot-row cc-tfoot-row--adic">
                                                    <td colSpan={2} className="ps-tfoot-label">Hs. adicionales</td>
                                                    {dias.map(dia => {
                                                        const real   = hsRealesDia(personal, dia);
                                                        const cubrir = horasDiaDoc(dia, hc, diasEsp) ?? 0;
                                                        const v = r1(Math.max(0, real - cubrir));
                                                        return <td key={fmtKey(dia)} className="ps-tfoot-cel">{v || "—"}</td>;
                                                    })}
                                                    <td className="ps-tfoot-total">{totalAdicional} hs</td>
                                                </tr>

                                                {/* Horas a Facturar = a cubrir − no cubiertas + adicionales */}
                                                <tr className="cc-tfoot-row cc-tfoot-row--fact">
                                                    <td colSpan={2} className="ps-tfoot-label">Hs. a Facturar</td>
                                                    {dias.map(dia => {
                                                        const cubrir = horasDiaDoc(dia, hc, diasEsp) ?? 0;
                                                        const real   = hsRealesDia(personal, dia);
                                                        const noCub  = r1(Math.max(0, cubrir - real));
                                                        const adic   = r1(Math.max(0, real - cubrir));
                                                        const v      = r1(cubrir - noCub + adic);
                                                        return <td key={fmtKey(dia)} className="ps-tfoot-cel">{v || "—"}</td>;
                                                    })}
                                                    <td className="ps-tfoot-total">{totalFacturar} hs</td>
                                                </tr>

                                                {/* Horas capacitación */}
                                                <tr className="cc-tfoot-row">
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
