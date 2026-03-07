// src/screens/AnalistaDashboard.jsx
// Vista de analista: dashboard filtrado por zona/objetivos asignados. Solo lectura.
import { useState, useMemo } from "react";
import { useAppData } from "../context/AppDataContext";

const toMin = (t) => { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
const diffMin = (a, b) => { if (!a || !b) return 0; let d = toMin(b) - toMin(a); if (d < 0) d += 1440; return Math.max(d, 0); };
const parseKm = (j) => { const k = Number(j.kmFinal || 0) - Number(j.kmInicial || 0); return k > 0 ? k : 0; };
const pct = (v, t) => t > 0 ? Math.min(Math.round(v / t * 100), 100) : 0;

const PERIODOS = [
    { key: "7", label: "7 días" },
    { key: "30", label: "30 días" },
    { key: "todo", label: "Todo" },
];

function Tag({ children, color = "#003087" }) {
    return (
        <span style={{
            background: color + "18", color, border: `1px solid ${color}40`,
            borderRadius: 99, padding: "2px 8px", fontSize: 11, fontWeight: 700
        }}>{children}</span>
    );
}

function KpiCard({ icon, label, value, color = "var(--color-primary)" }) {
    return (
        <div style={{ background: "#fff", border: "1px solid var(--color-border)", borderRadius: 10,
            padding: "12px 10px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,45,114,0.07)" }}>
            <div style={{ fontSize: 20 }}>{icon}</div>
            <div style={{ fontWeight: 800, fontSize: 22, color, lineHeight: 1.1, marginTop: 4 }}>{value}</div>
            <div style={{ fontSize: 10, color: "var(--color-muted)", marginTop: 2, fontWeight: 600 }}>{label}</div>
        </div>
    );
}

export default function AnalistaDashboard({ user }) {
    const { jornadas, data, plan: planGlobal } = useAppData();
    const [periodo, setPeriodo] = useState("30");

    const objVisibles = user.objetivosVisibles?.length > 0 ? user.objetivosVisibles : null;
    const vehVisibles = user.vehiculosVisibles?.length > 0 ? user.vehiculosVisibles : null;
    const supVisibles = user.supervisoresVisibles?.length > 0 ? user.supervisoresVisibles : null;
    const zona        = user.zona || "Mi zona";

    // Filter jornadas by period
    const jornadasFiltradas = useMemo(() => {
        const hoy = new Date(); hoy.setHours(23, 59, 59, 999);
        return jornadas.filter(j => {
            if (periodo !== "todo") {
                const dias = Number(periodo);
                const desde = new Date(hoy); desde.setDate(hoy.getDate() - dias); desde.setHours(0,0,0,0);
                const jFecha = new Date(j.creadaEn || j.fecha || 0);
                if (jFecha < desde) return false;
            }
            // Filtrar por supervisores de la zona
            if (supVisibles && supVisibles.length > 0) {
                const nombreJ = (j.nombre || "").trim();
                // match parcial: el nombre en la jornada puede ser "Apellido, Nombre"
                const match = supVisibles.some(s =>
                    nombreJ.toLowerCase().includes(s.toLowerCase()) ||
                    s.toLowerCase().includes(nombreJ.toLowerCase())
                );
                if (!match) return false;
            }
            // Filtrar por vehículos asignados
            if (vehVisibles && vehVisibles.length > 0 && j.vehiculo && !vehVisibles.includes(j.vehiculo)) return false;
            return true;
        });
    }, [jornadas, periodo, vehVisibles, supVisibles]);

    // All controls from filtered jornadas
    const controles = useMemo(() =>
        jornadasFiltradas.flatMap(j => (j.actividades || [])
            .filter(a => a.tipo === "ctrl")
            .map(a => ({ ...a, jornada: j }))
        ), [jornadasFiltradas]);

    // Controls filtered by visible objetivos
    const controlesFiltrados = useMemo(() =>
        objVisibles
            ? controles.filter(c => objVisibles.includes(c.objetivo))
            : controles
    , [controles, objVisibles]);

    // Stats
    const totalKm = jornadasFiltradas.reduce((s, j) => s + parseKm(j), 0);
    const totalJornadas = jornadasFiltradas.length;
    const anomalias = controlesFiltrados.filter(c => c.anomalia === "Sí").length;

    // Supervisores que operan en esta zona (tienen jornadas en período)
    const supervisores = useMemo(() => {
        const map = {};
        jornadasFiltradas.forEach(j => {
            if (!map[j.nombre]) map[j.nombre] = { nombre: j.nombre, jornadas: 0, controles: 0, km: 0 };
            map[j.nombre].jornadas++;
            map[j.nombre].km += parseKm(j);
            map[j.nombre].controles += (j.actividades || []).filter(a => {
                if (a.tipo !== "ctrl") return false;
                return !objVisibles || objVisibles.includes(a.objetivo);
            }).length;
        });
        return Object.values(map).sort((a, b) => b.controles - a.controles);
    }, [jornadasFiltradas, objVisibles]);

    // Objetivos: visitas realizadas vs plan
    const objetivosStats = useMemo(() => {
        const lista = objVisibles || data.objetivos || [];
        return lista.map(obj => {
            const visitas = controlesFiltrados.filter(c => c.objetivo === obj).length;
            const planObj = planGlobal?.find?.(p => p.objetivo === obj);
            return { obj, visitas, planSemana: planObj?.visitasPorSemana || null };
        }).sort((a, b) => b.visitas - a.visitas);
    }, [controlesFiltrados, objVisibles, data.objetivos, planGlobal]);

    // Vehículos de la zona
    const vehiculosStats = useMemo(() => {
        const lista = vehVisibles || [];
        return lista.map(veh => {
            const jorns = jornadasFiltradas.filter(j => j.vehiculo === veh);
            const kmTotal = jorns.reduce((s, j) => s + parseKm(j), 0);
            const ultimo = jorns.sort((a,b) => (b.fecha||"") > (a.fecha||"") ? 1 : -1)[0];
            return { veh, usos: jorns.length, kmTotal, kmUltimo: ultimo?.kmFinal || null, fecha: ultimo?.fecha || null };
        });
    }, [jornadasFiltradas, vehVisibles]);

    return (
        <div style={{ marginBottom: 16 }}>
            {/* Header */}
            <div style={{ background: "linear-gradient(135deg, #fff8d6, #fffef5)",
                border: "1.5px solid #d4a820", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#7a5c00", letterSpacing: 2, textTransform: "uppercase" }}>
                            📊 Vista Analista
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: "#0d1b3e" }}>Zona {zona}</div>
                        <div style={{ fontSize: 11, color: "#8894ac", marginTop: 2 }}>
                            {supVisibles ? supVisibles.length + " supervisores" : "Todos los supervisores"}
                            {objVisibles ? " · " + objVisibles.length + " objetivos" : ""}
                            {vehVisibles ? " · " + vehVisibles.length + " vehículos" : ""}
                        </div>
                    </div>
                    {/* Periodo selector */}
                    <div style={{ display: "flex", gap: 4 }}>
                        {PERIODOS.map(p => (
                            <button key={p.key} onClick={() => setPeriodo(p.key)}
                                style={{ padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700,
                                    cursor: "pointer", border: "1.5px solid",
                                    borderColor: periodo === p.key ? "#c9a227" : "var(--color-border)",
                                    background: periodo === p.key ? "#c9a227" : "transparent",
                                    color: periodo === p.key ? "#fff" : "var(--color-muted)" }}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 12 }}>
                <KpiCard icon="📋" label="Jornadas" value={totalJornadas} color="#003087" />
                <KpiCard icon="🎯" label="Controles" value={controlesFiltrados.length} color="#003087" />
                <KpiCard icon="🚗" label="Km totales" value={totalKm > 0 ? totalKm + " km" : "—"} color="#10b981" />
                <KpiCard icon="⚠️" label="Anomalías" value={anomalias} color={anomalias > 0 ? "#e20113" : "#8894ac"} />
            </div>

            {/* Supervisores de la zona */}
            {supervisores.length > 0 && (
                <div style={{ background: "#fff", border: "1px solid var(--color-border)", borderRadius: 10,
                    padding: 14, marginBottom: 10, boxShadow: "0 1px 4px rgba(0,45,114,0.07)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0d1b3e", marginBottom: 10,
                        borderBottom: "2px solid #c9a227", paddingBottom: 6 }}>
                        👮 Supervisores activos en la zona
                    </div>
                    {supervisores.map((s, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between",
                            alignItems: "center", padding: "6px 0",
                            borderBottom: i < supervisores.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>
                                {s.nombre?.split(" ").slice(0,2).join(" ") || "—"}
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                                <Tag color="#003087">{s.jornadas} jorn.</Tag>
                                <Tag color="#e20113">{s.controles} ctrl.</Tag>
                                {s.km > 0 && <Tag color="#10b981">{s.km} km</Tag>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Objetivos */}
            {objetivosStats.length > 0 && (
                <div style={{ background: "#fff", border: "1px solid var(--color-border)", borderRadius: 10,
                    padding: 14, marginBottom: 10, boxShadow: "0 1px 4px rgba(0,45,114,0.07)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0d1b3e", marginBottom: 10,
                        borderBottom: "2px solid #c9a227", paddingBottom: 6 }}>
                        🎯 Objetivos asignados
                    </div>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                                <tr style={{ background: "#f8f9fc" }}>
                                    <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 700 }}>Puesto</th>
                                    <th style={{ padding: "6px 8px", fontWeight: 700 }}>Visitas</th>
                                    <th style={{ padding: "6px 8px", fontWeight: 700 }}>Plan/sem</th>
                                    <th style={{ padding: "6px 8px", fontWeight: 700 }}>Cumpl.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {objetivosStats.map(({ obj, visitas, planSemana }, i) => {
                                    const cumpl = planSemana ? pct(visitas, planSemana * 4) : null;
                                    return (
                                        <tr key={i} style={{ borderTop: "1px solid #f0f2f7" }}>
                                            <td style={{ padding: "6px 8px", fontWeight: 600, maxWidth: 160,
                                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {obj}
                                            </td>
                                            <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700,
                                                color: visitas > 0 ? "#003087" : "#aaa" }}>
                                                {visitas}
                                            </td>
                                            <td style={{ padding: "6px 8px", textAlign: "center", color: "#8894ac" }}>
                                                {planSemana || "—"}
                                            </td>
                                            <td style={{ padding: "6px 8px", textAlign: "center" }}>
                                                {cumpl !== null
                                                    ? <span style={{ fontWeight: 700, fontSize: 11, padding: "2px 7px", borderRadius: 99,
                                                        background: cumpl >= 80 ? "#f0fdf4" : cumpl >= 50 ? "#fef3c7" : "#fef2f2",
                                                        color: cumpl >= 80 ? "#16a34a" : cumpl >= 50 ? "#92400e" : "#dc2626" }}>
                                                        {cumpl}%
                                                      </span>
                                                    : "—"}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Vehículos de la zona */}
            {vehiculosStats.length > 0 && (
                <div style={{ background: "#fff", border: "1px solid var(--color-border)", borderRadius: 10,
                    padding: 14, marginBottom: 10, boxShadow: "0 1px 4px rgba(0,45,114,0.07)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0d1b3e", marginBottom: 10,
                        borderBottom: "2px solid #c9a227", paddingBottom: 6 }}>
                        🚗 Vehículos de la zona
                    </div>
                    {vehiculosStats.map((v, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between",
                            alignItems: "center", padding: "6px 0",
                            borderBottom: i < vehiculosStats.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                            <div style={{ fontWeight: 600, fontSize: 12 }}>{v.veh}</div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                {v.usos > 0 && <Tag color="#003087">{v.usos} usos</Tag>}
                                {v.kmTotal > 0 && <Tag color="#10b981">{v.kmTotal} km</Tag>}
                                {v.kmUltimo && <span style={{ fontSize: 11, color: "#8894ac" }}>
                                    Últ: {Number(v.kmUltimo).toLocaleString("es-AR")} km
                                </span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {totalJornadas === 0 && (
                <div style={{ textAlign: "center", padding: 24, color: "#8894ac", fontSize: 13 }}>
                    📊 Sin jornadas en este período para la zona asignada.
                </div>
            )}
        </div>
    );
}
