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
function getGeneracion(nacimiento) {
    if (!nacimiento) return null;
    const y = parseInt(nacimiento.split("/")[2]);
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
        if (!p.fechaIngreso) return;
        const y = p.fechaIngreso.split("/")[2];
        if (!y || y.length !== 4 || parseInt(y) < 2013) return;
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

    // Encuadre: Fuera de convenio = Jefes/Supervisores FC, el resto = Convenio
    const fueraConv = legajos.filter(p => {
        const t = normalizarTarea(p.tarea);
        return t === "Jefe" || (p.encuadre || "").toLowerCase().includes("fuera");
    }).length;
    const convenio = legajos.length - fueraConv;

    // Contrato: Efectivo vs Prueba (usa campo tipoContrato si existe, sino cuenta efectivos)
    const prueba    = legajos.filter(p => (p.tipoContrato || "").toLowerCase().includes("prueba")).length;
    const efectivos = legajos.length - prueba;

    // Generaciones
    const genMap = {};
    legajos.forEach(p => {
        const g = getGeneracion(p.nacimiento);
        if (!g) return;
        genMap[g] = (genMap[g] || 0) + 1;
    });
    const generaciones = ORDEN_GEN
        .filter(g => genMap[g] !== undefined)
        .map(g => [g, genMap[g]]);

    return {
        total: legajos.length, masc, fem, promAntig, promEdad,
        conHijos, totalHijos, tareas, proyectos, servicios, hijosDistr,
        convenio, fueraConv, efectivos, prueba,
        generaciones,
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
                    <div className="dp-card-title">Encuadre</div>
                    <div className="dp-encuadre-row">
                        <div className="dp-encuadre-blk">
                            <div className="dp-encuadre-val">{stats.convenio}</div>
                            <div className="dp-encuadre-lbl">Convenio</div>
                        </div>
                        <div className="dp-encuadre-sep" />
                        <div className="dp-encuadre-blk dp-encuadre-blk--fc">
                            <div className="dp-encuadre-val">{stats.fueraConv}</div>
                            <div className="dp-encuadre-lbl">Fuera de convenio</div>
                        </div>
                        <div className="dp-encuadre-sep" />
                        <div className="dp-encuadre-blk dp-encuadre-blk--prueba">
                            <div className="dp-encuadre-val">{stats.efectivos}</div>
                            <div className="dp-encuadre-lbl">Efectivos</div>
                        </div>
                        <div className="dp-encuadre-sep" />
                        <div className="dp-encuadre-blk dp-encuadre-blk--prueba">
                            <div className="dp-encuadre-val">{stats.prueba}</div>
                            <div className="dp-encuadre-lbl">En prueba</div>
                        </div>
                    </div>
                </div>

                {/* Género — compacto */}
                <div className="dp-card dp-rrhh-small">
                    <div className="dp-card-title">Género</div>
                    <DonutSexo masc={stats.masc} fem={stats.fem} />
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

            {/* Fila 1 — función + cargo + sucursal */}
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
                    <div className="dp-card-title">Por sucursal</div>
                    <BarChart data={stats.sucursales} color="#0891b2" total={stats.total} />
                </div>
            </div>

            {/* Fila 2 — proyecto + objetivo + centro de costo */}
            <div className="dp-row3">
                <div className="dp-card">
                    <div className="dp-card-title">Por proyecto / contrato</div>
                    <BarChart data={stats.proyectos} color="var(--color-success)" total={stats.total} />
                </div>
                <div className="dp-card">
                    <div className="dp-card-title">Por servicio / objetivo</div>
                    <BarChart data={stats.servicios.slice(0, 10)} color="var(--color-warn)" total={stats.total} />
                </div>
                <div className="dp-card">
                    <div className="dp-card-title">Por centro de costo</div>
                    <BarChart data={stats.centrosCosto} color="#059669" total={stats.total} />
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

            {/* Hijos + Ingresos */}
            <div className="dp-row2">
                <div className="dp-card">
                    <div className="dp-card-title">Hijos</div>
                    <BarChart data={stats.hijosDistr} color="#ec4899" total={stats.total} />
                </div>
                <div className="dp-card">
                    <div className="dp-card-title">Ingresos por año</div>
                    <BarChart data={stats.ingresosPorAnio} color="#d97706" total={stats.total} />
                </div>
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

        </>
    );
}

// ── Componente principal ───────────────────────────────────────────────────
const ZONAS = [
    { key: "todas",        label: "🌐 Todo el personal" },
    { key: "Buenos Aires", label: "🏙️ Buenos Aires"     },
    { key: "Santa Cruz",   label: "⛏️ Santa Cruz"       },
];

export default function DashboardPersonalScreen({ onBack, zonaFija }) {
    const { empresaNombre } = useAppData();
    const [todosLegajos, setTodosLegajos] = useState([]);
    const [loading, setLoading]           = useState(true);
    const [zonaActiva, setZonaActiva]     = useState(zonaFija ?? "todas");

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

            {/* Tabs de zona — ocultos si hay zonaFija */}
            {!zonaFija && (
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
            <StatsPanel legajos={legajosFiltrados} zona={zonaActiva} />
        </div>
    );
}
