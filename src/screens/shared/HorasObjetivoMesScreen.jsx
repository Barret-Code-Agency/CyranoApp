// src/screens/shared/HorasObjetivoMesScreen.jsx
// Tabla de horas contratadas por objetivo × día — editable inline, día a día independiente
// Mes calendario completo (1-31):
//   Días  1-23 → período A (año/mes)    → horasObjetivoMes/{empresaId}_{oid}_{YYYY-MM}
//   Días 24-31 → período B (año/mes+1)  → horasObjetivoMes/{empresaId}_{oid}_{YYYY-MM+1}
// Formato guardado: { empresaId, objetivoId, año, mes, dias: { "YYYY-MM-DD": value } }
// Si no hay override del mes actual se pre-carga el patrón del mes anterior (moda por día de semana).

import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAppData }      from "../../context/AppDataContext";
import { useClientesData } from "../../hooks/useClientesData";
import { getDiasCalendario, fmtKey, MESES_ES, HORAS_KEYS, DIAS_ES } from "../../utils/periodoUtils";
import { FERIADOS_ARG } from "../../utils/feriados";
import "./HorasObjetivoMesScreen.css";

const COL_PROG    = "programacionServicios";
const COL_OVERRID = "horasObjetivoMes";

// ── Helpers de período ────────────────────────────────────────────────────────
const esB = (dia) => dia.getDate() >= 24;

function periodoAnterior(año, mes) {
    return mes === 1 ? { año: año - 1, mes: 12 } : { año, mes: mes - 1 };
}
function periodoSiguiente(año, mes) {
    return mes === 12 ? { año: año + 1, mes: 1 } : { año, mes: mes + 1 };
}

