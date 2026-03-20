// src/screens/PlanCapacitacionScreen.jsx
// Plan Anual de Capacitación — Santa Cruz 2026

import { useState, useEffect } from "react";
import { useAppData } from "../context/AppDataContext";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import "../styles/PlanCapacitacionScreen.css";

const ANIO   = 2026;
const ZONA   = "Santa Cruz";
const MESES  = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MK     = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

const mkMeses = (prog = {}) => {
    const p = {}; const e = {};
    MK.forEach(m => { p[m] = prog[m] ?? 0; e[m] = 0; });
    return { prog: p, ejec: e };
};

const ITEMS_BASE = [
    // ── Cuatrimestrales ──────────────────────────────────────────────────────
    { item:1,  grupo:"cuatrimestral", nombre:"Manejo de conflictos / Uso de la fuerza",             responsable:"Rodolfo Girelli",                     dur:1, met:"V", puestos:"Todo el personal",          ...mkMeses({mar:1,may:1,sep:1}) },
    { item:2,  grupo:"cuatrimestral", nombre:"DDHH",                                                responsable:"Juan Payero",                          dur:1, met:"V", puestos:"Todo el personal",          ...mkMeses({mar:1,jun:1,oct:1}) },
    { item:3,  grupo:"cuatrimestral", nombre:"Principios voluntarios de DDHH",                      responsable:"Juan Payero",                          dur:1, met:"V", puestos:"Todo el personal",          ...mkMeses({feb:1,jul:1,oct:1}) },
    { item:4,  grupo:"cuatrimestral", nombre:"Primeros Auxilios",                                   responsable:"Lautaro Portilla",                     dur:1, met:"V", puestos:"Todo el personal",          ...mkMeses({abr:1,ago:1,nov:1}) },
    // ── Regulares ────────────────────────────────────────────────────────────
    { item:5,  grupo:"regular",       nombre:"Manejo 4 x 4 Cámara de Transporte",                   responsable:"Cámara de transporte",                 dur:4, met:"P", puestos:"Según Necesidad",          ...mkMeses({may:1}) },
    { item:6,  grupo:"regular",       nombre:"Uso de gas pimienta y armas menos letales",           responsable:"Fernando Delgado",                     dur:1, met:"V", puestos:"Todo el personal",          ...mkMeses({feb:1}) },
    { item:7,  grupo:"regular",       nombre:"Funciones y responsabilidades del Supervisor",         responsable:"Fernando Delgado",                     dur:1, met:"V", puestos:"Encargados y Supervisores", ...mkMeses({jun:1}) },
    { item:8,  grupo:"regular",       nombre:"Uso de scanner teórico y práctico",                   responsable:"Fernando Delgado",                     dur:1, met:"P", puestos:"Todo el personal",          ...mkMeses({feb:1}) },
    { item:9,  grupo:"regular",       nombre:"Responsabilidad en controles y cumplimiento",         responsable:"Rodolfo Girelli",                      dur:1, met:"P", puestos:"Todo el personal",          ...mkMeses({mar:1}) },
    { item:10, grupo:"regular",       nombre:"Procedimiento de asalto e intrusión",                 responsable:"Rodolfo Girelli / Fernando Delgado",   dur:1, met:"P", puestos:"Todo el personal",          ...mkMeses({ago:1}) },
    { item:11, grupo:"regular",       nombre:"Manejo de 4 x 4 en condiciones adversas (barro/nieve)", responsable:"Rodolfo Girelli",                  dur:1, met:"P", puestos:"Todo el personal",          ...mkMeses({sep:1}) },
    { item:12, grupo:"regular",       nombre:"Funciones y responsabilidad de la Patrulla",          responsable:"Rolando Zuñiga",                       dur:1, met:"P", puestos:"Todo el personal",          ...mkMeses({mar:1}) },
    { item:13, grupo:"regular",       nombre:"Controles de acceso P1 y Planta (procedimientos)",   responsable:"Rolando Zuñiga",                       dur:1, met:"P", puestos:"Todo el personal",          ...mkMeses({mar:1}) },
    { item:14, grupo:"regular",       nombre:"Uso de scanner teórico y práctico",                   responsable:"Rolando Zuñiga",                       dur:1, met:"P", puestos:"Todo el personal",          ...mkMeses({may:1}) },
    { item:15, grupo:"regular",       nombre:"Convivencia en campamento, respeto y uso de elementos", responsable:"Rolando Zuñiga",                    dur:1, met:"P", puestos:"Todo el personal",          ...mkMeses({jun:1}) },
    { item:16, grupo:"regular",       nombre:"CCTV; Uso correcto, actitudes del operador, seguimientos", responsable:"Rolando Zuñiga",               dur:1, met:"P", puestos:"Todo el personal",          ...mkMeses({sep:1}) },
    { item:17, grupo:"regular",       nombre:"Confección de informes",                              responsable:"Rolando Zuñiga",                       dur:1, met:"P", puestos:"Todo el personal",          ...mkMeses({nov:1}) },
    { item:18, grupo:"regular",       nombre:"Funciones y responsabilidad de la Patrulla",          responsable:"Andres Aguirre / Rodolfo Girelli",     dur:1, met:"P", puestos:"Todo el personal",          ...mkMeses({mar:1}) },
    { item:19, grupo:"regular",       nombre:"Controles de acceso P1 y Planta (procedimientos)",   responsable:"Andres Aguirre / Rodolfo Girelli",     dur:1, met:"P", puestos:"Todo el personal",          ...mkMeses({abr:1}) },
    { item:20, grupo:"regular",       nombre:"Uso de scanner teórico y práctico",                   responsable:"Andres Aguirre / Rodolfo Girelli",     dur:1, met:"P", puestos:"Todo el personal",          ...mkMeses({jul:1}) },
    { item:21, grupo:"regular",       nombre:"Convivencia en campamento, respeto y uso de elementos", responsable:"Andres Aguirre / Rodolfo Girelli", dur:1, met:"P", puestos:"Todo el personal",          ...mkMeses({nov:1}) },
    { item:22, grupo:"regular",       nombre:"CCTV; Uso correcto, actitudes del operador, seguimientos", responsable:"Andres Aguirre / Rodolfo Girelli", dur:1, met:"P", puestos:"Todo el personal",    ...mkMeses({oct:1}) },
    { item:23, grupo:"regular",       nombre:"Confección de informes",                              responsable:"Andres Aguirre / Rodolfo Girelli",     dur:1, met:"P", puestos:"Todo el personal",          ...mkMeses({dic:1}) },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function totalProg(items) {
    return items.reduce((s, it) => s + MK.reduce((a, m) => a + (it.prog[m] || 0), 0), 0);
}
function totalEjec(items) {
    return items.reduce((s, it) => s + MK.reduce((a, m) => a + (it.ejec[m] || 0), 0), 0);
}
function mesProg(items, m) { return items.reduce((s, it) => s + (it.prog[m] || 0), 0); }
function mesEjec(items, m) { return items.reduce((s, it) => s + (it.ejec[m] || 0), 0); }

// ── Componente ─────────────────────────────────────────────────────────────────
export default function PlanCapacitacionScreen({ onBack }) {
    const { empresaNombre } = useAppData();
    const [items,       setItems]       = useState(null);
    const [cargando,    setCargando]    = useState(true);
    const [guardando,   setGuardando]   = useState(false);
    const [guardado,    setGuardado]    = useState(false);
    const [editResp,    setEditResp]    = useState({ idx: null, val: "" });

    const docId = `${empresaNombre}_santacruz_${ANIO}`;

    // ── Carga ────────────────────────────────────────────────────
    useEffect(() => {
        const cargar = async () => {
            try {
                const snap = await getDoc(doc(db, "planCapacitacion", docId));
                if (snap.exists() && snap.data().items?.length) {
                    setItems(snap.data().items);
                } else {
                    setItems(ITEMS_BASE.map(it => ({
                        ...it,
                        ejec: { ...Object.fromEntries(MK.map(m => [m, 0])) },
                    })));
                }
            } catch (e) {
                console.error(e);
                setItems(ITEMS_BASE);
            } finally {
                setCargando(false);
            }
        };
        cargar();
    }, [docId]);

    // ── Guardar ──────────────────────────────────────────────────
    const guardar = async () => {
        setGuardando(true);
        try {
            await setDoc(doc(db, "planCapacitacion", docId), {
                empresa: empresaNombre, zona: ZONA, anio: ANIO,
                items, actualizadoEn: serverTimestamp(),
            });
            setGuardado(true);
            setTimeout(() => setGuardado(false), 2500);
        } catch (e) {
            alert("Error al guardar: " + e.message);
        } finally {
            setGuardando(false);
        }
    };

    // ── Toggle celdas ────────────────────────────────────────────
    const toggleProg = (idx, mes) => setItems(prev => {
        const next = prev.map((it, i) => {
            if (i !== idx) return it;
            const val = it.prog[mes] ? 0 : 1;
            return { ...it, prog: { ...it.prog, [mes]: val }, ejec: { ...it.ejec, [mes]: val === 0 ? 0 : it.ejec[mes] } };
        });
        return next;
    });

    const toggleEjec = (idx, mes) => setItems(prev =>
        prev.map((it, i) => i !== idx ? it : { ...it, ejec: { ...it.ejec, [mes]: it.ejec[mes] ? 0 : 1 } })
    );

    const iniciarEditResp = (idx, val) => setEditResp({ idx, val });
    const confirmarEditResp = () => {
        if (editResp.idx === null) return;
        setItems(prev => prev.map((it, i) =>
            i === editResp.idx ? { ...it, responsable: editResp.val } : it
        ));
        setEditResp({ idx: null, val: "" });
    };

    if (cargando) return <div className="pc-loading">Cargando plan...</div>;

    const tProg = totalProg(items);
    const tEjec = totalEjec(items);
    const avance = tProg > 0 ? Math.round(tEjec / tProg * 100) : 0;
    const maxMes = Math.max(...MK.map(m => mesProg(items, m)), 1);

    const itemsCuat = items.filter(x => x.grupo === "cuatrimestral");
    const itemsReg  = items.filter(x => x.grupo === "regular");
    const pCuat = totalProg(itemsCuat), eCuat = totalEjec(itemsCuat);
    const pReg  = totalProg(itemsReg),  eReg  = totalEjec(itemsReg);
    const avCuat = pCuat > 0 ? Math.round(eCuat / pCuat * 100) : 0;
    const avReg  = pReg  > 0 ? Math.round(eReg  / pReg  * 100) : 0;

    const Donut = ({ pct, r, label, sub, color, colorEnd, size = "sm" }) => {
        const sw   = size === "lg" ? 11 : 8;
        const cx   = r + sw;
        const cy   = r + sw;
        const circ = 2 * Math.PI * r;
        const dash = (pct / 100) * circ;
        const id   = `grad-${label.replace(/\s/g, "")}`;
        const dim  = (r + sw) * 2;
        return (
            <div className={`pc-donut-card pc-donut-card--${size}`} style={{ "--dc": color }}>
                <div className="pc-donut-card-top">
                    <svg width={dim} height={dim} className="pc-donut-svg">
                        <defs>
                            <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor={color} />
                                <stop offset="100%" stopColor={colorEnd || color} />
                            </linearGradient>
                        </defs>
                        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e8eaf0" strokeWidth={sw} />
                        <circle
                            cx={cx} cy={cy} r={r} fill="none"
                            stroke={`url(#${id})`} strokeWidth={sw}
                            strokeDasharray={`${dash} ${circ}`}
                            strokeLinecap="round"
                            transform={`rotate(-90 ${cx} ${cy})`}
                            className="pc-donut-arc"
                        />
                        <text x={cx} y={cy + 6} textAnchor="middle" className="pc-donut-pct-txt" fill={color}>{pct}%</text>
                    </svg>
                    <div className="pc-donut-card-info">
                        <div className="pc-donut-card-label">{label}</div>
                        <div className="pc-donut-card-sub">{sub}</div>
                    </div>
                </div>
                <div className="pc-donut-bar-track">
                    <div className="pc-donut-bar-fill" style={{ "--pc-w": `${pct}%`, "--pc-grad": `linear-gradient(90deg, ${color}, ${colorEnd || color})` }} />
                </div>
            </div>
        );
    };

    return (
        <div className="pc-root">

            {/* ── Header ── */}
            <header className="pc-header">
                <div className="pc-header-left">
                    <button className="pc-back" onClick={onBack}>← Panel</button>
                    <div>
                        <div className="pc-header-title">🎓 Plan Anual de Capacitación {ANIO}</div>
                        <div className="pc-header-sub">📍 {ZONA} — {empresaNombre}</div>
                    </div>
                </div>
                <button className="pc-btn-guardar" onClick={guardar} disabled={guardando}>
                    {guardado ? "✓ Guardado" : guardando ? "Guardando..." : "Guardar"}
                </button>
            </header>

            {/* ── KPIs ── */}
            <div className="pc-kpis">
                <div className="pc-kpi">
                    <span className="pc-kpi-val">{tProg}</span>
                    <span className="pc-kpi-label">Programadas</span>
                </div>
                <div className="pc-kpi pc-kpi--ejec">
                    <span className="pc-kpi-val">{tEjec}</span>
                    <span className="pc-kpi-label">Ejecutadas</span>
                </div>
                <div className="pc-kpi pc-kpi--pend">
                    <span className="pc-kpi-val">{tProg - tEjec}</span>
                    <span className="pc-kpi-label">Pendientes</span>
                </div>
                <div className="pc-kpi pc-kpi--avance">
                    <span className="pc-kpi-val">{avance}%</span>
                    <span className="pc-kpi-label">Avance</span>
                </div>
                <div className="pc-avance-bar-wrap">
                    <div className="pc-avance-bar" style={{ "--pc-av": `${avance}%` }} />
                </div>
            </div>

            {/* ── Tabla ── */}
            <div className="pc-table-scroll">
                <table className="pc-table">
                    <thead>
                        <tr>
                            <th className="pc-th-num">#</th>
                            <th className="pc-th-nombre">Capacitación específica</th>
                            <th className="pc-th-resp">Responsable</th>
                            <th className="pc-th-hs">Hs</th>
                            <th className="pc-th-met">Met.</th>
                            <th className="pc-th-puestos">Puestos</th>
                            {MESES.map(m => (
                                <th key={m} colSpan={2} className="pc-th-mes">{m}</th>
                            ))}
                        </tr>
                        <tr className="pc-thead-sub">
                            <th colSpan={6} />
                            {MESES.map(m => [
                                <th key={m+"p"} className="pc-sub-p">P</th>,
                                <th key={m+"e"} className="pc-sub-e">E</th>,
                            ])}
                        </tr>
                    </thead>

                    <tbody>
                        {items.map((it, idx) => {
                            const esCuatrimestral = it.grupo === "cuatrimestral";
                            const showGrupoHeader = idx === 0 || (idx > 0 && items[idx - 1].grupo !== it.grupo);

                            return [
                                showGrupoHeader && (
                                    <tr key={`gh-${idx}`} className="pc-grupo-header">
                                        <td colSpan={6 + MESES.length * 2}>
                                            {esCuatrimestral ? "Cuatrimestrales" : "Específicas por anexo"}
                                        </td>
                                    </tr>
                                ),
                                <tr key={it.item} className={esCuatrimestral ? "pc-row--cuatrimestral" : ""}>
                                    <td className="pc-td-num">{it.item}</td>
                                    <td className="pc-td-nombre">{it.nombre}</td>
                                    <td className="pc-td-resp" onClick={() => editResp.idx !== idx && iniciarEditResp(idx, it.responsable)}>
                                        {editResp.idx === idx
                                            ? <input
                                                className="pc-input-resp"
                                                autoFocus
                                                value={editResp.val}
                                                onChange={e => setEditResp(r => ({ ...r, val: e.target.value }))}
                                                onBlur={confirmarEditResp}
                                                onKeyDown={e => { if (e.key === "Enter") confirmarEditResp(); if (e.key === "Escape") setEditResp({ idx: null, val: "" }); }}
                                              />
                                            : <span className="pc-resp-text">{it.responsable}</span>
                                        }
                                    </td>
                                    <td className="pc-td-hs">{it.dur}</td>
                                    <td className="pc-td-met">
                                        <span className={`pc-met-badge pc-met--${it.met === "P" ? "pres" : "virt"}`}>
                                            {it.met === "P" ? "Pres." : "Virt."}
                                        </span>
                                    </td>
                                    <td className="pc-td-puestos">{it.puestos}</td>
                                    {MK.map(m => [
                                        <td
                                            key={m+"p"}
                                            className={`pc-cell pc-cell-prog ${it.prog[m] ? "pc-cell--on-prog" : ""}`}
                                            onClick={() => toggleProg(idx, m)}
                                            title="Click para programar"
                                        >
                                            {it.prog[m] ? <span className="pc-dot-prog" /> : null}
                                        </td>,
                                        <td
                                            key={m+"e"}
                                            className={`pc-cell pc-cell-ejec ${it.ejec[m] ? "pc-cell--on-ejec" : ""} ${!it.prog[m] ? "pc-cell--disabled" : ""}`}
                                            onClick={() => it.prog[m] && toggleEjec(idx, m)}
                                            title={it.prog[m] ? "Click para marcar ejecutado" : "No programado"}
                                        >
                                            {it.ejec[m] ? "✓" : null}
                                        </td>,
                                    ])}
                                </tr>,
                            ];
                        })}

                        {/* ── Fila totales ── */}
                        <tr className="pc-totals-row">
                            <td colSpan={6} className="pc-totals-label">TOTAL</td>
                            {MK.map(m => [
                                <td key={m+"p"} className="pc-total-prog">{mesProg(items, m) || ""}</td>,
                                <td key={m+"e"} className="pc-total-ejec">{mesEjec(items, m) || ""}</td>,
                            ])}
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* ── Leyenda + Gráficos ── */}
            <div className="pc-bottom">
                <div className="pc-leyenda">
                    <span className="pc-ley-item"><span className="pc-ley-dot pc-ley-dot--prog" /> Programado (P)</span>
                    <span className="pc-ley-item"><span className="pc-ley-dot pc-ley-dot--ejec" /> Ejecutado (E)</span>
                    <span className="pc-ley-item pc-ley-note">Hacé click en P para programar · Click en E para marcar ejecutado</span>
                </div>

                <div className="pc-charts-row">
                    <div className="pc-chart">
                        <div className="pc-chart-title">Cumplimiento mensual</div>
                        <div className="pc-bars">
                            {MK.map((m, i) => {
                                const p = mesProg(items, m);
                                const e = mesEjec(items, m);
                                return (
                                    <div key={m} className="pc-bar-col">
                                        <div className="pc-bar-wrap">
                                            <div className="pc-bar pc-bar--prog" style={{ "--pc-h": `${(p / maxMes) * 80}px` }} title={`Prog: ${p}`} />
                                            <div className="pc-bar pc-bar--ejec" style={{ "--pc-h": `${(e / maxMes) * 80}px` }} title={`Ejec: ${e}`} />
                                        </div>
                                        <div className="pc-bar-label">{MESES[i]}</div>
                                        <div className="pc-bar-num">{e}/{p}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="pc-avance-chart">
                        <Donut pct={avance} r={46} size="lg" label="Plan completo"    sub={`${tEjec} de ${tProg} ejecutadas`} color="#6366f1" colorEnd="#a78bfa" />
                        <Donut pct={avCuat}  r={34} size="sm" label="Cuatrimestrales"  sub={`${eCuat} de ${pCuat} ejecutadas`} color="#0ea5e9" colorEnd="#38bdf8" />
                        <Donut pct={avReg}   r={34} size="sm" label="Específicas"      sub={`${eReg} de ${pReg} ejecutadas`}  color="#10b981" colorEnd="#34d399" />
                    </div>
                </div>
            </div>

        </div>
    );
}
