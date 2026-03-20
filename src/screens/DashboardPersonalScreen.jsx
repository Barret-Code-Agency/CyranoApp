// src/screens/DashboardPersonalScreen.jsx
import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAppData } from "../context/AppDataContext";
import { LEGAJOS_SEED } from "../data/legajosSeed";
import "../styles/DashboardPersonalScreen.css";

// ── Helpers ────────────────────────────────────────────────────────────────
function calcAntiguedad(fecha) {
    if (!fecha) return null;
    const [d, m, y] = fecha.split("/").map(Number);
    if (!y) return null;
    const diff = (Date.now() - new Date(y, m - 1, d)) / (1000 * 60 * 60 * 24 * 365.25);
    return isNaN(diff) ? null : diff;
}
function calcEdad(fecha) {
    if (!fecha) return null;
    const [d, m, y] = fecha.split("/").map(Number);
    if (!y) return null;
    const diff = (Date.now() - new Date(y, m - 1, d)) / (1000 * 60 * 60 * 24 * 365.25);
    return isNaN(diff) ? null : Math.floor(diff);
}
function normalizarTarea(t = "") {
    const v = t.trim().toLowerCase();
    if (v.includes("conductor") || v.includes("conducor")) return "Conductor";
    if (v.includes("operador")) return "Operador";
    if (v.includes("encargado")) return "Encargado";
    if (v.includes("supervisor")) return "Supervisor";
    if (v.includes("jefe")) return "Jefe";
    if (v.includes("receptionist") || v.includes("rececpion") || v.includes("administrativo")) return "Administrativo";
    if (v.includes("vigilador")) return "Vigilador";
    return t || "Otro";
}
function countBy(arr, fn) {
    const map = {};
    arr.forEach(x => { const k = fn(x); map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
}
function rangosAntiguedad(legajos) {
    const rangos = { "< 2 años": 0, "2–5 años": 0, "5–10 años": 0, "> 10 años": 0 };
    legajos.forEach(p => {
        const a = calcAntiguedad(p.fechaIngreso);
        if (a === null) return;
        if (a < 2) rangos["< 2 años"]++;
        else if (a < 5) rangos["2–5 años"]++;
        else if (a < 10) rangos["5–10 años"]++;
        else rangos["> 10 años"]++;
    });
    return Object.entries(rangos);
}
function rangosEdad(legajos) {
    const rangos = { "< 30": 0, "30–39": 0, "40–49": 0, "50–59": 0, "≥ 60": 0 };
    legajos.forEach(p => {
        const e = calcEdad(p.nacimiento);
        if (e === null) return;
        if (e < 30) rangos["< 30"]++;
        else if (e < 40) rangos["30–39"]++;
        else if (e < 50) rangos["40–49"]++;
        else if (e < 60) rangos["50–59"]++;
        else rangos["≥ 60"]++;
    });
    return Object.entries(rangos);
}
function ingresosPorAnio(legajos) {
    const map = {};
    legajos.forEach(p => {
        if (!p.fechaIngreso) return;
        const y = p.fechaIngreso.split("/")[2];
        if (!y || y.length !== 4) return;
        map[y] = (map[y] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
}
function antiguedadPorFuncion(legajos) {
    const map = {};
    legajos.forEach(p => {
        const fn = normalizarTarea(p.tarea);
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

function buildStats(legajos) {
    if (!legajos.length) return null;
    const masc = legajos.filter(p => p.sexo === "M").length;
    const fem  = legajos.filter(p => p.sexo === "F").length;
    const antiguedades = legajos.map(p => calcAntiguedad(p.fechaIngreso)).filter(Boolean);
    const promAntig = antiguedades.length
        ? (antiguedades.reduce((s, a) => s + a, 0) / antiguedades.length).toFixed(1) : "—";
    const edades = legajos.map(p => calcEdad(p.nacimiento)).filter(Boolean);
    const promEdad = edades.length
        ? Math.round(edades.reduce((s, e) => s + e, 0) / edades.length) : "—";
    const conHijos   = legajos.filter(p => parseInt(p.hijos) > 0).length;
    const totalHijos = legajos.reduce((s, p) => s + (parseInt(p.hijos) || 0), 0);
    const tareas    = countBy(legajos, p => normalizarTarea(p.tarea));
    const proyectos = countBy(legajos, p => p.proyecto || "Sin proyecto");
    const servicios = countBy(legajos, p => p.servicio || "Sin servicio");
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

    return {
        total: legajos.length, masc, fem, promAntig, promEdad,
        conHijos, totalHijos, tareas, proyectos, servicios, hijosDistr,
        antiguedad: rangosAntiguedad(legajos),
        edades: rangosEdad(legajos),
        sucursales:           countBy(legajos, p => p.sucursal   || "Sin sucursal"),
        cargos:               countBy(legajos, p => p.cargo      || "Sin cargo"),
        centrosCosto:         countBy(legajos, p => p.centroCosto || "Sin CC"),
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
function DonutSexo({ masc, fem }) {
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
            </div>
        </div>
    );
}

// ── Calendario de cumpleaños ───────────────────────────────────────────────
const DIAS_ES  = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function CalendarioCumpleanos({ legajos }) {
    const hoy = new Date();
    const dias = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(hoy);
        d.setDate(hoy.getDate() + i);
        return d;
    });

    const cumplesPorDia = dias.map(d => {
        const mes = d.getMonth() + 1;
        const dia = d.getDate();
        const personas = legajos.filter(p => {
            if (!p.nacimiento) return false;
            const parts = p.nacimiento.split("/");
            return parseInt(parts[0]) === dia && parseInt(parts[1]) === mes;
        });
        return { fecha: d, personas };
    });

    return (
        <div className="dp-cumple-wrap">
            <div className="dp-cumple-titulo">🎂 Cumpleaños — próximos 7 días</div>
            <div className="dp-cumple-strip">
                {cumplesPorDia.map(({ fecha, personas }, i) => (
                    <div
                        key={i}
                        className={[
                            "dp-cumple-dia",
                            i === 0          ? "dp-cumple-dia--hoy"   : "",
                            personas.length  ? "dp-cumple-dia--tiene" : "",
                        ].join(" ")}
                    >
                        <div className="dp-cumple-dayname">{DIAS_ES[fecha.getDay()]}</div>
                        <div className="dp-cumple-daynum">{fecha.getDate()}</div>
                        <div className="dp-cumple-mes">{MESES_ES[fecha.getMonth()]}</div>
                        <div className="dp-cumple-lista">
                            {personas.length === 0
                                ? <span className="dp-cumple-vacio">—</span>
                                : personas.map((p, j) => (
                                    <span key={j} className="dp-cumple-nombre">
                                        🎂 {p.nombre?.split(" ")[0]}
                                    </span>
                                ))
                            }
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Panel de estadísticas ──────────────────────────────────────────────────
function StatsPanel({ legajos, zona }) {
    const stats = useMemo(() => buildStats(legajos), [legajos]);

    const [busqueda, setBusqueda]         = useState("");
    const [filtroCargo, setFiltroCargo]   = useState("Todos");
    const [filtroProyecto, setFiltroProyecto] = useState("Todos");

    const tablaFiltrada = useMemo(() => {
        const q = busqueda.toLowerCase();
        return legajos.filter(p => {
            const matchBusq = !q ||
                (p.nombre || "").toLowerCase().includes(q) ||
                (p.legajo || "").toLowerCase().includes(q) ||
                (p.servicio || "").toLowerCase().includes(q);
            const matchCargo = filtroCargo === "Todos" || normalizarTarea(p.tarea) === filtroCargo;
            const matchProy  = filtroProyecto === "Todos" || p.proyecto === filtroProyecto;
            return matchBusq && matchCargo && matchProy;
        }).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
    }, [legajos, busqueda, filtroCargo, filtroProyecto]);

    const proyectosUnicos = ["Todos", ...new Set(legajos.map(p => p.proyecto).filter(Boolean))];
    const cargosUnicos    = ["Todos", ...new Set(legajos.map(p => normalizarTarea(p.tarea)).filter(Boolean))];

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

            {/* Calendario cumpleaños */}
            <CalendarioCumpleanos legajos={legajos} />

            {/* Fila 1 */}
            <div className="dp-row2">
                <div className="dp-card">
                    <div className="dp-card-title">Distribución por sexo</div>
                    <DonutSexo masc={stats.masc} fem={stats.fem} />
                </div>
                <div className="dp-card">
                    <div className="dp-card-title">Por función</div>
                    <BarChart data={stats.tareas} total={stats.total} />
                </div>
            </div>

            {/* Fila 2 */}
            <div className="dp-row2">
                <div className="dp-card">
                    <div className="dp-card-title">Por proyecto / contrato</div>
                    <BarChart data={stats.proyectos} color="var(--color-success)" total={stats.total} />
                </div>
                <div className="dp-card">
                    <div className="dp-card-title">Por servicio / objetivo</div>
                    <BarChart data={stats.servicios.slice(0, 10)} color="var(--color-warn)" total={stats.total} />
                </div>
            </div>

            {/* Fila 3 */}
            <div className="dp-row2">
                <div className="dp-card">
                    <div className="dp-card-title">Antigüedad</div>
                    <BarChart data={stats.antiguedad} color="#8b5cf6" total={stats.total} />
                </div>
                <div className="dp-card">
                    <div className="dp-card-title">Rango etario</div>
                    <BarChart data={stats.edades} color="#0ea5e9" total={stats.total} />
                </div>
            </div>

            {/* Hijos */}
            <div className="dp-card dp-card--full">
                <div className="dp-card-title">Distribución de hijos</div>
                <BarChart data={stats.hijosDistr} color="#ec4899" total={stats.total} />
            </div>

            {/* Fila 4 */}
            <div className="dp-row2">
                <div className="dp-card">
                    <div className="dp-card-title">Por sucursal</div>
                    <BarChart data={stats.sucursales} color="#0891b2" total={stats.total} />
                </div>
                <div className="dp-card">
                    <div className="dp-card-title">Por cargo</div>
                    <BarChart data={stats.cargos} color="#7c3aed" total={stats.total} />
                </div>
            </div>

            {/* Fila 5 */}
            <div className="dp-row2">
                <div className="dp-card">
                    <div className="dp-card-title">Por centro de costo</div>
                    <BarChart data={stats.centrosCosto} color="#059669" total={stats.total} />
                </div>
                <div className="dp-card">
                    <div className="dp-card-title">Ingresos por año</div>
                    <BarChart data={stats.ingresosPorAnio} color="#d97706" total={stats.total} />
                </div>
            </div>

            {/* Antigüedad promedio por función */}
            <div className="dp-card dp-card--full">
                <div className="dp-card-title">Antigüedad promedio por función</div>
                <BarChart data={stats.antiguedadPorFuncion} color="#8b5cf6" suffix=" a." />
            </div>

            {/* Personal próximo a jubilación */}
            <div className="dp-card dp-card--full">
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
                                    <th>Legajo</th>
                                    <th>Nombre</th>
                                    <th>Edad</th>
                                    <th>Antigüedad</th>
                                    <th>Función</th>
                                    <th>Servicio</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.proximosJubilacion.map((p, i) => {
                                    const edad  = calcEdad(p.nacimiento);
                                    const antig = calcAntiguedad(p.fechaIngreso);
                                    return (
                                        <tr key={p.legajo || i}>
                                            <td className="dp-td-legajo">{p.legajo}</td>
                                            <td className="dp-td-nombre">{p.nombre}</td>
                                            <td className="dp-td-num dp-td-alert">{edad} a.</td>
                                            <td className="dp-td-num">{antig !== null ? `${antig.toFixed(1)} a.` : "—"}</td>
                                            <td>
                                                <span className={`dp-tag dp-tag--${normalizarTarea(p.tarea).toLowerCase()}`}>
                                                    {normalizarTarea(p.tarea)}
                                                </span>
                                            </td>
                                            <td>{p.servicio || "—"}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Tabla */}
            <div className="dp-card dp-card--full">
                <div className="dp-card-title">Listado del personal</div>
                <div className="dp-tabla-filtros">
                    <input
                        className="dp-search"
                        placeholder="🔍 Buscar por nombre, legajo o servicio…"
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                    />
                    <select className="dp-select" value={filtroCargo} onChange={e => setFiltroCargo(e.target.value)}>
                        {cargosUnicos.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <select className="dp-select" value={filtroProyecto} onChange={e => setFiltroProyecto(e.target.value)}>
                        {proyectosUnicos.map(p => <option key={p}>{p}</option>)}
                    </select>
                    <span className="dp-tabla-count">{tablaFiltrada.length} resultados</span>
                </div>
                <div className="dp-tabla-wrap">
                    <table className="dp-tabla">
                        <thead>
                            <tr>
                                <th>Legajo</th>
                                <th>Nombre</th>
                                <th>Función</th>
                                <th>Cargo</th>
                                <th>Servicio</th>
                                <th>Proyecto</th>
                                <th>Antigüedad</th>
                                <th>Edad</th>
                                <th>Hijos</th>
                                <th>Sexo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tablaFiltrada.map((p, i) => {
                                const antig = calcAntiguedad(p.fechaIngreso);
                                const edad  = calcEdad(p.nacimiento);
                                return (
                                    <tr key={p.id || p.legajo || i}>
                                        <td className="dp-td-legajo">{p.legajo}</td>
                                        <td className="dp-td-nombre">{p.nombre}</td>
                                        <td>
                                            <span className={`dp-tag dp-tag--${normalizarTarea(p.tarea).toLowerCase()}`}>
                                                {normalizarTarea(p.tarea)}
                                            </span>
                                        </td>
                                        <td className="dp-td-muted">{p.cargo}</td>
                                        <td>{p.servicio || "—"}</td>
                                        <td className="dp-td-muted">{p.proyecto || "—"}</td>
                                        <td className="dp-td-num">{antig !== null ? `${antig.toFixed(1)} a.` : "—"}</td>
                                        <td className="dp-td-num">{edad !== null ? edad : "—"}</td>
                                        <td className="dp-td-num">{p.hijos !== "" ? p.hijos : "—"}</td>
                                        <td>
                                            <span className={`dp-sexo-badge ${p.sexo === "F" ? "dp-sexo-badge--f" : ""}`}>
                                                {p.sexo === "F" ? "♀" : "♂"}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

// ── Componente principal ───────────────────────────────────────────────────
const ZONAS = [
    { key: "todas",        label: "🌐 Todo el personal" },
    { key: "Buenos Aires", label: "🏙️ Buenos Aires"     },
    { key: "Santa Cruz",   label: "⛏️ Santa Cruz"       },
];

export default function DashboardPersonalScreen({ onBack }) {
    const { empresaNombre } = useAppData();
    const [todosLegajos, setTodosLegajos] = useState([]);
    const [loading, setLoading]           = useState(true);
    const [zonaActiva, setZonaActiva]     = useState("todas");

    useEffect(() => {
        const cargar = async () => {
            try {
                const snap = await getDocs(
                    query(collection(db, "legajos"), where("empresa", "==", empresaNombre))
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
                setTodosLegajos(unicos.length ? unicos : LEGAJOS_SEED);
            } catch {
                setTodosLegajos(LEGAJOS_SEED);
            } finally {
                setLoading(false);
            }
        };
        cargar();
    }, [empresaNombre]);

    const legajosFiltrados = useMemo(() => {
        if (zonaActiva === "todas") return todosLegajos;
        return todosLegajos.filter(p => (p.zona || p.sucursal || "") === zonaActiva);
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
            <div className="dp-header">
                <button className="dp-back-btn" onClick={onBack}>← Volver</button>
                <div className="dp-header-title">👥 Dashboard de Personal</div>
                <div className="dp-header-sub">{empresaNombre} · {todosLegajos.length} personas en total</div>
            </div>

            {/* Tabs de zona */}
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

            {/* Stats del tab activo */}
            <StatsPanel legajos={legajosFiltrados} zona={zonaActiva} />
        </div>
    );
}
