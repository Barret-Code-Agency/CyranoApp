// src/screens/ConsolidadoScreen.jsx
// Consolidado de horas del período — vista general de toda la planilla

import { useState, useEffect, useMemo } from "react";
import { useAppData } from "../context/AppDataContext";
import { useAuth }     from "../context/AuthContext";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import "../styles/ConsolidadoScreen.css";

// ── Constantes ───────────────────────────────────────────────────────────────
const DIAS_ES  = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const MESES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const FERIADOS_ARG = {
    "2025-01-01":"Año Nuevo","2025-03-03":"Carnaval","2025-03-04":"Carnaval",
    "2025-03-24":"Día de la Memoria","2025-04-02":"Día del Veterano","2025-04-18":"Viernes Santo",
    "2025-05-01":"Día del Trabajador","2025-05-25":"Revolución de Mayo",
    "2025-06-16":"Gral. Güemes","2025-06-20":"Gral. Belgrano",
    "2025-07-09":"Día de la Independencia","2025-08-18":"Gral. San Martín",
    "2025-10-13":"Diversidad Cultural","2025-11-21":"Soberanía Nacional",
    "2025-12-08":"Inmaculada Concepción","2025-12-25":"Navidad",
    "2026-01-01":"Año Nuevo","2026-02-16":"Carnaval","2026-02-17":"Carnaval",
    "2026-03-24":"Día de la Memoria","2026-04-02":"Día del Veterano","2026-04-03":"Viernes Santo",
    "2026-05-01":"Día del Trabajador","2026-05-25":"Revolución de Mayo",
    "2026-06-15":"Gral. Güemes","2026-06-20":"Gral. Belgrano",
    "2026-07-09":"Día de la Independencia","2026-08-17":"Gral. San Martín",
    "2026-10-12":"Diversidad Cultural","2026-11-20":"Soberanía Nacional",
    "2026-12-08":"Inmaculada Concepción","2026-12-25":"Navidad",
    "2027-01-01":"Año Nuevo","2027-02-08":"Carnaval","2027-02-09":"Carnaval",
    "2027-03-24":"Día de la Memoria","2027-04-02":"Día del Veterano","2027-03-26":"Viernes Santo",
    "2027-05-01":"Día del Trabajador","2027-05-25":"Revolución de Mayo",
    "2027-06-17":"Gral. Güemes","2027-06-21":"Gral. Belgrano",
    "2027-07-09":"Día de la Independencia","2027-08-16":"Gral. San Martín",
    "2027-10-11":"Diversidad Cultural","2027-11-22":"Soberanía Nacional",
    "2027-12-08":"Inmaculada Concepción","2027-12-25":"Navidad",
};

const AUS_SIN_VAC = ["Enf","Art","Asa","Aca","Sus","Lic"];

const REGIMENES = ["", "4 x 2 x 12", "6 x 1 x 8", "5 x 2 x 12", "200", "12 x 36", "14 x 14 x 12", "14 x 14 x 8"];

