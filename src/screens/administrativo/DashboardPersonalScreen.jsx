// src/screens/DashboardPersonalScreen.jsx
import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useAppData } from "../../context/AppDataContext";
import { useClientesData } from "../../hooks/useClientesData";
import "./DashboardPersonalScreen.css";
import { parseFecha, calcEdad, calcAntiguedad } from "../../utils/dateUtils";
function normalizarTarea(t = "") {
    const v = (t ?? "").trim().toLowerCase();
    if (v.includes("conductor") || v.includes("conducor")) return "Conductor";
    if (v.includes("operador")) return "Operador";
    if (v.includes("encargado")) return "Encargado";
    if (v.includes("supervisor")) return "Supervisor";
    if (v.includes("jefe")) return "Jefe";
    if (v.includes("receptionist") || v.includes("rececpion") || v.includes("administrativo")) return "Administrativo";
    if (v.includes("vigilador")) return "Vigilador";
    return t || "Otro";
}
// Devuelve el campo de rol/función del legajo (campo "rol" nuevo, "tarea" legacy)
function getRol(p) { return p.rol || p.tarea || ""; }
function countBy(arr, fn) {
    const map = {};
    arr.forEach(x => { const k = fn(x); map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
}
function getGeneracion(nacimiento) {
    const d = parseFecha(nacimiento);
    if (!d) return null;
    const y = d.getFullYear();
    if (!y || y < 1900) return null;
    if (y <= 1945) return "Silenciosa";
    if (y <= 1964) return "Baby Boomers";
    if (y <= 1980) return "Gen X";
    if (y <= 1996) return "Millennials";
    if (y <= 2012) return "Centenials";
    return "Alfa";
}
const ORDEN_GEN = ["Silenciosa","Baby Boomers","Gen X","Millennials","Centenials","Alfa"];
function rangosAntiguedad(legajos) {
    const rangos = { "< 2 años": 0, "2–5 años": 0, "5–10 años": 0, "10–15 años": 0, "15–20 años": 0, "> 20 años": 0 };
    legajos.forEach(p => {
        const a = calcAntiguedad(p.fechaIngreso);
        if (a === null) return;
        if (a < 2)       rangos["< 2 años"]++;
        else if (a < 5)  rangos["2–5 años"]++;
        else if (a < 10) rangos["5–10 años"]++;
        else if (a < 15) rangos["10–15 años"]++;
        else if (a < 20) rangos["15–20 años"]++;
        else             rangos["> 20 años"]++;
    });
    return Object.entries(rangos);
}
function rangosEdad(legajos) {
    const rangos = { "18–20": 0, "20–29": 0, "30–39": 0, "40–49": 0, "50–59": 0, "60–65": 0, "> 65": 0 };
    legajos.forEach(p => {
        const e = calcEdad(p.nacimiento);
        if (e === null || e < 18) return;
        if (e <= 20)      rangos["18–20"]++;
        else if (e <= 29) rangos["20–29"]++;
        else if (e <= 39) rangos["30–39"]++;
        else if (e <= 49) rangos["40–49"]++;
        else if (e <= 59) rangos["50–59"]++;
        else if (e <= 65) rangos["60–65"]++;
        else              rangos["> 65"]++;
    });
    return Object.entries(rangos);
}
function ingresosPorAnio(legajos) {
    const map = {};
    legajos.forEach(p => {
        const d = parseFecha(p.fechaIngreso);
        if (!d) return;
        const y = String(d.getFullYear());
        if (parseInt(y) < 2013) return;
        map[y] = (map[y] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
}
function antiguedadPorFuncion(legajos) {
    const map = {};
    legajos.forEach(p => {
        const fn = normalizarTarea(getRol(p));
        const a  = calcAntiguedad(p.fechaIngreso);
        if (a === null) return;
        if (!map[fn]) map[fn] = { sum: 0, count: 0 };
        map[fn].sum += a;
        map[fn].count++;
    });
    return Object.entries(map)
        .map(([k, v]) => [k, parseFloat((v.sum / v.count).toFixed(1))])
        .sort((a, b) => b[1] - a[1]);
}

function buildStats(legajos, proyectoMap = {}) {
    if (!legajos.length) return null;
    const masc  = legajos.filter(p => p.sexo === "M").length;
    const fem   = legajos.filter(p => p.sexo === "F").length;
    const oSexo = legajos.length - masc - fem;
    const antiguedades = legajos.map(p => calcAntiguedad(p.fechaIngreso)).filter(Boolean);
    const promAntig = antiguedades.length
        ? (antiguedades.reduce((s, a) => s + a, 0) / antiguedades.length).toFixed(1) : "—";
    const edades = legajos.map(p => calcEdad(p.nacimiento)).filter(Boolean);
    const promEdad = edades.length
        ? Math.round(edades.reduce((s, e) => s + e, 0) / edades.length) : "—";
    const conHijos   = legajos.filter(p => parseInt(p.hijos) > 0).length;
    const totalHijos = legajos.reduce((s, p) => s + (parseInt(p.hijos) || 0), 0);
    const tareas    = countBy(legajos, p => normalizarTarea(getRol(p)));
    const proyectos = countBy(legajos, p => {
        const num = (p.proyecto || "").trim();
        if (!num) return "Sin proyecto";
        const nombre = proyectoMap[num] || "";
        return nombre ? `${num} - ${nombre}` : num;
    });
    const servicios = countBy(legajos, p => p.centroCosto || "Sin CC");
    const hijosDistr = countBy(legajos, p => {
        const h = parseInt(p.hijos);
        if (isNaN(h) || p.hijos === "") return "S/D";
        if (h === 0) return "Sin hijos";
        if (h === 1) return "1 hijo";
        if (h === 2) return "2 hijos";
        if (h === 3) return "3 hijos";
        return "4+ hijos";
    }).sort((a, b) => {
        const order = ["Sin hijos", "1 hijo", "2 hijos", "3 hijos", "4+ hijos", "S/D"];
        return order.indexOf(a[0]) - order.indexOf(b[0]);
    });
    const proximosJubilacion = legajos
        .filter(p => { const e = calcEdad(p.nacimiento); return e !== null && e >= 60; })
        .sort((a, b) => (calcEdad(b.nacimiento) || 0) - (calcEdad(a.nacimiento) || 0));

    // Encuadre: Fuera de convenio se determina por el campo cargo
    const activos     = legajos.filter(p => !p.estado || p.estado === "Activo").length;
    const bajas       = legajos.filter(p => p.estado === "Baja").length;
    const suspendidos = legajos.filter(p => p.estado === "Suspendido").length;

    // Contrato: Período de prueba = ingresó hace 6 meses o menos
    const prueba    = legajos.filter(p => {
        const antig = calcAntiguedad(p.fechaIngreso);
        return antig !== null && antig <= 0.5;
    }).length;
    const efectivos = activos - prueba;

    // Generaciones
    const genMap = {};
    legajos.forEach(p => {
        const g = getGeneracion(p.nacimiento) || "Sin dato";
        genMap[g] = (genMap[g] || 0) + 1;
    });
    const generaciones = [
        ...ORDEN_GEN.filter(g => genMap[g] !== undefined).map(g => [g, genMap[g]]),
        ...(genMap["Sin dato"] ? [["Sin dato", genMap["Sin dato"]]] : []),
    ];

    return {
        total: legajos.length, masc, fem, oSexo, promAntig, promEdad,
        conHijos, totalHijos, tareas, proyectos, servicios, hijosDistr,
        activos, bajas, suspendidos, efectivos, prueba,
        generaciones,
        antiguedad:           rangosAntiguedad(legajos),
        edades:               rangosEdad(legajos),
        zonas:                countBy(legajos, p => p.zona       || "Sin zona"),
        cargos:               countBy(legajos, p => (p.cargo || "").trim() || "Sin cargo"),
        centrosCosto:         countBy(legajos, p => p.centroCosto || "Sin CC"),
        regimenes:            countBy(legajos, p => p.regimen    || "Sin régimen"),
        ingresosPorAnio:      ingresosPorAnio(legajos),
        antiguedadPorFuncion: antiguedadPorFuncion(legajos),
        proximosJubilacion,
    };
}

// ── Mini bar chart ─────────────────────────────────────────────────────────
function BarChart({ data, color = "var(--color-primary)", total, suffix = "" }) {
    const max = Math.max(...data.map(([, v]) => v), 1);
    return (
        <div className="dp-barchart">
            {data.map(([label, val]) => (
                <div key={label} className="dp-bar-row">
                    <div className="dp-bar-label">{label}</div>
                    <div className="dp-bar-track">
                        <div className="dp-bar-fill" style={{ "--dp-bar-w": `${(val / max) * 100}%`, "--dp-bar-color": color }} />
                    </div>
                    <div className="dp-bar-val">{val}{suffix}{total ? ` (${Math.round(val/total*100)}%)` : ""}</div>
                </div>
            ))}
        </div>
    );
}

// ── Donut sexo ─────────────────────────────────────────────────────────────
function DonutSexo({ masc, fem, otro = 0 }) {
    const total = masc + fem;
    const deg = total ? Math.round((fem / total) * 360) : 0;
    const pctM = total ? Math.round((masc / total) * 100) : 0;
    return (
        <div className="dp-donut-wrap">
            <div className="dp-donut" style={{ "--dp-deg": deg + "deg" }}>
                <div className="dp-donut-inner">
                    <div className="dp-donut-pct">{pctM}%</div>
                    <div className="dp-donut-lbl">Masc.</div>
                </div>
            </div>
            <div className="dp-donut-legend">
                <div className="dp-donut-leg-item">
                    <span className="dp-donut-dot dp-donut-dot--primary" />
                    Masculino <strong>{masc}</strong>
                </div>
                <div className="dp-donut-leg-item">
                    <span className="dp-donut-dot dp-donut-dot--fem" />
                    Femenino <strong>{fem}</strong>
                </div>
                {otro > 0 && (
                    <div className="dp-donut-leg-item" style={{ color: "#94a3b8" }}>
                        <span className="dp-donut-dot" style={{ background: "#cbd5e1" }} />
                        Sin dato <strong>{otro}</strong>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Calendario de cumpleaños ───────────────────────────────────────────────
const MESES_LARGO = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function apellido(nombre = "") {
    return nombre.trim().split(" ")[0] || nombre;
}

function CalendarioCumpleanos({ legajos }) {
    const hoy  = new Date();
    const mes  = hoy.getMonth();     // 0-based
    const año  = hoy.getFullYear();
    const hoyD = hoy.getDate();

    // Recopilar cumpleañeros del mes, ordenados por día
    const cumples = legajos
        .filter(p => {
            const d = parseFecha(p.nacimiento);
            return d ? d.getMonth() === mes : false;
        })
        .map(p => {
            const d = parseFecha(p.nacimiento);
            return { dia: d ? d.getDate() : 0, nombre: p.nombre || "" };
        })
        .sort((a, b) => a.dia - b.dia);

    return (
        <div className="dp-cumple-wrap">
            <div className="dp-cumple-titulo">🎂 Cumpleaños — {MESES_LARGO[mes]} {año}</div>
            {cumples.length === 0 ? (
                <div className="dp-cumple-vacio-msg">Sin cumpleaños este mes</div>
            ) : (
                <div className="dp-cumple-lista-mes">
                    {cumples.map((c, i) => (
                        <div key={i} className={`dp-cumple-row${c.dia === hoyD ? " dp-cumple-row--hoy" : ""}`}>
                            <span className="dp-cumple-row-dia">{c.dia}</span>
                            <span className="dp-cumple-row-nombre">{apellido(c.nombre)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Panel de estadísticas ──────────────────────────────────────────────────
function StatsPanel({ legajos, zona, proyectoMap }) {
    const stats = useMemo(() => buildStats(legajos, proyectoMap), [legajos, proyectoMap]);


    if (!stats) return <div className="dp-empty">Sin datos para esta zona.</div>;

    return (
        <>
            {/* KPIs */}
            <div className="dp-kpis">
                <div className="dp-kpi">
                    <div className="dp-kpi-val">{stats.total}</div>
                    <div className="dp-kpi-lbl">Personal total</div>
                </div>
                <div className="dp-kpi dp-kpi--blue">
                    <div className="dp-kpi-val">{stats.promAntig}</div>
                    <div className="dp-kpi-lbl">Años prom. antigüedad</div>
                </div>
                <div className="dp-kpi dp-kpi--green">
                    <div className="dp-kpi-val">{stats.promEdad}</div>
                    <div className="dp-kpi-lbl">Edad promedio</div>
                </div>
                <div className="dp-kpi dp-kpi--orange">
                    <div className="dp-kpi-val">{stats.conHijos}</div>
                    <div className="dp-kpi-lbl">Con hijos ({Math.round(stats.conHijos/stats.total*100)}%)</div>
                </div>
                <div className="dp-kpi dp-kpi--purple">
                    <div className="dp-kpi-val">{stats.totalHijos}</div>
                    <div className="dp-kpi-lbl">Hijos en total</div>
                </div>
            </div>

            {/* ── Estructura de RRHH — fila única ── */}
            <div className="dp-rrhh-row">
                {/* Encuadre — ancho fijo */}
                <div className="dp-card dp-rrhh-encuadre">
                    <div className="dp-card-title">Estado del personal</div>
                    <div className="dp-encuadre-row">
                        <div className="dp-encuadre-blk">
                            <div className="dp-encuadre-val">{stats.activos}</div>
                            <div className="dp-encuadre-lbl">Activos</div>
                        </div>
                        <div className="dp-encuadre-sep" />
                        <div className="dp-encuadre-blk dp-encuadre-blk--fc">
                            <div className="dp-encuadre-val">{stats.bajas}</div>
                            <div className="dp-encuadre-lbl">Bajas</div>
                        </div>
                        <div className="dp-encuadre-sep" />
                        <div className="dp-encuadre-blk dp-encuadre-blk--prueba">
                            <div className="dp-encuadre-val">{stats.suspendidos}</div>
                            <div className="dp-encuadre-lbl">Suspendidos</div>
                        </div>
                        <div className="dp-encuadre-sep" />
                        <div className="dp-encuadre-blk dp-encuadre-blk--prueba">
                            <div className="dp-encuadre-val">{stats.efectivos}</div>
                            <div className="dp-encuadre-lbl">Efectivos</div>
                        </div>
                        <div className="dp-encuadre-sep" />
                        <div className="dp-encuadre-blk">
                            <div className="dp-encuadre-val">{stats.prueba}</div>
                            <div className="dp-encuadre-lbl">En prueba</div>
                        </div>
                    </div>
                </div>

                {/* Género — compacto */}
                <div className="dp-card dp-rrhh-small">
                    <div className="dp-card-title">Género</div>
                    <DonutSexo masc={stats.masc} fem={stats.fem} otro={stats.oSexo} />
                </div>

                {/* Generaciones — compacto */}
                {stats.generaciones.length > 0 && (
                    <div className="dp-card dp-rrhh-small">
                        <div className="dp-card-title">Generaciones</div>
                        <div className="dp-gen-row dp-gen-row--compact">
                            {stats.generaciones.map(([gen, count]) => (
                                <div key={gen} className="dp-gen-blk">
                                    <div className="dp-gen-val">{count}</div>
                                    <div className="dp-gen-bar-wrap">
                                        <div
                                            className="dp-gen-bar"
                                            style={{ height: `${Math.max(4, Math.round((count / stats.total) * 52))}px` }}
                                        />
                                    </div>
                                    <div className="dp-gen-lbl">{gen}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Calendario cumpleaños */}
            <CalendarioCumpleanos legajos={legajos} />

            {/* Fila 1 — función + cargo + zona */}
            <div className="dp-row3">
                <div className="dp-card">
                    <div className="dp-card-title">Por función</div>
                    <BarChart data={stats.tareas} total={stats.total} />
                </div>
                <div className="dp-card">
                    <div className="dp-card-title">Por cargo</div>
                    <BarChart data={stats.cargos} color="#7c3aed" total={stats.total} />
                </div>
                <div className="dp-card">
                    <div className="dp-card-title">Por zona</div>
                    <BarChart data={stats.zonas} color="#0891b2" total={stats.total} />
                </div>
            </div>

            {/* Fila 2 — proyecto + centro de costo + régimen */}
            <div className="dp-row3">
                <div className="dp-card">
                    <div className="dp-card-title">Por proyecto / contrato</div>
                    <BarChart data={stats.proyectos} color="var(--color-success)" total={stats.total} />
                </div>
                <div className="dp-card">
                    <div className="dp-card-title">Por centro de costo</div>
                    <BarChart data={stats.centrosCosto} color="var(--color-warn)" total={stats.total} />
                </div>
                <div className="dp-card">
                    <div className="dp-card-title">Por régimen</div>
                    <BarChart data={stats.regimenes} color="#059669" total={stats.total} />
                </div>
            </div>

            {/* Fila 3 — antigüedad + antigüedad por función + rango etario */}
            <div className="dp-row3">
                <div className="dp-card">
                    <div className="dp-card-title">Antigüedad</div>
                    <BarChart data={stats.antiguedad} color="#8b5cf6" total={stats.total} />
                </div>
                <div className="dp-card">
                    <div className="dp-card-title">Antigüedad por función</div>
                    <BarChart data={stats.antiguedadPorFuncion} color="#8b5cf6" suffix=" a." />
                </div>
                <div className="dp-card">
                    <div className="dp-card-title">Rango etario</div>
                    <BarChart data={stats.edades} color="#0ea5e9" total={stats.total} />
                </div>
            </div>

            {/* Hijos + Ingresos | Personal próximo a jubilación */}
            <div className="dp-row-jubilacion">
                {/* Columna izquierda: gráficos */}
                <div className="dp-col-graficos">
                    <div className="dp-card">
                        <div className="dp-card-title">Hijos</div>
                        <BarChart data={stats.hijosDistr} color="#ec4899" total={stats.total} />
                    </div>
                    <div className="dp-card">
                        <div className="dp-card-title">Ingresos por año</div>
                        <BarChart data={stats.ingresosPorAnio} color="#d97706" />
                    </div>
                </div>

                {/* Columna derecha: tabla jubilación */}
                <div className="dp-card dp-col-jubilacion">
                <div className="dp-card-title">
                    Personal próximo a jubilación (≥ 60 años)
                    {stats.proximosJubilacion.length > 0 && (
                        <span className="dp-jubilacion-badge">{stats.proximosJubilacion.length}</span>
                    )}
                </div>
                {stats.proximosJubilacion.length === 0 ? (
                    <div className="dp-empty-inline">Sin personal de 60 años o más.</div>
                ) : (
                    <div className="dp-tabla-wrap">
                        <table className="dp-tabla">
                            <thead>
                                <tr>
                                    <th className="dp-th-center">Legajo</th>
                                    <th>Nombre</th>
                                    <th className="dp-th-center">Edad</th>
                                    <th className="dp-th-center">Antigüedad</th>
                                    <th className="dp-th-center">Función</th>
                                    <th className="dp-th-center">Servicio</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.proximosJubilacion.map((p, i) => {
                                    const edad  = calcEdad(p.nacimiento);
                                    const antig = calcAntiguedad(p.fechaIngreso);
                                    return (
                                        <tr key={p.legajo || i}>
                                            <td className="dp-td-legajo dp-td-center">{p.legajo}</td>
                                            <td className="dp-td-nombre">{p.nombre}</td>
                                            <td className="dp-td-center dp-td-alert">{edad} a.</td>
                                            <td className="dp-td-center">{antig !== null ? `${antig.toFixed(1)} a.` : "—"}</td>
                                            <td className="dp-td-center">
                                                <span className={`dp-tag dp-tag--${normalizarTarea(getRol(p)).toLowerCase()}`}>
                                                    {normalizarTarea(getRol(p))}
                                                </span>
                                            </td>
                                            <td className="dp-td-center">{p.servicio || "—"}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                </div>{/* fin dp-col-jubilacion */}
            </div>{/* fin dp-row-jubilacion */}

        </>
    );
}

// ── Componente principal ───────────────────────────────────────────────────
export default function DashboardPersonalScreen({ onBack, zonaFija, embedded }) {
    const { empresaNombre, empresaId } = useAppData();
    const { objetivos } = useClientesData(empresaId);
    const proyectoMap = useMemo(() => {
        const m = {};
        objetivos.forEach(o => { if (o.numProyecto) m[String(o.numProyecto).trim()] = o.nombreProyecto || ""; });
        return m;
    }, [objetivos]);
    const [todosLegajos, setTodosLegajos] = useState([]);
    const [loading, setLoading]           = useState(true);
    const [zonaActiva, setZonaActiva]     = useState(zonaFija ?? "todas");

    // Zonas dinámicas derivadas de los datos reales
    const ZONAS = useMemo(() => {
        const zonasUnicas = [...new Set(todosLegajos.map(p => p.zona).filter(Boolean))].sort();
        return [
            { key: "todas", label: "🌐 Todo el personal" },
            ...zonasUnicas.map(z => ({ key: z, label: z })),
        ];
    }, [todosLegajos]);

    useEffect(() => {
        const cargar = async () => {
            try {
                const snap = await getDocs(
                    query(collection(db, "legajos"), where("empresaId", "==", empresaId))
                );
                const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                // Deduplicar por legajo (el seed puede haberse cargado varias veces)
                const vistos = new Set();
                const unicos = docs.filter(p => {
                    const key = p.legajo || p.id;
                    if (vistos.has(key)) return false;
                    vistos.add(key);
                    return true;
                });
                setTodosLegajos(unicos);
            } catch (e) {
                console.error("DashboardPersonalScreen error:", e);
            } finally {
                setLoading(false);
            }
        };
        cargar();
    }, [empresaNombre]);

    const legajosFiltrados = useMemo(() => {
        if (zonaActiva === "todas") return todosLegajos;
        return todosLegajos.filter(p => !p.zona || p.zona === zonaActiva);
    }, [todosLegajos, zonaActiva]);

    if (loading) return (
        <div className="dp-loading">
            <div className="dp-spinner" />
            Cargando datos del personal…
        </div>
    );

    const zonaInfo = ZONAS.find(z => z.key === zonaActiva);
    const totalZona = legajosFiltrados.length;

    return (
        <div className="dp-root">
            {/* Header */}
            {!embedded && (
            <div className="dp-header">
                <button className="dp-back-btn" onClick={onBack}>← Volver al panel</button>
                <div className="dp-header-title">👥 Dashboard de Personal</div>
                <div className="dp-header-sub">{empresaNombre} · {todosLegajos.length} personas en total</div>
            </div>
            )}

            {/* Tabs de zona — ocultos si hay zonaFija o embedded */}
            {!zonaFija && !embedded && (
                <div className="dp-zona-tabs">
                    {ZONAS.map(z => (
                        <button
                            key={z.key}
                            className={`dp-zona-tab ${zonaActiva === z.key ? "dp-zona-tab--active" : ""}`}
                            onClick={() => setZonaActiva(z.key)}
                        >
                            {z.label}
                            <span className="dp-zona-tab-count">
                                {z.key === "todas"
                                    ? todosLegajos.length
                                    : todosLegajos.filter(p => (p.zona || p.sucursal || "") === z.key).length
                                }
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* Stats del tab activo */}
            <StatsPanel legajos={legajosFiltrados} zona={zonaActiva} proyectoMap={proyectoMap} />
        </div>
    );
}
