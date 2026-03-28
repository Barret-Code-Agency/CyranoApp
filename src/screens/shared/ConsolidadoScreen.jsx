// src/screens/ConsolidadoScreen.jsx
// Consolidado de horas del período — vista general de toda la planilla

import React, { useState, useEffect, useMemo } from "react";
import { useAppData } from "../../context/AppDataContext";
import { useAuth }     from "../../context/AuthContext";
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import {
    ResponsiveContainer, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip,
    PieChart, Pie, Cell,
} from "recharts";
import * as XLSX from "xlsx";
import "../../styles/ConsolidadoScreen.css";
import { getDias, fmtKey, DIAS_ES, MESES_ES, AUS_CODES, horasDeValor, normalizarTurno } from "../../utils/periodoUtils";
import { FERIADOS_ARG } from "../../utils/feriados";

// ── Colecciones Firestore ─────────────────────────────────────────────────────
const COL_PROG    = "programacionServicios";
const COL_LEGAJOS = "legajos";

// ── Constantes ───────────────────────────────────────────────────────────────
// DIAS_ES, MESES_ES, getDias, fmtKey, FERIADOS_ARG importados desde utils

const ZONAS_FIJAS = [
    "CABA Norte",
    "CABA Centro",
    "CABA Sur",
    "GBA Norte",
    "GBA Sur",
    "Buenos Aires Interior",
    "Santa Cruz",
];

// AUS_CODES importado de periodoUtils (incluye "Vac"); AUS_SIN_VAC para conteo diferenciado
const AUS_SIN_VAC = AUS_CODES.filter(c => c !== "Vac");

const REGIMENES = ["", "4 x 2 x 12", "6 x 1 x 8", "5 x 2 x 12", "200", "12 x 36", "14 x 14 x 12", "14 x 14 x 8"];

// ── Helpers ──────────────────────────────────────────────────────────────────
// getDias, fmtKey, AUS_CODES, horasDeValor importados desde periodoUtils

// Calcula solo las horas que caen en ventana nocturna 21:00–06:00
function horasNocturnas(val) {
    if (!val || typeof val !== "string" || !val.includes(":")) return 0;
    const partes = val.split(/\s*[-\u2013\u2014]\s*/);
    if (partes.length !== 2) return 0;
    const [h1, m1] = partes[0].split(":").map(Number);
    const [h2, m2] = partes[1].split(":").map(Number);
    if (isNaN(h1) || isNaN(h2)) return 0;
    const ini = h1 * 60 + (m1 || 0);
    const fin = h2 * 60 + (m2 || 0);
    // Ventanas nocturnas en minutos: 00:00-06:00 y 21:00-24:00
    const NOC = [[0, 360], [1260, 1440]];
    // Intervalos del turno (maneja cruce de medianoche)
    const tramos = fin > ini ? [[ini, fin]] : [[ini, 1440], [0, fin]];
    let total = 0;
    for (const [s, e] of tramos)
        for (const [ns, ne] of NOC)
            total += Math.max(0, Math.min(e, ne) - Math.max(s, ns));
    return total / 60;
}

function fmtHs(n) {
    if (!n || n === 0) return "—";
    return n % 1 === 0 ? `${n},0` : n.toFixed(1).replace(".", ",");
}

function valorCelda(val) {
    if (typeof val === "number") return val > 0 ? fmtHs(val) : "";
    if (!val) return "";
    // Normalizar formato antes de parsear (cubre "06-14", "06/14", variantes)
    const hrs = horasDeValor(normalizarTurno(val));
    if (hrs > 0) return fmtHs(hrs);
    // Mostrar códigos cortos (Fco, Vac, Enf, etc. son ≤ 3 caracteres)
    if (val.length <= 3) return val;
    // Turno en formato no reconocido → ocultar en lugar de mostrar el string crudo
    return "";
}

