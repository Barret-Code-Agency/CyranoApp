// src/screens/ProgramacionServiciosScreen.jsx
// Planilla de programación de servicios — Programado vs Real

import React, { useState, useEffect, useRef, useCallback } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { useAppData }       from "../../context/AppDataContext";
import { useClientesData }  from "../../hooks/useClientesData";
import {
    doc, getDoc, setDoc, serverTimestamp,
    collection, query, where, getDocs,
} from "firebase/firestore";
import { db } from "../../firebase";
import "./ProgramacionServiciosScreen.css";
import { getDias, fmtKey, DIAS_ES, MESES_ES, OPCIONES, AUS_CODES, HORAS_KEYS, esLaboral, horasDeValor, normalizarTurno } from "../../utils/periodoUtils";
import { FERIADOS_ARG } from "../../utils/feriados";
import { fmtObjetivo } from "../../utils/formatters";

// ── Colecciones Firestore ────────────────────────────────────────────────────────
const COL_PROG   = "programacionServicios";
const COL_LEGAJOS = "legajos";

// ── Helpers ─────────────────────────────────────────────────────────────────────
// AUS_CODES, HORAS_KEYS, esLaboral, horasDeValor, normalizarTurno, getDias, fmtKey importados desde periodoUtils

// Renderiza el contenido de una celda: turnos horarios → dos líneas (entrada / salida)
function CeldaContenido({ val, op }) {
    if (!val) return <span className="ps-celda-vacio">—</span>;
    const partes = val.split(/\s*[–\u2013\u2014-]\s*/);
    if (partes.length === 2 && partes[0].includes(":")) {
        return (
            <>
                <span className="ps-celda-t1">{partes[0]}</span>
                <span className="ps-celda-t2">{partes[1]}</span>
            </>
        );
    }
    return <>{op?.label ?? val}</>;
}


// ── Popup editor de celda ────────────────────────────────────────────────────────
function CeldaPopup({ top, left, valorActual, onSelect, onClose }) {
    const ref = useRef();
    const [pos, setPos] = useState({ top, left });

    const esOpcion = OPCIONES.some(o => o.val === valorActual);
    const [manual, setManual] = useState(() => (valorActual && !esOpcion) ? valorActual : "");

    useEffect(() => {
        const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [onClose]);

    useEffect(() => {
        if (!ref.current) return;
        const r = ref.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let adjLeft = left;
        let adjTop  = top;
        if (left + r.width  > vw - 8) adjLeft = vw - r.width  - 8;
        if (top  + r.height > vh - 8) adjTop  = top - r.height - 8;
        if (adjLeft < 8) adjLeft = 8;
        setPos({ top: adjTop, left: adjLeft });
    }, [top, left]);

    const confirmarManual = () => {
        const norm = normalizarTurno(manual);
        if (norm) { onSelect(norm); setManual(""); }
    };

    return (
        <div className="ps-popup" style={{ top: pos.top, left: pos.left }} ref={ref}>
            {OPCIONES.map(op => (
                <button
                    key={op.val}
                    className={[
                        "ps-popup-opt",
                        op.cls ? `ps-popup-opt--${op.cls}` : "ps-popup-opt--vacio",
                        valorActual === op.val ? "ps-popup-opt--activo" : "",
                    ].join(" ")}
                    onClick={() => onSelect(op.val)}
                >
                    {op.label}
                </button>
            ))}
            <div className="ps-popup-manual">
                <input
                    className="ps-popup-manual-input"
                    placeholder="HH:MM – HH:MM"
                    value={manual}
                    onChange={e => setManual(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && manual.trim()) confirmarManual(); }}
                />
                <button
                    className="ps-popup-manual-btn"
                    disabled={!manual.trim()}
                    onClick={confirmarManual}
                >✓</button>
            </div>
        </div>
    );
}