// ── Helpers ──────────────────────────────────────────────────────────────────
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
    if (typeof val === "number") return val;
    if (!val) return 0;
    if (["Fco","Com","FER","Lic","Vac","Enf","Art","Asa","Aca","Sus"].includes(val)) return 0;
    const partes = val.split(/\s*[-\u2013\u2014]\s*/);
    if (partes.length !== 2) return 0;
    const [h1, m1] = partes[0].split(":").map(Number);
    const [h2, m2] = partes[1].split(":").map(Number);
    if (isNaN(h1) || isNaN(h2)) return 0;
    const ini = h1 * 60 + (m1 || 0);
    const fin = h2 * 60 + (m2 || 0);
    return (fin > ini ? fin - ini : fin + 1440 - ini) / 60;
}

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
    const hrs = horasDeValor(val);
    if (hrs > 0) return fmtHs(hrs);
    return val;
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
                        {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
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
function ConsolidadoGrilla({ config, onBack }) {
    const { empresaNombre } = useAppData();
    const [rawDocs,      setRawDocs]      = useState([]);
    const [todoPersonal, setTodoPersonal] = useState([]);
    const [zonaMap,      setZonaMap]      = useState({});
    const [regimenMap,   setRegimenMap]   = useState({});
    const [docIdMap,     setDocIdMap]     = useState({});
    const [excluidos,    setExcluidos]    = useState(new Set());
    const [cargando,     setCargando]     = useState(true);
    const [vista,      setVista]      = useState("programado");
    const [filtroBusq, setFiltroBusq] = useState("");

    const dias = getDias(config.año, config.mes);
    const mesAnterior = config.mes === 1 ? 12 : config.mes - 1;
    const añoAnterior = config.mes === 1 ? config.año - 1 : config.año;

    // Carga todo de una vez
    useEffect(() => {
        if (!empresaNombre) return;
        (async () => {
            setCargando(true);
            try {
                const [progSnap, legSnap] = await Promise.all([
                    getDocs(query(collection(db, "programacionServicios"),
                                  where("empresa", "==", empresaNombre),
                                  where("año", "==", config.año),
                                  where("mes", "==", config.mes))),
                    getDocs(query(collection(db, "legajos"),
                                  where("empresa", "==", empresaNombre))),
                ]);
                setRawDocs(progSnap.docs.map(d => d.data()));

                const TAREAS_EXCLUIR = new Set(["Jefe", "Supervisor (FC)"]);
                const zm  = {};
                const rm  = {};
                const dm  = {};
                const exc = new Set();
                const pers = [];
                legSnap.docs.forEach(d => {
                    const data = d.data();
                    if (!data.legajo) return;
                    const leg = String(data.legajo);
                    zm[leg] = data.zona    || "";
                    rm[leg] = data.regimen || "";
                    dm[leg] = d.id;
                    if (TAREAS_EXCLUIR.has(data.tarea)) {
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
                            return updateDoc(doc(db, "legajos", docId), { regimen });
                        })
                    )
                );

                setZonaMap(zm);
                setRegimenMap(rm);
                setDocIdMap(dm);
                setExcluidos(exc);
                setTodoPersonal(pers);
            } catch (e) {
                console.error("ConsolidadoGrilla:", e);
            } finally {
                setCargando(false);
            }
        })();
    }, [empresaNombre, config.año, config.mes]);

    // Una fila por persona, sumando horas de todos sus objetivos por día
    const todasFilas = useMemo(() => {
        // Mapa legajo → acumulador
        const byLeg = {};

        rawDocs.forEach(doc => {
            const partes = (doc.objetivoId || "").split("-");
            const cc      = partes[0] || "";
            const proyecto= partes[1] || "";
            const hpd = [
                doc.horasDomingo   ?? null,
                doc.horasLunes     ?? null,
                doc.horasMartes    ?? null,
                doc.horasMiercoles ?? null,
                doc.horasJueves    ?? null,
                doc.horasViernes   ?? null,
                doc.horasSabado    ?? null,
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
                        cc, proyecto,
                        zona:    zonaMap[leg]    || "",
                        regimen: regimenMap[leg] || "",
                        rawDias: {},      // dateKey → [val, val, ...]
                        nocDias: {},      // dateKey → horas nocturnas acumuladas
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
                byLeg[leg].horasPorDows.push(hpd);
            });
        });

        // Convertir acumuladores a filas mergidas
        const conProg = Object.values(byLeg).map(r => {
            // Mergear días: sumar horas, o tomar código de ausencia si no hay horas
            const data = {};
            Object.entries(r.rawDias).forEach(([key, vals]) => {
                const totalHs = vals.reduce((s, v) => s + horasDeValor(v), 0);
                if (totalHs > 0) {
                    data[key] = totalHs; // número → fmtHs lo renderiza
                } else {
                    data[key] = vals.find(v => v && v !== "") || "";
                }
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
                horasPorDow, data, nocData,
            };
        });

        const legajesConProg = new Set(conProg.map(r => r.legajo));

        const sinProg = todoPersonal
            .filter(p => !legajesConProg.has(String(p.legajo || "")) && !excluidos.has(String(p.legajo || "")))
            .map(p => {
                const leg = String(p.legajo || "");
                return { legajo: leg, nombre: p.nombre || "", cc: "", proyecto: "",
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
    }, [rawDocs, todoPersonal, zonaMap, regimenMap, excluidos, vista]);

    const filas = useMemo(() => {
        if (!filtroBusq.trim()) return todasFilas;
        const q = filtroBusq.toLowerCase();
        return todasFilas.filter(f =>
            f.nombre.toLowerCase().includes(q) ||
            String(f.legajo).includes(q)
        );
    }, [todasFilas, filtroBusq]);

    const calcExtras = (data, regimen) => {
        let ext50 = 0, ext100 = 0;
        if (regimen === "200") {
            const hsTotal = dias.reduce((s, d) => s + horasDeValor(data[fmtKey(d)] || ""), 0);
            ext50 = Math.max(0, hsTotal - 200);
        } else {
            const umbral = regimen === "4 x 2 x 12" ? 10
                         : regimen === "5 x 2 x 12" ? 9.5
                         : regimen === "6 x 1 x 8"  ? 8
                         : regimen === "12 x 36"    ? 13
                         : null;
            if (umbral !== null) {
                dias.forEach(d => {
                    const key   = fmtKey(d);
                    const hs    = horasDeValor(data[key] || "");
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

    const calcResumen = (data) => {
        let hsTotal = 0, diasTrab = 0, francos = 0, ausentes = 0, vac = 0;
        let lv = 0, sabado = 0, domingo = 0, ferDias = 0;
        let domingoHs = 0, ferHs = 0;

        dias.forEach(d => {
            const key   = fmtKey(d);
            const val   = data[key] || "";
            const hs    = horasDeValor(val);
            const dow   = d.getDay();
            const esFer = !!FERIADOS_ARG[key];

            if (hs > 0) {
                hsTotal += hs;
                diasTrab++;
                if (esFer)          { ferDias++;  ferHs    += hs; }
                else if (dow === 0) { domingo++;   domingoHs += hs; }
                else if (dow === 6)   sabado++;
                else                  lv++;
            } else if (val === "Fco" || val === "Com") {
                francos++;
            } else if (val === "Vac") {
                vac++;
            } else if (AUS_SIN_VAC.includes(val)) {
                ausentes++;
            }
        });

        return { hsTotal, diasTrab, francos, ausentes, vac,
                 lv, sabado, domingo, ferDias, domingoHs, ferHs };
    };

    const handleRegimen = async (leg, valor) => {
        setRegimenMap(prev => ({ ...prev, [leg]: valor }));
        const docId = docIdMap[leg];
        if (docId) {
            try {
                await updateDoc(doc(db, "legajos", docId), { regimen: valor });
            } catch (e) {
                console.error("Error guardando régimen:", e);
            }
        }
    };

    if (cargando) return <div className="con-loading">Cargando consolidado...</div>;

    return (
        <div className="con-root">

            {/* ── Header ── */}
            <header className="con-header">
                <div className="con-header-left">
                    <button className="con-back" onClick={onBack}>← Volver</button>
                    <div>
                        <div className="con-header-title">
                            Consolidado — {MESES_ES[config.mes - 1]} {config.año}
                        </div>
                        <div className="con-header-sub">
                            24/{String(mesAnterior).padStart(2,"0")}/{añoAnterior}
                            &nbsp;—&nbsp;
                            23/{String(config.mes).padStart(2,"0")}/{config.año}
                            &nbsp;·&nbsp;{todasFilas.length} personas
                        </div>
                    </div>
                </div>
                <div className="con-header-right">
                    <input
                        className="con-busq"
                        placeholder="Filtrar..."
                        value={filtroBusq}
                        onChange={e => setFiltroBusq(e.target.value)}
                    />
                    <div className="con-tabs">
                        <button className={`con-tab ${vista === "programado" ? "con-tab--on" : ""}`}
                            onClick={() => setVista("programado")}>Programado</button>
                        <button className={`con-tab ${vista === "real" ? "con-tab--on" : ""}`}
                            onClick={() => setVista("real")}>Real</button>
                    </div>
                </div>
            </header>

            {todasFilas.length === 0 ? (
                <div className="con-empty">
                    No hay planillas cargadas para este período.<br />
                    <small>Cargá datos desde Gestión de horas → Programación.</small>
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
                                const r = calcResumen(f.data);
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
                                            const hs  = horasDeValor(val);
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
                                                    hs > 0                         ? "con-celda--hs"   : "",
                                                ].join(" ")}>
                                                    {valorCelda(val)}
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
                                            const { ext50, ext100 } = calcExtras(f.data, reg);
                                            const noc = Object.values(f.nocData || {}).reduce((s,v)=>s+v,0);
                                            return <>
                                                <td className="con-td-sum con-td-sum--ext">{ext50  ? fmtHs(ext50)  : "—"}</td>
                                                <td className="con-td-sum con-td-sum--ext">{ext100 ? fmtHs(ext100) : "—"}</td>
                                                <td className="con-td-sum con-td-sum--ext">—</td>
                                                <td className="con-td-sum con-td-sum--ext">{noc ? fmtHs(noc) : "—"}</td>
                                            </>;
                                        })()}
                                        <td className="con-td-sum con-td-sum--bon">—</td>
                                        <td className="con-td-sum con-td-sum--bon">—</td>
                                        <td className="con-td-sum con-td-sum--bon">—</td>
                                        <td className="con-td-sum con-td-sum--bon">—</td>
                                        <td className="con-td-sum con-td-sum--bon">—</td>
                                        <td className="con-td-sum con-td-sum--bon2">—</td>
                                        <td className="con-td-sum con-td-sum--bon2">—</td>
                                        <td className="con-td-sum con-td-sum--bon2">—</td>
                                        <td className="con-td-sum con-td-sum--bon2">—</td>
                                        <td className="con-td-sum con-td-sum--bon2">—</td>
                                    </tr>
                                );
                            })}
                        </tbody>

                        {/* Totales */}
                        <tfoot>
                            <tr className="con-tfoot">
                                <td className="con-td-fix">{filas.length}</td>
                                <td className="con-td-fix" colSpan={5}></td>
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
                                        const r    = calcResumen(f.data);
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
                                            ext50: acc.ext50 + calcExtras(f.data, regimenMap[f.legajo] || "").ext50,
                                            ext100:acc.ext100+ calcExtras(f.data, regimenMap[f.legajo] || "").ext100,
                                            noc:   acc.noc   + Object.values(f.nocData || {}).reduce((s,v)=>s+v,0),
                                        };
                                    }, { hs:0, dias:0, fco:0, vac:0, aus:0, lv:0, sab:0, dom:0, fer:0, ext50:0, ext100:0, noc:0 });
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
                                        <td className="con-tfoot-sum con-tfoot-sum--ext">{tots.ext50  ? fmtHs(tots.ext50)  : "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--ext">{tots.ext100 ? fmtHs(tots.ext100) : "—"}</td>
                                        <td className="con-tfoot-sum con-tfoot-sum--ext">—</td>
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
                        </tfoot>
                    </table>
                </div>
            )}

            {/* ── Panel de estadísticas ── */}
            {filas.length > 0 && (
                <div className="con-stats">
                    <div className="con-stats-section">
                        <div className="con-stats-title">Distribución por régimen</div>
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
                        {/* espacio reservado para gráficos */}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Export ───────────────────────────────────────────────────────────────────
export default function ConsolidadoScreen({ onBack }) {
    const [config, setConfig] = useState(null);
    const { user }                                   = useAuth();
    const { empresaLogos, empresaNombre }             = useAppData();

    if (config) return <ConsolidadoGrilla config={config} onBack={() => setConfig(null)} />;

    return (
        <div className="sh-root">
            <header className="sh-header">
                <div className="sh-header-left">
                    {empresaLogos?.panel && (
                        <img src={empresaLogos.panel} alt="Logo" className="sh-empresa-logo" />
                    )}
                    <div>
                        <div className="sh-header-title">Mi Panel — {empresaNombre}</div>
                        <div className="sh-header-sub">{user?.name}</div>
                    </div>
                </div>
                <button className="sh-back-btn sh-back-btn--header" onClick={onBack}>← Volver al panel</button>
            </header>
            <SelectorPeriodo onSelect={setConfig} />
        </div>
    );
}