// ── Selector de período ──────────────────────────────────────────────────────
function SelectorPeriodo({ onSelect }) {
    const hoy = new Date();
    const [año, setAño] = useState(hoy.getFullYear());
    const [mes, setMes] = useState(hoy.getMonth() + 1);

    const mesAnterior = mes === 1 ? 12 : mes - 1;
    const añoAnterior = mes === 1 ? año - 1 : año;

    return (
        <div className="con-sel-list">
            <div className="sh-modulo con-sel-item">
                <span className="sh-modulo-icon">📑</span>
                <div className="sh-modulo-info">
                    <strong>Consolidado de Horas</strong>
                    <small>
                        Del 24/{String(mesAnterior).padStart(2,"0")}/{añoAnterior}
                        &nbsp;al&nbsp;
                        23/{String(mes).padStart(2,"0")}/{año}
                    </small>
                </div>
                <div className="con-sel-campos">
                    <select className="con-select" value={mes}
                        onChange={e => setMes(Number(e.target.value))}>
                        {MESES_ES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                    </select>
                    <select className="con-select con-select--año" value={año}
                        onChange={e => setAño(Number(e.target.value))}>
                        {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button className="con-btn-abrir" onClick={() => onSelect({ año, mes })}>
                        Ver →
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Grilla ───────────────────────────────────────────────────────────────────
function ConsolidadoGrilla({ config, onBack = null, zonaFija = null }) {
    const { empresaNombre, empresaId } = useAppData();
    const [rawDocs,      setRawDocs]      = useState([]);
    const [todoPersonal, setTodoPersonal] = useState([]);
    const [zonaMap,      setZonaMap]      = useState({});
    const [regimenMap,   setRegimenMap]   = useState({});
    const [docIdMap,     setDocIdMap]     = useState({});
    const [tareaMap,     setTareaMap]     = useState({}); // legajo → tarea
    const [cargoMap,     setCargoMap]     = useState({}); // legajo → cargo
    const [rolMap,       setRolMap]       = useState({}); // legajo → rol
    const [grupoMap,     setGrupoMap]     = useState({}); // legajo → grupoTurno14
    const [ccMap,        setCcMap]        = useState({}); // legajo → centroCosto
    const [proyMap,      setProyMap]      = useState({}); // legajo → proyecto
    const [francosMap,   setFrancosMap]   = useState({}); // grupo → Set<"YYYY-MM-DD">
    const [grupoMesMap,  setGrupoMesMap]  = useState({}); // legajo → grupo (override mensual)
    const [horasObjMes,  setHorasObjMes]  = useState({}); // objetivoId → horasPorDow override
    const [excluidos,    setExcluidos]    = useState(new Set());
    const [cargando,     setCargando]     = useState(true);
    const [errorCarga,   setErrorCarga]   = useState("");
    const [vista,       setVista]      = useState("real");
    const [filtroBusq,  setFiltroBusq] = useState("");
    const [filtroZona,  setFiltroZona] = useState("");
    const [showGraf,    setShowGraf]   = useState(false);

    const dias = getDias(config.año, config.mes);
    const mesAnterior = config.mes === 1 ? 12 : config.mes - 1;
    const añoAnterior = config.mes === 1 ? config.año - 1 : config.año;

    // Carga todo de una vez
    useEffect(() => {
        if (!empresaId) return;
        (async () => {
            setCargando(true);
            try {
                const [progSnap, legSnap, diagSnapResult] = await Promise.all([
                    getDocs(query(collection(db, COL_PROG),
                                  where("empresaId", "==", empresaId))),
                    getDocs(query(collection(db, COL_LEGAJOS),
                                  where("empresaId", "==", empresaId))),
                    getDocs(query(collection(db, "diagramas14x14"),
                                  where("empresaId", "==", empresaId)))
                        .catch(() => ({ docs: [] })), // diagramas son opcionales
                ]);
                const diagSnap = diagSnapResult;
                // Filtrar año y mes en el cliente (evita índice compuesto en Firestore)
                const docsDelPeriodo = progSnap.docs
                    .map(d => d.data())
                    .filter(d => d.año === config.año && d.mes === config.mes);
                setRawDocs(docsDelPeriodo);

                const TAREAS_EXCLUIR = new Set(["Jefe", "Supervisor (FC)"]);
                const zm  = {};
                const rm  = {};
                const dm  = {};
                const gm  = {};
                const tm  = {};
                const cm  = {};
                const rlm = {}; // rol map
                const ccm = {}; // centroCosto map
                const pym = {}; // proyecto map
                const exc = new Set();
                const pers = [];
                legSnap.docs.forEach(d => {
                    const data = d.data();
                    if (!data.legajo) return;
                    const leg = String(data.legajo);
                    zm[leg]  = data.zona         || "";
                    rm[leg]  = data.regimen      || "";
                    dm[leg]  = d.id;
                    gm[leg]  = data.grupoTurno14 || "";
                    tm[leg]  = data.tarea        || "";
                    cm[leg]  = data.cargo        || "";
                    rlm[leg] = data.rol          || "";
                    ccm[leg] = data.centroCosto  || "";
                    pym[leg] = data.proyecto     || "";
                    // Excluir por tarea, por estado inactivo o por cargo "fuera de convenio"
                    const inactivo       = data.estado && data.estado !== "Activo";
                    const fueraConvenio  = (data.cargo || "").includes("(FC)");
                    if (TAREAS_EXCLUIR.has(data.tarea) || inactivo || fueraConvenio) {
                        exc.add(leg);
                    } else {
                        pers.push({ ...data });
                    }
                });
                // Asignar régimen por proyecto a quienes no tienen uno
                const REGIMEN_POR_PROYECTO = { "139": "200", "117": "200" };
                const legsPorRegimen = {}; // regimen → Set de legs
                progSnap.docs.forEach(d => {
                    const partes = (d.data().objetivoId || "").split("-");
                    const regDef = REGIMEN_POR_PROYECTO[partes[1]];
                    if (regDef) {
                        (d.data().personal || []).forEach(p => {
                            const leg = String(p.legajo || "");
                            if (leg && !rm[leg]) {
                                if (!legsPorRegimen[regDef]) legsPorRegimen[regDef] = new Set();
                                legsPorRegimen[regDef].add(leg);
                            }
                        });
                    }
                });
                await Promise.all(
                    Object.entries(legsPorRegimen).flatMap(([regimen, legs]) =>
                        [...legs].map(leg => {
                            const docId = dm[leg];
                            if (!docId) return Promise.resolve();
                            rm[leg] = regimen;
                            return updateDoc(doc(db, COL_LEGAJOS, docId), { regimen });
                        })
                    )
                );

                // Franco map: grupo → Set de fechas
                const fm = {};
                diagSnap.docs.forEach(d => {
                    const g = d.data();
                    if (g.grupo && g.francos) fm[g.grupo] = new Set(g.francos);
                });

                // ── Grupos 14x14 por mes ───────────────────────────────────────
                const periodoKey = `${config.año}-${String(config.mes).padStart(2,"0")}`;
                const gmMes = {};
                try {
                    const asigSnap = await getDoc(doc(db, "grupoAsignaciones14x14", `${empresaId}_${periodoKey}`));
                    if (asigSnap.exists()) {
                        const asigs = asigSnap.data().asignaciones || {};
                        Object.assign(gmMes, asigs); // legajo → "A" | "B"
                    }
                } catch (_) { /* colección opcional */ }

                // ── Horas por objetivo por mes ────────────────────────────────
                const hom = {}; // objetivoId → { horasDomingo, horasLunes, ... }
                try {
                    const horasSnap = await getDocs(query(
                        collection(db, "horasObjetivoMes"),
                        where("empresaId", "==", empresaId),
                        where("año", "==", config.año),
                        where("mes", "==", config.mes),
                    ));
                    horasSnap.docs.forEach(d => {
                        const h = d.data();
                        if (h.objetivoId) hom[h.objetivoId] = h;
                    });
                } catch (_) { /* colección opcional */ }

                setZonaMap(zm);
                setRegimenMap(rm);
                setDocIdMap(dm);
                setTareaMap(tm);
                setCargoMap(cm);
                setRolMap(rlm);
                setGrupoMap(gm);
                setCcMap(ccm);
                setProyMap(pym);
                setFrancosMap(fm);
                setGrupoMesMap(gmMes);
                setHorasObjMes(hom);
                setExcluidos(exc);
                setTodoPersonal(pers);
            } catch (e) {
                console.error("ConsolidadoGrilla:", e);
                setErrorCarga(e.message || "Error al cargar datos");
            } finally {
                setCargando(false);
            }
        })();
    }, [empresaId, config.año, config.mes]);

    // Una fila por persona, sumando horas de todos sus objetivos por día
    const todasFilas = useMemo(() => {
        // Mapa legajo → acumulador
        const byLeg = {};

        rawDocs.forEach(doc => {
            const partes = (doc.objetivoId || "").split("-");
            const cc      = partes[0] || "";
            const proyecto= partes[1] || "";
            // Override de horas por mes si existe para este objetivo
            const horasOvr = horasObjMes[doc.objetivoId];
            const hpd = [
                horasOvr?.horasDomingo   ?? doc.horasDomingo   ?? null,
                horasOvr?.horasLunes     ?? doc.horasLunes     ?? null,
                horasOvr?.horasMartes    ?? doc.horasMartes    ?? null,
                horasOvr?.horasMiercoles ?? doc.horasMiercoles ?? null,
                horasOvr?.horasJueves    ?? doc.horasJueves    ?? null,
                horasOvr?.horasViernes   ?? doc.horasViernes   ?? null,
                horasOvr?.horasSabado    ?? doc.horasSabado    ?? null,
            ];
            const vistoEnDoc = new Set(); // evita duplicados dentro del mismo doc
            (doc.personal || []).forEach(p => {
                const leg = String(p.legajo || "");
                if (excluidos.has(leg)) return;
                if (vistoEnDoc.has(leg)) return;
                vistoEnDoc.add(leg);
                if (!byLeg[leg]) {
                    byLeg[leg] = {
                        legajo: leg,
                        nombre: p.nombre || "",
                        cc:      ccMap[leg]  || cc,
                        proyecto: proyMap[leg] || proyecto,
                        zona:    zonaMap[leg] || doc.zona || doc.proyectoNombre || "",
                        regimen: regimenMap[leg] || "",
                        rawDias: {},
                        nocDias: {},
                        capDias: {},
                        pasPuesto1Dias: 0,
                        horasPorDows: [],
                    };
                }
                const personData = p[vista] || {};
                Object.entries(personData).forEach(([key, val]) => {
                    if (!byLeg[leg].rawDias[key]) byLeg[leg].rawDias[key] = [];
                    byLeg[leg].rawDias[key].push(val);
                    const hn = horasNocturnas(val);
                    if (hn > 0) {
                        byLeg[leg].nocDias[key] = (byLeg[leg].nocDias[key] || 0) + hn;
                    }
                });
                // Acumular capacitación
                Object.entries(p.capacitacion || {}).forEach(([key, val]) => {
                    const hc = Number(val) || 0;
                    if (hc > 0) byLeg[leg].capDias[key] = (byLeg[leg].capDias[key] || 0) + hc;
                });
                byLeg[leg].horasPorDows.push(hpd);
                // Contar días trabajados en "PAS Puesto 1" (para 000138 Adicional Alcolemia)
                const _docNombreCompleto = [doc.clienteNombre, doc.proyectoNombre, doc.objetivoNombre]
                    .filter(Boolean).join(" ").toLowerCase();
                if (_docNombreCompleto.includes("puesto 1")) {
                    const personDataPAS = p[vista] || {};
                    Object.values(personDataPAS).forEach(val => {
                        if (horasDeValor(normalizarTurno(val)) > 0)
                            byLeg[leg].pasPuesto1Dias++;
                    });
                }
            });
        });

        // Convertir acumuladores a filas mergidas
        const conProg = Object.values(byLeg).map(r => {
            // Mergear días: sumar horas, o tomar código de ausencia si no hay horas
            const data = {};
            Object.entries(r.rawDias).forEach(([key, vals]) => {
                // Normalizar formato antes de sumar (cubre "06-14", "06/14", variantes)
                const totalHs = vals.reduce((s, v) => s + horasDeValor(normalizarTurno(v)), 0);
                if (totalHs > 0) {
                    data[key] = totalHs; // número → fmtHs lo renderiza
                } else {
                    data[key] = vals.find(v => v && v !== "") || "";
                }
            });
            // Fusionar horas de capacitación en el total diario
            Object.entries(r.capDias).forEach(([key, capHs]) => {
                const hc = Number(capHs) || 0;
                if (hc <= 0) return;
                if (typeof data[key] === "number") {
                    data[key] = data[key] + hc;   // sumar al turno del día
                } else if (!data[key]) {
                    data[key] = hc;               // solo CAP ese día
                }
                // si hay código (Fco, Enf…) se ignora la CAP
            });
            // Sumar horas contratadas por DOW de todos los objetivos
            const horasPorDow = [0,1,2,3,4,5,6].map(dow => {
                const t = r.horasPorDows.reduce((s, hpd) =>
                    s + (hpd[dow] != null ? Number(hpd[dow]) : 0), 0);
                return t > 0 ? t : null;
            });
            const nocData = { ...r.nocDias };
            return {
                legajo: r.legajo, nombre: r.nombre,
                cc: r.cc, proyecto: r.proyecto,
                zona: r.zona, regimen: r.regimen,
                horasPorDow, data, nocData, capData: {},
                pasPuesto1Dias: r.pasPuesto1Dias || 0,
            };
        });

        const legajesConProg = new Set(conProg.map(r => r.legajo));

        const sinProg = todoPersonal
            .filter(p => !legajesConProg.has(String(p.legajo || "")) && !excluidos.has(String(p.legajo || "")))
            .map(p => {
                const leg = String(p.legajo || "");
                return { legajo: leg, nombre: p.nombre || "", cc: ccMap[leg] || "", proyecto: proyMap[leg] || "",
                    zona: zonaMap[leg] || "", regimen: regimenMap[leg] || "",
                    horasPorDow: null, data: {}, nocData: {} };
            });

        const resultado = [...conProg, ...sinProg];
        resultado.sort((a, b) => {
            const la = Number(a.legajo) || 0;
            const lb = Number(b.legajo) || 0;
            return la !== lb ? la - lb : String(a.legajo).localeCompare(String(b.legajo));
        });
        return resultado;
    }, [rawDocs, todoPersonal, zonaMap, regimenMap, excluidos, vista, ccMap, proyMap, horasObjMes, grupoMesMap]);

    const zonasDisponibles = useMemo(() => {
        // Zonas fijas predefinidas + cualquier zona extra que venga del data
        const delData = new Set(todasFilas.map(f => f.zona || "").filter(Boolean));
        const fijasNorm = new Set(ZONAS_FIJAS.map(z => z.toLowerCase()));
        const extras = [...delData].filter(z => !fijasNorm.has(z.toLowerCase()));
        return [...ZONAS_FIJAS, ...extras.sort()];
    }, [todasFilas]);

    const filas = useMemo(() => {
        let base = todasFilas;
        if (zonaFija) base = base.filter(f => (f.zona || "") === zonaFija);
        if (filtroZona) base = base.filter(f => (f.zona || "") === filtroZona);
        if (!filtroBusq.trim()) return base;
        const q = filtroBusq.toLowerCase();
        return base.filter(f =>
            f.nombre.toLowerCase().includes(q) ||
            String(f.legajo).includes(q)
        );
    }, [todasFilas, filtroBusq, filtroZona, zonaFija]);

    // Verdadero si el legajo tiene rol o tarea = "Encargado"
    const esEncargado = (leg) =>
        String(tareaMap[leg] || "").toUpperCase().includes("ENCARGADO") ||
        String(rolMap[leg]   || "").toUpperCase().includes("ENCARGADO");

    const calcExtras = (data, regimen, grupoTurno14, capData = {}) => {
        let ext50 = 0, ext100 = 0;
        if (regimen === "14 x 14 x 8" || regimen === "14 x 14 x 12") {
            const umbral  = regimen === "14 x 14 x 8" ? 8 : 12;
            const francos = francosMap[grupoTurno14] || new Set();
            dias.forEach(d => {
                const key   = fmtKey(d);
                const hsTur = horasDeValor(normalizarTurno(data[key] || ""));
                const hsCap = Number(capData[key]) || 0;
                const hs    = hsTur + hsCap;
                if (hs <= 0) return;
                if (francos.has(key)) {
                    ext100 += hs;          // trabajó en franco → todo al 100%
                } else if (hs > umbral) {
                    ext50 += hs - umbral;  // superó umbral en día normal → 50%
                }
            });
        } else if (regimen === "200") {
            const hsTur = dias.reduce((s, d) => s + horasDeValor(normalizarTurno(data[fmtKey(d)] || "")), 0);
            const hsCap = Object.values(capData).reduce((s, v) => s + (Number(v) || 0), 0);
            ext50 = Math.max(0, hsTur + hsCap - 200);
        } else {
            const umbral = regimen === "4 x 2 x 12" ? 10
                         : regimen === "5 x 2 x 12" ? 9.5
                         : regimen === "6 x 1 x 8"  ? 8
                         : regimen === "12 x 36"    ? 13
                         : null;
            if (umbral !== null) {
                dias.forEach(d => {
                    const key   = fmtKey(d);
                    const hsTur = horasDeValor(normalizarTurno(data[key] || ""));
                    const hsCap = Number(capData[key]) || 0;
                    const hs    = hsTur + hsCap;
                    const dow   = d.getDay();
                    const esFer = !!FERIADOS_ARG[key];
                    if (hs > umbral) {
                        const exc = hs - umbral;
                        if (esFer || dow === 0 || dow === 6) ext100 += exc;
                        else                                  ext50  += exc;
                    }
                });
            }
        }
        return { ext50, ext100 };
    };

    const calcBase = (horasPorDow) => {
        if (!horasPorDow) return null;
        return dias.reduce((s, d) => {
            const hs = horasPorDow[d.getDay()];
            return s + (hs != null ? Number(hs) : 0);
        }, 0);
    };

    const calcResumen = (data, capData = {}) => {
        let hsTotal = 0, diasTrab = 0, francos = 0, ausentes = 0, vac = 0;
        let lv = 0, sabado = 0, domingo = 0, ferDias = 0;
        let domingoHs = 0, ferHs = 0, sabadoHs = 0, lvHs = 0;

        // Sumar horas de capacitación al total
        Object.values(capData).forEach(hc => { hsTotal += Number(hc) || 0; });

        dias.forEach(d => {
            const key   = fmtKey(d);
            const val   = data[key] || "";
            const hs    = horasDeValor(val);
            const dow   = d.getDay();
            const esFer = !!FERIADOS_ARG[key];

            if (hs > 0) {
                hsTotal += hs;
                diasTrab++;
                if (esFer)          { ferDias++; ferHs    += hs; }
                else if (dow === 0) { domingo++;  domingoHs += hs; }
                else if (dow === 6) { sabado++;   sabadoHs  += hs; }
                else                { lv++;       lvHs      += hs; }
            } else if (val === "Fco" || val === "Com") {
                francos++;
            } else if (val === "Vac") {
                vac++;
            } else if (AUS_SIN_VAC.includes(val)) {
                ausentes++;
            }
        });

        return { hsTotal, diasTrab, francos, ausentes, vac,
                 lv, sabado, domingo, ferDias, domingoHs, ferHs, sabadoHs, lvHs };
    };

    // ── Datos para gráficos ───────────────────────────────────────────────────
    const grafPersonas = useMemo(() => {
        return todasFilas.map(f => {
            const r = calcResumen(f.data, f.capData);
            const { ext50, ext100 } = calcExtras(f.data, regimenMap[f.legajo] || "", grupoMesMap[f.legajo] || grupoMap[f.legajo] || "", f.capData);
            const exc = f.proyecto === "113" ? Math.max(0, (calcBase(f.horasPorDow) || 0) - 200) : 0;
            return {
                nombre: f.nombre.trim(),
                hs:     Math.round(r.hsTotal * 10) / 10,
                ext50:  Math.round(ext50  * 10) / 10,
                ext100: Math.round(ext100 * 10) / 10,
                exc:    Math.round(exc    * 10) / 10,
            };
        }).sort((a, b) => b.hs - a.hs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [todasFilas, regimenMap, grupoMap, francosMap]);

    const grafDesvios = useMemo(() => {
        const totAut = todasFilas.reduce((acc, f) => {
            const r = calcResumen(f.data, f.capData);
            return {
                lvHs:       acc.lvHs       + r.lvHs,
                saDomFerHs: acc.saDomFerHs + (r.sabadoHs + r.domingoHs + r.ferHs),
            };
        }, { lvHs: 0, saDomFerHs: 0 });
        const totPag = todasFilas.reduce((acc, f) => {
            const ext = calcExtras(f.data, regimenMap[f.legajo] || "", grupoMesMap[f.legajo] || grupoMap[f.legajo] || "", f.capData);
            return { ext50: acc.ext50 + ext.ext50, ext100: acc.ext100 + ext.ext100 };
        }, { ext50: 0, ext100: 0 });
        const autExt50  = Math.round(totAut.lvHs       * 0.07 * 10) / 10;
        const autExt100 = Math.round(totAut.saDomFerHs * 0.07 * 10) / 10;
        const pagExt50  = Math.round(totPag.ext50  * 10) / 10;
        const pagExt100 = Math.round(totPag.ext100 * 10) / 10;
        return {
            kpis: [
                {
                    label: "Ext 50%",
                    aut: autExt50, pag: pagExt50,
                    desv: Math.round((pagExt50  - autExt50)  * 10) / 10,
                    pct:  autExt50  ? Math.round((pagExt50  / autExt50  - 1) * 1000) / 10 : null,
                },
                {
                    label: "Ext 100%",
                    aut: autExt100, pag: pagExt100,
                    desv: Math.round((pagExt100 - autExt100) * 10) / 10,
                    pct:  autExt100 ? Math.round((pagExt100 / autExt100 - 1) * 1000) / 10 : null,
                },
            ],
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [todasFilas, regimenMap, grupoMap, francosMap]);

    const handleRegimen = async (leg, valor) => {
        setRegimenMap(prev => ({ ...prev, [leg]: valor }));
        const docId = docIdMap[leg];
        if (docId) {
            try {
                await updateDoc(doc(db, COL_LEGAJOS, docId), { regimen: valor });
            } catch (e) {
                console.error("Error guardando régimen:", e);
            }
        }
    };

    // ── Exportar Excel ────────────────────────────────────────────────────────
    const descargarExcel = () => {
        const BON_HEADERS = [
            "H00106 Premio Objetivo",
            "OOA112 Premio Present. Lee",
            "000219 Presentismo BA",
            "000215 Viáticos CCT Vig",
            "H00108 Adic Obj Lab Cuenca",
            "000105 Adic por Función",
            "000219 Presentismo SC",
            "000138 Adic Alcolemia",
            "OOA115 Adic Especial",
            "OOA110 Premio Objetivo SC",
        ];

        // ── Fila de cabecera ─────────────────────────────────────────────────
        const cabecera = [
            "LEGAJO", "CC", "PROY.", "NOMBRE Y APELLIDO", "ZONA", "RÉGIMEN",
            ...dias.map(d => {
                const dow = DIAS_ES[d.getDay()];
                const esFer = !!FERIADOS_ARG[fmtKey(d)];
                return `${d.getDate()}/${d.getMonth()+1} ${esFer ? "FER" : dow.slice(0,2)}`;
            }),
            "Hs", "Días", "Base", "L-V", "Sáb", "Dom", "Fer", "Fco", "Aus", "Vac",
            "Ext 50%", "Ext 100%", "Hs Exc.", "Hs Noc.",
            ...BON_HEADERS,
        ];

        // ── Filas de datos ───────────────────────────────────────────────────
        const filasDatos = filas.map(f => {
            const r   = calcResumen(f.data, f.capData);
            const reg = regimenMap[f.legajo] || "";
            const { ext50, ext100 } = calcExtras(f.data, reg, grupoMesMap[f.legajo] || grupoMap[f.legajo] || "", f.capData);
            const noc = Object.values(f.nocData || {}).reduce((s,v) => s+v, 0);
            const exc = f.proyecto === "113" ? Math.max(0, (calcBase(f.horasPorDow) || 0) - 200) : 0;
            const esSC = String(f.zona || "").toUpperCase().includes("SANTA CRUZ");
            const esBA = String(f.zona || "").toUpperCase().includes("BUENOS AIRES");

            // 000138 Alcolemia
            const alcolemia = !esSC ? "—"
                : f.pasPuesto1Dias >= 14 ? "100%"
                : f.pasPuesto1Dias >= 7  ? "50%"
                : "—";

            // Columnas de días
            const celdasDias = dias.map(d => {
                const val = f.data[fmtKey(d)] || "";
                if (typeof val === "number") return val;
                const hs = horasDeValor(normalizarTurno(val));
                if (hs > 0) return hs;
                return val || "";
            });

            // Bonus
            const bonuses = [
                f.proyecto === "113" ? (r.ausentes >= dias.length ? "0%" : "100%") : "—",
                f.proyecto === "113" ? (r.ausentes >= dias.length ? "0%" : "100%") : "—",
                esBA ? (r.ausentes > 4 ? "0%" : "100%") : "—",
                esBA ? (r.ausentes > 4 ? "0%" : "100%") : "—",
                f.legajo === "20038" ? "100%" : "—",
                esSC && esEncargado(f.legajo) ? "100%" : "—",
                esSC ? (r.ausentes > 4 ? "0%" : "100%") : "—",
                alcolemia,
                esSC ? (r.ausentes > 4 ? "0%" : "100%") : "—",
                esSC ? (r.ausentes > 4 ? "0%" : "100%") : "—",
            ];

            return [
                f.legajo, f.cc, f.proyecto, f.nombre, f.zona, reg,
                ...celdasDias,
                r.hsTotal  || 0,
                r.diasTrab || 0,
                "",                 // Base
                r.lv      || 0,
                r.sabado  || 0,
                r.domingo || 0,
                r.ferDias || 0,
                r.francos || 0,
                r.ausentes|| 0,
                r.vac     || 0,
                ext50  || 0,
                ext100 || 0,
                exc    || 0,
                noc    || 0,
                ...bonuses,
            ];
        });

        // ── Fila de totales ──────────────────────────────────────────────────
        const totHs    = filas.reduce((s,f) => s + calcResumen(f.data, f.capData).hsTotal,  0);
        const totDias  = filas.reduce((s,f) => s + calcResumen(f.data, f.capData).diasTrab, 0);
        const totDiasCols = dias.map(d => {
            const key = fmtKey(d);
            return filas.reduce((s,f) => s + horasDeValor(f.data[key] || ""), 0) || "";
        });

        const filaTotales = [
            filas.length, "", "", "TOTALES", "", "",
            ...totDiasCols,
            totHs  || 0,
            totDias|| 0,
            "", "", "", "", "", "", "", "",
            "", "", "", "",
            "", "", "", "", "", "", "", "", "", "",
        ];

        // ── Armar hoja ───────────────────────────────────────────────────────
        const aoa = [cabecera, ...filasDatos, filaTotales];
        const ws  = XLSX.utils.aoa_to_sheet(aoa);

        // Anchos de columna
        ws["!cols"] = [
            { wch: 8  }, // LEGAJO
            { wch: 5  }, // CC
            { wch: 5  }, // PROY
            { wch: 30 }, // NOMBRE
            { wch: 18 }, // ZONA
            { wch: 15 }, // RÉGIMEN
            ...dias.map(() => ({ wch: 6 })),
            { wch: 7  }, // Hs
            { wch: 5  }, // Días
            { wch: 6  }, // Base
            { wch: 4  }, // L-V
            { wch: 4  }, // Sáb
            { wch: 4  }, // Dom
            { wch: 4  }, // Fer
            { wch: 4  }, // Fco
            { wch: 4  }, // Aus
            { wch: 4  }, // Vac
            { wch: 7  }, // Ext 50%
            { wch: 7  }, // Ext 100%
            { wch: 7  }, // Hs Exc.
            { wch: 7  }, // Hs Noc.
            ...BON_HEADERS.map(() => ({ wch: 22 })),
        ];

        // Paneles fijos: 1 fila de encabezado + 6 columnas fijas
        ws["!views"] = [{ state: "frozen", xSplit: 6, ySplit: 1, topLeftCell: "G2" }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws,
            `${MESES_ES[config.mes-1]} ${config.año}`);

        XLSX.writeFile(wb,
            `Consolidado_${MESES_ES[config.mes-1]}_${config.año}.xlsx`);
    };

    if (cargando) return <div className="con-loading">Cargando consolidado...</div>;

    return (
        <div className="con-root">

            {/* ── Header ── */}
            <div className="con-header">
                <div className="con-header-left">
                    <div className="con-header-titulo">
                        Consolidado de Horas — {MESES_ES[config.mes - 1]} {config.año}
                    </div>
                    <div className="con-header-periodo">
                        Del 24/{String(mesAnterior).padStart(2,"0")}/{añoAnterior} al 23/{String(config.mes).padStart(2,"0")}/{config.año}
                        &nbsp;·&nbsp;{dias.length} días
                    </div>
                </div>
                <div className="con-header-right">
                    <div className="con-filtros-grupo">
                        <input
                            className="con-busq"
                            placeholder="Buscar..."
                            value={filtroBusq}
                            onChange={e => setFiltroBusq(e.target.value)}
                        />
                        <select
                            className="con-select-zona"
                            value={filtroZona}
                            onChange={e => setFiltroZona(e.target.value)}
                        >
                            <option value="">Todas las zonas</option>
                            {zonasDisponibles.map(z => (
                                <option key={z} value={z}>{z}</option>
                            ))}
                        </select>
                        <button
                            className={`con-btn-graf ${showGraf ? "con-btn-graf--on" : ""}`}
                            onClick={() => setShowGraf(v => !v)}
                            title="Ver gráficos"
                        >📊</button>
                        <button
                            className="con-btn-dl"
                            onClick={descargarExcel}
                            title="Descargar Excel"
                        >⬇ Descargar</button>
                    </div>
                </div>
            </div>

            {/* ── Panel de gráficos ── */}
            {showGraf && todasFilas.length > 0 && (() => {
                const GrafTick = ({ x, y, payload }) => {
                    const txt   = String(payload?.value || "");
                    const label = txt.length > 26 ? txt.slice(0, 26) + "…" : txt;
                    return (
                        <text x={x} y={y} dy={4} textAnchor="end" fill="#cbd5e1" fontSize={10}>
                            {label}
                        </text>
                    );
                };
                const totExt50  = grafDesvios.kpis[0];
                const totExt100 = grafDesvios.kpis[1];
                const totalAut  = Math.round((totExt50.aut  + totExt100.aut)  * 10) / 10;
                const totalPag  = Math.round((totExt50.pag  + totExt100.pag)  * 10) / 10;
                const totalDesv = Math.round((totExt50.desv + totExt100.desv) * 10) / 10;
                const totalPct  = totalAut ? Math.round((totalPag / totalAut - 1) * 1000) / 10 : null;
                const kpisGraf  = [...grafDesvios.kpis, { label: "Total Extras", aut: totalAut, pag: totalPag, desv: totalDesv, pct: totalPct }];
                return (
                    <div className="con-graf-panel">
                        {/* KPIs */}
                        <div className="con-graf-kpis">
                            {kpisGraf.map(k => (
                                <div key={k.label} className="con-graf-kpi">
                                    <div className="con-graf-kpi-label">{k.label}</div>
                                    <div className="con-graf-kpi-row">
                                        {[
                                            { sub: "Autorizado", val: k.aut },
                                            { sub: "Pagado",     val: k.pag },
                                            { sub: "Desvío",     val: (k.desv > 0 ? "+" : "") + (k.desv || "—"), cls: k.desv > 0 ? "con-graf-kpi--pos" : k.desv < 0 ? "con-graf-kpi--neg" : "" },
                                            { sub: "% Desvío",   val: k.pct != null ? `${k.pct > 0 ? "+" : ""}${k.pct}%` : "—", cls: k.pct > 0 ? "con-graf-kpi--pos" : k.pct < 0 ? "con-graf-kpi--neg" : "" },
                                        ].map(item => (
                                            <span key={item.sub} className="con-graf-kpi-item">
                                                <span className="con-graf-kpi-sub">{item.sub}</span>
                                                <span className={`con-graf-kpi-val ${item.cls || ""}`}>{item.val ?? "—"}</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Gráficos */}
                        <div className="con-graf-charts">
                            {/* Top 20 Ext 50% */}
                            {(() => {
                                const data = grafPersonas.slice().sort((a,b) => b.ext50 - a.ext50).slice(0,20);
                                if (!data.some(d => d.ext50 > 0)) return null;
                                return (
                                    <div className="con-graf-card">
                                        <div className="con-graf-card-title">20 mayores — Ext 50%</div>
                                        <div className="con-graf-scroll-inner">
                                            <ResponsiveContainer width="100%" height={Math.max(180, data.length * 22)}>
                                                <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" horizontal={false} />
                                                    <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} height={18} />
                                                    <YAxis type="category" dataKey="nombre" tick={<GrafTick />} width={160} />
                                                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: 12 }} />
                                                    <Bar dataKey="ext50" name="Ext 50%" fill="#f59e0b" radius={[0,3,3,0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                );
                            })()}
                            {/* Top 10 Ext 100% */}
                            {(() => {
                                const data = grafPersonas.slice().sort((a,b) => b.ext100 - a.ext100).slice(0,10);
                                if (!data.some(d => d.ext100 > 0)) return null;
                                return (
                                    <div className="con-graf-card">
                                        <div className="con-graf-card-title">10 mayores — Ext 100%</div>
                                        <div className="con-graf-scroll-inner">
                                            <ResponsiveContainer width="100%" height={Math.max(180, data.length * 22)}>
                                                <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" horizontal={false} />
                                                    <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} height={18} />
                                                    <YAxis type="category" dataKey="nombre" tick={<GrafTick />} width={160} />
                                                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: 12 }} />
                                                    <Bar dataKey="ext100" name="Ext 100%" fill="#ef4444" radius={[0,3,3,0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                );
                            })()}
                            {/* Gauges desvíos */}
                            <div className="con-graf-card con-graf-card--full">
                                <div className="con-graf-card-title">Desvíos — Autorizado vs Pagado</div>
                                <div className="con-desv-panels">
                                    {kpisGraf.map(k => {
                                        const over  = k.pag > k.aut;
                                        const ratio = k.aut > 0 ? Math.min(k.pag / k.aut, 1.3) : 0;
                                        const color = over ? "#ef4444" : "#22c55e";
                                        const gd    = [{ v: ratio }, { v: Math.max(0, 1.3 - ratio) }];
                                        return (
                                            <div key={k.label} className="con-desv-panel">
                                                <div className="con-desv-title">{k.label}</div>
                                                <div className="con-desv-gauge-wrap">
                                                    <PieChart width={200} height={110} margin={{top:0,right:0,bottom:0,left:0}}>
                                                        <Pie data={[{v:1.3}]} dataKey="v" cx={100} cy={100} startAngle={210} endAngle={-30} innerRadius={58} outerRadius={80} strokeWidth={0}>
                                                            <Cell fill="#0f172a" />
                                                        </Pie>
                                                        <Pie data={gd} dataKey="v" cx={100} cy={100} startAngle={210} endAngle={-30} innerRadius={60} outerRadius={78} strokeWidth={0}>
                                                            <Cell fill={color} />
                                                            <Cell fill="#1e3a5f" />
                                                        </Pie>
                                                    </PieChart>
                                                    <div className="con-desv-gauge-center">
                                                        <span className="con-desv-val" style={{color}}>{k.pag}</span>
                                                        <span className="con-desv-aut">de {k.aut} aut.</span>
                                                    </div>
                                                </div>
                                                <div className="con-desv-stats">
                                                    {[
                                                        { dot: "#22c55e", lbl: "Autorizado", val: `${k.aut} hs` },
                                                        { dot: color,     lbl: "Pagado",     val: `${k.pag} hs`, color },
                                                        { dot: color,     lbl: "Desvío",     val: `${k.desv > 0 ? "+" : ""}${k.desv} hs${k.pct != null ? ` (${k.pct > 0 ? "+" : ""}${k.pct}%)` : ""}`, color },
                                                    ].map(s => (
                                                        <div key={s.lbl} className="con-desv-stat">
                                                            <span className="con-desv-stat-dot" style={{background: s.dot}} />
                                                            <span className="con-desv-stat-label">{s.lbl}</span>
                                                            <span className="con-desv-stat-val" style={{color: s.color}}>{s.val}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {errorCarga ? (
                <div className="con-empty con-empty--error">
                    Error al cargar: {errorCarga}<br />
                    <small>Verificá tu conexión o permisos en Firebase.</small>
                </div>
            ) : todasFilas.length === 0 ? (
                <div className="con-empty">
                    No hay personal ni planillas cargadas para este período.<br />
                    <small>Verificá que existan legajos y planillas para {MESES_ES[config.mes - 1]} {config.año}.</small>
                </div>
            ) : (
                <div className="con-table-wrap">
                    <table className="con-table">
                        <thead>
                            <tr>
                                <th className="con-th-fix con-th-leg">LEGAJO</th>
                                <th className="con-th-fix con-th-cc">CC</th>
                                <th className="con-th-fix con-th-proy">PROY.</th>
                                <th className="con-th-fix con-th-nombre">NOMBRE Y APELLIDO</th>
                                <th className="con-th-fix con-th-obj">ZONA</th>
                                <th className="con-th-fix con-th-reg">RÉGIMEN</th>
                                {dias.map(d => {
                                    const key   = fmtKey(d);
                                    const esFer = !!FERIADOS_ARG[key];
                                    const dow   = d.getDay();
                                    const esFin = dow === 0 || dow === 6;
                                    return (
                                        <th key={key} title={esFer ? FERIADOS_ARG[key] : undefined}
                                            className={[
                                                "con-th-dia",
                                                esFer           ? "con-th-dia--fer" : "",
                                                esFin && !esFer ? "con-th-dia--fin" : "",
                                            ].join(" ")}>
                                            <div className="con-th-mes">{MESES_ES[d.getMonth()].slice(0,3)}</div>
                                            <div className="con-th-num">{d.getDate()}</div>
                                            <div className="con-th-dow">{esFer ? "FER" : DIAS_ES[dow].slice(0,2)}</div>
                                        </th>
                                    );
                                })}
                                <th className="con-th-sum">Hs</th>
                                <th className="con-th-sum">Días</th>
                                <th className="con-th-sum">Base</th>
                                <th className="con-th-sum con-th-sum--aus">L-V</th>
                                <th className="con-th-sum con-th-sum--aus">Sáb</th>
                                <th className="con-th-sum con-th-sum--aus">Dom</th>
                                <th className="con-th-sum con-th-sum--aus">Fer</th>
                                <th className="con-th-sum con-th-sum--aus">Fco</th>
                                <th className="con-th-sum con-th-sum--aus">Aus</th>
                                <th className="con-th-sum con-th-sum--aus">Vac</th>
                                <th className="con-th-sum con-th-sum--ext">Ext 50%</th>
                                <th className="con-th-sum con-th-sum--ext">Ext 100%</th>
                                <th className="con-th-sum con-th-sum--ext">Hs Exc.</th>
                                <th className="con-th-sum con-th-sum--ext">Hs Noc.</th>
                                <th className="con-th-sum con-th-sum--bon">H00106 Premio Objetivo</th>
                                <th className="con-th-sum con-th-sum--bon">OOA112 Premio Present. Reg. Lee</th>
                                <th className="con-th-sum con-th-sum--bon">000219 Presentismo</th>
                                <th className="con-th-sum con-th-sum--bon">000215 Viáticos CCT Vig</th>
                                <th className="con-th-sum con-th-sum--bon">H00108 Adic Obj Lab. Cuenca</th>
                                <th className="con-th-sum con-th-sum--bon2">000105 Adicional por función</th>
                                <th className="con-th-sum con-th-sum--bon2">000219 Presentismo</th>
                                <th className="con-th-sum con-th-sum--bon2">000138 Adicional Alcolemia</th>
                                <th className="con-th-sum con-th-sum--bon2">OOA115 Adicional especial</th>
                                <th className="con-th-sum con-th-sum--bon2">OOA110 Premio objetivo</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filas.map((f, i) => {
                                const r = calcResumen(f.data, f.capData);
                                return (
                                    <tr key={`${f.legajo}-${i}`} className="con-row">
                                        <td className="con-td-fix con-td-leg">{f.legajo}</td>
                                        <td className="con-td-fix con-td-cc">{f.cc}</td>
                                        <td className="con-td-fix con-td-proy">{f.proyecto}</td>
                                        <td className="con-td-fix con-td-nombre">{f.nombre}</td>
                                        <td className="con-td-fix con-td-obj">{f.zona}</td>
                                        <td className="con-td-fix con-td-reg">
                                            <select className="con-reg-sel"
                                                value={regimenMap[f.legajo] || ""}
                                                onChange={e => handleRegimen(f.legajo, e.target.value)}>
                                                {REGIMENES.map(r => <option key={r} value={r}>{r || "—"}</option>)}
                                            </select>
                                        </td>
                                        {dias.map(d => {
                                            const key = fmtKey(d);
                                            const val = f.data[key] || "";
                                            const valN = normalizarTurno(val);
                                            const hs  = horasDeValor(valN);
                                            const rendered = valorCelda(val);
                                            const dow = d.getDay();
                                            const esFer = !!FERIADOS_ARG[key];
                                            const esFin = dow === 0 || dow === 6;
                                            return (
                                                <td key={key} className={[
                                                    "con-celda",
                                                    esFer                          ? "con-celda--fer" : "",
                                                    esFin && !esFer                ? "con-celda--fin" : "",
                                                    val === "Fco" || val === "Com" ? "con-celda--fco"  : "",
                                                    val === "Vac"                  ? "con-celda--vac"  : "",
                                                    val === "Enf"                  ? "con-celda--enf"  : "",
                                                    val === "Art"                  ? "con-celda--art"  : "",
                                                    val === "Asa"                  ? "con-celda--asa"  : "",
                                                    val === "Aca"                  ? "con-celda--aca"  : "",
                                                    val === "Sus"                  ? "con-celda--sus"  : "",
                                                    hs > 0                         ? "con-celda--hs"    : "",
                                                    !rendered                      ? "con-celda--empty" : "",
                                                ].join(" ")}>
                                                    {rendered}
                                                </td>
                                            );
                                        })}
                                        <td className="con-td-sum con-td-sum--hs">{fmtHs(r.hsTotal)}</td>
                                        <td className="con-td-sum con-td-sum--dias">{r.diasTrab || "—"}</td>
                                        <td className="con-td-sum con-td-sum--base">—</td>
                                        <td className="con-td-sum con-td-sum--aus">{r.lv      || "—"}</td>
                                        <td className="con-td-sum con-td-sum--aus">{r.sabado  || "—"}</td>
                                        <td className="con-td-sum con-td-sum--aus">{r.domingo || "—"}</td>
                                        <td className="con-td-sum con-td-sum--aus">{r.ferDias || "—"}</td>
                                        <td className="con-td-sum con-td-sum--aus">{r.francos || "—"}</td>
                                        <td className="con-td-sum con-td-sum--aus">{r.ausentes|| "—"}</td>
                                        <td className="con-td-sum con-td-sum--aus">{r.vac     || "—"}</td>
                                        {(() => {
                                            const reg = regimenMap[f.legajo] || "";
                                            const { ext50, ext100 } = calcExtras(f.data, reg, grupoMesMap[f.legajo] || grupoMap[f.legajo] || "", f.capData);
                                            const noc = Object.values(f.nocData || {}).reduce((s,v)=>s+v,0);
                                            const exc = f.proyecto === "113" ? Math.max(0, (calcBase(f.horasPorDow) || 0) - 200) : 0;
                                            return <>
                                                <td className="con-td-sum con-td-sum--ext">{ext50  ? fmtHs(ext50)  : "—"}</td>
                                                <td className="con-td-sum con-td-sum--ext">{ext100 ? fmtHs(ext100) : "—"}</td>
                                                <td className="con-td-sum con-td-sum--ext">{exc   ? fmtHs(exc)   : "—"}</td>
                                                <td className="con-td-sum con-td-sum--ext">{noc ? fmtHs(noc) : "—"}</td>
                                            </>;
                                        })()}
                                        <td className="con-td-sum con-td-sum--bon">
                                            {f.proyecto === "113"
                                                ? r.ausentes >= dias.length ? "0%" : "100%"
                                                : "—"}
                                        </td>
                                        <td className="con-td-sum con-td-sum--bon">
                                            {f.proyecto === "113"
                                                ? r.ausentes >= dias.length ? "0%" : "100%"
                                                : "—"}
                                        </td>
                                        <td className="con-td-sum con-td-sum--bon">
                                            {String(f.zona || "").toUpperCase().includes("BUENOS AIRES")
                                                ? r.ausentes > 4 ? "0%" : "100%"
                                                : "—"}
                                        </td>
                                        <td className="con-td-sum con-td-sum--bon">
                                            {String(f.zona || "").toUpperCase().includes("BUENOS AIRES")
                                                ? r.ausentes > 4 ? "0%" : "100%"
                                                : "—"}
                                        </td>
                                        <td className="con-td-sum con-td-sum--bon">
                                            {f.legajo === "20038" ? "100%" : "—"}
                                        </td>
                                        <td className="con-td-sum con-td-sum--bon2">
                                            {String(f.zona || "").toUpperCase().includes("SANTA CRUZ") && esEncargado(f.legajo)
                                                ? "100%"
                                                : "—"}
                                        </td>
                                        <td className="con-td-sum con-td-sum--bon2">
                                            {String(f.zona || "").toUpperCase().includes("SANTA CRUZ")
                                                ? r.ausentes > 4 ? "0%" : "100%"
                                                : "—"}
                                        </td>
                                        <td className="con-td-sum con-td-sum--bon2">
                                            {(() => {
                                                if (!String(f.zona || "").toUpperCase().includes("SANTA CRUZ")) return "—";
                                                if (f.pasPuesto1Dias >= 14) return "100%";
                                                if (f.pasPuesto1Dias >= 7)  return "50%";
                                                return "—";
                                            })()}
                                        </td>
                                        <td className="con-td-sum con-td-sum--bon2">
                                            {String(f.zona || "").toUpperCase().includes("SANTA CRUZ")
                                                ? r.ausentes > 4 ? "0%" : "100%"
                                                : "—"}
                                        </td>
                                        <td className="con-td-sum con-td-sum--bon2">
                                            {String(f.zona || "").toUpperCase().includes("SANTA CRUZ")
                                                ? r.ausentes > 4 ? "0%" : "100%"
                                                : "—"}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>

                        {/* Totales */}
                        <tfoot>
                            <tr className="con-tfoot">
                                <td className="con-td-fix">{filas.length}</td>
                                <td className="con-td-fix"></td>
                                <td className="con-td-fix"></td>
                                <td className="con-td-fix con-tfoot-label">Totales</td>
                                <td className="con-td-fix"></td>
                                <td className="con-td-fix"></td>
                                {dias.map(d => {
                                    const key = fmtKey(d);
                                    const total = filas.reduce((s, f) => s + horasDeValor(f.data[key] || ""), 0);
                                    return (
                                        <td key={key} className="con-tfoot-cel">
                                            {total > 0 ? fmtHs(total) : ""}
                                        </td>
                                    );
                                })}
                                {(() => {
                                    const tots = filas.reduce((acc, f) => {
                                        const r    = calcResumen(f.data, f.capData);
                                        const base = calcBase(f.horasPorDow) ?? 0;
                                        return {
                                            hs:    acc.hs    + r.hsTotal,
                                            dias:  acc.dias  + r.diasTrab,
                                            fco:   acc.fco   + r.francos,
                                            vac:   acc.vac   + r.vac,
                                            aus:   acc.aus   + r.ausentes,
                                            lv:    acc.lv    + r.lv,
                                            sab:   acc.sab   + r.sabado,
                                            dom:   acc.dom   + r.domingo,
                                            fer:   acc.fer   + r.ferDias,
                                            ext50: acc.ext50 + calcExtras(f.data, regimenMap[f.legajo] || "", grupoMesMap[f.legajo] || grupoMap[f.legajo] || "", f.capData).ext50,
                                            ext100:acc.ext100+ calcExtras(f.data, regimenMap[f.legajo] || "", grupoMesMap[f.legajo] || grupoMap[f.legajo] || "", f.capData).ext100,
                                            exc:   acc.exc   + (f.proyecto === "113" ? Math.max(0, (calcBase(f.horasPorDow) || 0) - 200) : 0),
                                            noc:   acc.noc   + Object.values(f.nocData || {}).reduce((s,v)=>s+v,0),
                                            // bonus
                                            b1:  acc.b1  + (f.proyecto === "113" && calcResumen(f.data, f.capData).ausentes < dias.length ? 1 : 0),
                                            b2:  acc.b2  + (f.proyecto === "113" && calcResumen(f.data, f.capData).ausentes < dias.length ? 1 : 0),
                                            b3:  acc.b3  + (String(f.zona||"").toUpperCase().includes("BUENOS AIRES") && calcResumen(f.data, f.capData).ausentes <= 4 ? 1 : 0),
                                            b4:  acc.b4  + (String(f.zona||"").toUpperCase().includes("BUENOS AIRES") && calcResumen(f.data, f.capData).ausentes <= 4 ? 1 : 0),
                                            b5:  acc.b5  + (f.legajo === "20038" ? 1 : 0),
                                            b21: acc.b21 + (String(f.zona||"").toUpperCase().includes("SANTA CRUZ") && esEncargado(f.legajo) ? 1 : 0),
                                            b22: acc.b22 + (String(f.zona||"").toUpperCase().includes("SANTA CRUZ") && calcResumen(f.data, f.capData).ausentes <= 4 ? 1 : 0),
                                            b24: acc.b24 + (String(f.zona||"").toUpperCase().includes("SANTA CRUZ") && calcResumen(f.data, f.capData).ausentes <= 4 ? 1 : 0),
                                            b25: acc.b25 + (String(f.zona||"").toUpperCase().includes("SANTA CRUZ") && calcResumen(f.data, f.capData).ausentes <= 4 ? 1 : 0),
                                        };
                                    }, { hs:0, dias:0, fco:0, vac:0, aus:0, lv:0, sab:0, dom:0, fer:0, ext50:0, ext100:0, exc:0, noc:0, b1:0,b2:0,b3:0,b4:0,b5:0,b21:0,b22:0,b24:0,b25:0 });
                                    return <>
                                        <td className="con-tfoot-sum">{fmtHs(tots.hs)}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--dias">{tots.dias || "—"}</td>
                                        <td className="con-tfoot-sum">—</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--aus">{tots.lv  || "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--aus">{tots.sab || "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--aus">{tots.dom || "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--aus">{tots.fer || "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--aus">{tots.fco || "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--aus">{tots.aus || "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--aus">{tots.vac || "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--ext">—</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--ext">—</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--ext">{tots.exc ? fmtHs(tots.exc) : "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--ext">{tots.noc ? fmtHs(tots.noc) : "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--bon" />
                                        <td className="con-tfoot-sum con-tfoot-sum--bon" />
                                        <td className="con-tfoot-sum con-tfoot-sum--bon" />
                                        <td className="con-tfoot-sum con-tfoot-sum--bon" />
                                        <td className="con-tfoot-sum con-tfoot-sum--bon" />
                                        <td className="con-tfoot-sum con-tfoot-sum--bon2" />
                                        <td className="con-tfoot-sum con-tfoot-sum--bon2" />
                                        <td className="con-tfoot-sum con-tfoot-sum--bon2" />
                                        <td className="con-tfoot-sum con-tfoot-sum--bon2" />
                                        <td className="con-tfoot-sum con-tfoot-sum--bon2" />
                                    </>;
                                })()}
                            </tr>

                            {/* Cantidad autorizada */}
                            {(() => {
                                const aut = filas.reduce((acc, f) => {
                                    const r = calcResumen(f.data, f.capData);
                                    return {
                                        lvHs:      acc.lvHs      + r.lvHs,
                                        saDomFerHs:acc.saDomFerHs + (r.sabadoHs + r.domingoHs + r.ferHs),
                                        b2:        acc.b2        + (f.proyecto === "139" ? 1 : 0),
                                        sc:        acc.sc        + (String(f.zona||"").toUpperCase().includes("SANTA CRUZ") ? 1 : 0),
                                    };
                                }, { lvHs: 0, saDomFerHs: 0, b2: 0, sc: 0 });
                                const autExt50  = Math.round(aut.lvHs       * 0.07 * 10) / 10;
                                const autExt100 = Math.round(aut.saDomFerHs * 0.07 * 10) / 10;
                                return (
                                    <tr className="con-tfoot con-tfoot--sub">
                                        <td className="con-td-fix" colSpan={6 + dias.length + 10} style={{textAlign:"right", fontSize:10, color:"#93c5fd", paddingRight:8}}>
                                            Cant. autorizada
                                        </td>
                                        <td className="con-tfoot-sum con-tfoot-sum--ext">{autExt50  ? fmtHs(autExt50)  : "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--ext">{autExt100 ? fmtHs(autExt100) : "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--ext" />
                                        <td className="con-tfoot-sum con-tfoot-sum--ext" />
                                        <td className="con-tfoot-sum con-tfoot-sum--bon">4</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--bon">{aut.b2 || "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--bon">{filas.length || "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--bon">{filas.length || "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--bon">1</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--bon2">4</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--bon2">{aut.sc || "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--bon2">10</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--bon2">{aut.sc || "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--bon2">{aut.sc || "—"}</td>
                                    </tr>
                                );
                            })()}

                            {/* Pagados */}
                            {(() => {
                                const tots = filas.reduce((acc, f) => {
                                    const r   = calcResumen(f.data, f.capData);
                                    const ext = calcExtras(f.data, regimenMap[f.legajo] || "", grupoMesMap[f.legajo] || grupoMap[f.legajo] || "", f.capData);
                                    return {
                                        ext50: acc.ext50 + ext.ext50,
                                        ext100:acc.ext100+ ext.ext100,
                                        exc:   acc.exc   + (f.proyecto === "113" ? Math.max(0, (calcBase(f.horasPorDow) || 0) - 200) : 0),
                                        b1:  acc.b1  + (f.proyecto === "113" && r.ausentes < dias.length ? 1 : 0),
                                        b2:  acc.b2  + (f.proyecto === "113" && r.ausentes < dias.length ? 1 : 0),
                                        b3:  acc.b3  + (String(f.zona||"").toUpperCase().includes("BUENOS AIRES") && r.ausentes <= 4 ? 1 : 0),
                                        b4:  acc.b4  + (String(f.zona||"").toUpperCase().includes("BUENOS AIRES") && r.ausentes <= 4 ? 1 : 0),
                                        b5:  acc.b5  + (f.legajo === "20038" ? 1 : 0),
                                        b21: acc.b21 + (String(f.zona||"").toUpperCase().includes("SANTA CRUZ") && esEncargado(f.legajo) ? 1 : 0),
                                        b22: acc.b22 + (String(f.zona||"").toUpperCase().includes("SANTA CRUZ") && r.ausentes <= 4 ? 1 : 0),
                                        b23: acc.b23 + (String(f.zona||"").toUpperCase().includes("SANTA CRUZ") && f.pasPuesto1Dias >= 7 ? 1 : 0),
                                        b24: acc.b24 + (String(f.zona||"").toUpperCase().includes("SANTA CRUZ") && r.ausentes <= 4 ? 1 : 0),
                                        b25: acc.b25 + (String(f.zona||"").toUpperCase().includes("SANTA CRUZ") && r.ausentes <= 4 ? 1 : 0),
                                    };
                                }, { ext50:0, ext100:0, exc:0, b1:0,b2:0,b3:0,b4:0,b5:0,b21:0,b22:0,b23:0,b24:0,b25:0 });
                                return (
                                    <tr className="con-tfoot con-tfoot--sub">
                                        <td className="con-td-fix" colSpan={6 + dias.length + 10} style={{textAlign:"right", fontSize:10, color:"#93c5fd", paddingRight:8}}>
                                            Pagados
                                        </td>
                                        <td className="con-tfoot-sum con-tfoot-sum--ext">{tots.ext50  ? fmtHs(tots.ext50)  : "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--ext">{tots.ext100 ? fmtHs(tots.ext100) : "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--ext">{tots.exc ? fmtHs(tots.exc) : "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--ext" />
                                        <td className="con-tfoot-sum con-tfoot-sum--bon">{tots.b1  || "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--bon">{tots.b2  || "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--bon">{tots.b3  || "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--bon">{tots.b4  || "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--bon">{tots.b5  || "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--bon2">{tots.b21 || "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--bon2">{tots.b22 || "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--bon2">{tots.b23 || "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--bon2">{tots.b24 || "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--bon2">{tots.b25 || "—"}</td>
                                    </tr>
                                );
                            })()}
                        </tfoot>
                    </table>
                </div>
            )}

            {/* ── Panel de estadísticas ── */}
            {filas.length > 0 && (
                <div className="con-stats">
                    <div className="con-stats-section">
<div className="con-stats-chips">
                            {REGIMENES.filter(r => r).map(reg => {
                                const count = filas.filter(f => (regimenMap[f.legajo] || "") === reg).length;
                                if (!count) return null;
                                return (
                                    <div key={reg} className="con-stats-chip">
                                        <span className="con-stats-chip-label">{reg}</span>
                                        <span className="con-stats-chip-count">{count}</span>
                                    </div>
                                );
                            })}
                            {(() => {
                                const sinRegimen = filas.filter(f => !(regimenMap[f.legajo] || "")).length;
                                return sinRegimen > 0 ? (
                                    <div className="con-stats-chip con-stats-chip--empty">
                                        <span className="con-stats-chip-label">Sin régimen</span>
                                        <span className="con-stats-chip-count">{sinRegimen}</span>
                                    </div>
                                ) : null;
                            })()}
                        </div>
                    </div>
                    <div className="con-stats-graficos">
                        {(() => {
                            // Helper: calcula cards de donuts para un subset de filas
                            const buildCards = (rows) => {
                                const totAut = rows.reduce((acc, f) => {
                                    const r = calcResumen(f.data, f.capData);
                                    return {
                                        lvHs:      acc.lvHs       + r.lvHs,
                                        saDomFerHs:acc.saDomFerHs + (r.sabadoHs + r.domingoHs + r.ferHs),
                                    };
                                }, { lvHs: 0, saDomFerHs: 0 });
                                const aut50  = Math.round(totAut.lvHs       * 0.07 * 10) / 10;
                                const aut100 = Math.round(totAut.saDomFerHs * 0.07 * 10) / 10;
                                const totPag = rows.reduce((acc, f) => {
                                    const e = calcExtras(f.data, regimenMap[f.legajo] || "", grupoMesMap[f.legajo] || grupoMap[f.legajo] || "", f.capData);
                                    return { ext50: acc.ext50 + e.ext50, ext100: acc.ext100 + e.ext100 };
                                }, { ext50: 0, ext100: 0 });
                                const pag50  = Math.round(totPag.ext50  * 10) / 10;
                                const pag100 = Math.round(totPag.ext100 * 10) / 10;
                                const totalAut = Math.round((aut50  + aut100) * 10) / 10;
                                const totalPag = Math.round((pag50  + pag100) * 10) / 10;
                                const pct50  = aut50  ? Math.round((pag50  / aut50  - 1) * 1000) / 10 : null;
                                const pct100 = aut100 ? Math.round((pag100 / aut100 - 1) * 1000) / 10 : null;
                                const pctTot = totalAut ? Math.round((totalPag / totalAut - 1) * 1000) / 10 : null;
                                return [
                                    {
                                        label: "Permitidas",
                                        center: totalAut || 0, color: "#22c55e",
                                        data: [
                                            { v: totalAut,                         fill: "#22c55e" },
                                            { v: Math.max(0, totalPag - totalAut), fill: "#e2e8f0" },
                                        ],
                                    },
                                    {
                                        label: "Realizadas",
                                        center: totalPag || 0,
                                        pct: pctTot,
                                        color: totalPag > totalAut ? "#ef4444" : "#3b82f6",
                                        data: [
                                            { v: Math.min(totalPag, totalAut),     fill: totalPag > totalAut ? "#ef4444" : "#3b82f6" },
                                            { v: Math.max(0, totalAut - totalPag), fill: "#e2e8f0" },
                                        ],
                                    },
                                    {
                                        label: "Ext 50% — Hs",
                                        center: pag50 || 0, pct: pct50, color: "#f59e0b",
                                        data: [
                                            { v: pag50,                       fill: "#f59e0b" },
                                            { v: Math.max(0, aut50 - pag50),  fill: "#e2e8f0" },
                                        ],
                                    },
                                    {
                                        label: "Ext 100% — Hs",
                                        center: pag100 || 0, pct: pct100, color: "#ef4444",
                                        data: [
                                            { v: pag100,                        fill: "#ef4444" },
                                            { v: Math.max(0, aut100 - pag100),  fill: "#e2e8f0" },
                                        ],
                                    },
                                    {
                                        label: "% Desvío total",
                                        center: pctTot != null ? `${pctTot > 0 ? "+" : ""}${pctTot}%` : "—",
                                        color: pctTot > 0 ? "#f87171" : "#34d399",
                                        data: (() => {
                                            const cap = Math.min(Math.abs(pctTot || 0), 100);
                                            return [
                                                { v: cap,       fill: pctTot > 0 ? "#f87171" : "#34d399" },
                                                { v: 100 - cap, fill: "#e2e8f0" },
                                            ];
                                        })(),
                                    },
                                ];
                            };

                            const renderDonuts = (cards, prefix) => cards.map(c => (
                                <div key={prefix + c.label} className="con-donut-card">
                                    <div className="con-donut-label">{c.label}</div>
                                    <div className="con-donut-wrap">
                                        <PieChart width={100} height={100} margin={{ top:0,right:0,bottom:0,left:0 }}>
                                            <Pie data={c.data} dataKey="v" cx={50} cy={50}
                                                innerRadius={32} outerRadius={46}
                                                startAngle={90} endAngle={-270} strokeWidth={0}>
                                                {c.data.map((e, i) => <Cell key={i} fill={e.fill} />)}
                                            </Pie>
                                        </PieChart>
                                        <div className="con-donut-center">
                                            <span className="con-donut-val" style={{ color: c.color }}>{c.center}</span>
                                            {c.pct != null && (
                                                <span className={`con-donut-pct ${c.pct > 0 ? "con-donut--pos" : c.pct < 0 ? "con-donut--neg" : ""}`}>
                                                    {c.pct > 0 ? "+" : ""}{c.pct}%
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {c.sub && <div className="con-donut-sub">{c.sub}</div>}
                                </div>
                            ));

                            const grupos = [
                                { label: "Total",        rows: filas,                                                                                                    bg: "#eff6ff", border: "#bfdbfe", labelColor: "#1d4ed8" },
                                { label: "Santa Cruz",   rows: filas.filter(f => String(f.zona||"").toUpperCase().includes("SANTA CRUZ")),   bg: "#f0fdf4", border: "#bbf7d0", labelColor: "#15803d" },
                                { label: "Buenos Aires", rows: filas.filter(f => String(f.zona||"").toUpperCase().includes("BUENOS AIRES")), bg: "#fdf4ff", border: "#e9d5ff", labelColor: "#7e22ce" },
                            ];

                            return grupos.map(g => (
                                <div key={g.label} className="con-donut-grupo" style={{ background: g.bg, borderColor: g.border }}>
                                    <div className="con-donut-grupo-label" style={{ color: g.labelColor }}>{g.label}</div>
                                    <div className="con-donut-grupo-cards">
                                        {renderDonuts(buildCards(g.rows), g.label)}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Export ───────────────────────────────────────────────────────────────────
export default function ConsolidadoScreen({ onBack, zonaFija = null, onEnterGrilla, onExitGrilla }) {
    const [config, setConfig] = useState(null);

    const handleSelect = (cfg) => { setConfig(cfg); onEnterGrilla?.(); };
    const handleBack   = ()    => { setConfig(null); onExitGrilla?.();  };

    if (config) return <ConsolidadoGrilla config={config} onBack={handleBack} zonaFija={zonaFija} />;

    return (
        <div style={{ width: "100%", padding: "var(--space-4)" }}>
            <SelectorPeriodo onSelect={handleSelect} />
        </div>
    );
}