function fmtHs(n) {
    if (n == null) return "";
    if (n === 0)   return "0";
    return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

// Valor por defecto para un día según el doc fuente (campos horasLunes, etc.)
function defaultHorasDia(dia, src) {
    if (!src) return null;
    const key = fmtKey(dia);
    if (FERIADOS_ARG[key]) return src.horasFeriados != null ? Number(src.horasFeriados) : null;
    const hs = src[HORAS_KEYS[dia.getDay()]];
    return hs != null ? Number(hs) : null;
}

// Inicializa { "YYYY-MM-DD": value|null } para los días del período.
// Prioridad: overrideDoc (nuevo o viejo) → si la fecha no está en el dias map,
//            rellena con la moda DOW del mismo override (p.ej. período compartido) → fallback
function stateFromDocs(overrideDoc, fallback, diasPeriodo) {
    const result = {};

    // Si el override usa formato nuevo, calcular patrón DOW para rellenar fechas ausentes
    let gapPattern = null;
    if (overrideDoc?.dias && Object.keys(overrideDoc.dias).length > 0) {
        gapPattern = extractDowPattern(overrideDoc.dias, {});
    }

    diasPeriodo.forEach(dia => {
        const key = fmtKey(dia);
        if (overrideDoc?.dias) {
            if (key in overrideDoc.dias) {
                result[key] = overrideDoc.dias[key];
            } else if (gapPattern) {
                // Fecha no guardada aún → extrapola desde la moda del mismo período
                const v = FERIADOS_ARG[key]
                    ? (gapPattern.fer != null ? Number(gapPattern.fer) : null)
                    : (gapPattern[dia.getDay()] != null ? Number(gapPattern[dia.getDay()]) : null);
                result[key] = fallback?.[key] ?? v;
            } else {
                result[key] = fallback?.[key] ?? null;
            }
        } else if (overrideDoc) {
            // Formato viejo (horasLunes, etc.)
            result[key] = defaultHorasDia(dia, overrideDoc);
        } else {
            result[key] = fallback?.[key] ?? null;
        }
    });
    return result;
}

// Extrae la moda de valor por día de semana desde un mapa { "YYYY-MM-DD": value }.
// Devuelve { 0..6: val, fer: val } — para aplicar como patrón al mes siguiente.
function extractDowPattern(diasMapA, diasMapB) {
    const byDow = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    let ferVals = [];
    const combined = { ...(diasMapA || {}), ...(diasMapB || {}) };
    Object.entries(combined).forEach(([key, val]) => {
        if (val == null) return;
        // Parsear la fecha sin zona horaria
        const [y, m, d] = key.split("-").map(Number);
        const dia = new Date(y, m - 1, d);
        if (FERIADOS_ARG[key]) { ferVals.push(val); return; }
        byDow[dia.getDay()].push(val);
    });
    const pattern = {};
    for (let dow = 0; dow <= 6; dow++) {
        const vals = byDow[dow];
        if (!vals.length) { pattern[dow] = null; continue; }
        const freq = {};
        let maxF = 0, mode = vals[0];
        vals.forEach(v => { freq[v] = (freq[v] || 0) + 1; if (freq[v] > maxF) { maxF = freq[v]; mode = v; } });
        pattern[dow] = mode;
    }
    pattern.fer = ferVals.length
        ? ferVals.reduce((a, b, _, arr) => {
              const f = {}; arr.forEach(v => { f[v] = (f[v] || 0) + 1; });
              return Object.entries(f).sort((x, y) => y[1] - x[1])[0][0];
          }, ferVals[0])
        : null;
    return pattern;
}

// Aplica un patrón DOW a un array de días → { "YYYY-MM-DD": value|null }
function stateFromDowPattern(pattern, diasPeriodo, diasEsp) {
    const result = {};
    diasPeriodo.forEach(dia => {
        const key = fmtKey(dia);
        if (diasEsp?.[key] === false) { result[key] = 0; return; }
        if (FERIADOS_ARG[key]) { result[key] = pattern.fer != null ? Number(pattern.fer) : null; return; }
        const v = pattern[dia.getDay()];
        result[key] = v != null ? Number(v) : null;
    });
    return result;
}

// Solo guarda los valores no-nulos
function stateToFirestore(diasMap, empresaId, objetivoId, año, mes) {
    const dias = {};
    Object.entries(diasMap).forEach(([k, v]) => { if (v != null) dias[k] = v; });
    return { empresaId, objetivoId, año, mes, dias };
}

// ── Celda editable ────────────────────────────────────────────────────────────
function CeldaEditable({ value, onChange, deshabilitada, feriado, finde }) {
    const [editing, setEditing] = useState(false);
    const [local, setLocal]     = useState("");

    if (deshabilitada) return <span className="hom-celda-cero">0</span>;

    if (editing) return (
        <input
            className="hom-celda-input"
            type="number" min={0} max={24} step={0.5}
            autoFocus value={local}
            onChange={e => setLocal(e.target.value)}
            onBlur={() => { onChange(local === "" ? null : Number(local)); setEditing(false); }}
            onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditing(false); }}
        />
    );

    return (
        <span
            className={`hom-celda-val${value == null ? " hom-cero" : ""}${feriado ? " hom-celda-fer" : ""}${finde ? " hom-celda-finde" : ""}`}
            onClick={() => { setLocal(value != null ? String(value) : ""); setEditing(true); }}
            title="Click para editar"
        >
            {value != null ? fmtHs(value) : "—"}
        </span>
    );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function HorasObjetivoMesScreen({ año, mes, onBack }) {
    const { empresaId } = useAppData();
    const { objetivos, clientes, cargando: cargandoCatalogo } = useClientesData(empresaId);

    // Período B (días 24-31 del mes calendario)
    const { año: añoB, mes: mesB } = periodoSiguiente(año, mes);
    // Período anterior al mes calendario
    const { año: añoPrev, mes: mesPrev } = periodoAnterior(año, mes);
    const { año: añoPrevB, mes: mesPrevB } = periodoSiguiente(añoPrev, mesPrev);

    const periodoKeyA = `${año}-${String(mes).padStart(2, "0")}`;
    const periodoKeyB = `${añoB}-${String(mesB).padStart(2, "0")}`;

    const [docs,       setDocs]       = useState([]);
    const [cargando,   setCargando]   = useState(false);
    const [guardando,  setGuardando]  = useState(false);
    const [guardadoOk, setGuardadoOk] = useState(false);
    const [errorGuard, setErrorGuard] = useState("");

    // Estado por fecha: { oid → { "YYYY-MM-DD": value|null } }
    const [editStateA, setEditStateA] = useState({});
    const [editStateB, setEditStateB] = useState({});
    const [dirtyA,     setDirtyA]     = useState(new Set());
    const [dirtyB,     setDirtyB]     = useState(new Set());

    // Patrones del mes anterior por objetivo
    const [prevPatternsA, setPrevPatternsA] = useState({});  // oid → { "YYYY-MM-DD": val } para diasA
    const [prevPatternsB, setPrevPatternsB] = useState({});  // oid → { "YYYY-MM-DD": val } para diasB
    const [tienePrev,     setTienePrev]     = useState(false);

    // Dias maps existentes en Firestore (para mergear al guardar y no pisar fechas de otro mes)
    const [existingDiasA, setExistingDiasA] = useState({});  // oid → dias existentes en período A
    const [existingDiasB, setExistingDiasB] = useState({});  // oid → dias existentes en período B

    const dias  = useMemo(() => getDiasCalendario(año, mes), [año, mes]);
    const diasA = useMemo(() => dias.filter(d => !esB(d)), [dias]);
    const diasB = useMemo(() => dias.filter(d =>  esB(d)), [dias]);

    const objMap = useMemo(() => {
        const m = {};
        objetivos.forEach(o => { if (o.id) m[o.id] = o; });
        return m;
    }, [objetivos]);

    // Indexado por doc ID Y por nombre normalizado para cubrir clientes creados con addDoc (ID aleatorio)
    const clienteMap = useMemo(() => {
        const m = {};
        clientes.forEach(c => {
            if (c.id)     m[c.id] = c;
            if (c.nombre) m[c.nombre.toLowerCase().trim()] = c;
        });
        return m;
    }, [clientes]);

    useEffect(() => {
        // Esperar a que el catálogo de objetivos y clientes esté listo antes de correr los queries
        if (!empresaId || cargandoCatalogo) return;
        setCargando(true);
        setDirtyA(new Set());
        setDirtyB(new Set());
        setGuardadoOk(false);

        Promise.all([
            // Planillas período A y B (para saber qué objetivos hay)
            getDocs(query(collection(db, COL_PROG), where("empresaId","==",empresaId), where("año","==",año), where("mes","==",mes))),
            getDocs(query(collection(db, COL_PROG), where("empresaId","==",empresaId), where("año","==",añoB), where("mes","==",mesB))),
            // Overrides período actual A y B
            getDocs(query(collection(db, COL_OVERRID), where("empresaId","==",empresaId), where("año","==",año), where("mes","==",mes))),
            getDocs(query(collection(db, COL_OVERRID), where("empresaId","==",empresaId), where("año","==",añoB), where("mes","==",mesB))),
            // Overrides mes anterior A y B
            getDocs(query(collection(db, COL_OVERRID), where("empresaId","==",empresaId), where("año","==",añoPrev), where("mes","==",mesPrev))),
            getDocs(query(collection(db, COL_OVERRID), where("empresaId","==",empresaId), where("año","==",añoPrevB), where("mes","==",mesPrevB))),
        ])
            .then(([progSnapA, progSnapB, overSnapA, overSnapB, prevSnapA, prevSnapB]) => {
                // Objetivos presentes en las planillas
                const docsA = {}, docsB = {};
                progSnapA.docs.forEach(d => { const dat = d.data(); if (dat.objetivoId) docsA[dat.objetivoId] = dat; });
                progSnapB.docs.forEach(d => { const dat = d.data(); if (dat.objetivoId) docsB[dat.objetivoId] = dat; });
                const allOids = new Set([...Object.keys(docsA), ...Object.keys(docsB)]);

                // Incluir TODOS los objetivos del catálogo aunque no tengan planilla cargada todavía
                // (ej: Santa Cruz cuando aún no se importó la programación del mes)
                Object.keys(objMap).forEach(oid => allOids.add(oid));

                let merged = [...allOids].map(oid => {
                    const base   = docsA[oid] || docsB[oid];
                    const catObj = objMap[oid];
                    // Cliente: resolver en orden de confiabilidad
                    // 1. clientes collection (lookup por clienteId) — fuente más confiable
                    // 2. clienteNombre en el catálogo de objetivos (seteado por seed)
                    // 3. vacío
                    const clienteId = catObj?.clienteId || base?.clienteId || "";
                    const clienteNombre =
                        clienteMap[clienteId]?.nombre ||
                        catObj?.clienteNombre ||
                        base?.clienteNombre ||
                        "";
                    // Objetivo: código + proyecto + nombre (ej: "217-1-2 BSC Administracion Sur")
                    const objetivoNombre = [
                        catObj?.codigo,
                        catObj?.proyecto,
                        catObj?.nombre,
                    ].filter(Boolean).join(" ") ||
                        base?.objetivoNombre || "";
                    return {
                        objetivoId: oid,
                        clienteNombre,
                        objetivoNombre,
                        diasEspA: docsA[oid]?.diasEspeciales || {},
                        diasEspB: docsB[oid]?.diasEspeciales || {},
                    };
                });
                merged.sort((a, b) =>
                    a.clienteNombre.localeCompare(b.clienteNombre) ||
                    a.objetivoNombre.localeCompare(b.objetivoNombre)
                );
                setDocs(merged);

                // Overrides actuales
                const overMapA = {}, overMapB = {};
                const existA = {}, existB = {};
                overSnapA.docs.forEach(d => {
                    const od = d.data();
                    if (od.objetivoId) {
                        overMapA[od.objetivoId] = od;
                        if (od.dias) existA[od.objetivoId] = od.dias;
                    }
                });
                overSnapB.docs.forEach(d => {
                    const od = d.data();
                    if (od.objetivoId) {
                        overMapB[od.objetivoId] = od;
                        if (od.dias) existB[od.objetivoId] = od.dias;
                    }
                });
                setExistingDiasA(existA);
                setExistingDiasB(existB);

                // Overrides mes anterior
                const prevMapA = {}, prevMapB = {};
                prevSnapA.docs.forEach(d => { const od = d.data(); if (od.objetivoId) prevMapA[od.objetivoId] = od; });
                prevSnapB.docs.forEach(d => { const od = d.data(); if (od.objetivoId) prevMapB[od.objetivoId] = od; });

                const hayDatosPrev = prevSnapA.size > 0 || prevSnapB.size > 0;
                setTienePrev(hayDatosPrev);

                // Calcular patrones del mes anterior por objetivo
                const pattA = {}, pattB = {};
                allOids.forEach(oid => {
                    const prevDocA = prevMapA[oid];
                    const prevDocB = prevMapB[oid];
                    const hasPrevData = prevDocA || prevDocB;
                    if (!hasPrevData) return;

                    const prevDiasMapA = prevDocA?.dias || {};
                    const prevDiasMapB = prevDocB?.dias || {};
                    const pattern = extractDowPattern(prevDiasMapA, prevDiasMapB);

                    const docInfo = merged.find(m => m.objetivoId === oid);
                    pattA[oid] = stateFromDowPattern(pattern, diasA, docInfo?.diasEspA || {});
                    pattB[oid] = stateFromDowPattern(pattern, diasB, docInfo?.diasEspB || {});
                });
                setPrevPatternsA(pattA);
                setPrevPatternsB(pattB);

                // Inicializar estado actual
                const initA = {}, initB = {};
                const objMapLocal = {};
                objetivos.forEach(o => { if (o.id) objMapLocal[o.id] = o; });

                allOids.forEach(oid => {
                    const hasOverA = !!overMapA[oid];
                    const hasOverB = !!overMapB[oid];
                    const docInfo  = merged.find(m => m.objetivoId === oid);

                    // Período A: override actual → patrón mes anterior → default objetivo
                    initA[oid] = stateFromDocs(
                        overMapA[oid],
                        hasOverA ? null : pattA[oid],
                        diasA,
                    );
                    // Si no había override y hay patrón, usar el patrón directo
                    if (!hasOverA && pattA[oid]) {
                        initA[oid] = pattA[oid];
                    } else if (!hasOverA && !pattA[oid]) {
                        // Fallback a defaults del objetivo
                        const objDoc = objMapLocal[oid];
                        initA[oid] = {};
                        diasA.forEach(dia => {
                            const key = fmtKey(dia);
                            if (docInfo?.diasEspA[key] === false) { initA[oid][key] = 0; return; }
                            initA[oid][key] = defaultHorasDia(dia, objDoc);
                        });
                    }

                    // Período B: ídem
                    initB[oid] = stateFromDocs(overMapB[oid], null, diasB);
                    if (!hasOverB && pattB[oid]) {
                        initB[oid] = pattB[oid];
                    } else if (!hasOverB && !pattB[oid]) {
                        const objDoc = objMapLocal[oid];
                        initB[oid] = {};
                        diasB.forEach(dia => {
                            const key = fmtKey(dia);
                            if (docInfo?.diasEspB[key] === false) { initB[oid][key] = 0; return; }
                            initB[oid][key] = defaultHorasDia(dia, objDoc);
                        });
                    }
                });

                setEditStateA(initA);
                setEditStateB(initB);
            })
            .catch(console.error)
            .finally(() => setCargando(false));
    }, [empresaId, año, mes, cargandoCatalogo, objMap, clienteMap]); // eslint-disable-line react-hooks/exhaustive-deps

    // Aplica el patrón del mes anterior a todos los objetivos (sobrescribe el estado actual)
    const cargarMesAnterior = useCallback(() => {
        if (!Object.keys(prevPatternsA).length && !Object.keys(prevPatternsB).length) return;
        setEditStateA(prev => {
            const next = { ...prev };
            docs.forEach(d => {
                if (prevPatternsA[d.objetivoId]) next[d.objetivoId] = { ...prevPatternsA[d.objetivoId] };
            });
            return next;
        });
        setEditStateB(prev => {
            const next = { ...prev };
            docs.forEach(d => {
                if (prevPatternsB[d.objetivoId]) next[d.objetivoId] = { ...prevPatternsB[d.objetivoId] };
            });
            return next;
        });
        // Marcar todos como dirty para que se guarden
        setDirtyA(new Set(docs.map(d => d.objetivoId)));
        setDirtyB(new Set(docs.map(d => d.objetivoId)));
        setGuardadoOk(false);
    }, [docs, prevPatternsA, prevPatternsB]);

    const handleCellChange = (oid, dia) => (value) => {
        const key = fmtKey(dia);
        if (esB(dia)) {
            setEditStateB(prev => ({ ...prev, [oid]: { ...(prev[oid] || {}), [key]: value } }));
            setDirtyB(prev => new Set([...prev, oid]));
        } else {
            setEditStateA(prev => ({ ...prev, [oid]: { ...(prev[oid] || {}), [key]: value } }));
            setDirtyA(prev => new Set([...prev, oid]));
        }
        setGuardadoOk(false);
    };

    const handleGuardar = async () => {
        const totalDirty = dirtyA.size + dirtyB.size;
        if (!totalDirty) return;
        setGuardando(true);
        setErrorGuard("");
        try {
            const newExistA = { ...existingDiasA };
            const newExistB = { ...existingDiasB };

            for (const oid of dirtyA) {
                const docId   = `${empresaId}_${oid}_${periodoKeyA}`;
                const newDias = stateToFirestore(editStateA[oid] || {}, empresaId, oid, año, mes).dias;
                // Mergear: conservar fechas de otros meses dentro del mismo doc de período compartido
                const mergedDias = { ...(existingDiasA[oid] || {}), ...newDias };
                await setDoc(doc(db, COL_OVERRID, docId), { empresaId, objetivoId: oid, año, mes, dias: mergedDias });
                newExistA[oid] = mergedDias;
            }
            for (const oid of dirtyB) {
                const docId   = `${empresaId}_${oid}_${periodoKeyB}`;
                const newDias = stateToFirestore(editStateB[oid] || {}, empresaId, oid, añoB, mesB).dias;
                const mergedDias = { ...(existingDiasB[oid] || {}), ...newDias };
                await setDoc(doc(db, COL_OVERRID, docId), { empresaId, objetivoId: oid, año: añoB, mes: mesB, dias: mergedDias });
                newExistB[oid] = mergedDias;
            }

            setExistingDiasA(newExistA);
            setExistingDiasB(newExistB);
            setDirtyA(new Set());
            setDirtyB(new Set());
            setGuardadoOk(true);
            setTimeout(() => setGuardadoOk(false), 4000);
        } catch (e) {
            setErrorGuard("Error al guardar: " + e.message);
        } finally {
            setGuardando(false);
        }
    };

    const totalesDia = useMemo(() =>
        dias.map(dia => {
            const key = fmtKey(dia);
            return docs.reduce((s, d) => {
                const st      = esB(dia) ? editStateB[d.objetivoId] : editStateA[d.objetivoId];
                const diasEsp = esB(dia) ? d.diasEspB               : d.diasEspA;
                if (diasEsp[key] === false) return s;
                return s + (st?.[key] ?? 0);
            }, 0);
        }),
        [dias, docs, editStateA, editStateB]
    );

    const totalGeneral = totalesDia.reduce((s, h) => s + h, 0);
    const totalDirty   = dirtyA.size + dirtyB.size;

    if (cargando) return <div className="hom-cargando">Cargando…</div>;
    if (!docs.length) return <div className="hom-vacio">Sin datos para el período seleccionado.</div>;

    return (
        <div className="hom-root">
            <div className="hom-topbar">
                <span className="hom-topbar-info">
                    {MESES_ES[mes - 1]} {año}
                    &nbsp;·&nbsp;<strong>{docs.length}</strong> objetivo{docs.length !== 1 ? "s" : ""}
                    &nbsp;·&nbsp;total: <strong>{Math.round(totalGeneral).toLocaleString()} hs</strong>
                    {totalDirty > 0 && (
                        <span className="hom-dirty"> · {totalDirty} fila{totalDirty !== 1 ? "s" : ""} modificada{totalDirty !== 1 ? "s" : ""}</span>
                    )}
                </span>
                <div className="hom-topbar-actions">
                    {tienePrev && (
                        <button
                            className="hom-btn-prev"
                            onClick={cargarMesAnterior}
                            disabled={guardando}
                            title={`Cargar patrón de ${MESES_ES[mesPrev - 1]} ${añoPrev}`}>
                            ↩ {MESES_ES[mesPrev - 1]} {añoPrev}
                        </button>
                    )}
                    {errorGuard && <span className="hom-error-inline">⚠ {errorGuard}</span>}
                    {guardadoOk  && <span className="hom-ok-inline">✓ Guardado</span>}
                    <button
                        className="hom-btn-guardar"
                        onClick={handleGuardar}
                        disabled={guardando || !totalDirty}>
                        {guardando ? "Guardando…" : "💾 Guardar cambios"}
                    </button>
                </div>
            </div>

            <div className="hom-leyenda">
                <span className="hom-ley-finde">■</span> Fin de semana &nbsp;
                <span className="hom-ley-fer">■</span> Feriado &nbsp;
                <span className="hom-ley-edit">Click en celda para editar — cada día es independiente</span>
            </div>

            <div className="hom-tabla-scroll">
                <table className="hom-tabla">
                    <thead>
                        <tr>
                            <th className="hom-th hom-th-cliente">Cliente</th>
                            <th className="hom-th hom-th-obj">Objetivo</th>
                            {dias.map((dia, i) => {
                                const key      = fmtKey(dia);
                                const esFer    = !!FERIADOS_ARG[key];
                                const dow      = dia.getDay();
                                const esFin    = dow === 0 || dow === 6;
                                const esLimite = dia.getDate() === 24;
                                return (
                                    <th key={i} title={key}
                                        className={`hom-th hom-th-dia${esFin ? " hom-finde" : ""}${esFer ? " hom-feriado" : ""}${esLimite ? " hom-th-limite" : ""}`}>
                                        <div className="hom-dia-dow">{DIAS_ES[dow]}</div>
                                        <div className="hom-dia-num">{dia.getDate()}</div>
                                    </th>
                                );
                            })}
                            <th className="hom-th hom-th-total">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {docs.map((d, ri) => {
                            const oid     = d.objetivoId;
                            const isDirty = dirtyA.has(oid) || dirtyB.has(oid);
                            const total   = dias.reduce((s, dia) => {
                                const key     = fmtKey(dia);
                                const st      = esB(dia) ? editStateB[oid] : editStateA[oid];
                                const diasEsp = esB(dia) ? d.diasEspB      : d.diasEspA;
                                if (diasEsp[key] === false) return s;
                                return s + (st?.[key] ?? 0);
                            }, 0);
                            return (
                                <tr key={ri} className={`hom-tr${isDirty ? " hom-tr-dirty" : ""}`}>
                                    <td className="hom-td hom-td-cliente">{d.clienteNombre || "—"}</td>
                                    <td className="hom-td hom-td-obj">
                                        {d.objetivoNombre || oid || "—"}
                                        {isDirty && <span className="hom-mod-badge">●</span>}
                                    </td>
                                    {dias.map((dia, ci) => {
                                        const key      = fmtKey(dia);
                                        const esFer    = !!FERIADOS_ARG[key];
                                        const dow      = dia.getDay();
                                        const esFin    = dow === 0 || dow === 6;
                                        const esLimite = dia.getDate() === 24;
                                        const st       = esB(dia) ? editStateB[oid] : editStateA[oid];
                                        const diasEsp  = esB(dia) ? d.diasEspB      : d.diasEspA;
                                        const deshabili = diasEsp[key] === false;
                                        const value    = deshabili ? 0 : (st?.[key] ?? null);
                                        return (
                                            <td key={ci}
                                                className={`hom-td hom-td-num${esFin ? " hom-finde" : ""}${esFer ? " hom-feriado" : ""}${esLimite ? " hom-td-limite" : ""}`}>
                                                <CeldaEditable
                                                    value={value}
                                                    onChange={handleCellChange(oid, dia)}
                                                    deshabilitada={deshabili}
                                                    feriado={esFer}
                                                    finde={esFin}
                                                />
                                            </td>
                                        );
                                    })}
                                    <td className="hom-td hom-td-total"><strong>{fmtHs(total) || "—"}</strong></td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="hom-tr-total">
                            <td className="hom-td hom-td-cliente" colSpan={2}><strong>Total</strong></td>
                            {totalesDia.map((h, i) => (
                                <td key={i} className={`hom-td hom-td-num${!h ? " hom-cero" : ""}`}>
                                    <strong>{h ? fmtHs(h) : "—"}</strong>
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