// ── Selector de servicio ─────────────────────────────────────────────────────────
function SelectorServicio({ onSelect }) {
    const { empresaNombre, empresaId } = useAppData();
    const { clientes, objetivos, cargando } = useClientesData(empresaId);
    const hoy = new Date();
    const [año,        setAño]        = useState(hoy.getFullYear());
    const [mes,        setMes]        = useState(hoy.getMonth() + 1);
    const [clienteId,  setClienteId]  = useState("");
    const [objetivoId, setObjetivoId] = useState("");

    const clienteSel = clientes.find(c => c.id === clienteId);
    const objFiltrados = objetivos.filter(o => {
        if (o.clienteId === clienteId) return true;
        if (!clienteSel?.nombre) return false;
        const cn  = clienteSel.nombre.toLowerCase().trim();
        const oid = String(o.clienteId ?? "").toLowerCase().trim();
        const onm = String(o.clienteNombre ?? o.nombreProyecto ?? "").toLowerCase().trim();
        return oid === cn || onm === cn;
    });
    const objSel = objetivos.find(o => o.id === objetivoId);
    const valido = clienteId && objetivoId;

    const mesAnterior = mes === 1 ? 12 : mes - 1;
    const añoAnterior = mes === 1 ? año - 1 : año;

    return (
        <div className="ps-selector">
            <div className="ps-selector-icon">📋</div>
            <h2 className="ps-selector-title">Programación de Servicios</h2>
            <p className="ps-selector-sub">Seleccioná el servicio y el período para abrir o crear la planilla</p>

            <div className="ps-selector-fields">

                <div className="ps-field">
                    <label className="ps-label">Período</label>
                    <div className="ps-periodo-row">
                        <select className="ps-select" value={mes} onChange={e => setMes(Number(e.target.value))}>
                            {MESES_ES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                        <select className="ps-select ps-select--año" value={año} onChange={e => setAño(Number(e.target.value))}>
                            {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className="ps-periodo-hint">
                        Del 24/{String(mesAnterior).padStart(2,"0")}/{añoAnterior} al 23/{String(mes).padStart(2,"0")}/{año}
                    </div>
                </div>

                <div className="ps-field">
                    <label className="ps-label">Cliente</label>
                    <select
                        className="ps-select"
                        value={clienteId}
                        onChange={e => { setClienteId(e.target.value); setObjetivoId(""); }}
                        disabled={cargando}
                    >
                        <option value="">— Seleccionar cliente —</option>
                        {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                </div>

                <div className="ps-field">
                    <label className="ps-label">Objetivo / Servicio</label>
                    <select
                        className="ps-select"
                        value={objetivoId}
                        onChange={e => setObjetivoId(e.target.value)}
                        disabled={!clienteId || cargando}
                    >
                        <option value="">— Seleccionar objetivo —</option>
                        {objFiltrados.map(o => (
                            <option key={o.id} value={o.id}>
                                {[o.codigo, o.proyecto, o.nombre].filter(Boolean).join("  ")}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <button className="ps-btn-abrir" disabled={!valido} onClick={() =>
                onSelect({
                    clienteId,
                    clienteNombre: clienteSel?.nombre || "",
                    objetivoId,
                    objetivoCodigo: objSel?.codigo || "",
                    objetivoNombre: objSel?.nombre || "",
                    proyectoNombre: objSel?.proyecto || "",
                    horasLunes:     objSel?.horasLunes     ?? null,
                    horasMartes:    objSel?.horasMartes    ?? null,
                    horasMiercoles: objSel?.horasMiercoles ?? null,
                    horasJueves:    objSel?.horasJueves    ?? null,
                    horasViernes:   objSel?.horasViernes   ?? null,
                    horasSabado:    objSel?.horasSabado    ?? null,
                    horasDomingo:   objSel?.horasDomingo   ?? null,
                    horasFeriados:  objSel?.horasFeriados  ?? null,
                    zona:           objSel?.zona           || "",
                    año, mes,
                })
            }>
                Abrir planilla →
            </button>
        </div>
    );
}

// ── Modal días no laborables ─────────────────────────────────────────────────────
function ModalNoLaborables({ dias, onChange, onClose }) {
    const [sel, setSel] = useState(() =>
        Object.fromEntries(dias.map(d => [fmtKey(d), false]))
    );

    const toggleAll = (val) => setSel(Object.fromEntries(dias.map(d => [fmtKey(d), val])));

    return (
        <div className="ps-overlay" onClick={onClose}>
            <div className="ps-nolab-modal" onClick={e => e.stopPropagation()}>
                <div className="ps-modal-title">📅 Días no laborables</div>
                <p className="ps-nolab-sub">
                    Los siguientes días figuran como <strong>no laborables</strong> según el objetivo
                    pero <strong>no son feriado nacional</strong>.
                    ¿Se trabaja en alguno de ellos?
                </p>

                <div className="ps-nolab-acciones">
                    <button className="ps-nolab-bulk" onClick={() => toggleAll(true)}>Marcar todos ✓</button>
                    <button className="ps-nolab-bulk" onClick={() => toggleAll(false)}>Desmarcar todos</button>
                </div>

                <div className="ps-nolab-lista">
                    {dias.map(d => {
                        const key = fmtKey(d);
                        return (
                            <label key={key} className={`ps-nolab-item ${sel[key] ? "ps-nolab-item--on" : ""}`}>
                                <input
                                    type="checkbox"
                                    checked={sel[key]}
                                    onChange={e => setSel(p => ({ ...p, [key]: e.target.checked }))}
                                />
                                <span className="ps-nolab-fecha">
                                    {DIAS_ES[d.getDay()]} {d.getDate()}/{String(d.getMonth()+1).padStart(2,"0")}
                                </span>
                                <span className="ps-nolab-turno">{sel[key] ? "Se trabaja" : "No se trabaja"}</span>
                            </label>
                        );
                    })}
                </div>

                <div className="ps-patron-actions">
                    <button className="ps-modal-cerrar" onClick={onClose}>Cancelar</button>
                    <button className="ps-btn-aplicar" onClick={() => {
                        onChange(sel); // { dateKey: true/false }
                        onClose();
                    }}>
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Modal de patrón masivo ───────────────────────────────────────────────────────
const DIAS_SEM_LABELS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const TURNOS_OPT = OPCIONES.filter(o => o.cls === "dia" || o.cls === "noch" || o.cls === "tard");

function PatronModal({ persona, dias, vista, onAplicar, onClose }) {
    const [tipo,     setTipo]     = useState("semanal");
    // Semanal
    const [selDias,  setSelDias]  = useState([1,2,3,4,5]);
    const [turnoSem, setTurnoSem] = useState(TURNOS_OPT[0]?.val || "");
    const [offSem,   setOffSem]   = useState("Fco");
    // Rotativo
    const [ntrabajo,  setNtrabajo]  = useState(4);
    const [nfranco,   setNfranco]   = useState(2);
    const defTurno = TURNOS_OPT[0]?.val || "";
    // Un turno por cada posición de trabajo (array de length ntrabajo)
    const [turnosRot, setTurnosRot] = useState(() => Array(4).fill(defTurno));
    const [offRot,    setOffRot]    = useState("Fco");
    const [fase,      setFase]      = useState(0);

    const toggleDia = d => setSelDias(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);

    const nTrab = Number(ntrabajo);
    const nFran = Number(nfranco);
    const ciclo = nTrab + nFran;

    // Ajusta el array de turnos cuando cambia ntrabajo
    const handleNtrabajo = (val) => {
        const n = Number(val);
        setNtrabajo(val);
        setTurnosRot(prev => {
            if (n > prev.length) return [...prev, ...Array(n - prev.length).fill(defTurno)];
            return prev.slice(0, n);
        });
    };

    const setTurnoRot = (idx, val) =>
        setTurnosRot(prev => prev.map((t, i) => i === idx ? val : t));

    const faseOpts = [
        ...Array.from({ length: nTrab }, (_, i) => ({ val: i,          label: `Día de trabajo ${i + 1}` })),
        ...Array.from({ length: nFran }, (_, i) => ({ val: nTrab + i,  label: `Día de franco ${i + 1}` })),
    ];

    const calcPatron = () => {
        const r = {};
        if (tipo === "semanal") {
            dias.forEach(d => { r[fmtKey(d)] = selDias.includes(d.getDay()) ? turnoSem : offSem; });
        } else {
            dias.forEach((d, i) => {
                const pos = (i + Number(fase)) % ciclo;
                r[fmtKey(d)] = pos < nTrab ? (turnosRot[pos] || defTurno) : offRot;
            });
        }
        return r;
    };

    const patron = calcPatron();
    const preview = dias.slice(0, 14);

    return (
        <div className="ps-overlay" onClick={onClose}>
            <div className="ps-patron-modal" onClick={e => e.stopPropagation()}>
                <div className="ps-modal-title">🗓 Asignar patrón — {persona.nombre}</div>

                <div className="ps-patron-tipo-tabs">
                    <button className={`ps-ptab ${tipo === "semanal"  ? "ps-ptab--on" : ""}`} onClick={() => setTipo("semanal")}>Por días de semana</button>
                    <button className={`ps-ptab ${tipo === "rotativo" ? "ps-ptab--on" : ""}`} onClick={() => setTipo("rotativo")}>Rotativo</button>
                </div>

                {tipo === "semanal" && (
                    <div className="ps-patron-form">
                        <div className="ps-patron-field">
                            <label className="ps-label">Días de trabajo</label>
                            <div className="ps-dias-row">
                                {[0,1,2,3,4,5,6].map(d => (
                                    <button key={d} className={`ps-dia-btn ${selDias.includes(d) ? "ps-dia-btn--on" : ""}`} onClick={() => toggleDia(d)}>
                                        {DIAS_SEM_LABELS[d]}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="ps-patron-row">
                            <div className="ps-patron-field">
                                <label className="ps-label">Turno días laborables</label>
                                <select className="ps-select" value={turnoSem} onChange={e => setTurnoSem(e.target.value)}>
                                    {TURNOS_OPT.map(o => <option key={o.val} value={o.val}>{o.val}</option>)}
                                </select>
                            </div>
                            <div className="ps-patron-field">
                                <label className="ps-label">Días libres como</label>
                                <select className="ps-select" value={offSem} onChange={e => setOffSem(e.target.value)}>
                                    <option value="">— (sin asignar)</option>
                                    <option value="Fco">Fco</option>
                                    <option value="Com">Com</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {tipo === "rotativo" && (
                    <div className="ps-patron-form">
                        <div className="ps-patron-row">
                            <div className="ps-patron-field">
                                <label className="ps-label">Días de trabajo</label>
                                <input type="number" min={1} max={14} className="ps-input-num" value={ntrabajo} onChange={e => handleNtrabajo(e.target.value)} />
                            </div>
                            <div className="ps-patron-field">
                                <label className="ps-label">Días de franco</label>
                                <input type="number" min={1} max={14} className="ps-input-num" value={nfranco} onChange={e => setNfranco(e.target.value)} />
                            </div>
                            <div className="ps-patron-field">
                                <label className="ps-label">Franco como</label>
                                <select className="ps-select" value={offRot} onChange={e => setOffRot(e.target.value)}>
                                    <option value="Fco">Fco</option>
                                    <option value="Com">Com</option>
                                </select>
                            </div>
                        </div>

                        <div className="ps-patron-field">
                            <label className="ps-label">Turno por día de trabajo</label>
                            <div className="ps-turnos-rot-grid">
                                {turnosRot.map((t, idx) => (
                                    <div key={idx} className="ps-turno-rot-row">
                                        <span className="ps-turno-rot-label">Día {idx + 1}</span>
                                        <select
                                            className="ps-select ps-select--rot"
                                            value={t}
                                            onChange={e => setTurnoRot(idx, e.target.value)}
                                        >
                                            {TURNOS_OPT.map(o => <option key={o.val} value={o.val}>{o.val}</option>)}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="ps-patron-field">
                            <label className="ps-label">El período empieza en</label>
                            <select className="ps-select" value={fase} onChange={e => setFase(Number(e.target.value))}>
                                {faseOpts.map(f => <option key={f.val} value={f.val}>{f.label}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                <div className="ps-patron-preview-title">Vista previa (primeros 14 días)</div>
                <div className="ps-patron-preview">
                    {preview.map(d => {
                        const val = patron[fmtKey(d)] || "";
                        const op  = OPCIONES.find(o => o.val === val);
                        return (
                            <div key={fmtKey(d)} className={`ps-prev-cell ${op?.cls ? `ps-celda--${op.cls}` : "ps-prev-cell--vacio"}`}>
                                <span className="ps-prev-num">{d.getDate()}</span>
                                <span className="ps-prev-val"><CeldaContenido val={val} op={op} /></span>
                            </div>
                        );
                    })}
                </div>

                <div className="ps-patron-actions">
                    <button className="ps-modal-cerrar" onClick={onClose}>Cancelar</button>
                    <button className="ps-btn-aplicar" onClick={() => { onAplicar(patron); onClose(); }}>
                        Aplicar al período completo
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Selector de reemplazo (inline en AusentismoModal) ───────────────────────────
function ReemplazoPicker({ dia, todoElPersonal, reemplazoActual, onConfirm, onCancel }) {
    const [legajo, setLegajo] = useState(reemplazoActual?.legajo || "");
    const [turno,  setTurno]  = useState(reemplazoActual?.turno  || TURNOS_OPT[0]?.val || "");

    const personaSel = todoElPersonal.find(p => String(p.legajo) === String(legajo) || p.id === legajo);

    return (
        <div className="ps-reempl-picker">
            <div className="ps-reempl-picker-title">
                🔄 Reemplazo — {DIAS_ES[dia.getDay()]} {dia.getDate()}/{String(dia.getMonth()+1).padStart(2,"0")}
            </div>
            <div className="ps-patron-field">
                <label className="ps-label">Persona de reemplazo</label>
                <select className="ps-select" value={legajo} onChange={e => setLegajo(e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    {todoElPersonal.map(p => (
                        <option key={p.id} value={p.legajo || p.id}>
                            {p.nombre}{p.legajo ? ` (${p.legajo})` : ""}
                        </option>
                    ))}
                </select>
            </div>
            <div className="ps-patron-field">
                <label className="ps-label">Turno que cubre</label>
                <select className="ps-select" value={turno} onChange={e => setTurno(e.target.value)}>
                    {TURNOS_OPT.map(o => <option key={o.val} value={o.val}>{o.val}</option>)}
                </select>
            </div>
            <div className="ps-patron-actions">
                <button className="ps-modal-cerrar" onClick={onCancel}>Cancelar</button>
                <button
                    className="ps-btn-aplicar"
                    disabled={!legajo}
                    onClick={() => onConfirm({ legajo: legajo || "", nombre: personaSel?.nombre || "", turno })}
                >
                    Confirmar reemplazo
                </button>
            </div>
        </div>
    );
}

// ── Modal de ausentismo ──────────────────────────────────────────────────────────
function AusentismoModal({ persona, dias, vista, todoElPersonal, onAplicar, onClose }) {
    const primerDia = fmtKey(dias[0]);
    const ultimoDia = fmtKey(dias[dias.length - 1]);

    const [desde,     setDesde]     = useState(primerDia);
    const [hasta,     setHasta]     = useState(ultimoDia);
    const [codigo,    setCodigo]    = useState(null);
    const [reemplazos, setReemplazos] = useState(() => ({ ...(persona.reemplazos || {}) }));
    const [reemplDia,  setReemplDia]  = useState(null); // dateKey del día a reemplazar

    // Días existentes con ausentismo ya cargado (para mostrar historial)
    const ausExistentes = dias.filter(d => AUS_CODES.includes(persona[vista]?.[fmtKey(d)] || ""));

    // Rango seleccionado
    const diasRango = dias.filter(d => {
        const k = fmtKey(d);
        return k >= desde && k <= hasta;
    });

    const fmtFecha = (key) => {
        const d = dias.find(x => fmtKey(x) === key);
        if (!d) return key;
        return `${DIAS_ES[d.getDay()]} ${d.getDate()}/${String(d.getMonth()+1).padStart(2,"0")}`;
    };

    const aplicar = () => {
        const edits = {};
        diasRango.forEach(d => { edits[fmtKey(d)] = codigo; });
        onAplicar(edits, reemplazos);
        onClose();
    };

    const quitarAus = (key) => {
        onAplicar({ [key]: "" }, reemplazos);
    };

    const setReemplazo = (key, remp) => {
        setReemplazos(p => ({ ...p, [key]: remp }));
        setReemplDia(null);
    };

    const reemplDiaObj = reemplDia ? dias.find(d => fmtKey(d) === reemplDia) : null;

    return (
        <div className="ps-overlay" onClick={reemplDia ? undefined : onClose}>
            <div className="ps-aus-modal" onClick={e => e.stopPropagation()}>
                <div className="ps-modal-title">🏥 Ausentismo — {persona.nombre}</div>

                {reemplDiaObj ? (
                    <ReemplazoPicker
                        dia={reemplDiaObj}
                        todoElPersonal={todoElPersonal}
                        reemplazoActual={reemplazos[reemplDia]}
                        onConfirm={(remp) => setReemplazo(reemplDia, remp)}
                        onCancel={() => setReemplDia(null)}
                    />
                ) : (
                    <>
                        {/* ── Rango de fechas ── */}
                        <div className="ps-aus-rango">
                            <div className="ps-patron-field">
                                <label className="ps-label">Desde</label>
                                <select className="ps-select" value={desde} onChange={e => setDesde(e.target.value)}>
                                    {dias.map(d => {
                                        const k = fmtKey(d);
                                        return <option key={k} value={k}>{fmtFecha(k)}</option>;
                                    })}
                                </select>
                            </div>
                            <div className="ps-patron-field">
                                <label className="ps-label">Hasta</label>
                                <select className="ps-select" value={hasta} onChange={e => setHasta(e.target.value)}>
                                    {dias.filter(d => fmtKey(d) >= desde).map(d => {
                                        const k = fmtKey(d);
                                        return <option key={k} value={k}>{fmtFecha(k)}</option>;
                                    })}
                                </select>
                            </div>
                        </div>
                        <div className="ps-aus-rango-info">
                            {diasRango.length} día{diasRango.length !== 1 ? "s" : ""}
                        </div>

                        {/* ── Tipo de ausentismo ── */}
                        <div className="ps-patron-field">
                            <label className="ps-label">Motivo</label>
                            <div className="ps-aus-codes ps-aus-codes--grande">
                                {AUS_CODES.map(c => (
                                    <button
                                        key={c}
                                        className={`ps-aus-code ps-aus-code--lg ${codigo === c ? "ps-aus-code--on" : ""}`}
                                        onClick={() => setCodigo(p => p === c ? null : c)}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── Historial de ausentismos en el período ── */}
                        {ausExistentes.length > 0 && (
                            <div className="ps-aus-historial">
                                <div className="ps-patron-preview-title">Ausentismos cargados</div>
                                <div className="ps-aus-lista">
                                    {ausExistentes.map(d => {
                                        const key  = fmtKey(d);
                                        const val  = persona[vista]?.[key] || "";
                                        const remp = reemplazos[key];
                                        return (
                                            <div key={key} className="ps-aus-item ps-aus-item--aus">
                                                <span className="ps-aus-fecha">{fmtFecha(key)}</span>
                                                <span className="ps-aus-badge">{val}</span>
                                                <button
                                                    className={`ps-aus-remp-btn ${remp ? "ps-aus-remp-btn--set" : ""}`}
                                                    onClick={() => setReemplDia(key)}
                                                >
                                                    {remp ? `🔄 ${remp.nombre.split(" ")[0]}` : "🔄 Reemplazo"}
                                                </button>
                                                <button className="ps-aus-clear" onClick={() => quitarAus(key)} title="Quitar">×</button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="ps-patron-actions">
                            <button className="ps-modal-cerrar" onClick={onClose}>Cancelar</button>
                            <button
                                className="ps-btn-aplicar"
                                disabled={!codigo || diasRango.length === 0}
                                onClick={aplicar}
                            >
                                Aplicar {codigo ? `"${codigo}"` : ""} a {diasRango.length} día{diasRango.length !== 1 ? "s" : ""}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ── Grilla de servicio ───────────────────────────────────────────────────────────
function GrillaServicio({ config, onBack }) {
    const { empresaNombre, empresaId } = useAppData();
    const [todoElPersonal, setTodoElPersonal] = useState([]);

    useEffect(() => {
        if (!empresaId) return;
        getDocs(query(collection(db, COL_LEGAJOS), where("empresaId", "==", empresaId)))
            .then(snap => {
                const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                docs.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
                setTodoElPersonal(docs);
            })
            .catch(console.error);
    }, [empresaId]);

    const [personal,   setPersonal]   = useState([]);
    const [vista,      setVista]      = useState("programado");
    const [popup,      setPopup]      = useState(null);
    const [cargando,   setCargando]   = useState(true);
    const [guardando,  setGuardando]  = useState(false);
    const [guardado,   setGuardado]   = useState(false);
    const [modalAdd,     setModalAdd]     = useState(false);
    const [patronModal,  setPatronModal]  = useState(null); // { rowIdx }
    const [ausModal,     setAusModal]     = useState(null); // { rowIdx }
    const [diasEsp,      setDiasEsp]      = useState({}); // dateKey → true(trabaja)/false(no)
    const [modalNoLab,   setModalNoLab]   = useState(false);
    const [busq,         setBusq]         = useState("");

    const dias = getDias(config.año, config.mes);
    const docId = `${empresaNombre}_${config.clienteId}_${config.objetivoId}_${config.año}-${String(config.mes).padStart(2,"0")}`;

    const mesAnterior = config.mes === 1 ? 12 : config.mes - 1;
    const añoAnterior = config.mes === 1 ? config.año - 1 : config.año;

    // ── Carga ────────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                const snap = await getDoc(doc(db, "programacionServicios", docId));
                if (snap.exists()) {
                    setPersonal(snap.data().personal || []);
                    setDiasEsp(snap.data().diasEspeciales || {});
                }
            } catch (e) { console.error(e); }
            finally { setCargando(false); }
        })();
    }, [docId]);


    // ── Días no laborables del período (sin feriado nacional) ────
    const diasNoLabNonHoliday = dias.filter(d => {
        const key = fmtKey(d);
        if (FERIADOS_ARG[key]) return false;
        const hs = config[HORAS_KEYS[d.getDay()]];
        return hs !== null && hs !== undefined && Number(hs) === 0;
    });

    // Mostrar modal si hay días sin responder
    useEffect(() => {
        if (!cargando && diasNoLabNonHoliday.some(d => diasEsp[fmtKey(d)] === undefined)) {
            setModalNoLab(true);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargando]);

    // ── Guardar ──────────────────────────────────────────────
    const guardar = async () => {
        setGuardando(true);
        try {
            await setDoc(doc(db, "programacionServicios", docId), {
                empresa:        empresaNombre,
                empresaId:      empresaId,
                clienteId:      config.clienteId,
                clienteNombre:  config.clienteNombre,
                objetivoId:     config.objetivoId,
                objetivoCodigo: config.objetivoCodigo || "",
                objetivoNombre: config.objetivoNombre,
                proyectoNombre: config.proyectoNombre,
                zona:           config.zona || "",
                año: config.año, mes: config.mes,
                horasConfig: {
                    horasDomingo:    config.horasDomingo    ?? null,
                    horasLunes:      config.horasLunes      ?? null,
                    horasMartes:     config.horasMartes     ?? null,
                    horasMiercoles:  config.horasMiercoles  ?? null,
                    horasJueves:     config.horasJueves     ?? null,
                    horasViernes:    config.horasViernes    ?? null,
                    horasSabado:     config.horasSabado     ?? null,
                    horasFeriados:   config.horasFeriados   ?? null,
                },
                personal,
                diasEspeciales: diasEsp,
                actualizadoEn: serverTimestamp(),
            });
            setGuardado(true);
            setTimeout(() => setGuardado(false), 2500);
        } catch (e) { alert("Error al guardar: " + e.message); }
        finally { setGuardando(false); }
    };

    // ── Edición ──────────────────────────────────────────────
    const setCelda = (rowIdx, diaKey, val) => {
        setPersonal(prev => prev.map((p, i) =>
            i !== rowIdx ? p : { ...p, [vista]: { ...(p[vista] || {}), [diaKey]: val } }
        ));
        setPopup(null);
    };

    const agregarPersona = (v) => {
        if (personal.find(p => p.legajo === v.legajo)) return;
        setPersonal(prev => [...prev, { legajo: v.legajo || "", nombre: v.nombre || "", programado: {}, real: {}, reemplazos: {}, capacitacion: {} }]);
        setModalAdd(false); setBusq("");
    };

    const setCap = (rowIdx, diaKey, val) => {
        setPersonal(prev => prev.map((p, i) =>
            i !== rowIdx ? p : { ...p, capacitacion: { ...(p.capacitacion || {}), [diaKey]: val === "" ? null : Number(val) } }
        ));
    };

    const aplicarPatron = (rowIdx, patron) => {
        setPersonal(prev => prev.map((p, i) =>
            i !== rowIdx ? p : { ...p, [vista]: { ...(p[vista] || {}), ...patron } }
        ));
    };

    const aplicarAusentismo = (rowIdx, edits, reemplazos) => {
        setPersonal(prev => prev.map((p, i) => {
            if (i !== rowIdx) return p;
            const newVista = { ...(p[vista] || {}) };
            Object.entries(edits).forEach(([key, val]) => { newVista[key] = val; });
            return { ...p, [vista]: newVista, reemplazos: { ...(p.reemplazos || {}), ...reemplazos } };
        }));
    };

    const quitarPersona = (idx) => {
        if (!window.confirm("¿Quitar esta persona de la planilla?")) return;
        setPersonal(prev => prev.filter((_, i) => i !== idx));
    };

    const HORAS_POR_DOW = [
        config.horasDomingo,
        config.horasLunes,
        config.horasMartes,
        config.horasMiercoles,
        config.horasJueves,
        config.horasViernes,
        config.horasSabado,
    ];

    const horasFila = (p) => {
        const data = p[vista] || {};
        const total = dias.reduce((s, d) => s + horasDeValor(data[fmtKey(d)] || ""), 0);
        return Math.round(total * 10) / 10;
    };

    const horasDia = (d) => {
        const key = fmtKey(d);
        if (FERIADOS_ARG[key]) return config.horasFeriados != null ? Number(config.horasFeriados) : null;
        if (diasEsp[key] === false) return 0;
        return HORAS_POR_DOW[d.getDay()] != null ? Number(HORAS_POR_DOW[d.getDay()]) : null;
    };

    const vigFiltrados = todoElPersonal
        .filter(v => !personal.find(p => p.legajo === v.legajo))
        .filter(v => !busq || v.nombre?.toLowerCase().includes(busq.toLowerCase()) || String(v.legajo).includes(busq));

    if (cargando) return <div className="ps-loading">Cargando planilla...</div>;

    return (
        <div className="ps-grilla-root">

            {/* ── Header ── */}
            <header className="ps-header">
                <div className="ps-header-left">
                    <button className="ps-back" onClick={onBack}>← Volver</button>
                    <div>
                        <div className="ps-header-title">
                            {config.objetivoCodigo && <span className="ps-header-codigo">[{config.objetivoCodigo}]</span>}
                            {[config.clienteNombre, config.proyectoNombre, config.objetivoNombre].filter(Boolean).join(" · ")}
                        </div>
                        <div className="ps-header-sub">
                            Período 24/{String(mesAnterior).padStart(2,"0")}/{añoAnterior} — 23/{String(config.mes).padStart(2,"0")}/{config.año}
                            &nbsp;·&nbsp;{dias.length} días
                        </div>
                    </div>
                </div>
                <div className="ps-header-right">
                    <div className="ps-tabs">
                        <button className={`ps-tab ${vista === "programado" ? "ps-tab--on" : ""}`} onClick={() => setVista("programado")}>Programado</button>
                        <button className={`ps-tab ${vista === "real"       ? "ps-tab--on" : ""}`} onClick={() => {
                            // Al pasar a real: pre-carga desde programado para personas sin datos reales
                            setPersonal(prev => prev.map(p => {
                                const tieneReal = Object.keys(p.real || {}).length > 0;
                                if (tieneReal) return p;
                                return { ...p, real: { ...(p.programado || {}) } };
                            }));
                            setVista("real");
                        }}>Real</button>
                    </div>
                    {diasNoLabNonHoliday.length > 0 && (
                        <button className="ps-btn-nolab" onClick={() => setModalNoLab(true)} title="Días no laborables">
                            📅 No laborables
                        </button>
                    )}
                    <button className="ps-btn-add" onClick={() => setModalAdd(true)}>+ Personal</button>
                    <button className="ps-btn-guardar" onClick={guardar} disabled={guardando}>
                        {guardado ? "✓ Guardado" : guardando ? "..." : "💾 Guardar"}
                    </button>
                </div>
            </header>

            {/* ── Tabla ── */}
            <div className="ps-table-wrap">
                <table className="ps-table">
                    <thead>
                        <tr>
                            <th className="ps-th-sticky ps-th-legajo">Leg.</th>
                            <th className="ps-th-sticky ps-th-nombre">Nombre y Apellido</th>
                            <th className="ps-th-sticky ps-th-acciones" />
                            {dias.map(d => {
                                const key       = fmtKey(d);
                                const fin       = d.getDay() === 0 || d.getDay() === 6;
                                const ferNombre = FERIADOS_ARG[key];
                                const hs        = config[HORAS_KEYS[d.getDay()]];
                                const esNoLab   = !ferNombre && hs !== null && hs !== undefined && Number(hs) === 0;
                                const trabaja   = diasEsp[key]; // true/false/undefined
                                return (
                                    <th
                                        key={key}
                                        title={ferNombre || (esNoLab ? "Día no laborable según objetivo" : undefined)}
                                        className={[
                                            "ps-th-dia",
                                            fin && !ferNombre && trabaja !== false ? "ps-th-dia--fin" : "",
                                            ferNombre ? "ps-th-dia--fer" : "",
                                            esNoLab && trabaja === false     ? "ps-th-dia--nolab"   : "",
                                            esNoLab && trabaja === undefined ? "ps-th-dia--nolab-q" : "",
                                        ].join(" ")}
                                    >
                                        <div className="ps-th-mes-label">{MESES_ES[d.getMonth()].slice(0,3)}</div>
                                        <div className="ps-th-num">{d.getDate()}</div>
                                        <div className="ps-th-dow">{DIAS_ES[d.getDay()].slice(0,2)}</div>
                                        {ferNombre && <div className="ps-th-badge ps-th-badge--fer">FER</div>}
                                        {esNoLab && !ferNombre && trabaja !== true && (
                                            <div
                                                className="ps-th-badge ps-th-badge--nolab"
                                                onClick={e => { e.stopPropagation(); setModalNoLab(true); }}
                                                title="Click para revisar días no laborables"
                                            >
                                                {trabaja === false ? "✗" : "?"}
                                            </div>
                                        )}
                                    </th>
                                );
                            })}
                            <th className="ps-th-hs">Hs</th>
                            <th className="ps-th-del" />
                        </tr>
                    </thead>

                    <tbody>
                        {personal.length === 0 && (
                            <tr>
                                <td colSpan={dias.length + 5} className="ps-empty">
                                    Sin personal asignado. Usá "+ Personal" para agregar.
                                </td>
                            </tr>
                        )}
                        {personal.map((p, rowIdx) => {
                            const data = p[vista] || {};
                            return (
                                <React.Fragment key={p.legajo + rowIdx}>
                                <tr className="ps-row">
                                    <td className="ps-td-sticky ps-td-legajo">{p.legajo}</td>
                                    <td className="ps-td-sticky ps-td-nombre">{p.nombre}</td>
                                    <td className="ps-td-sticky ps-td-acciones">
                                        <button
                                            className="ps-btn-accion ps-btn-accion--patron"
                                            title="Asignar patrón"
                                            onClick={() => setPatronModal({ rowIdx })}
                                        >🗓</button><button
                                            className="ps-btn-accion ps-btn-accion--aus"
                                            title="Registrar ausentismo"
                                            onClick={() => setAusModal({ rowIdx })}
                                        >🏥</button>
                                    </td>
                                    {dias.map(d => {
                                        const key     = fmtKey(d);
                                        const val     = data[key] || "";
                                        const op      = OPCIONES.find(o => o.val === val);
                                        const fin     = d.getDay() === 0 || d.getDay() === 6;
                                        const trabaja = diasEsp[key];
                                        const hasRemp = AUS_CODES.includes(val) && p.reemplazos?.[key];
                                        return (
                                            <td
                                                key={key}
                                                className={[
                                                    "ps-celda",
                                                    op?.cls ? `ps-celda--${op.cls}` : "",
                                                    fin && !op?.cls && trabaja !== false ? "ps-celda--fin" : "",
                                                ].join(" ")}
                                                onClick={e => {
                                                    const r = e.currentTarget.getBoundingClientRect();
                                                    setPopup({ rowIdx, diaKey: key, top: r.bottom + 4, left: r.left, valorActual: val });
                                                }}
                                            >
                                                <CeldaContenido val={val} op={op} />
                                                {hasRemp && <span className="ps-remp-badge">R</span>}
                                            </td>
                                        );
                                    })}
                                    <td className="ps-td-hs">{horasFila(p) || "—"}</td>
                                    <td className="ps-td-del">
                                        <button className="ps-btn-del" onClick={() => quitarPersona(rowIdx)}>×</button>
                                    </td>
                                </tr>
                                {vista === "real" && (
                                    <tr key={`cap-${p.legajo}-${rowIdx}`} className="ps-row-cap">
                                        <td colSpan={3} className="ps-td-sticky ps-cap-label">Cap.</td>
                                        {dias.map(d => {
                                            const key = fmtKey(d);
                                            const val = p.capacitacion?.[key] ?? "";
                                            return (
                                                <td key={key} className="ps-cap-cel">
                                                    <input
                                                        type="number"
                                                        min={0} max={24} step={0.5}
                                                        className="ps-cap-input"
                                                        value={val === null ? "" : val}
                                                        onChange={e => setCap(rowIdx, key, e.target.value)}
                                                    />
                                                </td>
                                            );
                                        })}
                                        <td className="ps-cap-total">
                                            {(() => {
                                                const t = Math.round(dias.reduce((s, d) => s + (Number(p.capacitacion?.[fmtKey(d)]) || 0), 0) * 10) / 10;
                                                return t || "—";
                                            })()}
                                        </td>
                                        <td />
                                    </tr>
                                )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>

                    <tfoot>
                        <tr className="ps-tfoot">
                            <td colSpan={3} className="ps-tfoot-label">Hs. a cubrir</td>
                            {dias.map(d => {
                                const hs = horasDia(d);
                                return (
                                    <td key={fmtKey(d)} className={`ps-tfoot-cel ${hs == null ? "ps-tfoot-cel--sin" : ""}`}>
                                        {hs != null ? hs : "—"}
                                    </td>
                                );
                            })}
                            <td className="ps-tfoot-total" colSpan={2}>
                                {Math.round(dias.reduce((s, d) => s + (horasDia(d) ?? 0), 0) * 10) / 10} hs
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* ── Leyenda ── */}
            <div className="ps-leyenda">
                {OPCIONES.filter(o => o.cls).map(o => (
                    <span key={o.val} className={`ps-ley-chip ps-celda--${o.cls}`}>{o.label}</span>
                ))}
                <span className="ps-ley-note">· Click en una celda para asignar turno</span>
            </div>

            {/* ── Popup celda ── */}
            {popup && (
                <CeldaPopup
                    top={popup.top} left={popup.left}
                    valorActual={popup.valorActual || ""}
                    onSelect={val => setCelda(popup.rowIdx, popup.diaKey, val)}
                    onClose={() => setPopup(null)}
                />
            )}

            {/* ── Modal días no laborables ── */}
            {modalNoLab && diasNoLabNonHoliday.length > 0 && (
                <ModalNoLaborables
                    dias={diasNoLabNonHoliday}
                    onChange={sel => setDiasEsp(prev => ({ ...prev, ...sel }))}
                    onClose={() => setModalNoLab(false)}
                />
            )}

            {/* ── Modal patrón ── */}
            {patronModal && (
                <PatronModal
                    persona={personal[patronModal.rowIdx]}
                    dias={dias}
                    vista={vista}
                    onAplicar={patron => aplicarPatron(patronModal.rowIdx, patron)}
                    onClose={() => setPatronModal(null)}
                />
            )}

            {/* ── Modal ausentismo ── */}
            {ausModal && (
                <AusentismoModal
                    persona={personal[ausModal.rowIdx]}
                    dias={dias}
                    vista={vista}
                    todoElPersonal={todoElPersonal}
                    onAplicar={(edits, reemplazos) => aplicarAusentismo(ausModal.rowIdx, edits, reemplazos)}
                    onClose={() => setAusModal(null)}
                />
            )}

            {/* ── Modal agregar personal ── */}
            {modalAdd && (
                <div className="ps-overlay" onClick={() => { setModalAdd(false); setBusq(""); }}>
                    <div className="ps-modal" onClick={e => e.stopPropagation()}>
                        <div className="ps-modal-title">Agregar personal</div>
                        <input
                            className="ps-modal-busq"
                            placeholder="Buscar por nombre o legajo..."
                            value={busq}
                            onChange={e => setBusq(e.target.value)}
                            autoFocus
                        />
                        <div className="ps-modal-lista">
                            {vigFiltrados.length === 0 && (
                                <div className="ps-modal-empty">No hay más personal disponible</div>
                            )}
                            {vigFiltrados.map(v => (
                                <button key={v.id} className="ps-modal-item" onClick={() => agregarPersona(v)}>
                                    <span className="ps-modal-legajo">{v.legajo}</span>
                                    <span className="ps-modal-nombre">{v.nombre}</span>
                                </button>
                            ))}
                        </div>
                        <button className="ps-modal-cerrar" onClick={() => { setModalAdd(false); setBusq(""); }}>Cerrar</button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── ObjetivoEditableCard — tabla editable para un objetivo del período ────────────
function ObjetivoEditableCard({ docInicial, dias, modo = "programado", objetivos = [] }) {
    const { empresaNombre, empresaId } = useAppData();
    const [personal,      setPersonal]   = useState(() => {
        const base = docInicial.personal || [];
        // Si modo es "real", pre-cargar desde programado para personas sin datos reales
        if (modo !== "real") return base;
        return base.map(p => {
            const tieneReal = Object.keys(p.real || {}).length > 0;
            if (tieneReal) return p;
            return { ...p, real: { ...(p.programado || {}) } };
        });
    });
    const [popup,         setPopup]      = useState(null);
    const [guardando,     setGuardando]  = useState(false);
    const [guardado,      setGuardado]   = useState(false);
    const [modalAdd,      setModalAdd]   = useState(false);
    const [busqAdd,       setBusqAdd]    = useState("");
    const [todosLegajos,  setTodosLegajos] = useState([]);
    const [patronModal,   setPatronModal] = useState(null);
    const diasEsp = docInicial.diasEspeciales || {};

    // Cargar legajos cuando se abre el modal
    useEffect(() => {
        if (!modalAdd || todosLegajos.length > 0 || !empresaId) return;
        getDocs(query(collection(db, COL_LEGAJOS), where("empresaId", "==", empresaId)))
            .then(snap => {
                const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                data.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
                setTodosLegajos(data);
            })
            .catch(console.error);
    }, [modalAdd, empresaId, todosLegajos.length]);

    const agregarPersona = (v) => {
        if (personal.find(p => p.legajo === v.legajo)) return;
        setPersonal(prev => [...prev, { legajo: v.legajo || "", nombre: v.nombre || "", programado: {}, real: {}, reemplazos: {}, capacitacion: {} }]);
        setModalAdd(false); setBusqAdd("");
    };

    const eliminarPersona = (rowIdx) => {
        if (!window.confirm(`¿Quitar a ${personal[rowIdx]?.nombre} de esta planilla?`)) return;
        setPersonal(prev => prev.filter((_, i) => i !== rowIdx));
    };

    const aplicarPatron = (rowIdx, patron) => {
        setPersonal(prev => prev.map((p, i) =>
            i !== rowIdx ? p : { ...p, [modo]: { ...(p[modo] || {}), ...patron } }
        ));
    };

    const setCelda = (rowIdx, diaKey, val) => {
        setPersonal(prev => prev.map((p, i) =>
            i !== rowIdx ? p : { ...p, [modo]: { ...(p[modo] || {}), [diaKey]: val } }
        ));
        setPopup(null);
    };

    const setCap = (rowIdx, diaKey, val) => {
        setPersonal(prev => prev.map((p, i) =>
            i !== rowIdx ? p : { ...p, capacitacion: { ...(p.capacitacion || {}), [diaKey]: val === "" ? null : Number(val) } }
        ));
    };

    const horasFila = (p) => {
        const data = p[modo] || {};
        return Math.round(dias.reduce((s, d) => s + horasDeValor(data[fmtKey(d)] || ""), 0) * 10) / 10;
    };

    const horasDiaDoc = (dia) => {
        const objFallback = objetivos.find(o => o.id === docInicial.objetivoId);
        const hc = docInicial.horasConfig || (objFallback ? {
            horasLunes:     objFallback.horasLunes     ?? null,
            horasMartes:    objFallback.horasMartes    ?? null,
            horasMiercoles: objFallback.horasMiercoles ?? null,
            horasJueves:    objFallback.horasJueves    ?? null,
            horasViernes:   objFallback.horasViernes   ?? null,
            horasSabado:    objFallback.horasSabado    ?? null,
            horasDomingo:   objFallback.horasDomingo   ?? null,
            horasFeriados:  objFallback.horasFeriados  ?? null,
        } : null);
        if (!hc) return null;
        const key = fmtKey(dia);
        if (FERIADOS_ARG[key]) return hc.horasFeriados != null ? Number(hc.horasFeriados) : null;
        if (diasEsp[key] === false) return 0;
        const hs = hc[HORAS_KEYS[dia.getDay()]];
        return hs != null ? Number(hs) : null;
    };

    const guardar = async () => {
        setGuardando(true);
        try {
            const ref = doc(db, "programacionServicios", docInicial.docId);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                await setDoc(ref, {
                    ...snap.data(),
                    empresaId: snap.data().empresaId || empresaId,
                    personal,
                    actualizadoEn: serverTimestamp(),
                });
            }
            setGuardado(true);
            setTimeout(() => setGuardado(false), 2500);
        } catch (e) { alert("Error al guardar: " + e.message); }
        finally { setGuardando(false); }
    };

    return (
        <div className="ps-vt-objetivo">
            <div className="ps-vt-obj-header">
                <span className="ps-vt-obj-nombre">
                    {docInicial.objetivoCodigo && <span className="ps-vt-obj-codigo">[{docInicial.objetivoCodigo}]</span>}
                    {[docInicial.clienteNombre, docInicial.proyectoNombre, docInicial.objetivoNombre].filter(Boolean).join(" · ")}
                </span>
                <span className="ps-vt-obj-count">{personal.length} personas</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <button className="ps-todos-btn-nueva" onClick={() => setModalAdd(true)}>
                        ➕ Agregar
                    </button>
                    <button
                        className="ps-vt-dl-btn"
                        style={{ background: guardado ? "#16a34a" : "#1e40af", color: "#fff" }}
                        disabled={guardando}
                        onClick={guardar}
                    >
                        {guardado ? "✓ Guardado" : guardando ? "..." : "💾 Guardar"}
                    </button>
                </div>
            </div>

            <div className="ps-vt-tabla-wrap" style={{ position: "relative" }}>
                        <table className="ps-table">
                            <thead>
                                <tr>
                                    <th className="ps-th-sticky ps-th-legajo">Leg.</th>
                                    <th className="ps-th-sticky ps-th-nombre">Nombre y Apellido</th>
                                    {dias.map(dia => {
                                        const key = fmtKey(dia);
                                        const fin = dia.getDay() === 0 || dia.getDay() === 6;
                                        const ferNombre = FERIADOS_ARG[key];
                                        const trabaja = diasEsp[key];
                                        return (
                                            <th key={key}
                                                className={["ps-th-dia",
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
                                    <th className="ps-th-hs">Hs</th>
                                </tr>
                            </thead>
                            <tbody>
                                {personal.length === 0 && (
                                    <tr><td colSpan={dias.length + 2} className="ps-vt-obj-empty">Sin personal asignado</td></tr>
                                )}
                                {personal.map((p, rowIdx) => {
                                    const data = p[modo] || {};
                                    return (
                                        <React.Fragment key={p.legajo + rowIdx}>
                                            <tr className="ps-row">
                                                <td className="ps-td-sticky ps-td-legajo">{p.legajo}</td>
                                                <td className="ps-td-sticky ps-td-nombre">
                                                    <button className="ps-btn-del-inline" title="Quitar" onClick={() => eliminarPersona(rowIdx)}>✕</button>
                                                    {p.nombre}
                                                    <button className="ps-btn-patron-inline" title="Asignar patrón" onClick={() => setPatronModal({ rowIdx })}>🗓</button>
                                                </td>
                                                {dias.map(dia => {
                                                    const key = fmtKey(dia);
                                                    const val = data[key] || "";
                                                    const op  = OPCIONES.find(o => o.val === val);
                                                    const fin = dia.getDay() === 0 || dia.getDay() === 6;
                                                    const trabaja = diasEsp[key];
                                                    return (
                                                        <td key={key}
                                                            className={["ps-celda",
                                                                op?.cls ? `ps-celda--${op.cls}` : "",
                                                                fin && !op?.cls && trabaja !== false ? "ps-celda--fin" : "",
                                                            ].join(" ")}
                                                            onClick={e => {
                                                                const r = e.currentTarget.getBoundingClientRect();
                                                                setPopup({ rowIdx, diaKey: key, top: r.bottom + 4, left: r.left, valorActual: val });
                                                            }}
                                                        >
                                                            <CeldaContenido val={val} op={op} />
                                                        </td>
                                                    );
                                                })}
                                                <td className="ps-td-hs">{horasFila(p) || "—"}</td>
                                            </tr>
                                            {modo === "real" && (
                                                <tr className="ps-row-cap">
                                                    <td colSpan={2} className="ps-td-sticky ps-cap-label">Cap.</td>
                                                    {dias.map(d => {
                                                        const key = fmtKey(d);
                                                        const val = p.capacitacion?.[key] ?? "";
                                                        return (
                                                            <td key={key} className="ps-cap-cel">
                                                                <input type="number" min={0} max={24} step={0.5}
                                                                    className="ps-cap-input"
                                                                    value={val === null ? "" : val}
                                                                    onChange={e => setCap(rowIdx, key, e.target.value)}
                                                                />
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="ps-cap-total">
                                                        {(() => { const t = Math.round(dias.reduce((s, d) => s + (Number(p.capacitacion?.[fmtKey(d)]) || 0), 0) * 10) / 10; return t || "—"; })()}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="ps-tfoot">
                                    <td colSpan={2} className="ps-tfoot-label">Hs. a cubrir</td>
                                    {dias.map(dia => {
                                        const hs = horasDiaDoc(dia);
                                        return (
                                            <td key={fmtKey(dia)} className={`ps-tfoot-cel ${hs == null ? "ps-tfoot-cel--sin" : ""}`}>
                                                {hs != null ? hs : "—"}
                                            </td>
                                        );
                                    })}
                                    <td className="ps-tfoot-total">
                                        {Math.round(dias.reduce((s, d) => s + (horasDiaDoc(d) ?? 0), 0) * 10) / 10} hs
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                        {popup && (
                            <CeldaPopup
                                top={popup.top} left={popup.left}
                                valorActual={popup.valorActual || ""}
                                onSelect={val => setCelda(popup.rowIdx, popup.diaKey, val)}
                                onClose={() => setPopup(null)}
                            />
                        )}
            </div>

            {/* ── Modal patrón ── */}
            {patronModal && (
                <PatronModal
                    persona={personal[patronModal.rowIdx]}
                    dias={dias}
                    vista={modo}
                    onAplicar={patron => { aplicarPatron(patronModal.rowIdx, patron); setPatronModal(null); }}
                    onClose={() => setPatronModal(null)}
                />
            )}

            {/* ── Modal agregar vigilador ── */}
            {modalAdd && (
                <div className="ps-overlay" onClick={() => { setModalAdd(false); setBusqAdd(""); }}>
                    <div className="ps-modal ps-modal--nueva" onClick={e => e.stopPropagation()}>
                        <div className="ps-modal-title">➕ Agregar vigilador</div>
                        <input
                            className="ps-modal-busq"
                            placeholder="Buscar por nombre o legajo…"
                            value={busqAdd}
                            onChange={e => setBusqAdd(e.target.value)}
                            autoFocus
                        />
                        <div className="ps-modal-lista">
                            {todosLegajos
                                .filter(v => {
                                    if (personal.find(p => p.legajo === v.legajo)) return false;
                                    const q = busqAdd.toLowerCase();
                                    return !q || (v.nombre || "").toLowerCase().includes(q) || String(v.legajo).includes(q);
                                })
                                .map(v => (
                                    <button key={v.id} className="ps-modal-item" onClick={() => agregarPersona(v)}>
                                        <span className="ps-modal-legajo">{v.legajo}</span>
                                        <span className="ps-modal-nombre">{v.nombre}</span>
                                    </button>
                                ))
                            }
                        </div>
                        <div className="ps-modal-actions">
                            <button className="ps-btn-secundario" onClick={() => { setModalAdd(false); setBusqAdd(""); }}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Programación — todos los objetivos del período, editables ─────────────────────
export function ProgramacionTodos({ año, mes, modo = "programado" }) {
    const { empresaNombre, empresaId } = useAppData();
    const { clientes, objetivos } = useClientesData(empresaId);
    const [docs,        setDocs]        = useState([]);
    const [cargando,    setCargando]    = useState(false);
    const [modalNueva,  setModalNueva]  = useState(false);
    const [clienteId,   setClienteId]   = useState("");
    const [objetivoId,  setObjetivoId]  = useState("");
    const [creando,     setCreando]     = useState(false);

    const cargar = () => {
        if (!empresaId) return;
        setCargando(true);
        getDocs(query(
            collection(db, COL_PROG),
            where("empresaId", "==", empresaId),
            where("año", "==", año),
            where("mes", "==", mes)
        ))
            .then(snap => {
                const data = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
                data.sort((a, b) => (a.clienteNombre || "").localeCompare(b.clienteNombre || ""));
                setDocs(data);
            })
            .catch(console.error)
            .finally(() => setCargando(false));
    };

    useEffect(cargar, [empresaNombre, año, mes]);

    const dias = getDias(año, mes);

    const clienteSel   = clientes.find(c => c.id === clienteId);
    const objFiltrados = !clienteId ? [] : objetivos.filter(o => {
        if (!clienteSel) return false;
        const cn  = clienteSel.nombre.toLowerCase().trim();
        const oid = String(o.clienteId ?? "").toLowerCase().trim();
        const onm = String(o.clienteNombre ?? o.nombreProyecto ?? "").toLowerCase().trim();
        return o.clienteId === clienteId   // ID Firestore exacto
            || oid === cn                  // clienteId guarda el nombre exacto del cliente
            || onm === cn;                 // clienteNombre / nombreProyecto exacto
    });
    const objSel       = objetivos.find(o => o.id === objetivoId);

    const crearPlanilla = async () => {
        if (!clienteId || !objetivoId) return;
        setCreando(true);
        try {
            const docId = `${empresaNombre}_${clienteId}_${objetivoId}_${año}-${String(mes).padStart(2,"0")}`;
            await setDoc(doc(db, "programacionServicios", docId), {
                empresa:        empresaNombre,
                empresaId,
                clienteId,
                clienteNombre:  clienteSel?.nombre || "",
                objetivoId,
                objetivoCodigo: objSel?.codigo     || "",
                objetivoNombre: objSel?.nombre     || "",
                proyectoNombre: objSel?.proyecto   || "",
                año, mes,
                personal:       [],
                diasEspeciales: {},
                horasConfig: {
                    horasLunes:     objSel?.horasLunes     ?? null,
                    horasMartes:    objSel?.horasMartes    ?? null,
                    horasMiercoles: objSel?.horasMiercoles ?? null,
                    horasJueves:    objSel?.horasJueves    ?? null,
                    horasViernes:   objSel?.horasViernes   ?? null,
                    horasSabado:    objSel?.horasSabado    ?? null,
                    horasDomingo:   objSel?.horasDomingo   ?? null,
                    horasFeriados:  objSel?.horasFeriados  ?? null,
                },
                actualizadoEn:  serverTimestamp(),
            }, { merge: true });
            setModalNueva(false);
            setClienteId(""); setObjetivoId("");
            cargar();
        } catch (e) { alert("Error: " + e.message); }
        finally { setCreando(false); }
    };

    const tituloModo = modo === "programado" ? "Programación de Objetivos" : "Horarios Trabajados";

    return (
        <div className="ps-vt-root">
            {/* ── Barra superior con botón nueva planilla ── */}
            <div className="ps-todos-bar">
                <span className="ps-todos-titulo">{tituloModo}</span>
                <button className="ps-todos-btn-nueva" onClick={() => setModalNueva(true)}>
                    ➕ Nueva planilla
                </button>
            </div>

            <div className="ps-vt-body">
                {cargando && <div className="ps-loading">Cargando planillas...</div>}
                {!cargando && docs.length === 0 && (
                    <div className="ps-vt-empty">No hay planillas para este período. Agregá una con "Nueva planilla".</div>
                )}
                {!cargando && docs.map(d => (
                    <ObjetivoEditableCard key={d.docId} docInicial={d} dias={dias} modo={modo} objetivos={objetivos} />
                ))}
            </div>

            {/* ── Modal nueva planilla ── */}
            {modalNueva && (
                <div className="ps-overlay" onClick={() => setModalNueva(false)}>
                    <div className="ps-modal ps-modal--nueva" onClick={e => e.stopPropagation()}>
                        <div className="ps-modal-title">➕ Nueva planilla</div>

                        <div className="ps-field">
                            <label className="ps-label">Cliente</label>
                            <select className="ps-select" value={clienteId}
                                onChange={e => { setClienteId(e.target.value); setObjetivoId(""); }}>
                                <option value="">— Seleccionar cliente —</option>
                                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </div>

                        <div className="ps-field">
                            <label className="ps-label">Objetivo / Servicio</label>
                            <select className="ps-select" value={objetivoId}
                                onChange={e => setObjetivoId(e.target.value)}
                                disabled={!clienteId}>
                                <option value="">— Seleccionar objetivo —</option>
                                {objFiltrados.map(o => (
                                    <option key={o.id} value={o.id}>
                                        {fmtObjetivo(o)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="ps-modal-actions">
                            <button className="ps-btn-secundario" onClick={() => setModalNueva(false)}>Cancelar</button>
                            <button className="ps-btn-abrir" disabled={!clienteId || !objetivoId || creando}
                                onClick={crearPlanilla}>
                                {creando ? "Creando…" : "Crear planilla"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Vista de Turnos (solo lectura, todos los objetivos del período) ───────────────
export function VistaTurnos({ año, mes, zonaFija = null }) {
    const { empresaNombre, empresaId } = useAppData();
    const [docs, setDocs] = useState([]);
    const [cargando, setCargando] = useState(false);

    useEffect(() => {
        if (!empresaId) return;
        setCargando(true);
        getDocs(query(
            collection(db, COL_PROG),
            where("empresaId", "==", empresaId),
            where("año", "==", año),
            where("mes", "==", mes)
        ))
            .then(snap => {
                let data = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
                if (zonaFija) data = data.filter(d => !d.zona || d.zona === zonaFija);
                data.sort((a, b) => (a.clienteNombre || "").localeCompare(b.clienteNombre || ""));
                setDocs(data);
            })
            .catch(console.error)
            .finally(() => setCargando(false));
    }, [empresaId, año, mes, zonaFija]);

    const dias = getDias(año, mes);
    const mesAnterior = mes === 1 ? 12 : mes - 1;
    const añoAnterior = mes === 1 ? año - 1 : año;

    const [descargando, setDescargando] = useState(false);

    // ── Helpers de descarga ───────────────────────────────────────────────────
    const capturar = async (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        return html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    };

    // Agrega 3 cm de margen lateral (en canvas units) a ambos lados
    const conMargenes = (canvas) => {
        const DPI = 96;
        const CM_TO_PX = DPI / 2.54;
        const margen = Math.round(3 * CM_TO_PX * 2); // ×2 por scale:2
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
            const raw = await capturar(`vt-obj-${docId}`);
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
                    const raw = await capturar(`vt-obj-${d.docId}`);
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
                    const raw = await capturar(`vt-obj-${d.docId}`);
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
                if (pdf) pdf.save(`Turnos ${MESES_ES[mes - 1]} ${año}.pdf`);
            }
        } finally { setDescargando(false); }
    };

    // Calcula hs a cubrir para un día dado el horasConfig guardado en el doc
    const horasDiaDoc = (dia, hc, diasEsp) => {
        if (!hc) return null;
        const key = fmtKey(dia);
        if (FERIADOS_ARG[key]) return hc.horasFeriados != null ? Number(hc.horasFeriados) : null;
        if (diasEsp[key] === false) return 0;
        const hs = hc[HORAS_KEYS[dia.getDay()]];
        return hs != null ? Number(hs) : null;
    };

    return (
        <div className="ps-vt-root">
            <div className="ps-vt-header">
                <span className="ps-vt-title">Vista de Turnos</span>
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

            <div className="ps-vt-body">
                {cargando && <div className="ps-loading">Cargando turnos...</div>}
                {!cargando && docs.length === 0 && (
                    <div className="ps-vt-empty">No hay planillas programadas para este período.</div>
                )}
                {!cargando && docs.map(d => {
                    const hc      = d.horasConfig || null;
                    const diasEsp = d.diasEspeciales || {};
                    return (
                        <div key={d.docId} className="ps-vt-objetivo" id={`vt-obj-${d.docId}`}>
                            <div className="ps-vt-obj-header">
                                <span className="ps-vt-obj-nombre">
                                    {d.objetivoCodigo && <span className="ps-vt-obj-codigo">[{d.objetivoCodigo}]</span>}
                                    {[d.clienteNombre, d.proyectoNombre, d.objetivoNombre].filter(Boolean).join(" · ")}
                                </span>
                                <span className="ps-vt-obj-count">{(d.personal || []).length} personas</span>
                                <div className="ps-vt-obj-dl">
                                    <button className="ps-vt-dl-btn ps-vt-dl-btn--jpg" disabled={descargando}
                                        onClick={() => descargarUno(d.docId, nombreArchivo(d), "jpg")}>⬇ JPG</button>
                                    <button className="ps-vt-dl-btn ps-vt-dl-btn--pdf" disabled={descargando}
                                        onClick={() => descargarUno(d.docId, nombreArchivo(d), "pdf")}>⬇ PDF</button>
                                </div>
                            </div>
                            {(d.personal || []).length === 0
                                ? <div className="ps-vt-obj-empty">Sin personal asignado</div>
                                : (
                                    <div className="ps-vt-tabla-wrap">
                                        <table className="ps-table ps-vt-table">
                                            <thead>
                                                <tr>
                                                    <th className="ps-th-sticky ps-th-legajo">Leg.</th>
                                                    <th className="ps-th-sticky ps-th-nombre">Nombre y Apellido</th>
                                                    {dias.map(dia => {
                                                        const key      = fmtKey(dia);
                                                        const fin      = dia.getDay() === 0 || dia.getDay() === 6;
                                                        const ferNombre = FERIADOS_ARG[key];
                                                        const trabaja  = diasEsp[key];
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
                                                    <th className="ps-th-hs">Hs</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(d.personal || []).map((p, i) => {
                                                    const data = p.programado || {};
                                                    const hs = Math.round(dias.reduce((s, d) => s + horasDeValor(data[fmtKey(d)] || ""), 0) * 10) / 10;
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
                                                            <td className="ps-td-hs">{hs || "—"}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot>
                                                <tr className="ps-tfoot">
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
                                                        {Math.round(dias.reduce((s, dia) => s + (horasDiaDoc(dia, hc, diasEsp) ?? 0), 0) * 10) / 10} hs
                                                    </td>
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

// ── Export principal ─────────────────────────────────────────────────────────────
export default function ProgramacionServiciosScreen({ onBack }) {
    const [config, setConfig] = useState(null);

    if (config) return <GrillaServicio config={config} onBack={() => setConfig(null)} />;

    return (
        <div className="ps-root">
            <button className="ps-back ps-back--panel" onClick={onBack}>← Panel</button>
            <SelectorServicio onSelect={setConfig} />
        </div>
    );
}
